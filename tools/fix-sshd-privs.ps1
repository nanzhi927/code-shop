#Requires -Version 5.1
<#
  让 sshd 以【服务】方式启动（补齐官方 install-sshd.ps1 中缺失的两步）

  现场情况：
    - sshd -d 前台模式正常，能 Bind 到 22 并监听
    - 但作为服务启动后立即退出（STATE: START_PENDING -> Stopped）
    - Application 日志里查不到 sshd 记录

  根因（对照官方 install-sshd.ps1 第 137-138、126 行）：
    1) 缺少服务特权授予。官方会执行：
         sc.exe privs sshd SeAssignPrimaryTokenPrivilege/SeTcbPrivilege/SeBackupPrivilege/SeRestorePrivilege/SeImpersonatePrivilege
       没有 SeAssignPrimaryTokenPrivilege / SeImpersonatePrivilege，
       sshd 无法创建用户令牌，以服务方式启动会直接退出；
       而 -d 前台模式不需要这些特权，所以前台正常。
    2) 事件日志清单未注册（wevtutil im openssh-events.man），
       所以 Application 日志里看不到 sshd 记录。

  用法（服务器上以【管理员】身份运行）：
    powershell -ExecutionPolicy Bypass -File .\fix-sshd-privs.ps1
#>
[CmdletBinding()]
param(
  [string]$InstallDir = "$env:ProgramFiles\OpenSSH"
)

$ErrorActionPreference = 'Continue'

function Say { param([string]$m, [string]$c = 'Gray') Write-Host $m -ForegroundColor $c }
function Head { param([string]$m)
  Say ""; Say ("=" * 62) 'DarkCyan'; Say "  $m" 'Cyan'; Say ("=" * 62) 'DarkCyan' }

Head "让 sshd 以服务方式启动"
Say ("  主机: {0}    时间: {1}" -f $env:COMPUTERNAME, (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
      [Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Say "  [错误] 请以【管理员】身份运行" 'Red'; exit 1
}

$sshd = Join-Path $InstallDir 'sshd.exe'
$man  = Join-Path $InstallDir 'openssh-events.man'
$keygen = Join-Path $InstallDir 'ssh-keygen.exe'
$sshDir = Join-Path $env:ProgramData 'ssh'

# --- 1. 当前服务配置 ------------------------------------------------------
Head "1/6 当前 sshd 服务配置"
$qc = (& sc.exe qc sshd) 2>&1 | Out-String
if ($qc -notmatch 'SERVICE_NAME') {
  Say "  [错误] sshd 服务不存在，请先运行 finish-sshd.ps1" 'Red'
  exit 1
}
$qc -split "`r?`n" | Where-Object { $_.Trim() } | ForEach-Object { Say ("      " + $_.Trim()) 'DarkGray' }

# --- 2. 授予服务特权（官方脚本的关键一步）--------------------------------
Head "2/6 授予服务特权"
$privs = 'SeAssignPrimaryTokenPrivilege/SeTcbPrivilege/SeBackupPrivilege/SeRestorePrivilege/SeImpersonatePrivilege'
Say ("  执行: sc.exe privs sshd {0}" -f $privs) 'DarkGray'
$out = & sc.exe privs sshd $privs 2>&1
$out | ForEach-Object { Say ("      " + $_) 'DarkGray' }
# 复核
$qpriv = (& sc.exe qprivs sshd) 2>&1 | Out-String
Say "  复核已授予的特权:" 'DarkGray'
$qpriv -split "`r?`n" | Where-Object { $_.Trim() -and $_ -match 'Se[A-Za-z]+' } | ForEach-Object { Say ("      " + $_.Trim()) 'Green' }

# --- 3. 注册事件日志清单（让 sshd 能写事件日志）--------------------------
Head "3/6 注册事件日志清单"
if (Test-Path -LiteralPath $man) {
  $r = & wevtutil.exe im $man 2>&1
  $r | ForEach-Object { Say ("      " + $_) 'DarkGray' }
  $srcOk = $false
  try { $srcOk = [System.Diagnostics.EventLog]::SourceExists('sshd') } catch {}
  Say ("  sshd 事件源已注册: {0}" -f $srcOk) $(if ($srcOk) { 'Green' } else { 'Yellow' })
} else {
  Say ("  未找到清单文件: {0}（不影响启动，只是事件日志无记录）" -f $man) 'Yellow'
}

# --- 4. 启动 --------------------------------------------------------------
Head "4/6 启动 sshd 服务"
& sc.exe stop sshd 2>&1 | Out-Null
Start-Sleep -Seconds 2
$start = & sc.exe start sshd 2>&1
$start | ForEach-Object { Say ("      " + $_) 'DarkGray' }
Start-Sleep -Seconds 6

$svc = Get-Service -Name sshd -ErrorAction SilentlyContinue
if ($svc) {
  Say ("  服务状态: {0} / 启动类型: {1}" -f $svc.Status, $svc.StartType) $(if ($svc.Status -eq 'Running') { 'Green' } else { 'Red' })
}

# --- 5. 失败则抓 SCM 日志（关键：服务退出的真实原因）---------------------
if (-not $svc -or $svc.Status -ne 'Running') {
  Head "5/6 启动失败，抓 Service Control Manager 记录"
  try {
    Get-WinEvent -LogName 'System' -MaxEvents 60 -ErrorAction Stop |
      Where-Object { $_.Message -match 'sshd|OpenSSH' } |
      Select-Object -First 8 |
      ForEach-Object {
        $m = ($_.Message -replace "`r?`n", ' ')
        Say ("      [{0}] {1}" -f $_.TimeCreated.ToString('HH:mm:ss'), $m.Substring(0, [Math]::Min(220, $m.Length))) 'Yellow'
      }
  } catch { Say ("      读取系统日志失败: {0}" -f $_.Exception.Message) 'DarkGray' }

  if ([System.Diagnostics.EventLog]::SourceExists('sshd')) {
    try {
      Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'sshd' } -MaxEvents 10 -ErrorAction Stop |
        ForEach-Object {
          $m = ($_.Message -replace "`r?`n", ' ')
          Say ("      [app {0}] {1}" -f $_.TimeCreated.ToString('HH:mm:ss'), $m.Substring(0, [Math]::Min(220, $m.Length))) 'Yellow'
        }
    } catch { Say "      Application 日志仍无 sshd 记录" 'DarkGray' }
  }
  Say ""
  Say "  再用 sshd -d 对照（前台模式，应能正常监听）:" 'DarkGray'
  $job = Start-Job -ScriptBlock { param($e) & $e -d 2>&1 | Select-Object -First 12 } -ArgumentList $sshd
  Wait-Job $job -Timeout 12 | Out-Null
  Receive-Job $job | ForEach-Object { Say ("      " + $_) 'DarkGray' }
  Remove-Job $job -Force -ErrorAction SilentlyContinue
} else {
  Head "5/6 启动成功，跳过故障排查"
}

# --- 6. 自检 --------------------------------------------------------------
Head "6/6 自检"
$listen = Get-NetTCPConnection -LocalPort 22 -State Listen -ErrorAction SilentlyContinue
if ($listen) {
  foreach ($l in $listen) { Say ("  ✅ 监听中 {0}:{1}  PID {2}" -f $l.LocalAddress, $l.LocalPort, $l.OwningProcess) 'Green' }
} else {
  Say "  ❌ 22 端口未监听" 'Red'
}
$keyFile = Join-Path $sshDir 'administrators_authorized_keys'
if ((Test-Path -LiteralPath $keyFile) -and (Test-Path -LiteralPath $keygen)) {
  Say ("  公钥指纹: {0}" -f ((& $keygen -l -f $keyFile 2>&1) -join ' ')) 'DarkGray'
}
Say ("  sshd 服务: {0}" -f (Get-Service sshd -ErrorAction SilentlyContinue).Status) 'DarkGray'
Say ""
Say "  请把本次全部输出发回给主控。" 'Yellow'
Say ""
