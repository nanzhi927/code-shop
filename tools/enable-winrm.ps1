#Requires -Version 5.1
<#
  启用 WinRM（PowerShell 远程管理），给远程协助开一条命令通道。

  为什么用 WinRM 而不是 OpenSSH：
    Server 2016 上 OpenSSH 装不上（Add-WindowsCapability 假成功、
    sshd 报 get_passwd: lookup_sid() failed: 1332）。
    WinRM 是 Server 2016 原生内置的，不需要下载任何东西。

  本脚本处理三个关键坑：
    1) 腾讯云服务器的网络位置通常是「公用(Public)」，
       直接 Enable-PSRemoting 会失败 -> 必须加 -SkipNetworkProfileCheck
    2) Windows 默认禁止用【本地账号】远程连接（UAC 远程限制），
       Administrator 是本地账号，必须设 LocalAccountTokenFilterPolicy=1，
       否则认证报 Access is denied
    3) 默认的 WinRM 防火墙规则对所有来源开放，
       本脚本会把它收窄到指定 IP，避免把 5985 暴露给全网

  用法（服务器上以【管理员】身份运行）：
    powershell -ExecutionPolicy Bypass -File .\enable-winrm.ps1
    powershell -ExecutionPolicy Bypass -File .\enable-winrm.ps1 -AllowedIp 1.2.3.4
    powershell -ExecutionPolicy Bypass -File .\enable-winrm.ps1 -CreateOpsUser   # 建一个专用账号，不用交出 Administrator 口令
#>
[CmdletBinding()]
param(
  # 允许远程连接的来源公网 IP（只放行这一个，不放开 5985 给全网）
  [string]$AllowedIp = '183.200.25.188',
  # 是否创建一个专用管理员账号（可选；不建就用现有 Administrator）
  [switch]$CreateOpsUser,
  [string]$OpsUser = 'opsdsh',
  [string]$OpsPassword = '',
  # 服务器自己的公网 IP（打印客户端 TrustedHosts 命令时使用）
  [string]$PublicIp = '62.234.122.127'
)

$ErrorActionPreference = 'Continue'

function Say { param([string]$m, [string]$c = 'Gray') Write-Host $m -ForegroundColor $c }
function Head { param([string]$m)
  Say ""; Say ("=" * 64) 'DarkCyan'; Say "  $m" 'Cyan'; Say ("=" * 64) 'DarkCyan' }

Head "启用 WinRM 远程管理"
Say ("  主机: {0}    时间: {1}" -f $env:COMPUTERNAME, (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Say ("  允许来源 IP: {0}" -f $AllowedIp) 'Yellow'

$idw = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($idw)).IsInRole(
      [Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Say "  [错误] 请以【管理员】身份运行" 'Red'; exit 1
}

# --- 1. 网络位置类型 ------------------------------------------------------
Head "1/7 网络位置检查"
try {
  Get-NetConnectionProfile -ErrorAction Stop | ForEach-Object {
    Say ("  接口 {0}  类别 {1}" -f $_.InterfaceAlias, $_.NetworkCategory) 'DarkGray'
  }
} catch { Say "  读取失败（不影响后续）" 'DarkGray' }

# --- 2. 启用 WinRM --------------------------------------------------------
Head "2/7 启用 WinRM"
try {
  Enable-PSRemoting -Force -SkipNetworkProfileCheck -ErrorAction Stop 2>&1 |
    ForEach-Object { Say ("      " + $_) 'DarkGray' }
  Say "  ✅ Enable-PSRemoting 完成" 'Green'
} catch {
  Say ("  ⚠ Enable-PSRemoting 报错: {0}" -f $_.Exception.Message) 'Yellow'
  Say "  改为手动启用：" 'Yellow'
  try { Set-Service WinRM -StartupType Automatic -ErrorAction Stop } catch {}
  try { Start-Service WinRM -ErrorAction Stop } catch {}
  try { & winrm.exe quickconfig -quiet -force 2>&1 | ForEach-Object { Say ("      " + $_) 'DarkGray' } } catch {}
}

# --- 3. 服务与监听 --------------------------------------------------------
Head "3/7 WinRM 服务状态"
try { Set-Service WinRM -StartupType Automatic -ErrorAction Stop } catch {}
$svc = Get-Service WinRM -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -ne 'Running') { Start-Service WinRM -ErrorAction SilentlyContinue; Start-Sleep -Seconds 3 }
$svc = Get-Service WinRM -ErrorAction SilentlyContinue
Say ("  WinRM: {0} / {1}" -f $svc.Status, $svc.StartType) $(if ($svc.Status -eq 'Running') { 'Green' } else { 'Red' })
try {
  $l = @(Get-NetTCPConnection -LocalPort 5985 -State Listen -ErrorAction Stop)
  if ($l.Count -gt 0) { Say "  ✅ 已监听 5985" 'Green' } else { Say "  ⚠ 未监听 5985" 'Yellow' }
} catch { Say "  （无法读取监听状态）" 'DarkGray' }

# --- 4. 允许本地账号远程认证（关键）--------------------------------------
Head "4/7 允许本地账号远程认证"
$polPath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
$cur = (Get-ItemProperty -Path $polPath -Name LocalAccountTokenFilterPolicy -ErrorAction SilentlyContinue).LocalAccountTokenFilterPolicy
Say ("  LocalAccountTokenFilterPolicy 当前值: {0}" -f $(if ($null -eq $cur) { '未设置（=0，会拦截本地账号远程认证）' } else { $cur }))
try {
  Set-ItemProperty -Path $polPath -Name LocalAccountTokenFilterPolicy -Value 1 -Type DWord -ErrorAction Stop
  Say "  ✅ 已设为 1（允许本地账号远程连接）" 'Green'
} catch {
  Say ("  ❌ 设置失败: {0}" -f $_.Exception.Message) 'Red'
}

# --- 5. 防火墙：收窄到指定来源 IP ----------------------------------------
Head "5/7 防火墙（只放行指定来源 IP）"
$narrowed = 0
try {
  $auto = @(Get-NetFirewallRule -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like '*Windows Remote Management*' -or $_.DisplayName -like '*Windows 远程管理*' })
  foreach ($r in $auto) {
    try {
      Set-NetFirewallRule -Name $r.Name -Enabled True -Profile Any -RemoteAddress $AllowedIp -ErrorAction Stop
      Say ("  已收窄: {0}" -f $r.DisplayName) 'DarkGray'
      $narrowed++
    } catch { Say ("  收窄失败: {0} -> {1}" -f $r.DisplayName, $_.Exception.Message) 'Yellow' }
  }
} catch { }
if ($narrowed -eq 0) { Say "  未找到系统自带规则，将直接新建" 'DarkGray' }

try {
  $mine = Get-NetFirewallRule -Name 'WinRM-5985-ops' -ErrorAction SilentlyContinue
  if ($mine) {
    Set-NetFirewallRule -Name 'WinRM-5985-ops' -Enabled True -Profile Any -RemoteAddress $AllowedIp -ErrorAction Stop
    Say "  ✅ 已更新规则 WinRM-5985-ops" 'Green'
  } else {
    New-NetFirewallRule -Name 'WinRM-5985-ops' -DisplayName 'WinRM 5985 (ops only)' `
      -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 5985 `
      -RemoteAddress $AllowedIp -Profile Any -ErrorAction Stop | Out-Null
    Say "  ✅ 已新建规则 WinRM-5985-ops（仅放行该 IP）" 'Green'
  }
} catch {
  Say ("  ❌ 防火墙规则创建失败: {0}" -f $_.Exception.Message) 'Red'
}

# --- 6. 可选：创建专用账号 ------------------------------------------------
Head "6/7 认证账号"
if ($CreateOpsUser) {
  if (-not $OpsPassword) {
    $chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'.ToCharArray()
    $OpsPassword = -join (1..16 | ForEach-Object { $chars | Get-Random })
  }
  try {
    $sec = ConvertTo-SecureString $OpsPassword -AsPlainText -Force
    $exists = Get-LocalUser -Name $OpsUser -ErrorAction SilentlyContinue
    if ($exists) {
      Set-LocalUser -Name $OpsUser -Password $sec -ErrorAction Stop
      Say ("  ✅ 已重置账号 {0} 的口令" -f $OpsUser) 'Green'
    } else {
      New-LocalUser -Name $OpsUser -Password $sec -PasswordNeverExpires -AccountNeverExpires `
        -Description 'remote ops' -ErrorAction Stop | Out-Null
      Say ("  ✅ 已创建账号 {0}" -f $OpsUser) 'Green'
    }
    try { Add-LocalGroupMember -Group 'Administrators' -Member $OpsUser -ErrorAction Stop } catch { }
    try { Add-LocalGroupMember -Group 'Remote Management Users' -Member $OpsUser -ErrorAction SilentlyContinue } catch { }
    Say ""
    Say "  ============ 请把下面这行发给协助者 ============" 'Yellow'
    Say ("  USER={0}  PASS={1}" -f $OpsUser, $OpsPassword) 'Yellow'
    Say "  ================================================" 'Yellow'
  } catch {
    Say ("  ❌ 专用账号创建失败: {0}" -f $_.Exception.Message) 'Red'
    Say "     可以改用 Administrator 账号（把 Windows 管理员口令发给协助者即可）" 'Yellow'
  }
} else {
  Say "  使用现有 Administrator 账号（如需专用账号，加 -CreateOpsUser 再跑一次）" 'DarkGray'
}

# --- 7. 自检 --------------------------------------------------------------
Head "7/7 自检"
try {
  $r = Test-WSMan -ComputerName localhost -ErrorAction Stop
  Say "  ✅ 本机 WinRM 响应正常" 'Green'
  Say ("      ProductVendor : {0}" -f $r.ProductVendor) 'DarkGray'
  Say ("      ProductVersion: {0}" -f $r.ProductVersion) 'DarkGray'
} catch {
  Say ("  ❌ Test-WSMan 失败: {0}" -f $_.Exception.Message) 'Red'
}

Say ""
Say "============================================================" 'Yellow'
Say "  还需要做两件事：" 'Yellow'
Say "" 'Yellow'
Say "  1) 腾讯云控制台 -> 该服务器的 防火墙/安全组 -> 入站规则 -> 添加：" 'Yellow'
Say "       协议端口: TCP:5985" 'Yellow'
Say ("       来源:     {0}/32   （只放行这一台电脑）" -f $AllowedIp) 'Yellow'
Say "" 'Yellow'
Say "  2) 在你自己的电脑上，用【管理员 PowerShell】执行一次：" 'Yellow'
Say ("       Set-Item WSMan:\localhost\Client\TrustedHosts -Value '{0}' -Force" -f $PublicIp) 'Yellow'
Say "     （这里填【服务器】的公网 IP，不是上面那个来源 IP）" 'Yellow'
Say "" 'Yellow'
Say "  完成后把账号口令发给协助者，他就能直接接管服务器操作。" 'Yellow'
Say "============================================================" 'Yellow'
Say ""
