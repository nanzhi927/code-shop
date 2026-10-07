@echo off
REM ===================================================================
REM  Start the code-shop site through the scheduled task.
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

echo Requesting start of scheduled task "code-shop-server" ...
schtasks /run /tn "code-shop-server"
if errorlevel 1 (
  echo.
  echo [FAILED] Could not start the task. It may not be registered yet.
  echo          Run  zhucefuwu.bat  ^(or install-service.ps1^)  first.
) else (
  echo.
  echo [OK] Start requested. Wait about 10 seconds, then open the site.
)
echo.
pause
