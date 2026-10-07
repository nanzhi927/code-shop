@echo off
REM ===================================================================
REM  IMPORTANT: this file must stay GBK/ANSI (codepage 936) encoded.
REM  Do NOT add "chcp 65001" here: switching codepage mid-batch makes
REM  cmd.exe lose its read position and the rest of the file is parsed wrong.
REM ===================================================================
setlocal
cd /d "%~dp0"

echo ============================================================
echo   code-shop 服务器更新脚本
echo ============================================================
echo   工作目录: %CD%
echo.

if not exist "server\.env" (
  echo [错误] 在当前目录下找不到 server\.env
  echo.
  echo        当前目录: %CD%
  echo.
  echo        请确认两点:
  echo        1. 本脚本是否与 启动.bat 放在同一个目录
  echo        2. 该目录的 server 文件夹里是否真有 .env
  echo           查看命令: dir /a server\.env
  echo.
  echo        若确实没有: 新版仓库已不再包含 .env,
  echo        请从原来能正常运行的目录里把 server\.env 复制过来。
  echo.
  pause
  exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [错误] 当前目录不是 git 仓库，无法用 git 更新。
  echo.
  echo        当前目录: %CD%
  echo.
  echo        说明: 这是从 Gitee 下载 ZIP 解压出来的目录，没有 .git。
  echo.
  echo        解决办法（二选一）:
  echo        A. 下载最新 ZIP 覆盖（保留 server\.env）:
  echo           https://gitee.com/nanzhiyu/code-shop/repository/archive/main.zip
  echo        B. 改用 git 克隆一次，以后本脚本就能直接用:
  echo           cd /d %%USERPROFILE%%\Desktop
  echo           git clone https://gitee.com/nanzhiyu/code-shop.git code-shop-new
  echo           再把 server\.env 复制进 code-shop-new\server\ 后重跑本脚本
  echo.
  pause
  exit /b 1
)

echo [1/6] 备份数据库配置 server\.env
copy /Y "server\.env" "server\.env.keep" >nul
if errorlevel 1 (
  echo        [错误] 备份失败，已中止
  pause
  exit /b 1
)
echo        已备份为 server\.env.keep
echo.

echo [2/6] 拉取最新代码
git fetch origin
if errorlevel 1 (
  echo        [错误] git fetch 失败，请检查网络或仓库地址
  pause
  exit /b 1
)
git reset --hard origin/main
if errorlevel 1 (
  echo        [错误] git reset 失败
  pause
  exit /b 1
)
echo.

echo [3/6] 还原 server\.env
echo        新版已把 .env 移出版本控制，上一步会删掉它，必须在这里还原
copy /Y "server\.env.keep" "server\.env" >nul
if not exist "server\.env" (
  echo        [错误] 还原失败，请手动把 server\.env.keep 改名为 server\.env
  pause
  exit /b 1
)
echo        已还原
echo.

echo [4/6] 安装后端依赖
pushd server
call npm install --omit=dev
if errorlevel 1 echo        [警告] 依赖安装失败，服务可能启动异常
popd
echo.

echo [5/6] 停止旧服务并启动新服务
call "停止.bat" quiet
timeout /t 3 /nobreak >nul
start "code-shop商城" /D "%CD%\server" cmd /k "node src\index.js"
timeout /t 6 /nobreak >nul
echo.

echo [6/6] 自检
echo        请求本机接口 /api/opensource ...
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/opensource' -TimeoutSec 15; Write-Host ('        成功: 返回 ' + $r.items.Count + ' 个开源项目，空标题 ' + (@($r.items ^| Where-Object { -not $_.title }).Count) + ' 条') } catch { Write-Host '        接口未就绪，或端口不是 8080，请以 server\.env 中的 PORT 为准' }"

echo.
echo ============================================================
echo   更新完成。请打开站点并按 Ctrl+F5 强制刷新，检查:
echo     1) 顶部导航是否出现「开源项目」入口
echo     2) 站点地址/opensource 是否显示 157 个项目且无空白卡片
echo     3) 技术栈筛选、搜索、翻页是否正常
echo     4) 原有商品列表、登录、后台是否正常
echo ============================================================
echo.
pause
