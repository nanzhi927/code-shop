/**
 * PM2 进程配置 — code-shop 后端（可选）
 * 日常推荐直接双击根目录 启动.bat / 停止.bat
 *
 * pm2 start ecosystem.config.js
 */
'use strict';

const path = require('path');

const root = __dirname;
const serverDir = path.join(root, 'server');

module.exports = {
  apps: [
    {
      name: 'code-shop-server',
      cwd: serverDir,
      script: path.join(serverDir, 'src', 'index.js'),
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: path.join(serverDir, 'logs', 'pm2-out.log'),
      error_file: path.join(serverDir, 'logs', 'pm2-err.log'),
      time: true,
    },
  ],
};
