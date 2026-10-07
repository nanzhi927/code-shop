#Requires -Version 5.1
<#
  在 Windows Server 2016 上安装 OpenSSH Server（手动安装包方式）

  为什么不用 Add-WindowsCapability：
    实测在 Server 2016 上它可能"不报错但不生效"——命令返回成功，
    但 C:\Windows\System32\OpenSSH 里没有 sshd.exe，属于假成功。
    因此本脚本直接走官方 Win32-OpenSSH 手动安装包，结果可验证。

  用法（服务器上以【管理员】身份运行）：
    powershell -ExecutionPolicy Bypass -File .\install-openssh-v2.ps1

  脚本动作：
    1. 诊断：列出系统功能状态、现存 sshd.exe、sshd 服务 binPath
    2. 清理：删除指向不存在文件的历史 sshd 服务（避免冲突）
    3. 下载 OpenSSH-Win64 稳定版（多个源依次尝试）
    4. 解压到 C:\Program Files\OpenSSH
    5. 执行 install-sshd.ps1 注册服务并生成主机密钥
    6. 补齐主机密钥、修正私钥 ACL
    7. 服务设为自动启动并启动，失败则抓事件日志 / sshd -d 报错
    8. 防火墙放行 22、写入公钥并修正 ACL、打印指纹
    9. 自检 22 端口监听

  不改动任何业务文件、不动数据库。
#>
[CmdletBinding()]
param(
  [string]$PublicKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIjFGmNcsZdegQ+6Qs7+889wHYEk059Q3OcL7If0ImcA dsh-agent-code-shop',
  [string]$InstallDir = "$env:ProgramFiles\OpenSSH"
)

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

function Say { param([string]$m, [string]$c = 'Gray') Write-Host $m -ForegroundColor $c }
function Head { param([string]$m)
  Say ""; Say ("=" * 62) 'DarkCyan'; Say "  $m" 'Cyan'; Say ("=" * 62) 'DarkCyan' }

Head "在 Windows Server 2016 上安装 OpenSSH Server（手动安装包）"
Say ("  主机: {0}    时间: {1}" -f $env:COMPUTERNAME, (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
      [Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Say "  [错误] 请以【管理员】身份运行" 'Red'; exit 1
}

# --- 1. 诊断 --------------------------------------------------------------
Head "1/9 诊断当前状态"
try {
  $caps = Get-WindowsCapability -Online -Name 'OpenSSH*' -ErrorAction Stop
  foreach ($c in $caps) { Say ("  系统功能 {0} = {1}" -f $c.Name, $c.State) 'DarkGray' }
  if (-not $caps) { Say "  系统功能里没有 OpenSSH 相关条目" 'DarkGray' }
} catch { Say ("  查询系统功能失败: {0}" -f $_.Exception.Message) 'DarkGray' }

$foundExe = @()
foreach ($p in @("$env:SystemRoot\System32\OpenSSH\sshd.exe", "$env:ProgramFiles\OpenSSH\sshd.exe")) {
  if (Test-Path -LiteralPath $p) { $foundExe += $p; Say ("  ✅ 发现 sshd.exe: {0}" -f $p) 'Green' }
}
if (-not $foundExe) { Say "  ❌ 两处都没有 sshd.exe —— 确认此前安装未真正生效" 'Yellow' }

$qc = (& sc.exe qc sshd) 2>&1 | Out-String
if ($qc -match 'BINARY_PATH_NAME') {
  $bin = ($qc -split "`n" | Where-Object { $_ -match 'BINARY_PATH_NAME' }) -join ''
  Say ("  现有 sshd 服务 binPath: {0}" -f $bin.Trim()) 'DarkGray'
  $binPath = (($bin -split ':', 2)[1]).Trim()
  if ($binPath -and -not (Test-Path -LiteralPath $binPath)) {
    Say "  ⚠ 该路径不存在 —— 这是之前那次假安装留下的空服务，需要删除" 'Yellow'
  }
} else {
  Say "  当前没有 sshd 服务" 'DarkGray'
}

# --- 2. 清理坏服务 --------------------------------------------------------
Head "2/9 清理无效的 sshd 服务"
if ($qc -match 'BINARY_PATH_NAME') {
  & sc.exe stop sshd 2>&1 | Out-Null
  Start-Sleep -Seconds 2
  $del = & sc.exe delete sshd 2>&1
  $del | ForEach-Object { Say ("      " + $_) 'DarkGray' }
  Start-Sleep -Seconds 2
  Say "  已删除旧服务（若原本有效也会被 install-sshd.ps1 重建）" 'DarkGray'
} else {
  Say "  无需清理" 'DarkGray'
}

# --- 3. 下载 --------------------------------------------------------------
Head "3/9 下载 Win32-OpenSSH 稳定版"
$tmp = Join-Path $env:TEMP ('openssh_' + (Get-Random))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$zip = Join-Path $tmp 'OpenSSH-Win64.zip'

# 若已手动下载到固定路径，直接复用，不联网
$manual = 'C:\OpenSSH-Win64.zip'
if (Test-Path -LiteralPath $manual) {
  Copy-Item -LiteralPath $manual -Destination $zip -Force
  Say ("  已发现手动下载的安装包 {0}，跳过联网下载" -f $manual) 'Green'
  $skipDownload = $true
} else {
  $skipDownload = $false
}
$base = 'https://github.com/PowerShell/Win32-OpenSSH/releases/download/v9.5.0.0p1-Beta/OpenSSH-Win64.zip'
$urls = @(
  $base,
  ('https://gh-proxy.com/' + $base),
  ('https://ghproxy.net/' + $base),
  ('https://gh.llkk.cc/' + $base)
)
$got = $false
if (-not $skipDownload) {
foreach ($u in $urls) {
  Say ("  尝试: {0}" -f ($u -replace '^https://', ''))
  try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    Invoke-WebRequest -Uri $u -OutFile $zip -TimeoutSec 240 -UseBasicParsing
    $sw.Stop()
    Say ("  ✅ 下载成功 {0} MB，耗时 {1} 秒" -f `
      [math]::Round((Get-Item $zip).Length / 1MB, 2), [math]::Round($sw.Elapsed.TotalSeconds, 1)) 'Green'
    $got = $true
    break
  } catch {
    Say ("  ❌ {0}" -f $_.Exception.Message.Split([char]10)[0]) 'Red'
  }
}
}
if (-not $got -and -not $skipDownload) {
  Say ""
  Say "  [错误] 所有源都失败。请在服务器浏览器里手动下载：" 'Red'
  Say ("  {0}" -f $base) 'Yellow'
  Say ("  保存为 {0} 后重跑本脚本（会自动复用该文件）" -f $zip) 'Yellow'
  exit 1
}

# --- 4. 解压安装 ----------------------------------------------------------
Head "4/9 解压并放置文件"
Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
$srcDir = Join-Path $tmp 'OpenSSH-Win64'
if (-not (Test-Path -LiteralPath $srcDir)) {
  $srcDir = (Get-ChildItem -LiteralPath $tmp -Directory | Select-Object -First 1).FullName
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item -Path (Join-Path $srcDir '*') -Destination $InstallDir -Recurse -Force
$sshd   = Join-Path $InstallDir 'sshd.exe'
$keygen = Join-Path $InstallDir 'ssh-keygen.exe'
if (-not (Test-Path -LiteralPath $sshd)) {
  Say "  [错误] 解压后仍没有 sshd.exe，请把 $tmp 的内容发我" 'Red'
  exit 1
}
Say ("  ✅ 已放置到 {0}" -f $InstallDir) 'Green'
Get-ChildItem -LiteralPath $InstallDir -Filter '*.exe' | ForEach-Object { Say ("      " + $_.Name) 'DarkGray' }

# --- 5. 注册服务 ----------------------------------------------------------
Head "5/9 注册 sshd 服务"
$inst = Join-Path $InstallDir 'install-sshd.ps1'
if (Test-Path -LiteralPath $inst) {
  Say "  执行 install-sshd.ps1 ..."
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $inst 2>&1 |
    ForEach-Object { Say ("      " + $_) 'DarkGray' }
} else {
  Say "  安装包内没有 install-sshd.ps1，直接注册服务" 'Yellow'
  & sc.exe create sshd binPath= "`"$sshd`"" start= auto DisplayName= "OpenSSH SSH Server" 2>&1 |
    ForEach-Object { Say ("      " + $_) 'DarkGray' }
}
& sc.exe config sshd binPath= "`"$sshd`"" start= auto 2>&1 | Out-Null

# --- 6. 主机密钥 ----------------------------------------------------------
Head "6/9 主机密钥"
$sshDir = Join-Path $env:ProgramData 'ssh'
if (-not (Test-Path -LiteralPath $sshDir)) { New-Item -ItemType Directory -Force -Path $sshDir | Out-Null }
Say ("  密钥目录: {0}" -f $sshDir)

if (Test-Path -LiteralPath $keygen) {
  Say "  执行 ssh-keygen -A（补齐所有缺失的主机密钥）..."
  & $keygen -A 2>&1 | ForEach-Object { Say ("      " + $_) 'DarkGray' }
}
foreach ($t in @('ed25519', 'rsa')) {
  $kf = Join-Path $sshDir ("ssh_host_{0}_key" -f $t)
  if (-not (Test-Path -LiteralPath $kf) -and (Test-Path -LiteralPath $keygen)) {
    Say ("  显式生成 {0} ..." -f $t)
    & cmd.exe /c "`"$keygen`" -t $t -f `"$kf`" -N `"`"" 2>&1 | ForEach-Object { Say ("      " + $_) 'DarkGray' }
  }
}
$hostKeys = Get-ChildItem -LiteralPath $sshDir -Filter 'ssh_host_*_key' -ErrorAction SilentlyContinue
if ($hostKeys) {
  Say ("  ✅ 主机密钥 {0} 个" -f $hostKeys.Count) 'Green'
  foreach ($hk in $hostKeys) {
    & icacls.exe $hk.FullName /inheritance:r 2>&1 | Out-Null
    & icacls.exe $hk.FullName /grant "SYSTEM:F" 2>&1 | Out-Null
    & icacls.exe $hk.FullName /grant "Administrators:F" 2>&1 | Out-Null
    Say ("      {0}  {1} 字节（ACL 已修正）" -f $hk.Name, $hk.Length) 'DarkGray'
  }
} else {
  Say "  ❌ 没有主机密钥，sshd 无法启动" 'Red'
}

# --- 7. 启动服务 ----------------------------------------------------------
Head "7/9 启动 sshd 服务"
& sc.exe start sshd 2>&1 | ForEach-Object { Say ("      " + $_) 'DarkGray' }
Start-Sleep -Seconds 5
$svc = Get-Service -Name sshd -ErrorAction SilentlyContinue
if ($svc) {
  Say ("  服务状态: {0} / 启动类型: {1}" -f $svc.Status, $svc.StartType) $(if ($svc.Status -eq 'Running') { 'Green' } else { 'Red' })
}
if (-not $svc -or $svc.Status -ne 'Running') {
  Say ""
  Say "  启动失败，抓取证据：" 'Yellow'
  try {
    Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'sshd' } -MaxEvents 10 -ErrorAction Stop |
      ForEach-Object {
        $msg = ($_.Message -replace "`r?`n", ' ')
        Say ("      [{0}] {1}" -f $_.TimeCreated.ToString('HH:mm:ss'), $msg.Substring(0, [Math]::Min(160, $msg.Length))) 'DarkGray'
      }
  } catch { Say "      事件日志无 sshd 记录" 'DarkGray' }
  Say "  改用 -d 前台模式看报错（3 秒后自动结束）：" 'Yellow'
  $job = Start-Job -ScriptBlock { param($e) & $e -d 2>&1 | Select-Object -First 20 } -ArgumentList $sshd
  Wait-Job $job -Timeout 12 | Out-Null
  Receive-Job $job | ForEach-Object { Say ("      " + $_) 'DarkGray' }
  Remove-Job $job -Force -ErrorAction SilentlyContinue
}

# --- 8. 防火墙与公钥 ------------------------------------------------------
Head "8/9 防火墙与免密登录公钥"
if (-not (Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' `
    -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 -ErrorAction SilentlyContinue | Out-Null
  Say "  已新增入站规则 TCP 22" 'Green'
} else { Say "  防火墙规则已存在" 'DarkGray' }

$keyFile = Join-Path $sshDir 'administrators_authorized_keys'
$key = $PublicKey.Trim()
$cur = if (Test-Path -LiteralPath $keyFile) { Get-Content -LiteralPath $keyFile -ErrorAction SilentlyContinue } else { @() }
if ($cur -contains $key) { Say "  公钥已存在" 'DarkGray' }
else { $key | Out-File -LiteralPath $keyFile -Encoding ASCII -Append; Say "  已写入公钥" 'Green' }
& icacls.exe $keyFile /inheritance:r 2>&1 | Out-Null
& icacls.exe $keyFile /grant "Administrators:F" 2>&1 | Out-Null
& icacls.exe $keyFile /grant "SYSTEM:F" 2>&1 | Out-Null
Say "  ACL 已修正" 'Green'
if (Test-Path -LiteralPath $keygen) {
  Say ("  公钥指纹: {0}" -f ((& $keygen -l -f $keyFile 2>&1) -join ' ')) 'DarkGray'
}

# --- 9. 自检 --------------------------------------------------------------
Head "9/9 自检"
$listen = Get-NetTCPConnection -LocalPort 22 -State Listen -ErrorAction SilentlyContinue
if ($listen) {
  foreach ($l in $listen) { Say ("  ✅ 监听中 {0}:{1}  PID {2}" -f $l.LocalAddress, $l.LocalPort, $l.OwningProcess) 'Green' }
} else {
  Say "  ❌ 22 端口未监听" 'Red'
}
Say ""
Say ("  sshd 服务: {0}" -f (Get-Service sshd -ErrorAction SilentlyContinue).Status) 'DarkGray'
Say ""
Say "  若显示监听中，请把本次全部输出发回给主控。" 'Yellow'
Say ""
