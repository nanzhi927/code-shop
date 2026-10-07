#!/usr/bin/env node
/**
 * code-shop 数据库 + uploads 备份脚本（Windows / Linux 通用）
 *
 * 环境变量:
 *   DB_HOST      默认 127.0.0.1
 *   DB_PORT      默认 3306
 *   DB_USER      默认 root
 *   DB_PASSWORD  默认 123456
 *   DB_NAME      默认 code_shop
 *   BACKUP_DIR   默认 <项目>/server/backups
 *   MYSQLDUMP    默认 mysqldump（Windows 下自动尝试常见安装路径）
 *
 * 用法:
 *   node scripts/backup.js
 *   cd server && npm run backup
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';
const DB_NAME = process.env.DB_NAME || 'code_shop';
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(ROOT, 'server', 'backups');
const UPLOADS_DIR = path.join(ROOT, 'server', 'uploads');

const WIN_MYSQLDUMP =
  'D:\\mysql\\mysql-8.0.22-winx64\\mysql-8.0.22-winx64\\bin\\mysqldump.exe';
const RETENTION_DAYS = 7;

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function dateOnly() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
}

function isExecutable(cmd) {
  const result = spawnSync(cmd, ['--version'], { shell: false, stdio: 'ignore' });
  return !result.error && result.status === 0;
}

function resolveMysqldump() {
  if (process.env.MYSQLDUMP) {
    return process.env.MYSQLDUMP;
  }
  if (isExecutable('mysqldump')) {
    return 'mysqldump';
  }
  if (process.platform === 'win32' && fs.existsSync(WIN_MYSQLDUMP)) {
    return WIN_MYSQLDUMP;
  }
  return 'mysqldump';
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getMysqldumpMajor(cmd) {
  // 解析 mysqldump 客户端主版本（8.0 客户端连 5.7 服务端需 --column-statistics=0）
  try {
    const res = spawnSync(cmd, ['--no-defaults', '--version'], { shell: false, stdio: 'pipe' });
    const text = (res.stdout || '').toString() + (res.stderr || '').toString();
    // 5.7 客户端: "Ver 14.14 Distrib 5.7.17" → 取 Distrib 后版本；8.0 客户端: "Ver 8.0.22 for Win64" → 取 Ver 后版本
    let m = text.match(/Distrib\s+(\d+)\./i);
    if (!m) m = text.match(/(?:^|\s)Ver\s+(\d+)\./i);
    return m ? parseInt(m[1], 10) : 0;
  } catch {
    return 0;
  }
}

function runMysqldump(mysqldumpCmd, outFile) {
  const args = [
    '--no-defaults', // 避免读取本机 my.ini 中 mysqldump 不支持的变量（如 wait_timeout）
    '--single-transaction',
    '--no-tablespaces',
    '-h', DB_HOST,
    '-P', DB_PORT,
    '-u', DB_USER,
    `-p${DB_PASSWORD}`,
    DB_NAME,
  ];
  // MySQL 8.0 客户端连 5.7 服务端时，跳过 column_statistics 查询
  if (getMysqldumpMajor(mysqldumpCmd) >= 8) {
    args.splice(1, 0, '--column-statistics=0');
  }

  return new Promise((resolve, reject) => {
    const fd = fs.openSync(outFile, 'w');
    const child = spawn(mysqldumpCmd, args, {
      stdio: ['ignore', fd, 'ignore'],
      shell: false,
    });

    child.on('error', (err) => {
      try { fs.closeSync(fd); } catch (_) { /* ignore */ }
      reject(err);
    });

    child.on('close', (code) => {
      try { fs.closeSync(fd); } catch (_) { /* ignore */ }
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`mysqldump 退出码 ${code}`));
      }
    });
  });
}

function copyUploads(destDir) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('[跳过] uploads 目录不存在:', UPLOADS_DIR);
    return Promise.resolve(true);
  }

  ensureDir(destDir);

  if (process.platform === 'win32') {
    return new Promise((resolve, reject) => {
      const child = spawn(
        'robocopy',
        [UPLOADS_DIR, destDir, '/E', '/NFL', '/NDL', '/NJH', '/NJS'],
        { shell: false, stdio: 'ignore' },
      );
      child.on('error', reject);
      child.on('close', (code) => {
        // robocopy: 0-7 均为成功或部分成功
        if (code >= 0 && code <= 7) {
          resolve(true);
        } else {
          reject(new Error(`robocopy 退出码 ${code}`));
        }
      });
    });
  }

  return new Promise((resolve, reject) => {
    const child = spawn('cp', ['-r', UPLOADS_DIR + '/.', destDir], {
      shell: false,
      stdio: 'ignore',
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(`cp 退出码 ${code}`));
    });
  });
}

function parseDateFromName(name) {
  // code_shop-YYYYMMDD-HHmmss.sql 或 uploads-YYYYMMDD
  const m1 = name.match(/(\d{4})(\d{2})(\d{2})-\d{6}\.sql$/);
  if (m1) {
    return new Date(+m1[1], +m1[2] - 1, +m1[3]);
  }
  const m2 = name.match(/uploads-(\d{4})(\d{2})(\d{2})$/);
  if (m2) {
    return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  }
  return null;
}

function deleteOldBackups() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  let removed = 0;

  if (!fs.existsSync(BACKUP_DIR)) return removed;

  for (const entry of fs.readdirSync(BACKUP_DIR)) {
    const full = path.join(BACKUP_DIR, entry);
    const date = parseDateFromName(entry);
    if (!date || date >= cutoff) continue;

    try {
      fs.rmSync(full, { recursive: true, force: true });
      console.log('[清理] 已删除过期备份:', entry);
      removed++;
    } catch (err) {
      console.error('[警告] 删除失败:', entry, err.message);
    }
  }
  return removed;
}

async function main() {
  const ts = timestamp();
  const day = dateOnly();
  const sqlFile = path.join(BACKUP_DIR, `code_shop-${ts}.sql`);
  const uploadsBackup = path.join(BACKUP_DIR, `uploads-${day}`);
  const mysqldumpCmd = resolveMysqldump();

  console.log('=== code-shop 备份 ===');
  console.log('数据库:', `${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  console.log('备份目录:', BACKUP_DIR);
  console.log('mysqldump:', mysqldumpCmd);
  console.log('');

  ensureDir(BACKUP_DIR);

  let failed = false;

  try {
    await runMysqldump(mysqldumpCmd, sqlFile);
    const size = fs.statSync(sqlFile).size;
    console.log('[成功] 数据库备份:', sqlFile, `(${(size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error('[失败] 数据库备份:', err.message);
    failed = true;
  }

  try {
    await copyUploads(uploadsBackup);
    console.log('[成功] uploads 备份:', uploadsBackup);
  } catch (err) {
    console.error('[失败] uploads 备份:', err.message);
    failed = true;
  }

  const removed = deleteOldBackups();
  if (removed > 0) {
    console.log(`[清理] 共删除 ${removed} 个超过 ${RETENTION_DAYS} 天的备份`);
  }

  console.log('');
  if (failed) {
    console.error('备份未完全成功，请检查上述错误。');
    process.exit(1);
  }
  console.log('备份完成。');
}

main().catch((err) => {
  console.error('备份脚本异常:', err);
  process.exit(1);
});
