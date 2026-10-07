#Requires -Version 5.1
<#
  修复 Windows Server 上 sshd 服务无法启动的问题，并确保 22 端口监听。

  典型场景：用系统功能（Add-WindowsCapability）装好 OpenSSH 后，
  sshd 服务存在但状态 Stopped，22 端口不监听。原因通常是：
    1) 缺少主机密钥（C:\ProgramData\ssh\ssh_host_*_key）
    2) 服务 binPath 指向错误，或未正确注册

  用法（服务器上以【管理员】身份运行）：
    powershell -ExecutionPolicy Bypass -File .\fix-sshd.ps1

  本脚本只做：生成主机密钥、修正服务注册、启动服务、放行防火墙、
  校验公钥与 ACL、打印诊断。不改动任何业务文件。
#>
[CmdletBinding()]
param(
  [string]$PublicKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIjFGmNcsZdegQ+6Qs7+889wHYEk059Q3OcL7If0ImcA dsh-agent-code-shop'
)

$ErrorActionPreference = 'Continue'

function Say { param([string]$m, [string]$c = 'Gray') Write-Host $m -ForegroundColor $c }
function Head { param([string]$m)
  Say ""; Say ("=" * 60) 'DarkCyan'; Say "  $m" 'Cyan'; Say ("=" * 60) 'DarkCyan' }

Head "修复 sshd 服务并确保 22 端口监听"
Say ("  主机: {0}" -f $env:COMPUTERNAME)

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
      [Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Say "  [错误] 请以【管理员】身份运行" 'Red'; exit 1
}

# --- 1. 定位 sshd.exe ------------------------------------------------------
Head "1/7 定位 OpenSSH 安装位置"
$cands = @(
  (Join-Path $env:SystemRoot 'System32\OpenSSH'),
  (Join-Path $env:ProgramFiles 'OpenSSH')
)
$dir = $null
foreach ($c in $cands) {
  if (Test-Path -LiteralPath (Join-Path $c 'sshd.exe')) { $dir = $c; break }
}
if (-not $dir) {
  Say "  [错误] 两处都没找到 sshd.exe，OpenSSH 未安装成功" 'Red'
  Say "        请先运行 install-openssh.ps1" 'Red'
  exit 1
}
$sshd     = Join-Path $dir 'sshd.exe'
$keygen   = Join-Path $dir 'ssh-keygen.exe'
Say ("  安装目录: {0}" -f $dir) 'Green'
Say ("  sshd.exe 存在: {0}   ssh-keygen.exe 存在: {1}" -f (Test-Path $sshd), (Test-Path $keygen))
Get-ChildItem -LiteralPath $dir -Filter '*.exe' | ForEach-Object { Say ("      " + $_.Name) 'DarkGray' }

# --- 2. 生成主机密钥 -------------------------------------------------------
Head "2/7 检查并生成主机密钥"
$sshDir = Join-Path $env:ProgramData 'ssh'
if (-not (Test-Path -LiteralPath $sshDir)) { New-Item -ItemType Directory -Force -Path $sshDir | Out-Null }
Say ("  密钥目录: {0}" -f $sshDir)

$need = @()
foreach ($t in @('ed25519', 'rsa')) {
  $kf = Join-Path $sshDir ("ssh_host_{0}_key" -f $t)
  if (Test-Path -LiteralPath $kf) { Say ("  已有 {0}" -f (Split-Path $kf -Leaf)) 'DarkGray' }
  else { $need += $t }
}

if ($need.Count -gt 0) {
  Say ("  缺少主机密钥类型: {0}，开始生成" -f ($need -join ', ')) 'Yellow'
  # 先试 -A（自动补齐所有缺失类型）
  if (Test-Path -LiteralPath $keygen) {
    Say "  执行 ssh-keygen -A ..."
    & $keygen -A 2>&1 | ForEach-Object { Say ("      " + $_) 'DarkGray' }
  }
  # 仍缺的用显式 -f 生成（-N 空口令，用 cmd 规避 PowerShell 引号问题）
  foreach ($t in $need) {
    $kf = Join-Path $sshDir ("ssh_host_{0}_key" -f $t)
    if (Test-Path -LiteralPath $kf) { continue }
    Say ("  显式生成 {0} ..." -f $t)
    & cmd.exe /c "`"$keygen`" -t $t -f `"$kf`" -N `"`"" 2>&1 | ForEach-Object { Say ("      " + $_) 'DarkGray' }
  }
}

$hostKeys = Get-ChildItem -LiteralPath $sshDir -Filter 'ssh_host_*_key' -ErrorAction SilentlyContinue
if ($hostKeys) {
  Say ("  ✅ 主机密钥 {0} 个:" -f $hostKeys.Count) 'Green'
  $hostKeys | ForEach-Object { Say ("      {0}  {1} 字节" -f $_.Name, $_.Length) 'DarkGray' }
} else {
  Say "  ❌ 仍然没有主机密钥，sshd 无法启动" 'Red'
}
# 私钥权限必须是 SYSTEM/Administrators 独占，否则 sshd 拒绝加载
foreach ($hk in $hostKeys) {
  & icacls.exe $hk.FullName /inheritance:r 2>&1 | Out-Null
  & icacls.exe $hk.FullName /grant "SYSTEM:F" 2>&1 | Out-Null
  & icacls.exe $hk.FullName /grant "Administrators:F" 2>&1 | Out-Null
}
if ($hostKeys) { Say "  已修正主机私钥 ACL" 'Green' }

# --- 3. 服务注册 -----------------------------------------------------------
Head "3/7 检查 sshd 服务注册"
$svc = Get-Service -Name sshd -ErrorAction SilentlyContinue
if (-not $svc) {
  Say "  服务不存在，创建..." 'Yellow'
  & sc.exe create sshd binPath= "`"$sshd`"" start= auto DisplayName= "OpenSSH SSH Server" 2>&1 |
    ForEach-Object { Say ("      " + $_) 'DarkGray' }
  & sc.exe description sshd "OpenSSH SSH Server" 2>&1 | Out-Null
} else {
  Say "  服务已存在" 'DarkGray'
}
# 校验 binPath 是否正确指向 sshd.exe；不对就修正
$qc = (& sc.exe qc sshd) 2>&1 | Out-String
$binLine = ($qc -split "`n" | Where-Object { $_ -match 'BINARY_PATH_NAME' }) -join ''
Say ("  当前 binPath: {0}" -f $binLine.Trim()) 'DarkGray'
if ($binLine -notmatch [regex]::Escape($sshd)) {
  Say "  binPath 不正确，修正为 $sshd" 'Yellow'
  & sc.exe config sshd binPath= "`"$sshd`"" start= auto 2>&1 | ForEach-Object { Say ("      " + $_) 'DarkGray' }
}
& sc.exe config sshd start= auto 2>&1 | Out-Null

# --- 4. 启动服务 -----------------------------------------------------------
Head "4/7 启动 sshd 服务"
& sc.exe stop sshd 2>&1 | Out-Null
Start-Sleep -Seconds 2
$startOut = & sc.exe start sshd 2>&1
$startOut | ForEach-Object { Say ("      " + $_) 'DarkGray' }
Start-Sleep -Seconds 5

$svc = Get-Service -Name sshd -ErrorAction SilentlyContinue
Say ("  服务状态: {0} / 启动类型: {1}" -f $svc.Status, $svc.StartType) $(if ($svc.Status -eq 'Running') { 'Green' } else { 'Red' })

if ($svc.Status -ne 'Running') {
  Say ""
  Say "  启动失败，抓取事件日志（最近 8 条 sshd 相关）:" 'Yellow'
  try {
    Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'sshd' } -MaxEvents 8 -ErrorAction Stop |
      ForEach-Object { Say ("      [{0}] {1}" -f $_.TimeCreated.ToString('HH:mm:ss'), ($_.Message -replace "`r?`n", ' ').Substring(0, [Math]::Min(150, $_.Message.Length))) 'DarkGray' }
  } catch {
    Say "      事件日志中没有 sshd 记录" 'DarkGray'
    Say "  改用前台方式启动，直接看报错：" 'Yellow'
    & $sshd -d 2>&1 | Select-Object -First 15 | ForEach-Object { Say ("      " + $_) 'DarkGray' }
  }
}

# --- 5. 防火墙 ------------------------------------------------------------
Head "5/7 防火墙入站规则"
$rule = Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue
if (-not $rule) {
  New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' `
    -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 -ErrorAction SilentlyContinue | Out-Null
  Say "  已新增规则（TCP 22）" 'Green'
} else {
  Say "  规则已存在" 'DarkGray'
}

# --- 6. 公钥与 ACL ---------------------------------------------------------
Head "6/7 免密登录公钥"
$keyFile = Join-Path $sshDir 'administrators_authorized_keys'
$key = $PublicKey.Trim()
$cur = if (Test-Path -LiteralPath $keyFile) { Get-Content -LiteralPath $keyFile -ErrorAction SilentlyContinue } else { @() }
if ($cur -contains $key) { Say "  公钥已存在" 'DarkGray' }
else { $key | Out-File -LiteralPath $keyFile -Encoding ASCII -Append; Say "  已追加公钥" 'Green' }
& icacls.exe $keyFile /inheritance:r 2>&1 | Out-Null
& icacls.exe $keyFile /grant "Administrators:F" 2>&1 | Out-Null
& icacls.exe $keyFile /grant "SYSTEM:F" 2>&1 | Out-Null
Say "  ACL 已修正（仅 Administrators / SYSTEM）" 'Green'
Say ("  公钥指纹: {0}" -f ((& $keygen -l -f $keyFile 2>&1) -join ' ')) 'DarkGray'

# --- 7. 自检 --------------------------------------------------------------
Head "7/7 自检"
$listen = Get-NetTCPConnection -LocalPort 22 -State Listen -ErrorAction SilentlyContinue
if ($listen) {
  $listen | Select-Object -First 3 | ForEach-Object { Say ("  ✅ 监听中 {0}:{1}  PID {2}" -f $_.LocalAddress, $_.LocalPort, $_.OwningProcess) 'Green' }
} else {
  Say "  ❌ 22 端口未监听" 'Red'
}
Say ""
Say "  服务详情:" 'DarkGray'
Say ("      sshd  = {0}" -f (Get-Service sshd -ErrorAction SilentlyContinue).Status) 'DarkGray'
Say ("      ssh-agent = {0}" -f (Get-Service ssh-agent -ErrorAction SilentlyContinue).Status) 'DarkGray'
Say ""
Say "  若上面显示 22 端口监听中，请让主控从本机执行：" 'Yellow'
Say "      ssh -i D:\deepseek_work\ssh\id_ed25519_codeshop Administrator@62.234.122.127" 'Yellow'
Say ""
