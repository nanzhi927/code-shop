@echo off
chcp 65001 >nul
title code-shop 开发模式
cd /d "%~dp0"
echo 开发模式：后端 + Vite 前端热更新
echo API / 页面端口见终端输出，Ctrl+C 停止
echo.
npm run dev
pause
