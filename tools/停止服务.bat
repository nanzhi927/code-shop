@echo off
REM ===================================================================
REM  Stop the code-shop site (scheduled task + whatever owns the port).
REM  ASCII-only on purpose: cannot be broken by console codepage issues.
REM ===================================================================
setlocal

net session >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Administrator rights are required.
  echo         Close this window, then:
  echo           right-click this file - Run as administrator
  echo.
  pause
  exit /b 1
)

echo Stopping scheduled task ...
schtasks /end /tn "code-shop-server" >nul 2>&1

echo Stopping the process that owns the site port ...
powershell -NoProfile -Command "$f='%~dp0server\.env'; $p=''; if (Test-Path $f) { $m=Select-String -Path $f -Pattern '^\s*PORT\s*=\s*(.+)$' | Select-Object -First 1; if ($m) { $p=$m.Matches.Groups[1].Value.Trim() } }; if (-not $p) { $p='40621' }; $n=0; Get-NetTCPConnection -LocalPort ([int]$p) -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; $n++ }; Write-Host ('  port ' + $p + ' : stopped ' + $n + ' process(es)')"

echo.
echo [OK] Done.
echo.
pause
