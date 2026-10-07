#!/usr/bin/env bash
# 停止生产服务（Linux）
cd "$(dirname "$0")"
if [ -f server/logs/server.pid ]; then
  kill "$(cat server/logs/server.pid)" 2>/dev/null || true
  rm -f server/logs/server.pid
fi
pkill -f "node server/src/index.js" 2>/dev/null || true
pkill -f "node src/index.js" 2>/dev/null || true
echo "[完成] 已停止"
