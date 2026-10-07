@echo off
REM ===================================================================
REM  Register the code-shop site as a scheduled task:
REM  auto start at boot, runs as SYSTEM, survives logoff / reboot.
REM  ASCII-only on purpose: cannot be broken by console codepage issues.
REM ===================================================================
setlocal
cd /d "%~dp0"

echo ============================================================
echo   code-shop  -  register as scheduled task
echo ============================================================
echo   Folder: %CD%
echo.

net session >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Administrator rights are required.
  echo         Close this window, then:
  echo           right-click this file - Run as administrator
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-service.ps1"
set RC=%ERRORLEVEL%
echo.
if "%RC%"=="0" (
  echo [OK] The site is now managed by the scheduled task "code-shop-server".
) else (
  echo [FAILED] Exit code: %RC%
)
echo.
pause
