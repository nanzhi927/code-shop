#Requires -Version 5.1
<#
  收尾：注册 sshd 服务并启动（绕过 install-sshd.ps1 的已知缺陷）

  现场情况：
    - Win32-OpenSSH 已解压到 C:\Program Files\OpenSSH（sshd.exe 等齐全）
    - install-sshd.ps1 执行到 C:\ProgramData\ssh 权限修复时崩溃：
        OpenSSHUtils.psm1:624  New-Object FileSystemAccessRule
        "对于类型 FileSystemRights 的此种用法，值 268435456 无效"
      这是该模块在部分系统上的已知 bug，导致服务没被注册、
      且 sshd_config 没被复制过去（sshd -d 报 No such file）

  本脚本用 icacls 直接设权限，不调用 OpenSSHUtils，因此不会触发该 bug。

  用法（服务器上以【管理员】身份运行）：
    powershell -ExecutionPolicy Bypass -File .\finish-sshd.ps1
#>
[CmdletBinding()]
param(
  [string]$InstallDir = "$env:ProgramFiles\OpenSSH"
)

$ErrorActionPreference = 'Continue'

function Say { param([string]$m, [string]$c = 'Gray') Write-Host $m -ForegroundColor $c }
function Head { param([string]$m)
  Say ""; Say ("=" * 62) 'DarkCyan'; Say "  $m" 'Cyan'; Say ("=" * 62) 'DarkCyan' }

Head "收尾：注册 sshd 服务并启动"
Say ("  主机: {0}    时间: {1}" -f $env:COMPUTERNAME, (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
      [Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Say "  [错误] 请以【管理员】身份运行" 'Red'; exit 1
}

$sshd    = Join-Path $InstallDir 'sshd.exe'
$keygen  = Join-Path $InstallDir 'ssh-keygen.exe'
$defCfg  = Join-Path $InstallDir 'sshd_config_default'
$sshDir  = Join-Path $env:ProgramData 'ssh'
$cfg     = Join-Path $sshDir 'sshd_config'

# --- 1. 前置检查 ----------------------------------------------------------
Head "1/7 前置检查"
if (-not (Test-Path -LiteralPath $sshd)) {
  Say ("  [错误] 找不到 {0}，请先运行 install-openssh-v2.ps1" -f $sshd) 'Red'
  exit 1
}
Say ("  ✅ sshd.exe: {0}" -f $sshd) 'Green'
if (-not (Test-Path -LiteralPath $sshDir)) { New-Item -ItemType Directory -Force -Path $sshDir | Out-Null }
Say ("  密钥目录: {0}" -f $sshDir)

# --- 2. 部署 sshd_config --------------------------------------------------
Head "2/7 部署 sshd_config"
if (Test-Path -LiteralPath $cfg) {
  Say "  已存在，保留现有配置" 'DarkGray'
} elseif (Test-Path -LiteralPath $defCfg) {
  Copy-Item -LiteralPath $defCfg -Destination $cfg -Force
  Say ("  ✅ 已从 sshd_config_default 复制并部署" ) 'Green'
} else {
  Say "  模板不存在，写入内置最小配置" 'Yellow'
  $builtin = @(
    '# code-shop 自动生成的最小 sshd 配置',
    'Port 22',
    'Subsystem	sftp	sftp-server.exe',
    'AuthorizedKeysFile	.ssh/authorized_keys',
    '',
    'Match Group administrators',
    '       AuthorizedKeysFile __PROGRAMDATA__/ssh/administrators_authorized_keys'
  ) -join "`r`n"
  $builtin | Out-File -LiteralPath $cfg -Encoding ASCII
}
Say "  配置要点:"
Get-Content -LiteralPath $cfg -ErrorAction SilentlyContinue |
  Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') } |
  ForEach-Object { Say ("      " + $_) 'DarkGray' }

# --- 3. 权限（用 icacls，避开 OpenSSHUtils 的 bug）------------------------
Head "3/7 修正权限（icacls 方式）"
# 目录：SYSTEM/Administrators 完全控制，Users 只读
& icacls.exe $sshDir /inheritance:r 2>&1 | Out-Null
& icacls.exe $sshDir /grant "SYSTEM:(OI)(CI)F" 2>&1 | Out-Null
& icacls.exe $sshDir /grant "Administrators:(OI)(CI)F" 2>&1 | Out-Null
& icacls.exe $sshDir /grant "Users:(OI)(CI)R" 2>&1 | Out-Null

# sshd_config：不能让普通用户写（否则 sshd 拒绝加载）
& icacls.exe $cfg /inheritance:r 2>&1 | Out-Null
& icacls.exe $cfg /grant "SYSTEM:F" 2>&1 | Out-Null
& icacls.exe $cfg /grant "Administrators:F" 2>&1 | Out-Null
& icacls.exe $cfg /grant "Users:R" 2>&1 | Out-Null

# 主机私钥：仅 SYSTEM/Administrators
$hostKeys = Get-ChildItem -LiteralPath $sshDir -Filter 'ssh_host_*_key' -ErrorAction SilentlyContinue
foreach ($hk in $hostKeys) {
  & icacls.exe $hk.FullName /inheritance:r 2>&1 | Out-Null
  & icacls.exe $hk.FullName /grant "SYSTEM:F" 2>&1 | Out-Null
  & icacls.exe $hk.FullName /grant "Administrators:F" 2>&1 | Out-Null
}
Say ("  已处理: 目录 / sshd_config / 主机密钥 {0} 个" -f $hostKeys.Count) 'Green'

$keyFile = Join-Path $sshDir 'administrators_authorized_keys'
if (Test-Path -LiteralPath $keyFile) {
  & icacls.exe $keyFile /inheritance:r 2>&1 | Out-Null
  & icacls.exe $keyFile /grant "Administrators:F" 2>&1 | Out-Null
  & icacls.exe $keyFile /grant "SYSTEM:F" 2>&1 | Out-Null
  Say "  administrators_authorized_keys 权限已修正" 'Green'
}

# --- 4. 注册服务 ----------------------------------------------------------
Head "4/7 注册 sshd 服务"
$existing = Get-Service -Name sshd -ErrorAction SilentlyContinue
if ($existing) {
  Say "  已存在同名服务，先停止并删除" 'Yellow'
  & sc.exe stop sshd 2>&1 | Out-Null
  Start-Sleep -Seconds 2
  & sc.exe delete sshd 2>&1 | ForEach-Object { Say ("      " + $_) 'DarkGray' }
  Start-Sleep -Seconds 2
}
$create = & sc.exe create sshd binPath= "`"$sshd`"" start= auto DisplayName= "OpenSSH SSH Server" 2>&1
$create | ForEach-Object { Say ("      " + $_) 'DarkGray' }
& sc.exe description sshd "OpenSSH SSH Server" 2>&1 | Out-Null
& sc.exe sidtype sshd unrestricted 2>&1 | Out-Null
Say "  服务注册完成" 'Green'

# --- 5. 启动 --------------------------------------------------------------
Head "5/7 启动 sshd"
$start = & sc.exe start sshd 2>&1
$start | ForEach-Object { Say ("      " + $_) 'DarkGray' }
Start-Sleep -Seconds 6
$svc = Get-Service -Name sshd -ErrorAction SilentlyContinue
if ($svc) {
  Say ("  服务状态: {0} / 启动类型: {1}" -f $svc.Status, $svc.StartType) $(if ($svc.Status -eq 'Running') { 'Green' } else { 'Red' })
}

if (-not $svc -or $svc.Status -ne 'Running') {
  Say ""
  Say "  启动失败，抓证据：" 'Yellow'
  try {
    Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'sshd' } -MaxEvents 10 -ErrorAction Stop |
      ForEach-Object {
        $m = ($_.Message -replace "`r?`n", ' ')
        Say ("      [{0}] {1}" -f $_.TimeCreated.ToString('HH:mm:ss'), $m.Substring(0, [Math]::Min(200, $m.Length))) 'DarkGray'
      }
  } catch { Say "      事件日志无 sshd 记录" 'DarkGray' }

  Say "  用 sshd -d 前台模式看详细报错：" 'Yellow'
  $job = Start-Job -ScriptBlock { param($e) & $e -d 2>&1 | Select-Object -First 25 } -ArgumentList $sshd
  Wait-Job $job -Timeout 15 | Out-Null
  Receive-Job $job | ForEach-Object { Say ("      " + $_) 'DarkGray' }
  Remove-Job $job -Force -ErrorAction SilentlyContinue
}

# --- 6. 防火墙 ------------------------------------------------------------
Head "6/7 防火墙"
if (-not (Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' `
    -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 -ErrorAction SilentlyContinue | Out-Null
  Say "  已新增入站规则 TCP 22" 'Green'
} else { Say "  规则已存在" 'DarkGray' }

# --- 7. 自检 --------------------------------------------------------------
Head "7/7 自检"
$listen = Get-NetTCPConnection -LocalPort 22 -State Listen -ErrorAction SilentlyContinue
if ($listen) {
  foreach ($l in $listen) { Say ("  ✅ 监听中 {0}:{1}  PID {2}" -f $l.LocalAddress, $l.LocalPort, $l.OwningProcess) 'Green' }
} else {
  Say "  ❌ 22 端口仍未监听" 'Red'
}
Say ""
if ((Test-Path -LiteralPath $keyFile) -and (Test-Path -LiteralPath $keygen)) {
  Say ("  公钥指纹: {0}" -f ((& $keygen -l -f $keyFile 2>&1) -join ' ')) 'DarkGray'
}
Say ("  sshd 服务: {0}" -f (Get-Service sshd -ErrorAction SilentlyContinue).Status) 'DarkGray'
Say ""
Say "  请把本次全部输出发回给主控。" 'Yellow'
Say ""
