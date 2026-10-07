@echo off
REM ===================================================================
REM  code-shop deploy launcher (v3)
REM  ASCII-only on purpose: cannot be broken by console codepage issues.
REM ===================================================================
setlocal
cd /d "%~dp0"

echo ============================================================
echo   code-shop deploy  v3
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

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
set RC=%ERRORLEVEL%
echo.
if "%RC%"=="0" (
  echo [OK] Deploy finished successfully. Please press Ctrl+F5 in the browser.
) else (
  echo [FAILED] Deploy did not fully succeed. Exit code: %RC%
  echo          Send the log file on the Desktop to the assistant.
)
echo.
pause
