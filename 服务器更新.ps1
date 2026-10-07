#Requires -Version 5.1
<#
  code-shop 服务器更新脚本（自动定位安装目录）
  适用：Windows Server 2016 + PowerShell 5.1

  用法（在服务器上以【管理员】身份运行 PowerShell）：
    1) 自动更新"正在运行的那份"：
         .\服务器更新.ps1
    2) 把配置搬到指定目录并从那里启动（推荐，用于干净克隆）：
         .\服务器更新.ps1 -TargetDir "C:\Users\Administrator\Desktop\code-shop-new"

  它会做：
    扫描出所有安装目录 -> 选定运行目录(带 .env 的那份)
    -> 备份 .env -> 拉取最新代码 -> 还原 .env -> 装依赖
    -> 停掉旧 node 进程 -> 从目标目录启动 -> 自检接口 -> 写日志

  不会做：改数据库、删用户文件、动 server\uploads
#>
[CmdletBinding()]
param(
  [string]$TargetDir = '',
  [string]$EnvFrom   = '',
  [switch]$SkipUpdate,
  [switch]$DryRun
)

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

# 日志目录：桌面取不到就退回 TEMP / 脚本目录（避免路径为空导致写出失败）
$logDir = [Environment]::GetFolderPath('Desktop')
if (-not $logDir -or -not (Test-Path -LiteralPath $logDir)) { $logDir = $env:TEMP }
if (-not $logDir -or -not (Test-Path -LiteralPath $logDir)) { $logDir = $PSScriptRoot }
$LOG = Join-Path $logDir ("code-shop-update-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$script:logLines = @()

function Say {
  param([string]$msg, [string]$color = 'Gray')
  Write-Host $msg -ForegroundColor $color
  $script:logLines += $msg
}

function Say-Head {
  param([string]$msg)
  Say ""
  Say ("=" * 62) 'DarkCyan'
  Say "  $msg" 'Cyan'
  Say ("=" * 62) 'DarkCyan'
}

function Is-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Read-EnvValue {
  param([string]$envPath, [string]$key)
  if (-not (Test-Path -LiteralPath $envPath)) { return '' }
  foreach ($line in (Get-Content -LiteralPath $envPath -Encoding UTF8 -ErrorAction SilentlyContinue)) {
    if ($line -match ("^\s*" + [regex]::Escape($key) + "\s*=\s*(.+?)\s*$")) { return $Matches[1].Trim('"', "'") }
  }
  return ''
}

function Find-InstallDirs {
  $roots = @('C:\Users', 'C:\code-shop', 'C:\www', 'C:\inetpub', 'C:\sites', 'C:\app',
             'D:\code-shop', 'D:\www', 'D:\sites')
  $found = New-Object System.Collections.Generic.List[object]
  foreach ($r in $roots) {
    if (-not (Test-Path -LiteralPath $r)) { continue }
    $hits = Get-ChildItem -LiteralPath $r -Recurse -Depth 6 -Filter 'index.js' -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match '\\server\\src\\index\.js$' }
    foreach ($h in $hits) {
      # h = <root>\server\src\index.js  -> 安装目录 = 上三层
      $root2 = Split-Path (Split-Path (Split-Path $h.FullName -Parent) -Parent) -Parent
      if (-not $root2) { continue }
      $envPath = Join-Path $root2 'server\.env'
      $obj = [pscustomobject]@{
        Dir      = $root2
        HasEnv   = (Test-Path -LiteralPath $envPath)
        EnvPath  = $envPath
        EnvTime  = if (Test-Path -LiteralPath $envPath) { (Get-Item -LiteralPath $envPath).LastWriteTime } else { [datetime]'1970-01-01' }
        IsGit    = (Test-Path -LiteralPath (Join-Path $root2 '.git'))
        HasDist  = (Test-Path -LiteralPath (Join-Path $root2 'web\dist\index.html'))
      }
      if (-not ($found | Where-Object { $_.Dir -eq $obj.Dir })) { $found.Add($obj) }
    }
  }
  return $found
}

function Stop-NodeServer {
  $killed = 0
  $procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue
  foreach ($p in $procs) {
    $cl = [string]$p.CommandLine
    if ($cl -match 'src[\\/]index\.js') {
      Say ("    结束进程 PID {0}" -f $p.ProcessId) 'DarkYellow'
      try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue; $killed++ } catch {}
    }
  }
  return $killed
}

function Start-Server {
  param([string]$ServerDir)
  $node = (Get-Command node.exe -ErrorAction SilentlyContinue)
  if (-not $node) { Say "    [错误] PATH 中找不到 node.exe" 'Red'; return $false }
  $args = '/k "node src\index.js"'
  Start-Process -FilePath 'cmd.exe' -ArgumentList $args -WorkingDirectory $ServerDir -WindowStyle Normal
  return $true
}

# ===========================================================================
Say-Head "code-shop 服务器更新"
Say ("  时间: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Say ("  主机: {0}" -f $env:COMPUTERNAME)
Say ("  日志: {0}" -f $LOG)

if (-not (Is-Admin)) {
  Say ""
  Say "  [错误] 请以【管理员】身份运行 PowerShell 后再执行本脚本" 'Red'
  Say "        方法：开始菜单搜索 PowerShell -> 右键 -> 以管理员身份运行" 'Red'
  Say ""
  $script:logLines | Out-File -LiteralPath $LOG -Encoding UTF8
  exit 1
}

# --- 1. 找安装目录 ---------------------------------------------------------
Say-Head "1/7 扫描安装目录"
$dirs = Find-InstallDirs
if ($dirs.Count -eq 0) {
  Say "  [错误] 没有扫描到任何安装目录（没找到 server\src\index.js）" 'Red'
  Say "        请手动指定：.\服务器更新.ps1 -TargetDir <目录>" 'Red'
  $script:logLines | Out-File -LiteralPath $LOG -Encoding UTF8
  exit 1
}
foreach ($d in $dirs) {
  $mark = if ($d.HasEnv) { '★有配置' } else { ' 无配置' }
  Say ("  [{0}] {1}" -f $mark, $d.Dir)
  Say ("         git仓库={0}  前端产物={1}  配置更新于 {2}" -f $d.IsGit, $d.HasDist, $d.EnvTime)
}

$running = $dirs | Where-Object { $_.HasEnv } | Sort-Object EnvTime -Descending | Select-Object -First 1
$source  = if ($EnvFrom) { $dirs | Where-Object { $_.Dir -like ("*" + $EnvFrom + "*") } | Select-Object -First 1 } else { $running }

if (-not $source) {
  Say ""
  Say "  [错误] 找不到任何带 server\.env 的目录 —— 无法取得数据库配置" 'Red'
  $script:logLines | Out-File -LiteralPath $LOG -Encoding UTF8
  exit 1
}
Say ""
Say ("  >> 配置来源（正在运行的那份）: {0}" -f $source.Dir) 'Green'

# --- 2. 决定目标目录 -------------------------------------------------------
Say-Head "2/7 确定更新目标"
if ($TargetDir) {
  $target = $TargetDir
} else {
  $target = $source.Dir
}
Say ("  目标目录: {0}" -f $target)
if (-not (Test-Path -LiteralPath (Join-Path $target 'server\src\index.js'))) {
  Say "  [错误] 目标目录不是有效的 code-shop 安装目录" 'Red'
  $script:logLines | Out-File -LiteralPath $LOG -Encoding UTF8
  exit 1
}
$targetIsGit = Test-Path -LiteralPath (Join-Path $target '.git')
Say ("  是 git 仓库: {0}" -f $targetIsGit)
if ($DryRun) { Say ""; Say "  [DryRun] 到此为止，未做任何改动" 'Yellow'; $script:logLines | Out-File -LiteralPath $LOG -Encoding UTF8; exit 0 }

# --- 3. 处理 .env ----------------------------------------------------------
Say-Head "3/7 处理数据库配置 server\.env"
$targetEnvPath = Join-Path $target 'server\.env'
$backupEnv = Join-Path $target 'server\.env.keep'
if (Test-Path -LiteralPath $targetEnvPath) {
  Copy-Item -LiteralPath $targetEnvPath -Destination $backupEnv -Force
  Say "  已备份目标目录现有 .env -> server\.env.keep"
} else {
  Copy-Item -LiteralPath $source.EnvPath -Destination $targetEnvPath -Force
  Say "  目标目录缺 .env，已从运行目录复制过来" 'Green'
}
if (-not (Test-Path -LiteralPath $targetEnvPath)) {
  Say "  [错误] 仍然没有 .env，无法继续" 'Red'
  $script:logLines | Out-File -LiteralPath $LOG -Encoding UTF8
  exit 1
}
$port = Read-EnvValue -envPath $targetEnvPath -key 'PORT'
if (-not $port) { $port = '8080' }
$dbHost = Read-EnvValue -envPath $targetEnvPath -key 'DB_HOST'
$dbName = Read-EnvValue -envPath $targetEnvPath -key 'DB_NAME'
Say ("  端口 PORT={0}  数据库 {1}/{2}" -f $port, $dbHost, $dbName)
Say ("  .env 大小 {0} 字节" -f (Get-Item -LiteralPath $targetEnvPath).Length)

# --- 4. 拉取代码 -----------------------------------------------------------
Say-Head "4/7 拉取最新代码"
if ($SkipUpdate) {
  Say "  [跳过] 按参数要求不更新代码"
} elseif (-not $targetIsGit) {
  Say "  [警告] 目标目录不是 git 仓库，跳过代码更新" 'Yellow'
  Say "         如需更新请下载 ZIP 覆盖：" 'Yellow'
  Say "         https://gitee.com/nanzhiyu/code-shop/repository/archive/main.zip" 'Yellow'
} else {
  Push-Location $target
  Say "  git fetch origin ..."
  $out = & git fetch origin 2>&1
  $out | ForEach-Object { Say ("      " + $_) 'DarkGray' }
  if ($LASTEXITCODE -ne 0) {
    Say "  [错误] git fetch 失败，跳过代码更新" 'Red'
  } else {
    $before = (& git rev-parse --short HEAD) -join ''
    Say ("  当前版本: {0}" -f $before)
    Say "  git reset --hard origin/main ..."
    $out2 = & git reset --hard origin/main 2>&1
    $out2 | ForEach-Object { Say ("      " + $_) 'DarkGray' }
    $after = (& git rev-parse --short HEAD) -join ''
    Say ("  更新后版本: {0}" -f $after) 'Green'
  }
  Pop-Location
}

# 拉取会删掉 .env（新版已把它移出版本控制），这里必须还原
if (-not (Test-Path -LiteralPath $targetEnvPath)) {
  Copy-Item -LiteralPath $backupEnv -Destination $targetEnvPath -Force
  Say "  拉取删除了 .env，已自动还原" 'Yellow'
}

# --- 5. 装依赖 -------------------------------------------------------------
Say-Head "5/7 安装后端依赖"
Push-Location (Join-Path $target 'server')
$out = & npm install --omit=dev 2>&1
$out | Select-Object -Last 12 | ForEach-Object { Say ("      " + $_) 'DarkGray' }
if ($LASTEXITCODE -ne 0) { Say "  [警告] npm install 返回非 0，服务可能异常" 'Yellow' } else { Say "  依赖就绪" 'Green' }
Pop-Location

# --- 6. 重启服务 -----------------------------------------------------------
Say-Head "6/7 重启服务"
Say "  停止所有 node src\index.js 进程 ..."
$n = Stop-NodeServer
Say ("  共结束 {0} 个进程" -f $n)
Start-Sleep -Seconds 3
Say "  启动新服务 ..."
$ok = Start-Server -ServerDir (Join-Path $target 'server')
if ($ok) { Say "  已在新窗口启动（窗口标题为 cmd，请勿关闭）" 'Green' }
Start-Sleep -Seconds 8

# --- 7. 自检 ---------------------------------------------------------------
Say-Head "7/7 自检"
$url = "http://127.0.0.1:$port/api/opensource"
Say ("  请求 {0}" -f $url)
$result = 'unknown'
try {
  $r = Invoke-RestMethod -Uri $url -TimeoutSec 20
  $empty = @($r.items | Where-Object { -not $_.title }).Count
  Say ("  ✅ 开源项目接口正常：返回 {0} 个项目，空标题 {1} 条" -f $r.items.Count, $empty) 'Green'
  if ($r.items.Count -eq 157) { Say "  ✅ 数量正确（157），说明新版代码已生效" 'Green' }
  $result = "ok:$($r.items.Count)"
} catch {
  Say ("  ❌ 接口自检失败：{0}" -f $_.Exception.Message) 'Red'
  Say "     若网站端口不是 $port，请以 server\.env 里的 PORT 为准" 'Yellow'
  $result = "fail"
}
try {
  $h = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -TimeoutSec 15 -UseBasicParsing
  $m = [regex]::Match($h.Content, 'src="(/assets/[^"]+)"')
  Say ("  首页可访问，入口 JS: {0}" -f $m.Groups[1].Value)
} catch { Say "  首页自检失败（不影响接口判断）" 'Yellow' }

Say-Head "完成"
Say ("  自检结果: {0}" -f $result)
Say ("  日志文件: {0}" -f $LOG)
Say "  请用浏览器打开站点并按 Ctrl+F5 强制刷新，检查："
Say "    1) 顶部导航是否出现「开源项目」入口"
Say "    2) 站点地址/opensource 是否显示 157 个项目"
Say "    3) 商品列表、登录、后台是否正常"
Say ""
$script:logLines | Out-File -LiteralPath $LOG -Encoding UTF8
Write-Host ("日志已写入: " + $LOG) -ForegroundColor Yellow
