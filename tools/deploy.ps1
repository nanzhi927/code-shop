#Requires -Version 5.1
<#
  code-shop 一键部署脚本 v3（免 git、免手工找目录）

  用途：把本包内的最新代码，部署到服务器上已有的安装目录并重启服务。
        会自动保留原目录的 server\uploads（商品图片，约 2GB）
        与 node_modules，只替换代码文件，因此不会丢图片、不需要重新下载依赖。

  v3 相比旧版修掉的问题：
    1) 旧版"重启"只按 node.exe 命令行匹配 src\index.js，匹配不到时静默跳过，
       结果文件换了、进程没换，网站仍在跑旧代码（表现为"部署成功但没变化"）。
       现在改为【按端口占用者 PID 精确结束】，并等待端口释放后再启动。
    2) 旧版可能把解压包目录本身当成安装目录，出现大量
       "无法使用项 ... 其自身覆盖该项" 的自我覆盖错误。现在会主动拒绝这种目标。
    3) 旧版自检只测 /api/opensource（旧代码也返回 157），无法判断是否换版。
       现在自检接口 /api/admin/todos（旧代码 404 / 新代码 401）与前端入口 JS 指纹。
    4) 新增：通过"线上入口 JS"反查安装目录，避免在多份副本里选错。

  用法（服务器上以【管理员】身份运行）：
    powershell -ExecutionPolicy Bypass -File .\deploy.ps1
  可选参数：
    -InstallDir "C:\xxx\code-shop"   直接指定安装目录，跳过自动判断
    -DryRun                          只扫描与检查，不做任何改动
    -VerifyOnly                      只逐文件比对安装目录与包内是否一致，不做任何改动
    -ForceNpmInstall                 强制重装依赖
    -Force                           自动选择失败时，退化为"图片最多的目录"

  不会做：改数据库、删 uploads、删用户文件、动 git 历史。
#>
[CmdletBinding()]
param(
  [string]$InstallDir = '',
  [switch]$DryRun,
  [switch]$VerifyOnly,
  [switch]$ForceNpmInstall,
  [switch]$Force
)

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

$PKG = $PSScriptRoot

# 日志目录：优先桌面，取不到则退回 TEMP、再到脚本目录
$logDir = [Environment]::GetFolderPath('Desktop')
if (-not $logDir -or -not (Test-Path -LiteralPath $logDir)) { $logDir = $env:TEMP }
if (-not $logDir -or -not (Test-Path -LiteralPath $logDir)) { $logDir = $PKG }
$LogPath = Join-Path $logDir ("code-shop-deploy-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$script:LogLines = @()

function Save-Log {
  if (-not $LogPath) { Write-Host "  [警告] 日志路径为空，未能写日志" -ForegroundColor Yellow; return }
  try {
    $script:LogLines | Out-File -LiteralPath $LogPath -Encoding UTF8 -ErrorAction Stop
    Write-Host ("日志已写入: " + $LogPath) -ForegroundColor Yellow
  } catch {
    Write-Host ("  [警告] 日志写入失败: " + $_.Exception.Message) -ForegroundColor Yellow
    Write-Host ("        尝试的路径: " + $LogPath) -ForegroundColor DarkGray
  }
}
function Say { param([string]$m, [string]$c = 'Gray')
  Write-Host $m -ForegroundColor $c; $script:LogLines += $m }
function Head { param([string]$m)
  Say ""; Say ("=" * 64) 'DarkCyan'; Say "  $m" 'Cyan'; Say ("=" * 64) 'DarkCyan' }
function Die { param([string]$m)
  Say ""; Say ("  [错误] " + $m) 'Red'; Save-Log; exit 1 }

function Read-EnvValue {
  param([string]$envPath, [string]$key)
  if (-not (Test-Path -LiteralPath $envPath)) { return '' }
  foreach ($line in (Get-Content -LiteralPath $envPath -Encoding UTF8 -ErrorAction SilentlyContinue)) {
    if ($line -match ("^\s*" + [regex]::Escape($key) + "\s*=\s*(.+?)\s*$")) { return $Matches[1].Trim('"', "'") }
  }
  return ''
}

function Get-EntryJs {
  param([string]$htmlPath)
  if (-not $htmlPath -or -not (Test-Path -LiteralPath $htmlPath)) { return '' }
  $h = ''
  try { $h = Get-Content -LiteralPath $htmlPath -Raw -Encoding UTF8 -ErrorAction Stop } catch { return '' }
  if (-not $h) { return '' }
  $m = [regex]::Match($h, 'src="(/assets/index-[^"]+\.js)"')
  if ($m.Success) { return $m.Groups[1].Value }
  $m2 = [regex]::Match($h, 'src="([^"]*index-[^"]+\.js)"')
  if ($m2.Success) { return $m2.Groups[1].Value }
  return ''
}

function Get-LiveEntry {
  param([int]$Port)
  if ($Port -le 0) { return '' }
  try {
    $r = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/" -f $Port) -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
    $m = [regex]::Match([string]$r.Content, 'src="(/assets/index-[^"]+\.js)"')
    if ($m.Success) { return $m.Groups[1].Value }
  } catch { }
  return ''
}

function Get-UrlStatus {
  param([string]$Url, [int]$Timeout = 15)
  try {
    $r = Invoke-WebRequest -Uri $Url -TimeoutSec $Timeout -UseBasicParsing -ErrorAction Stop
    return [int]$r.StatusCode
  } catch {
    $resp = $_.Exception.Response
    if ($resp) { try { return [int]$resp.StatusCode } catch { } }
    return 0
  }
}

function Get-PortOwners {
  param([int]$Port)
  $ids = @()
  if ($Port -le 0) { return @() }
  try {
    $ids += @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
              Select-Object -ExpandProperty OwningProcess)
  } catch { }
  if (@($ids).Count -eq 0) {
    try {
      $ns = & netstat.exe -ano 2>$null
      foreach ($line in $ns) {
        if ($line -match ("^\s*TCP\s+\S+:" + $Port + "\s+\S+\s+LISTENING\s+(\d+)\s*$")) {
          $ids += [int]$Matches[1]
        }
      }
    } catch { }
  }
  return @($ids | Where-Object { $_ -and $_ -gt 0 } | Sort-Object -Unique)
}

function Get-ProcInfo {
  param([int]$ProcId)
  try { return (Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $ProcId) -ErrorAction Stop) }
  catch { return $null }
}

function Test-InstallRoot {
  param([string]$Root)
  if (-not $Root) { return $false }
  return (Test-Path -LiteralPath (Join-Path $Root 'server\src\index.js'))
}

function New-Cand {
  param([string]$Root, [string]$PkgDir)
  $up = 0
  $ud = Join-Path $Root 'server\uploads'
  if (Test-Path -LiteralPath $ud) {
    $up = @(Get-ChildItem -LiteralPath $ud -Recurse -File -ErrorAction SilentlyContinue).Count
  }
  $isSelf = $false
  try {
    $rp = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\')
    $pp = (Resolve-Path -LiteralPath $PkgDir).Path.TrimEnd('\')
    if ($rp -eq $pp -or $rp.StartsWith($pp + '\') -or $pp.StartsWith($rp + '\')) { $isSelf = $true }
  } catch { }
  return [pscustomobject]@{
    Dir     = $Root
    HasEnv  = (Test-Path -LiteralPath (Join-Path $Root 'server\.env'))
    Uploads = $up
    HasNM   = (Test-Path -LiteralPath (Join-Path $Root 'server\node_modules'))
    HasDist = (Test-Path -LiteralPath (Join-Path $Root 'web\dist\index.html'))
    Entry   = (Get-EntryJs (Join-Path $Root 'web\dist\index.html'))
    Self    = $isSelf
    Live    = $false
  }
}

function Add-Cand {
  param([System.Collections.ArrayList]$List, [string]$Root, [string]$PkgDir)
  if (-not $Root) { return }
  if (-not (Test-InstallRoot -Root $Root)) { return }
  foreach ($x in $List) { if ($x.Dir -eq $Root) { return } }
  [void]$List.Add((New-Cand -Root $Root -PkgDir $PkgDir))
}

function Find-Installs {
  param([string]$PkgDir)
  $list = New-Object System.Collections.ArrayList
  $roots = @('C:\Users', 'C:\www', 'C:\sites', 'C:\app', 'C:\code-shop', 'D:\', 'E:\', 'F:\')
  $seenDirs = @()
  foreach ($r in $roots) {
    if (-not (Test-Path -LiteralPath $r)) { continue }
    $hits = @()
    try {
      $hits = Get-ChildItem -LiteralPath $r -Recurse -Depth 6 -Filter 'index.js' -ErrorAction Stop |
              Where-Object { $_.FullName -match '\\server\\src\\index\.js$' }
    } catch { }
    foreach ($h in $hits) {
      $root = Split-Path (Split-Path (Split-Path $h.FullName -Parent) -Parent) -Parent
      Add-Cand -List $list -Root $root -PkgDir $PkgDir
    }
  }
  # 额外：常见命名的顶层目录（C:\ 与各盘根，深度 2），避免安装目录名不在常见路径里
  foreach ($drv in @('C:\', 'D:\', 'E:\', 'F:\')) {
    if (-not (Test-Path -LiteralPath $drv)) { continue }
    try {
      Get-ChildItem -LiteralPath $drv -Directory -Depth 2 -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match 'shop|www|site|web|service|project|项目' } |
        ForEach-Object { Add-Cand -List $list -Root $_.FullName -PkgDir $PkgDir }
    } catch { }
  }
  return $list
}

# ===========================================================================
Head "code-shop 一键部署 v3"
Say ("  时间: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Say ("  主机: {0}" -f $env:COMPUTERNAME)
Say ("  包目录: {0}" -f $PKG)
Say ("  日志: {0}" -f $LogPath)

$idw = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($idw)).IsInRole(
      [Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Say "  [错误] 请以【管理员】身份运行" 'Red'; Save-Log; exit 1
}

# --- 1. 校验包内容 --------------------------------------------------------
Head "1/9 校验包内容"
$need = @(
  @{p='server\src\index.js'; n='后端入口'},
  @{p='server\src\routes\admin.js'; n='后台路由'},
  @{p='server\package.json'; n='后端依赖清单'},
  @{p='server\.env';         n='数据库配置'},
  @{p='web\dist\index.html'; n='前端产物'}
)
$missing = @()
foreach ($x in $need) {
  $ok = Test-Path -LiteralPath (Join-Path $PKG $x.p)
  Say ("  {0} {1}" -f $(if ($ok) { '✅' } else { '❌' }), $x.p)
  if (-not $ok) { $missing += $x.p }
}
if ($missing.Count -gt 0) {
  Say ("  [错误] 包内缺少: {0}" -f ($missing -join ', ')) 'Red'
  Say "        请确认已在解压后的完整目录里运行本脚本（不要只解压单个文件）" 'Red'
  Save-Log; exit 1
}

$pkgPort  = Read-EnvValue -envPath (Join-Path $PKG 'server\.env') -key 'PORT'
if (-not $pkgPort) { $pkgPort = '40621' }
$pkgPortI = 0; [void][int]::TryParse($pkgPort, [ref]$pkgPortI)
$pkgEntry = Get-EntryJs (Join-Path $PKG 'web\dist\index.html')

# 包内版本标记：新版后台路由里应有 /todos
$pkgMarker = $false
try {
  $adm = Get-Content -LiteralPath (Join-Path $PKG 'server\src\routes\admin.js') -Raw -Encoding UTF8 -ErrorAction Stop
  if ($adm -match "'/todos'|`"/todos`"") { $pkgMarker = $true }
} catch { }
Say ("  包内 .env 端口 PORT={0}" -f $pkgPort) 'Green'
Say ("  包内前端入口 JS: {0}" -f $(if ($pkgEntry) { $pkgEntry } else { '（未识别）' })) 'Green'
Say ("  包内新版标记 /todos: {0}" -f $(if ($pkgMarker) { '✅ 存在' } else { '❌ 缺失（这个包是旧的，请重新下载）' })) $(if ($pkgMarker) { 'Green' } else { 'Red' })
if (-not $pkgMarker) { Die "部署包本身不含新版代码，部署没有意义。请重新下载最新部署包。" }

# --- 2. 定位运行中的服务与安装目录 ---------------------------------------
Head "2/9 定位运行中的服务与安装目录"
$owners = @(Get-PortOwners -Port $pkgPortI)
if (@($owners).Count -gt 0) {
  Say ("  端口 {0} 正在被占用: PID {1}" -f $pkgPort, ($owners -join ', ')) 'Yellow'
  foreach ($op in $owners) {
    $pi = Get-ProcInfo -ProcId $op
    if ($pi) {
      Say ("    PID {0}  {1}" -f $pi.ProcessId, $pi.Name) 'DarkGray'
      Say ("      路径: {0}" -f $pi.ExecutablePath) 'DarkGray'
      Say ("      命令行: {0}" -f $pi.CommandLine) 'DarkGray'
      $pp = Get-ProcInfo -ProcId ([int]$pi.ParentProcessId)
      if ($pp) { Say ("      父进程: PID {0} {1}  命令行: {2}" -f $pp.ProcessId, $pp.Name, $pp.CommandLine) 'DarkGray' }
    } else {
      Say ("    PID {0}（无法读取进程信息，可能 WMI 不可用）" -f $op) 'DarkGray'
    }
  }
} else {
  Say ("  端口 {0} 当前没有进程在监听（服务可能已停止）" -f $pkgPort) 'Yellow'
}

$liveEntry = Get-LiveEntry -Port $pkgPortI
Say ("  线上正在提供的入口 JS: {0}" -f $(if ($liveEntry) { $liveEntry } else { '（取不到，服务可能已停止）' })) 'Green'

# 从占用者命令行里提取安装目录（若启动时用了绝对路径）
$derived = ''
foreach ($op in $owners) {
  $pi = Get-ProcInfo -ProcId $op
  if (-not $pi) { continue }
  $cl = [string]$pi.CommandLine
  $m = [regex]::Match($cl, '([A-Za-z]:\\[^"]*?)\\server\\src\\index\.js')
  if ($m.Success) { $derived = $m.Groups[1].Value; break }
  $m2 = [regex]::Match($cl, '([A-Za-z]:\\[^"]*?)\\src\\index\.js')
  if ($m2.Success) { $derived = (Split-Path $m2.Groups[1].Value -Parent); break }
}
if ($derived) { Say ("  由命令行推断安装目录: {0}" -f $derived) 'Green' }

$target = $null
if ($InstallDir) {
  if (-not (Test-InstallRoot -Root $InstallDir)) {
    Die ("指定的安装目录不像 code-shop 安装目录（缺少 server\src\index.js）: " + $InstallDir)
  }
  $target = New-Cand -Root $InstallDir -PkgDir $PKG
  Say ("  使用指定目录: {0}" -f $InstallDir) 'Green'
} elseif ($derived -and (Test-InstallRoot -Root $derived)) {
  $target = New-Cand -Root $derived -PkgDir $PKG
  Say ("  使用命令行推断的目录: {0}" -f $derived) 'Green'
} else {
  Say "  正在扫描已有安装目录（可能要 1-2 分钟）..."
  $cands = @(Find-Installs -PkgDir $PKG)
  if ($cands.Count -eq 0) {
    Say ""
    Say "  ❌ 没有找到任何已有安装目录。" 'Yellow'
    Say "     本包不含 2GB 商品图片，因此不能独立运行。" 'Yellow'
    Say "     请手动指定安装目录：" 'Yellow'
    Say "        .\deploy.ps1 -InstallDir ""C:\你的\code-shop""" 'Yellow'
    Save-Log; exit 1
  }
  foreach ($c in $cands) {
    if ($liveEntry -and $c.Entry -eq $liveEntry) { $c.Live = $true }
    Say ("  [候选] {0}" -f $c.Dir) $(if ($c.Self) { 'DarkGray' } else { 'Gray' })
    Say ("         有配置={0}  图片文件={1}  依赖={2}  前端产物={3}  入口JS={4}  线上匹配={5}{6}" -f `
      $c.HasEnv, $c.Uploads, $c.HasNM, $c.HasDist, $(if ($c.Entry) { $c.Entry } else { '-' }),
      $(if ($c.Live) { '是' } else { '否' }), $(if ($c.Self) { '  ← 这是解压包自己，不能作为安装目录' } else { '' })) 'DarkGray'
  }
  $eligible = @($cands | Where-Object { -not $_.Self })
  if ($eligible.Count -eq 0) {
    Say ""
    Say "  ❌ 唯一找到的目录就是解压包自己，说明【更新包被解压进了安装目录里】，" 'Yellow'
    Say "     解压时同名文件很可能被跳过，脚本无法再自我覆盖。" 'Yellow'
    Say "     请把更新包解压到【另一个】目录（例如 C:\shop-update）后重新运行。" 'Yellow'
    Save-Log; exit 1
  }
  $liveMatches = @($eligible | Where-Object { $_.Live })
  if ($liveMatches.Count -ge 1) {
    $target = ($liveMatches | Sort-Object @{e={$_.HasEnv};Descending=$true}, @{e={$_.Uploads};Descending=$true} | Select-Object -First 1)
  } elseif ($liveEntry) {
    $real = @($eligible | Where-Object { $_.HasEnv -and $_.Uploads -gt 0 })
    if ($real.Count -eq 1) {
      $target = $real[0]
      Say "  [提示] 没有候选与线上入口 JS 匹配，但只有一个候选同时具备 .env 与商品图片，按它作为安装目录" 'Yellow'
    } elseif (-not $Force) {
      Say ""
      Say "  ❌ 没有候选目录与线上入口 JS 匹配，无法确定服务是从哪个目录启动的。" 'Yellow'
      Say "     为避免把代码部署到错误的副本（可能导致网站打不开），已停止。" 'Yellow'
      Say "     请用上面列出的正确目录重跑：" 'Yellow'
      Say "        .\deploy.ps1 -InstallDir ""C:\你的\code-shop""" 'Yellow'
      Say "     （确实要用「图片最多的目录」可以加 -Force）" 'Yellow'
      Save-Log; exit 1
    }
    $target = ($eligible | Sort-Object @{e={$_.HasEnv};Descending=$true}, @{e={$_.Uploads};Descending=$true} | Select-Object -First 1)
    Say "  [警告] 使用了 -Force，按「有配置且图片最多」选择目标" 'Yellow'
  } else {
    $target = ($eligible | Sort-Object @{e={$_.HasEnv};Descending=$true}, @{e={$_.Uploads};Descending=$true} | Select-Object -First 1)
    Say "  [提示] 服务当前未运行，按「有配置且图片最多」选择目标" 'Yellow'
  }
}

Say ""
Say ("  >> 选定安装目录: {0}" -f $target.Dir) 'Green'
Say ("     有配置={0}  图片文件={1}  依赖={2}  当前入口JS={3}  线上入口JS={4}" -f `
  $target.HasEnv, $target.Uploads, $target.HasNM, $(if ($target.Entry) { $target.Entry } else { '-' }), $(if ($liveEntry) { $liveEntry } else { '-' }))

# 拒绝自杀式覆盖
try {
  $tp = (Resolve-Path -LiteralPath $target.Dir).Path.TrimEnd('\')
  $pp = (Resolve-Path -LiteralPath $PKG).Path.TrimEnd('\')
  if ($tp -eq $pp -or $tp.StartsWith($pp + '\') -or $pp.StartsWith($tp + '\')) {
    Say ""
    Say "  ❌ 解压包目录与安装目录是同一个（或互相嵌套），脚本不能把文件复制到自己身上。" 'Red'
    Say "     请把更新包解压到【另一个】目录后重新运行，例如：" 'Red'
    Say "        解压到 C:\shop-update  ->  运行 C:\shop-update\一键部署.bat" 'Red'
    Say "     脚本会自动把代码复制进上面的安装目录，图片与依赖不会丢。" 'Red'
    Save-Log; exit 1
  }
} catch { }

# --- 只核对不改动：逐文件哈希比对 -----------------------------------------
if ($VerifyOnly) {
  Head "核对：安装目录里的代码是否与包内完全一致（不做任何改动）"
  $dirsToCheck = @('server\src', 'server\data', 'server\scripts', 'web\dist')
  $filesToCheck = @('server\package.json', 'server\package-lock.json',
                    'deploy.ps1', '一键部署.bat', '使用说明.txt',
                    'install-service.ps1', '注册服务.bat', '启动服务.bat', '停止服务.bat',
                    'start.bat', '启动.bat', '停止.bat', '开发启动.bat', '服务器更新.bat', '服务器更新.ps1')
  $totalMissing = 0; $totalDiff = 0; $totalExtra = 0
  foreach ($d in $dirsToCheck) {
    $src = Join-Path $PKG $d
    $dst = Join-Path $target.Dir $d
    if (-not (Test-Path -LiteralPath $src)) { continue }
    $missing = @(); $diff = @(); $extra = @()
    $srcFiles = @(Get-ChildItem -LiteralPath $src -Recurse -File)
    foreach ($f in $srcFiles) {
      $rel = $f.FullName.Substring($src.Length).TrimStart('\')
      $to = Join-Path $dst $rel
      if (-not (Test-Path -LiteralPath $to)) { $missing += $rel; continue }
      try {
        $h1 = (Get-FileHash -LiteralPath $f.FullName -Algorithm MD5).Hash
        $h2 = (Get-FileHash -LiteralPath $to -Algorithm MD5).Hash
        if ($h1 -ne $h2) { $diff += $rel }
      } catch { $diff += $rel }
    }
    if (Test-Path -LiteralPath $dst) {
      foreach ($f in (Get-ChildItem -LiteralPath $dst -Recurse -File)) {
        $rel = $f.FullName.Substring($dst.Length).TrimStart('\')
        if (-not (Test-Path -LiteralPath (Join-Path $src $rel))) { $extra += $rel }
      }
    }
    $totalMissing += @($missing).Count; $totalDiff += @($diff).Count; $totalExtra += @($extra).Count
    Say ("  {0}：包内 {1} 个文件 → 缺失 {2}、内容不同 {3}、多余 {4}" -f `
      $d, $srcFiles.Count, @($missing).Count, @($diff).Count, @($extra).Count) `
      $(if ((@($missing).Count + @($diff).Count) -eq 0) { 'Green' } else { 'Red' })
    foreach ($x in ($missing | Select-Object -First 5)) { Say ("      缺失: {0}" -f $x) 'Red' }
    foreach ($x in ($diff | Select-Object -First 5)) { Say ("      不同: {0}" -f $x) 'Red' }
    foreach ($x in ($extra | Select-Object -First 3)) { Say ("      多余: {0}" -f $x) 'DarkGray' }
  }
  foreach ($f in $filesToCheck) {
    $src = Join-Path $PKG $f
    if (-not (Test-Path -LiteralPath $src)) { continue }
    $to = Join-Path $target.Dir $f
    if (-not (Test-Path -LiteralPath $to)) { Say ("  缺失: {0}" -f $f) 'Red'; $totalMissing++; continue }
    try {
      if ((Get-FileHash -LiteralPath $src -Algorithm MD5).Hash -ne (Get-FileHash -LiteralPath $to -Algorithm MD5).Hash) {
        Say ("  内容不同: {0}" -f $f) 'Red'; $totalDiff++
      }
    } catch { Say ("  无法比对: {0}" -f $f) 'Yellow' }
  }
  Say ""
  if ($totalMissing -eq 0 -and $totalDiff -eq 0) {
    Say ("  ✅ 代码与包内完全一致（多余文件 {0} 个，属无害残留；其中 web\dist 的多余旧产物会在下次部署时自动清理）" -f $totalExtra) 'Green'
    Save-Log; exit 0
  }
  Say ("  ❌ 不一致：缺失 {0} 个、内容不同 {1} 个 → 请正常跑一次部署（去掉 -VerifyOnly）" -f $totalMissing, $totalDiff) 'Red'
  Save-Log; exit 1
}

if ($DryRun) { Say ""; Say "  [DryRun] 到此为止，未做任何改动" 'Yellow'; Save-Log; exit 0 }

# --- 3. 备份配置 ----------------------------------------------------------
Head "3/9 备份现有 server\.env"
$tEnv = Join-Path $target.Dir 'server\.env'
$keep = Join-Path $target.Dir 'server\.env.keep'
if (Test-Path -LiteralPath $tEnv) {
  Copy-Item -LiteralPath $tEnv -Destination $keep -Force
  Say ("  已备份为 {0}" -f $keep) 'Green'
} else {
  Say "  现有目录没有 .env，稍后用包内的补上" 'Yellow'
}

# --- 4. 覆盖代码（保留 uploads / node_modules）---------------------------
Head "4/9 覆盖代码（保留图片与依赖）"
$dirs = @('server\src', 'server\data', 'server\scripts', 'web\dist')
foreach ($d in $dirs) {
  $src = Join-Path $PKG $d
  $dst = Join-Path $target.Dir $d
  if (-not (Test-Path -LiteralPath $src)) { Say ("  跳过（包内无）: {0}" -f $d) 'DarkGray'; continue }
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  $n = 0
  Get-ChildItem -LiteralPath $src -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length).TrimStart('\')
    $to = Join-Path $dst $rel
    New-Item -ItemType Directory -Force -Path (Split-Path $to -Parent) | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $to -Force -ErrorAction SilentlyContinue
    if ($?) { $n++ }
  }
  Say ("  ✅ {0}  ({1} 个文件)" -f $d, $n) 'Green'
  if ($d -eq 'web\dist') {
    # 前端产物做【镜像同步】：清掉包内已不存在的旧 hash 文件，避免残留旧页面
    $removed = 0
    foreach ($f in (Get-ChildItem -LiteralPath $dst -Recurse -File)) {
      $rel = $f.FullName.Substring($dst.Length).TrimStart('\')
      if (-not (Test-Path -LiteralPath (Join-Path $src $rel))) {
        Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue
        if (-not (Test-Path -LiteralPath $f.FullName)) { $removed++ }
      }
    }
    if ($removed -gt 0) { Say ("     已清理 {0} 个包内不存在的旧产物" -f $removed) 'DarkGray' }
  } else {
    # 其他目录只提示、不删除（可能有运行期生成的数据）
    $extra = 0
    foreach ($f in (Get-ChildItem -LiteralPath $dst -Recurse -File)) {
      $rel = $f.FullName.Substring($dst.Length).TrimStart('\')
      if (-not (Test-Path -LiteralPath (Join-Path $src $rel))) { $extra++ }
    }
    if ($extra -gt 0) { Say ("     提示：该目录另有 {0} 个包内没有的文件（未删除）" -f $extra) 'DarkGray' }
  }
}
$files = @('server\package.json', 'server\package-lock.json', 'start.bat', '启动.bat', '停止.bat', '开发启动.bat', '服务器更新.bat', '服务器更新.ps1', 'install-service.ps1', '注册服务.bat', '启动服务.bat', '停止服务.bat', 'deploy.ps1', '一键部署.bat', '使用说明.txt')
foreach ($f in $files) {
  $src = Join-Path $PKG $f
  if (Test-Path -LiteralPath $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $target.Dir $f) -Force -ErrorAction SilentlyContinue
    Say ("  ✅ {0}" -f $f) 'Green'
  }
}

# 确认覆盖结果
$tEntry = Get-EntryJs (Join-Path $target.Dir 'web\dist\index.html')
$tMarker = $false
try {
  $ta = Get-Content -LiteralPath (Join-Path $target.Dir 'server\src\routes\admin.js') -Raw -Encoding UTF8 -ErrorAction Stop
  if ($ta -match "'/todos'|`"/todos`"") { $tMarker = $true }
} catch { }
Say ("  磁盘上代码检查: 入口JS={0}  新版标记/todos={1}" -f $tEntry, $(if ($tMarker) { '✅' } else { '❌' })) $(if ($tMarker -and $tEntry -eq $pkgEntry) { 'Green' } else { 'Yellow' })
if (-not $tMarker) { Die "代码复制后磁盘上仍没有新版标记，复制步骤失败（可能被占用或权限不足）。" }

# --- 5. 处理 .env ---------------------------------------------------------
Head "5/9 处理数据库配置 server\.env"
if (-not (Test-Path -LiteralPath $tEnv)) {
  Copy-Item -LiteralPath (Join-Path $PKG 'server\.env') -Destination $tEnv -Force
  Say "  已用包内 .env 写入" 'Green'
} else {
  Say "  保留现有 .env" 'DarkGray'
}
$port = Read-EnvValue -envPath $tEnv -key 'PORT'
if (-not $port) { $port = $pkgPort }
$portI = 0; [void][int]::TryParse($port, [ref]$portI)
$dbHost = Read-EnvValue -envPath $tEnv -key 'DB_HOST'
$dbName = Read-EnvValue -envPath $tEnv -key 'DB_NAME'
Say ("  生效端口 PORT={0}   数据库 {1}/{2}" -f $port, $dbHost, $dbName) 'Green'

# --- 6. 依赖与数据库表结构 -------------------------------------------------
Head "6/9 检查依赖与数据库表结构"
$nm = Join-Path $target.Dir 'server\node_modules'
if ($ForceNpmInstall -or -not (Test-Path -LiteralPath $nm)) {
  Say "  安装依赖（npm install --omit=dev）..."
  # 说明：本块刻意不用管道接 npm 的 stderr —— PS 5.1 会把原生程序的 stderr
  # 当成错误记录，脚本又开了 ErrorAction=Continue，容易误判；改看重定向日志。
  $npmLog = Join-Path $env:TEMP 'code-shop-npm.log'
  Push-Location (Join-Path $target.Dir 'server')
  & cmd.exe /c "npm install --omit=dev > `"$npmLog`" 2>&1"
  $rcNpm = $LASTEXITCODE
  Pop-Location
  if (Test-Path -LiteralPath $npmLog) {
    Get-Content -LiteralPath $npmLog -Tail 8 -ErrorAction SilentlyContinue |
      ForEach-Object { Say ("      " + $_) 'DarkGray' }
  }
  if ($rcNpm -ne 0) { Say "  [警告] npm install 返回非 0" 'Yellow' } else { Say "  依赖就绪" 'Green' }
} else {
  Say "  已存在 node_modules，跳过（如需强制重装加 -ForceNpmInstall）" 'DarkGray'
}

# 幂等补建缺失的表 / 字段 / 索引（含新增功能所需的新表）。
# init.js 只会 CREATE TABLE IF NOT EXISTS、补缺失列与索引；
# products 有数据时会打印「已有数据，跳过导入」，不会覆盖线上商品。
Say "  执行数据库表结构初始化（幂等，只补缺失项）..."
$initLog = Join-Path $env:TEMP 'code-shop-init.log'
if (Test-Path -LiteralPath $initLog) { Remove-Item -LiteralPath $initLog -Force }
Push-Location (Join-Path $target.Dir 'server')
& cmd.exe /c "node src\init.js > `"$initLog`" 2>&1"
$rcInit = $LASTEXITCODE
Pop-Location
if (Test-Path -LiteralPath $initLog) {
  Get-Content -LiteralPath $initLog -Tail 14 -ErrorAction SilentlyContinue |
    ForEach-Object { Say ("      " + $_) 'DarkGray' }
}
if ($rcInit -ne 0) {
  Say "  [警告] init.js 返回非 0（上表结构可能未补齐；若数据库连不上，下面的启动自检也会失败）" 'Yellow'
} else {
  Say "  表结构就绪" 'Green'
}

# --- 7. 重启（按端口占用者精确结束）--------------------------------------
Head "7/9 重启服务"
$victims = @()
$victims += @(Get-PortOwners -Port $portI)
try {
  foreach ($p in (Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue)) {
    $cl = [string]$p.CommandLine
    if ($cl -match 'src[\\/]index\.js' -or $cl -match [regex]::Escape($target.Dir)) { $victims += [int]$p.ProcessId }
  }
} catch { }
$victims = @($victims | Where-Object { $_ -and $_ -gt 0 } | Sort-Object -Unique)

if (@($victims).Count -eq 0) {
  Say "  没有找到需要结束的旧进程" 'DarkGray'
} else {
  foreach ($v in $victims) {
    $pi = Get-ProcInfo -ProcId $v
    $nmz = ''
    if ($pi) { $nmz = $pi.Name; $pp = Get-ProcInfo -ProcId ([int]$pi.ParentProcessId); if ($pp -and $pp.Name -eq 'cmd.exe') { $nmz = $nmz + " (父 cmd PID " + $pp.ProcessId + ")" } }
    Say ("  结束进程 PID {0} {1}" -f $v, $nmz) 'DarkGray'
    Stop-Process -Id $v -Force -ErrorAction SilentlyContinue
    # 再补一刀 taskkill /T：连它的父 cmd 窗口一起结束，避免残留
    & taskkill.exe /F /T /PID $v 2>&1 | Out-Null
  }
}
# 等端口释放
$freed = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 1500
  if (@(Get-PortOwners -Port $portI).Count -eq 0) { $freed = $true; break }
}
if (-not $freed) {
  $still = @(Get-PortOwners -Port $portI)
  Say ("  ❌ 端口 {0} 仍被占用（PID {1}），旧服务没结束掉。" -f $port, ($still -join ', ')) 'Red'
  Say "     这通常是被【Windows 服务】或【计划任务】托管、或权限不足。" 'Red'
  Say "     请打开【任务管理器】-> 详细信息，结束上面的 PID，然后重新运行本脚本。" 'Red'
  Save-Log; exit 1
}
Say "  ✅ 端口已释放" 'Green'

# 生成启动包装脚本：node 的输出直接写进日志文件，不经过控制台。
# 原因：winston 会把每条请求日志写控制台，而 Windows 的「快速编辑」模式下，
# 只要鼠标在控制台窗口里选中过内容，写控制台的线程就会无限阻塞、整个进程卡死，
# 表现是「端口能连上但一个字节都不回」。输出重定向到文件后就不会再有控制台写入。
$srvDirT = Join-Path $target.Dir 'server'
$logsDirT = Join-Path $srvDirT 'logs'
New-Item -ItemType Directory -Force -Path $logsDirT | Out-Null
$runCmd = Join-Path $srvDirT 'run.cmd'
$runLines = @(
  '@echo off',
  'rem code-shop launcher: node output goes to logs\service.log (no console writes)',
  'cd /d "%~dp0"',
  'title code-shop-server',
  'node src\index.js >> logs\service.log 2>&1'
)
Set-Content -LiteralPath $runCmd -Value $runLines -Encoding ASCII
Say ("  已生成启动脚本: {0}" -f $runCmd) 'DarkGray'
Say ("  运行日志: {0}" -f (Join-Path $logsDirT 'service.log')) 'DarkGray'

# 启动方式：优先用【计划任务】。
# 原因：Start-Process 起的进程属于当前会话——在远程会话（如 WinRM/PowerShell 远程）
# 里执行部署时，会话一结束进程就被杀，站点会直接掉线（已实际踩到过）。
# 计划任务由任务计划程序服务托管，与会话无关，部署完就一直是持久状态。
$taskName = 'code-shop-server'
$startedByTask = $false
$task = $null
try { $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop } catch { $task = $null }
if ($task) {
  $taskArgs = ''
  try { $taskArgs = [string]$task.Actions[0].Arguments } catch { }
  $taskMatches = $taskArgs -and ($taskArgs -like ('*' + $target.Dir + '*'))
  if (-not $taskMatches) {
    Say ("  [提示] 计划任务 {0} 指向的目录与本次安装目录不同，跳过任务启动" -f $taskName) 'Yellow'
    Say ("         任务参数: {0}" -f $taskArgs) 'DarkGray'
  } else {
    try {
      Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
      $startedByTask = $true
      Say ("  已通过计划任务 {0} 启动（SYSTEM 身份，不依赖当前会话，注销/断线都不会掉）" -f $taskName) 'Green'
    } catch {
      Say ("  [警告] 计划任务启动失败，改用控制台方式: {0}" -f $_.Exception.Message) 'Yellow'
    }
  }
}
if (-not $startedByTask) {
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', ('"{0}"' -f $runCmd) `
    -WorkingDirectory $srvDirT -WindowStyle Minimized
  Say "  已在最小化的窗口里启动（可放心最小化，不要去窗口里选中文字）" 'Green'
  Say "  提示：如需注销/断线后仍不中断，请运行同目录的「注册服务.bat」改由计划任务托管" 'Yellow'
}

# 等就绪：不仅要监听端口，还要真的能返回 HTTP 响应
# （曾经出现「端口能连上但一个字节都不回」= 进程被卡住，只测端口会误判为成功）
$up = $false
$listening = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  if (@(Get-PortOwners -Port $portI).Count -eq 0) { continue }
  $listening = $true
  if ((Get-UrlStatus -Url ("http://127.0.0.1:{0}/api/health" -f $portI) -Timeout 8) -eq 200) { $up = $true; break }
}
if (-not $up) {
  if ($listening) {
    Say ("  ❌ 端口 {0} 已监听，但接口不响应 —— 进程被卡住了。" -f $port) 'Red'
    Say "     常见原因：node 的输出写控制台被阻塞（鼠标在控制台窗口里选中过内容）。" 'Red'
    Say ("     请看运行日志: {0}" -f (Join-Path $logsDirT 'service.log')) 'Yellow'
  } else {
    Say ("  ❌ 启动后端口 {0} 一直没被监听，服务启动失败。" -f $port) 'Red'
    Say ("     请看运行日志里的报错（常见：数据库连不上、端口被占）: {0}" -f (Join-Path $logsDirT 'service.log')) 'Red'
  }
  Save-Log; exit 1
}
Say "  ✅ 端口已监听且接口有响应" 'Green'
Start-Sleep -Seconds 2

# --- 8. 自检 --------------------------------------------------------------
Head "8/9 自检（判断是否真的换成新代码）"
$okAll = $true

# 8.1 新版标记接口：旧代码 404，新代码 401/403
$st = Get-UrlStatus -Url ("http://127.0.0.1:{0}/api/admin/todos" -f $portI) -Timeout 20
if ($st -eq 404) {
  Say ("  ❌ /api/admin/todos 返回 404 —— 服务仍在跑旧代码" ) 'Red'; $okAll = $false
} elseif ($st -eq 401 -or $st -eq 403) {
  Say ("  ✅ /api/admin/todos 返回 {0}（路由存在，未登录，符合预期）" -f $st) 'Green'
} elseif ($st -eq 0) {
  Say "  ❌ 接口无响应" 'Red'; $okAll = $false
} else {
  Say ("  ⚠ /api/admin/todos 返回 {0}（既不是 404 也不是 401，请人工确认）" -f $st) 'Yellow'
}

# 8.2 前端入口 JS 指纹
$nowEntry = Get-LiveEntry -Port $portI
Say ("  线上入口 JS: {0}   包内入口 JS: {1}" -f $(if ($nowEntry) { $nowEntry } else { '-' }), $pkgEntry)
if ($nowEntry -and $nowEntry -eq $pkgEntry) { Say "  ✅ 前端已换成新版" 'Green' }
else { Say "  ❌ 前端入口 JS 与包内不一致，浏览器可能仍拿到旧页面" 'Red'; $okAll = $false }

# 8.3 开源项目接口
try {
  $r = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/api/opensource?page=1&pageSize=1" -f $portI) -TimeoutSec 25
  Say ("  ✅ 开源项目接口正常，总数 {0}" -f $r.total) 'Green'
} catch { Say ("  ⚠ 开源项目接口异常: {0}" -f $_.Exception.Message) 'Yellow' }

# 8.4 sitemap
try {
  $s = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/sitemap.xml" -f $portI) -TimeoutSec 25 -UseBasicParsing
  $loc = ([regex]::Match([string]$s.Content, '<loc>([^<]+)</loc>')).Groups[1].Value
  Say ("  sitemap 首条: {0}" -f $loc) 'Green'
  if ($loc -match 'localhost') { Say "  ❌ sitemap 仍指向 localhost" 'Red'; $okAll = $false }
} catch { Say "  ⚠ sitemap 自检失败" 'Yellow' }

# 8.5 图片是否还在
try {
  $p = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/api/products?page=1&pageSize=1" -f $portI) -TimeoutSec 25
  $cover = ''
  if ($p.list -and $p.list.Count -gt 0) { $cover = [string]$p.list[0].cover }
  if ($cover) {
    $st2 = Get-UrlStatus -Url ("http://127.0.0.1:{0}{1}" -f $portI, $cover) -Timeout 20
    if ($st2 -eq 200) { Say ("  ✅ 商品图片正常: {0}" -f $cover) 'Green' }
    else { Say ("  ❌ 商品图片取不到（{0}）: {1}" -f $st2, $cover) 'Red'; $okAll = $false }
  }
} catch { Say "  ⚠ 商品接口自检失败" 'Yellow' }

# --- 9. 结论 --------------------------------------------------------------
Head "9/9 结论"
Say ("  安装目录: {0}" -f $target.Dir)
Say ("  访问端口: {0}" -f $port)
Say ("  日志文件: {0}" -f $LogPath)
if ($okAll) {
  Say ""
  Say "  ✅ 部署成功：磁盘代码与运行中的服务都已是新版。" 'Green'
} else {
  Say ""
  Say "  ❌ 部署未完全成功，请把本日志发给协助者。" 'Red'
}
Say ""
Say "  请在浏览器打开站点并按 Ctrl+F5 强制刷新，检查:" 'Yellow'
Say "    1) 顶部导航出现「开源项目」入口" 'Yellow'
Say "    2) 站点/opensource 显示 157 个项目，无空白卡片" 'Yellow'
Say "    3) 商品列表页：搜索不重复刷新、分页可点、卡片可进详情" 'Yellow'
Say "    4) 商品图片正常显示" 'Yellow'
Save-Log
if ($okAll) { exit 0 } else { exit 1 }
