/**
 * code-shop 一键开发启动器
 * 同时拉起后端(server) 与 前端(web)，Ctrl+C 统一优雅退出
 * 用法: node scripts/dev-all.js  或  npm run dev  或 双击 start.bat
 */
const { spawn } = require('child_process');
const path = require('path');

const COLORS = {
  server: '\x1b[36m', // 青
  web: '\x1b[35m', // 品红
  sys: '\x1b[33m', // 黄
};
const procs = [];

function run(name, cwd, cmd, args, color) {
  const p = spawn(cmd, args, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = `[${name}] `;
  const paint = (buf) => {
    buf.toString().split('\n').forEach((l) => {
      if (l.trim()) console.log(color + tag + l);
    });
  };
  p.stdout.on('data', paint);
  p.stderr.on('data', paint);
  p.on('exit', (code, signal) => {
    console.log(color + tag + `进程退出 (code=${code == null ? '-' : code}, signal=${signal || '-'})`);
  });
  procs.push(p);
  return p;
}

console.log(COLORS.sys + '==> 正在启动 code-shop 开发环境');
console.log(COLORS.sys + '==> 后端 API : http://localhost:3000');
console.log(COLORS.sys + '==> 前端页面 : http://localhost:5173');
console.log(COLORS.sys + '==> 按 Ctrl+C 可同时关闭前后端');

run('server', path.join(__dirname, '..', 'server'), 'npm', ['run', 'start'], COLORS.server);
run('web', path.join(__dirname, '..', 'web'), 'npm', ['run', 'dev'], COLORS.web);

let shutting = false;
function shutdown() {
  if (shutting) return;
  shutting = true;
  console.log('\n' + COLORS.sys + '==> 正在关闭 code-shop 服务...');
  procs.forEach((p) => {
    try { p.kill('SIGINT'); } catch (e) { /* ignore */ }
  });
  setTimeout(() => process.exit(0), 1500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
