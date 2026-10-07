@echo off
chcp 65001 >nul
title code-shop 停止
cd /d "%~dp0"

echo 正在停止商城服务...

REM 按窗口标题结束
taskkill /FI "WINDOWTITLE eq code-shop商城*" /T /F >nul 2>&1

REM 再按命令行匹配 node src/index.js（防漏）
powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'src[\\/]index\.js' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo [完成] 已停止（若本来没开也不会报错）
if /I not "%~1"=="quiet" pause
