#Requires -Version 5.1
<#
  code-shop 把网站注册成【计划任务】——一劳永逸解决"注销登录后网站掉线"

  为什么需要它：
    站点是用控制台窗口（启动.bat）跑 node 的。这类进程属于当前 RDP 会话，
    一旦你【注销登录】（不是断开连接）或服务器重启，进程就被结束，网站随之掉线。
    注册成计划任务后：开机自动启动、以 SYSTEM 身份运行、与你是否登录无关。

  用法（服务器上以【管理员】身份运行）：
    powershell -ExecutionPolicy Bypass -File .\注册服务.ps1
    powershell -ExecutionPolicy Bypass -File .\注册服务.ps1 -InstallDir "C:\你的\code-shop"

  之后：
    启动服务.bat   /  schtasks /run /tn "code-shop-server"
    停止服务.bat   /  schtasks /end /tn "code-shop-server"
    运行日志：安装目录\server\logs\service.log
#>
[CmdletBinding()]
param(
  [string]$InstallDir = '',
  [string]$TaskName = 'code-shop-server',
  [switch]$DryRun
)

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

function Say { param([string]$m, [string]$c = 'Gray') Write-Host $m -ForegroundColor $c }
function Head { param([string]$m) Say ""; Say ("=" * 64) 'DarkCyan'; Say "  $m" 'Cyan'; Say ("=" * 64) 'DarkCyan' }

$idw = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($idw)).IsInRole(
      [Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Say "  [错误] 请以【管理员】身份运行" 'Red'; exit 1
}

function Get-PortOwners {
  param([int]$Port)
  $ids = @()
  if ($Port -le 0) { return @() }
  try { $ids += @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess) } catch { }
  if (@($ids).Count -eq 0) {
    try {
      foreach ($line in (& netstat.exe -ano 2>$null)) {
        if ($line -match ("^\s*TCP\s+\S+:" + $Port + "\s+\S+\s+LISTENING\s+(\d+)\s*$")) { $ids += [int]$Matches[1] }
      }
    } catch { }
  }
  return @($ids | Where-Object { $_ -and $_ -gt 0 } | Sort-Object -Unique)
}
function Read-EnvValue {
  param([string]$envPath, [string]$key)
  if (-not (Test-Path -LiteralPath $envPath)) { return '' }
  foreach ($line in (Get-Content -LiteralPath $envPath -Encoding UTF8 -ErrorAction SilentlyContinue)) {
    if ($line -match ("^\s*" + [regex]::Escape($key) + "\s*=\s*(.+?)\s*$")) { return $Matches[1].Trim('"', "'") }
  }
  return ''
}
function Test-InstallRoot { param([string]$Root) return ($Root -and (Test-Path -LiteralPath (Join-Path $Root 'server\src\index.js'))) }

Head "code-shop 注册为计划任务（网站不再因注销而掉线）"
Say ("  时间: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

# --- 1. 找 node.exe ------------------------------------------------------
$nodeExe = ''
try { $nodeExe = (Get-Command node.exe -ErrorAction Stop).Source } catch { }
if (-not $nodeExe) {
  foreach ($p in @("$env:ProgramFiles\nodejs\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe", "$env:LOCALAPPDATA\Programs\nodejs\node.exe")) {
    if (Test-Path -LiteralPath $p) { $nodeExe = $p; break }
  }
}
if (-not $nodeExe) { Say "  [错误] 找不到 node.exe，请确认已安装 Node.js 且在 PATH 中" 'Red'; exit 1 }
Say ("  node.exe: {0}" -f $nodeExe) 'Green'

# --- 2. 定位安装目录 -----------------------------------------------------
$PKG = $PSScriptRoot
if ($InstallDir) {
  if (-not (Test-InstallRoot -Root $InstallDir)) { Say ("  [错误] 目录不像 code-shop 安装目录: " + $InstallDir) 'Red'; exit 1 }
  $target = $InstallDir
} else {
  Say "  正在查找已有安装目录（可能几十秒）..."
  $list = New-Object System.Collections.ArrayList
  $roots = @('C:\Users', 'C:\www', 'C:\sites', 'C:\app', 'C:\code-shop', 'D:\', 'E:\', 'F:\')
  foreach ($r in $roots) {
    if (-not (Test-Path -LiteralPath $r)) { continue }
    try {
      Get-ChildItem -LiteralPath $r -Recurse -Depth 6 -Filter 'index.js' -ErrorAction Stop |
        Where-Object { $_.FullName -match '\\server\\src\\index\.js$' } |
        ForEach-Object {
          $root = Split-Path (Split-Path (Split-Path $_.FullName -Parent) -Parent) -Parent
          if ($root -and -not ($list | Where-Object { $_ -eq $root })) { [void]$list.Add($root) }
        }
    } catch { }
  }
  $cands = @()
  foreach ($c in $list) {
    $up = 0; $ud = Join-Path $c 'server\uploads'
    if (Test-Path -LiteralPath $ud) { $up = @(Get-ChildItem -LiteralPath $ud -Recurse -File -ErrorAction SilentlyContinue).Count }
    $isSelf = $false
    try {
      $cp = (Resolve-Path -LiteralPath $c).Path.TrimEnd('\')
      $pp = (Resolve-Path -LiteralPath $PKG).Path.TrimEnd('\')
      if ($cp -eq $pp -or $cp.StartsWith($pp + '\') -or $pp.StartsWith($cp + '\')) { $isSelf = $true }
    } catch { }
    if ($isSelf) { continue }
    $cands += [pscustomobject]@{
      Dir = $c; Uploads = $up
      HasEnv = (Test-Path -LiteralPath (Join-Path $c 'server\.env'))
      HasNM = (Test-Path -LiteralPath (Join-Path $c 'server\node_modules'))
    }
    Say ("  [候选] {0}  图片={1}  配置={2}  依赖={3}" -f $c, $up, (Test-Path -LiteralPath (Join-Path $c 'server\.env')), (Test-Path -LiteralPath (Join-Path $c 'server\node_modules'))) 'DarkGray'
  }
  if (@($cands).Count -eq 0) { Say "  [错误] 没找到安装目录，请用 -InstallDir 指定" 'Red'; exit 1 }
  $target = ($cands | Sort-Object @{e = { $_.HasEnv }; Descending = $true }, @{e = { $_.Uploads }; Descending = $true } | Select-Object -First 1).Dir
}
$srvDir = Join-Path $target 'server'
Say ("  >> 安装目录: {0}" -f $target) 'Green'

$port = Read-EnvValue -envPath (Join-Path $srvDir '.env') -key 'PORT'
if (-not $port) { $port = '40621' }
$portI = 0; [void][int]::TryParse($port, [ref]$portI)
Say ("  >> 端口: {0}" -f $port) 'Green'

if ($DryRun) { Say ""; Say "  [DryRun] 到此为止" 'Yellow'; exit 0 }

# --- 3. 写启动包装脚本（把输出落到日志文件，SYSTEM 下没窗口也能排查）------
$logDir = Join-Path $srvDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$wrapper = Join-Path $srvDir 'run-service.cmd'
$logFile = Join-Path $logDir 'service.log'
$lines = @(
  '@echo off',
  'cd /d "%~dp0"',
  ('echo [%date% %time%] service starting >> "{0}"' -f $logFile),
  ('"{0}" src\index.js >> "{1}" 2>&1' -f $nodeExe, $logFile)
)
Set-Content -LiteralPath $wrapper -Value $lines -Encoding Default
Say ("  已写入启动包装脚本: {0}" -f $wrapper) 'Green'
Say ("  运行日志: {0}" -f $logFile) 'Green'

# --- 4. 注册计划任务 -----------------------------------------------------
Say "  正在注册计划任务 $TaskName ..."
try {
  $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c "{0}"' -f $wrapper) -WorkingDirectory $srvDir
  $triggers = @((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -AtLogOn))
  # 说明：不设"失败自动重启"，避免部署时我们手动结束进程后它又抢着拉起来
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Settings $settings `
    -Principal $principal -Force -ErrorAction Stop | Out-Null
  Say "  ✅ 计划任务已注册（SYSTEM / 开机自启 / 不受注销影响）" 'Green'
} catch {
  Say ("  ❌ 计划任务注册失败: {0}" -f $_.Exception.Message) 'Red'
  Say "     请改用控制台方式启动：安装目录下的 启动.bat（注意注销会停掉它）" 'Yellow'
  exit 1
}

# --- 5. 结束当前在跑的 node，再用任务拉起 ---------------------------------
$owners = @(Get-PortOwners -Port $portI)
if (@($owners).Count -gt 0) {
  foreach ($o in $owners) {
    Say ("  结束旧进程 PID {0}" -f $o) 'DarkGray'
    Stop-Process -Id $o -Force -ErrorAction SilentlyContinue
    & taskkill.exe /F /T /PID $o 2>&1 | Out-Null
  }
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 1000
    if (@(Get-PortOwners -Port $portI).Count -eq 0) { break }
  }
}

Say "  通过计划任务启动..."
try { Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop } catch { Say ("  ❌ 启动任务失败: " + $_.Exception.Message) 'Red'; exit 1 }

$up = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  if (@(Get-PortOwners -Port $portI).Count -gt 0) { $up = $true; break }
}
if (-not $up) {
  Say ("  ❌ 端口 {0} 未被监听，服务没起来。请看日志: {1}" -f $port, $logFile) 'Red'
  exit 1
}
Say "  ✅ 端口已监听" 'Green'

# --- 6. 自检 -------------------------------------------------------------
$ok = $true
try {
  $r = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/api/opensource?page=1&pageSize=1" -f $portI) -TimeoutSec 25
  Say ("  ✅ 接口正常，开源项目 {0} 个" -f $r.total) 'Green'
} catch { Say ("  ❌ 接口自检失败: {0}" -f $_.Exception.Message) 'Red'; $ok = $false }
try {
  $h = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/" -f $portI) -TimeoutSec 20 -UseBasicParsing
  $m = [regex]::Match([string]$h.Content, 'src="(/assets/index-[^"]+\.js)"')
  Say ("  ✅ 首页正常，入口 JS: {0}" -f $m.Groups[1].Value) 'Green'
} catch { Say "  ❌ 首页打不开" 'Red'; $ok = $false }

Say ""
if ($ok) {
  Say "  完成：网站已由计划任务托管，注销登录 / 重启服务器都会自动拉起。" 'Green'
  Say "    启动: 启动服务.bat     停止: 停止服务.bat" 'Yellow'
  Say ("    日志: {0}" -f $logFile) 'Yellow'
  exit 0
}
Say "  未完全成功，请看上面的报错与日志文件。" 'Red'
exit 1
