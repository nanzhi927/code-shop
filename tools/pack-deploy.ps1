#Requires -Version 5.1
<#
  code-shop 部署包打包脚本
  把仓库里【已构建好的】代码打成免 git 的部署包 deploy\code-shop-update.zip。

  顶层文件夹名固定为 code-shop-update，故意与常见安装目录 code-shop-deploy 区分开，
  避免用户解压时与安装目录合并、同名文件被跳过，导致"部署了但没换代码"。

  用法：
    powershell -ExecutionPolicy Bypass -File D:\code-shop\tools\pack-deploy.ps1
    powershell -ExecutionPolicy Bypass -File D:\code-shop\tools\pack-deploy.ps1 -SkipBuild
#>
[CmdletBinding()]
param(
  [string]$Repo = 'D:\code-shop',
  [string]$OutDir = 'D:\code-shop\deploy',
  [string]$StageName = 'code-shop-update',
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Say { param([string]$m, [string]$c = 'Gray') Write-Host $m -ForegroundColor $c }

if (-not (Test-Path -LiteralPath $Repo)) { throw "仓库不存在: $Repo" }
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }

# --- 1. 构建前端 ----------------------------------------------------------
if (-not $SkipBuild) {
  Say "1/6 构建前端 (web)..." 'Cyan'
  # 注意：不能直接 & npm ... 2>&1 交给管道。
  # 本脚本开了 $ErrorActionPreference='Stop'，而 Vite/npm 的告警走 stderr，
  # 在 PS 5.1 里会被当成终止性错误直接中断打包。
  # 因此改用 cmd 重定向到日志文件，再按退出码判断。
  $buildLog = Join-Path $env:TEMP 'code-shop-build.log'
  if (Test-Path -LiteralPath $buildLog) { Remove-Item -LiteralPath $buildLog -Force }
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  Push-Location (Join-Path $Repo 'web')
  & cmd.exe /c "npm run build > `"$buildLog`" 2>&1"
  $rc = $LASTEXITCODE
  Pop-Location
  $ErrorActionPreference = $prevEap
  if (Test-Path -LiteralPath $buildLog) {
    Get-Content -LiteralPath $buildLog -Tail 6 -ErrorAction SilentlyContinue |
      ForEach-Object { Say ("      " + $_) 'DarkGray' }
  }
  if ($rc -ne 0) { throw "npm run build 失败（exit $rc），完整日志: $buildLog" }
  Say "      构建完成" 'Green'
} else {
  Say "1/6 跳过前端构建（-SkipBuild）" 'Yellow'
}

$dist = Join-Path $Repo 'web\dist'
if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) { throw "缺少 web\dist\index.html，请先构建前端" }

# --- 2. 暂存目录（放在系统临时目录，避免把仓库里的旧包卷进去）------------
Say "2/6 准备暂存目录..." 'Cyan'
$stage = Join-Path $env:TEMP $StageName
if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

function Copy-Dir {
  param([string]$Rel)
  $src = Join-Path $Repo $Rel
  if (-not (Test-Path -LiteralPath $src)) { Say ("      跳过（不存在）: {0}" -f $Rel) 'DarkGray'; return }
  $dst = Join-Path $stage $Rel
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Get-ChildItem -LiteralPath $src -Recurse -File -Force |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.Name -notlike '*.keep' } |
    ForEach-Object {
      $rel = $_.FullName.Substring($src.Length).TrimStart('\')
      $to = Join-Path $dst $rel
      New-Item -ItemType Directory -Force -Path (Split-Path $to -Parent) | Out-Null
      Copy-Item -LiteralPath $_.FullName -Destination $to -Force
    }
  Say ("      + {0}" -f $Rel) 'DarkGray'
}
function Copy-File {
  param([string]$Rel, [string]$As = '')
  $src = Join-Path $Repo $Rel
  if (-not (Test-Path -LiteralPath $src)) { Say ("      跳过（不存在）: {0}" -f $Rel) 'DarkGray'; return }
  # 默认【保持相对路径】（server\package.json 必须落在包内 server\ 下）。
  # 曾经这里默认只取文件名，导致 server\package.json 被丢到包根目录，
  # 部署脚本校验时直接报「包内缺少 server\package.json」。
  if (-not $As) { $As = $Rel }
  $to = Join-Path $stage $As
  New-Item -ItemType Directory -Force -Path (Split-Path $to -Parent) | Out-Null
  Copy-Item -LiteralPath $src -Destination $to -Force
  Say ("      + {0}" -f $As) 'DarkGray'
}

# 代码与前端产物
Copy-Dir 'server\src'
Copy-Dir 'server\data'
Copy-Dir 'server\scripts'
Copy-Dir 'web\dist'
Copy-File 'server\package.json'
Copy-File 'server\package-lock.json'
# 包内 .env 必须是【生产配置】（端口 40621 / 线上数据库），
# 不能把仓库里给本地开发用的 server\.env（127.0.0.1:3306 / 8080）打进去。
Copy-File 'server\.env.prod' -As 'server\.env'
Copy-File 'server\.env.example'
# 根目录运维脚本
foreach ($f in @('start.bat', '启动.bat', '停止.bat', '开发启动.bat', '服务器更新.bat', '服务器更新.ps1', 'README.md')) {
  Copy-File $f
}
# 部署脚本、服务托管脚本与说明（从 tools 目录改名放到包根）
Copy-File 'tools\deploy.ps1'          -As 'deploy.ps1'
Copy-File 'tools\一键部署.bat'         -As '一键部署.bat'
Copy-File 'tools\使用说明.txt'         -As '使用说明.txt'
Copy-File 'tools\install-service.ps1' -As 'install-service.ps1'
Copy-File 'tools\注册服务.bat'         -As '注册服务.bat'
Copy-File 'tools\启动服务.bat'         -As '启动服务.bat'
Copy-File 'tools\停止服务.bat'         -As '停止服务.bat'

# --- 3. 校验暂存内容 ------------------------------------------------------
Say "3/6 校验暂存内容..." 'Cyan'
$must = @('deploy.ps1', '一键部署.bat', '使用说明.txt',
          'server\src\index.js', 'server\src\routes\admin.js', 'server\src\init.js',
          'server\package.json', 'server\package-lock.json',
          'server\.env', 'web\dist\index.html')
foreach ($m in $must) {
  if (-not (Test-Path -LiteralPath (Join-Path $stage $m))) { throw "暂存内容缺少: $m" }
}
# 反向检查：这些文件必须【不在】包根目录（曾因 Copy-File 只取文件名而错位，
# 导致部署脚本报「包内缺少 server\package.json」）
foreach ($bad in @('package.json', 'package-lock.json', '.env', '.env.example')) {
  if (Test-Path -LiteralPath (Join-Path $stage $bad)) { throw "包根目录出现了不该有的文件: $bad（应该在 server\ 下）" }
}
$html = Get-Content -LiteralPath (Join-Path $stage 'web\dist\index.html') -Raw -Encoding UTF8
$entry = ([regex]::Match($html, 'src="(/assets/index-[^"]+\.js)"')).Groups[1].Value
if (-not $entry) { throw "无法从 web\dist\index.html 识别入口 JS" }
$adm = Get-Content -LiteralPath (Join-Path $stage 'server\src\routes\admin.js') -Raw -Encoding UTF8
if ($adm -notmatch "'/todos'") { throw "包内 admin.js 不含新版标记 /todos，说明源码不是最新" }
$dep = Get-Content -LiteralPath (Join-Path $stage 'deploy.ps1') -Raw -Encoding UTF8
if ($dep -notmatch 'v3') { throw "包内 deploy.ps1 不是 v3" }
# 内容页是否已构建进去
$hasHelp = @(Get-ChildItem -LiteralPath (Join-Path $stage 'web\dist\assets') -Filter 'Help-*.js' -ErrorAction SilentlyContinue).Count -gt 0
Say ("      入口 JS: {0}" -f $entry) 'Green'
Say ("      新版标记 /todos: 有" ) 'Green'
Say ("      内容页 Help 资源: {0}" -f $(if ($hasHelp) { '有' } else { '无（内容页可能没构建进去）' })) $(if ($hasHelp) { 'Green' } else { 'Yellow' })

# --- 4. 打包 --------------------------------------------------------------
Say "4/6 打包..." 'Cyan'
$zip = Join-Path $OutDir ($StageName + '.zip')
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $stage, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $true)
$zi = Get-Item -LiteralPath $zip
Say ("      {0}  ({1:N0} 字节 / {2:N0} KB)" -f $zi.Name, $zi.Length, ($zi.Length / 1KB)) 'Green'

# --- 5. 回读校验 ----------------------------------------------------------
Say "5/6 回读校验 zip..." 'Cyan'
$z = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  # 不同打包 API 的分隔符可能是 / 或 \，统一后再比对
  $names = $z.Entries | ForEach-Object { $_.FullName.Replace('\', '/') }
  $need = @("$StageName/deploy.ps1", "$StageName/一键部署.bat", "$StageName/使用说明.txt",
            "$StageName/server/src/routes/admin.js", "$StageName/web/dist/index.html",
            "$StageName/server/.env")
  foreach ($n in $need) {
    if ($names -notcontains $n) { throw "zip 内缺少条目: $n" }
  }
  if (-not ($names | Where-Object { $_ -match '/web/dist/assets/Help-' })) { Say "      [警告] zip 内没有 Help 资源" 'Yellow' }
  # 包内 .env 必须是生产端口
  $en = $z.Entries | Where-Object { $_.FullName.Replace('\', '/') -eq "$StageName/server/.env" }
  if ($en) {
    $sr = New-Object System.IO.StreamReader($en.Open())
    $envTxt = $sr.ReadToEnd(); $sr.Close()
    if ($envTxt -notmatch 'PORT=40621') { throw "包内 server/.env 不是生产配置（缺少 PORT=40621）" }
    Say "      包内 .env 为生产配置（PORT=40621）" 'Green'
  }
  Say ("      条目数: {0}，关键条目齐全" -f $z.Entries.Count) 'Green'
} finally { $z.Dispose() }

# --- 6. 清理 --------------------------------------------------------------
Say "6/6 清理暂存目录..." 'Cyan'
Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue

Say ""
Say ("完成: {0}" -f $zip) 'Green'
Say ("入口 JS: {0}   顶层目录: {1}" -f $entry, $StageName) 'Green'
Say "请把该 zip 传到服务器，解压到一个【和安装目录不同】的新文件夹后运行 一键部署.bat" 'Yellow'
