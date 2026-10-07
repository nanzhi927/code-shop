#Requires -Version 5.1
<#
  让 sshd 通过【开机计划任务】常驻运行（绕过服务方式启动失败的问题）

  背景：
    - sshd.exe -d / -D 前台常驻模式实测正常，能 Bind 到 22 并监听
    - 但注册成 Windows 服务后启动即"意外停止"（SCM 日志无具体错误码）
    - sshd -d 输出中持续出现 debug1: get_passwd: lookup_sid() failed: 1332.
      1332 = ERROR_NONE_MAPPED，这是 Server 2016 上的已知痛点；
      即使已用 sc privs 补齐 5 项服务特权，服务方式仍无法启动

  做法：
    把 sshd 交给任务计划程序管理 —— 以 SYSTEM 身份、开机触发、
    无执行时限、失败自动重启，运行 sshd.exe -D。
    这与服务方式的运行上下文一致（session 0 + SYSTEM），
    但不经过 SCM，因此不受该问题影响。

  用法（服务器上以【管理员】身份运行）：
    powershell -ExecutionPolicy Bypass -File .\sshd-as-task.ps1

  管理命令：
    查看: schtasks /query /tn code-shop-sshd /v /fo list
    启动: schtasks /run  /tn code-shop-sshd
    停止: schtasks /end  /tn code-shop-sshd
    删除: schtasks /delete /tn code-shop-sshd /f
#>
[CmdletBinding()]
param(
  [string]$InstallDir = "$env:ProgramFiles\OpenSSH",
  [string]$TaskName   = 'code-shop-sshd'
)

$ErrorActionPreference = 'Continue'

function Say { param([string]$m, [string]$c = 'Gray') Write-Host $m -ForegroundColor $c }
function Head { param([string]$m)
  Say ""; Say ("=" * 62) 'DarkCyan'; Say "  $m" 'Cyan'; Say ("=" * 62) 'DarkCyan' }

Head "让 sshd 通过开机计划任务常驻运行"
Say ("  主机: {0}    时间: {1}" -f $env:COMPUTERNAME, (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
      [Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Say "  [错误] 请以【管理员】身份运行" 'Red'; exit 1
}

$sshd   = Join-Path $InstallDir 'sshd.exe'
$keygen = Join-Path $InstallDir 'ssh-keygen.exe'
$sshDir = Join-Path $env:ProgramData 'ssh'

# --- 1. 前置检查 ----------------------------------------------------------
Head "1/6 前置检查"
if (-not (Test-Path -LiteralPath $sshd)) { Say ("  [错误] 找不到 {0}" -f $sshd) 'Red'; exit 1 }
Say ("  ✅ sshd.exe: {0}" -f $sshd) 'Green'
Say ("  sshd_config 存在: {0}" -f (Test-Path -LiteralPath (Join-Path $sshDir 'sshd_config')))
Say ("  主机密钥: {0} 个" -f (Get-ChildItem -LiteralPath $sshDir -Filter 'ssh_host_*_key' -ErrorAction SilentlyContinue).Count)

# --- 2. 停掉会冲突的 sshd 服务 -------------------------------------------
Head "2/6 停用 sshd 服务（避免与计划任务抢 22 端口）"
$svc = Get-Service -Name sshd -ErrorAction SilentlyContinue
if ($svc) {
  & sc.exe stop sshd 2>&1 | Out-Null
  Start-Sleep -Seconds 2
  & sc.exe config sshd start= disabled 2>&1 | ForEach-Object { Say ("      " + $_) 'DarkGray' }
  Say "  已设为禁用（若以后服务方式修好，可改回 auto）" 'DarkGray'
} else {
  Say "  没有 sshd 服务，无需处理" 'DarkGray'
}

# 清掉可能残留的监听进程
$existing = Get-NetTCPConnection -LocalPort 22 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  foreach ($c in $existing) {
    Say ("  22 端口已被 PID {0} 占用，结束它" -f $c.OwningProcess) 'Yellow'
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 2
}

# --- 3. 注册计划任务 ------------------------------------------------------
Head "3/6 注册开机计划任务"
$old = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($old) {
  Say "  已存在同名任务，先删除" 'Yellow'
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

try {
  $action = New-ScheduledTaskAction -Execute $sshd -Argument '-D' -WorkingDirectory $InstallDir
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  # ExecutionTimeLimit 设为 0 = 不限时（默认 3 天后会被杀掉）
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Description 'code-shop: 常驻运行 OpenSSH sshd（-D 前台模式）' -Force | Out-Null
  Say "  ✅ 任务已注册：" 'Green'
  Say ("      动作: {0} -D" -f $sshd) 'DarkGray'
  Say "      身份: SYSTEM（最高权限）  触发: 开机  时限: 无限制" 'DarkGray'
} catch {
  Say ("  [错误] 注册失败: {0}" -f $_.Exception.Message) 'Red'
  exit 1
}

# --- 4. 立即启动 ----------------------------------------------------------
Head "4/6 立即启动"
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 8
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) { Say ("  任务状态: {0}" -f $task.State) 'DarkGray' }
if ($info) { Say ("  上次运行结果: {0}  上次运行时间: {1}" -f $info.LastTaskResult, $info.LastRunTime) 'DarkGray' }

# --- 5. 自检 --------------------------------------------------------------
Head "5/6 自检 22 端口"
$ok = $false
for ($i = 1; $i -le 3; $i++) {
  $listen = Get-NetTCPConnection -LocalPort 22 -State Listen -ErrorAction SilentlyContinue
  if ($listen) {
    foreach ($l in $listen) { Say ("  ✅ 监听中 {0}:{1}  PID {2}" -f $l.LocalAddress, $l.LocalPort, $l.OwningProcess) 'Green' }
    $ok = $true
    break
  }
  Say ("  第 {0} 次未监听，等待 4 秒..." -f $i) 'DarkGray'
  Start-Sleep -Seconds 4
}

if (-not $ok) {
  Say "  ❌ 仍未监听，排查：" 'Red'
  Say ("  任务结果码: {0}" -f (Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue).LastTaskResult) 'Yellow'
  Say "  用 sshd -D 前台直接跑 8 秒看输出:"
  $job = Start-Job -ScriptBlock { param($e) & $e -D 2>&1 | Select-Object -First 15 } -ArgumentList $sshd
  Wait-Job $job -Timeout 10 | Out-Null
  Receive-Job $job | ForEach-Object { Say ("      " + $_) 'DarkGray' }
  Remove-Job $job -Force -ErrorAction SilentlyContinue
  Say ""
  Say "  另可查看任务历史：事件查看器 -> 应用程序和服务日志 -> Microsoft -> Windows -> TaskScheduler" 'DarkGray'
} else {
  Say ""
  Say "  ✅ sshd 已常驻运行，开机自启（由计划任务保证）" 'Green'
}

# --- 6. 管理命令 ----------------------------------------------------------
Head "6/6 管理命令"
Say "    查看: schtasks /query /tn $TaskName /v /fo list" 'DarkGray'
Say "    启动: schtasks /run  /tn $TaskName" 'DarkGray'
Say "    停止: schtasks /end  /tn $TaskName" 'DarkGray'
Say "    删除: schtasks /delete /tn $TaskName /f" 'DarkGray'
$keyFile = Join-Path $sshDir 'administrators_authorized_keys'
if ((Test-Path -LiteralPath $keyFile) -and (Test-Path -LiteralPath $keygen)) {
  Say ("    公钥指纹: {0}" -f ((& $keygen -l -f $keyFile 2>&1) -join ' ')) 'DarkGray'
}
Say ""
Say "  请把本次全部输出发回给主控。" 'Yellow'
Say ""
