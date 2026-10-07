#!/usr/bin/env bash
# 一键启动生产服务（Linux）
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未安装 Node.js"
  exit 1
fi

if [ ! -f server/.env ]; then
  echo "[错误] 缺少 server/.env"
  exit 1
fi

if [ ! -d server/node_modules ]; then
  echo "首次安装后端依赖..."
  (cd server && npm install --omit=dev)
fi

mkdir -p server/logs
echo "启动中... 日志: server/logs/out.log"
nohup node server/src/index.js >> server/logs/out.log 2>&1 &
echo $! > server/logs/server.pid
echo "[完成] PID=$(cat server/logs/server.pid)"
