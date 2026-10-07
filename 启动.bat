@echo off
chcp 65001 >nul
title code-shop 启动
cd /d "%~dp0"

echo ========================================
echo   毕设源码商城 - 一键启动
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node.js 20+
  pause
  exit /b 1
)

if not exist "server\.env" (
  echo [错误] 缺少 server\.env
  echo 请从 server\.env.example 复制一份并填写数据库配置
  pause
  exit /b 1
)

if not exist "server\node_modules\" (
  echo [提示] 首次运行，正在安装后端依赖...
  pushd server
  call npm install --omit=dev
  if errorlevel 1 (
    echo [错误] 依赖安装失败
    popd
    pause
    exit /b 1
  )
  popd
)

if not exist "web\dist\index.html" (
  echo [警告] 未找到 web\dist，前台页面可能打不开
  echo        本机可执行: cd web ^&^& npm install ^&^& npm run build
  echo.
)

REM 若已在运行则先停掉旧进程
call "%~dp0停止.bat" quiet

if not exist "server\logs" mkdir "server\logs"

echo 正在启动服务...
start "code-shop商城" /D "%~dp0server" cmd /k "node src\index.js"

timeout /t 2 /nobreak >nul
echo.
echo [完成] 已打开服务窗口「code-shop商城」
echo        关闭该窗口即停止服务；也可双击 停止.bat
echo        访问地址见 server\.env 中的 PORT（如 http://服务器IP:8080 ）
echo.
pause
