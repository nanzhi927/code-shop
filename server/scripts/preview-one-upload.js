/**
 * 清空线上假商品 → 只同步 1 个本地真实项目并上架（含详情探测 + 封面/截图经远程 API 上传）
 * 用法: node scripts/preview-one-upload.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const ROOT = path.resolve(__dirname, '../..');
const JSON_PATH = path.join(ROOT, 'data/products.json');
const BACKUP_PATH = path.join(ROOT, 'data/products.json.bak-preview');
const SAMPLE_TITLE = '图书个性化推荐系统的设计与实现';
const API_BASE = process.env.PREVIEW_API_BASE || 'http://62.234.122.127:40621';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

function request(method, urlPath, { token, body, form } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, API_BASE);
    const lib = u.protocol === 'https:' ? https : http;
    const headers = {};
    let payload = null;
    if (token) headers.Authorization = 'Bearer ' + token;
    if (form) {
      headers['Content-Type'] = 'multipart/form-data; boundary=' + form.boundary;
      payload = form.buffer;
      headers['Content-Length'] = payload.length;
    } else if (body != null) {
      payload = Buffer.from(JSON.stringify(body));
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length;
    }
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers,
        timeout: 60000
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data = text;
          try {
            data = JSON.parse(text);
          } catch {
            /* raw */
          }
          if (res.statusCode >= 400) {
            reject(new Error(`${method} ${urlPath} → ${res.statusCode} ${text.slice(0, 300)}`));
          } else resolve(data);
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout ' + urlPath));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function buildMultipart(fieldName, filePath) {
  const boundary = '----PreviewBoundary' + Date.now();
  const filename = path.basename(filePath);
  const fileBuf = fs.readFileSync(filePath);
  const mime =
    /\.png$/i.test(filename) ? 'image/png' : /\.webp$/i.test(filename) ? 'image/webp' : 'image/jpeg';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { boundary, buffer: Buffer.concat([head, fileBuf, tail]) };
}

async function main() {
  if (!fs.existsSync(JSON_PATH)) throw new Error('缺少 data/products.json，请先 npm run scan');
  const all = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const sample =
    all.find((p) => p.title === SAMPLE_TITLE && p.type === 'folder' && fs.existsSync(p.sourcePath)) ||
    all.find((p) => p.type === 'folder' && fs.existsSync(p.sourcePath) && p.hasPaper && p.hasDb);

  if (!sample) throw new Error('未找到可用的本地样本项目');
  console.log('样本:', sample.title);
  console.log('路径:', sample.sourcePath);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  console.log('1) 清空线上商品…');
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  await conn.query('TRUNCATE TABLE product_files');
  try {
    await conn.query('TRUNCATE TABLE product_reviews');
  } catch {
    /* 表可能不存在 */
  }
  try {
    await conn.query('TRUNCATE TABLE favorites');
  } catch {
    /* 忽略 */
  }
  try {
    await conn.query('TRUNCATE TABLE cart');
  } catch {
    /* 忽略 */
  }
  await conn.query('TRUNCATE TABLE products');
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  const [[cnt]] = await conn.query('SELECT COUNT(*) n FROM products');
  console.log('   清空后商品数:', cnt.n);
  await conn.end();

  console.log('2) 临时只保留样本到 products.json，跑 sync…');
  fs.copyFileSync(JSON_PATH, BACKUP_PATH);
  fs.writeFileSync(JSON_PATH, JSON.stringify([sample], null, 2), 'utf8');

  const { spawnSync } = require('child_process');
  const sync = spawnSync(process.execPath, ['scripts/sync-products.js'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    env: process.env
  });
  process.stdout.write(sync.stdout || '');
  process.stderr.write(sync.stderr || '');
  fs.copyFileSync(BACKUP_PATH, JSON_PATH);
  fs.unlinkSync(BACKUP_PATH);
  if (sync.status !== 0) throw new Error('sync 失败');

  const conn2 = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  const [rows] = await conn2.query(
    'SELECT id, title, cover, details, description, status FROM products ORDER BY id DESC LIMIT 1'
  );
  if (!rows.length) throw new Error('同步后库中无商品');
  const product = rows[0];
  console.log('3) 已入库 #' + product.id, product.title);

  console.log('4) 登录远程后台并上传本地封面/截图…');
  const login = await request('POST', '/api/auth/login', {
    body: { username: ADMIN_USER, password: ADMIN_PASS }
  });
  const token = login.token || login.data?.token;
  if (!token) throw new Error('登录失败: ' + JSON.stringify(login));

  const DETAIL_DIR = path.resolve(__dirname, '../uploads/detail');
  const COVER_DIR = path.resolve(__dirname, '../uploads/covers');
  const localShots = fs.existsSync(DETAIL_DIR)
    ? fs.readdirSync(DETAIL_DIR).filter((f) => f.startsWith(product.id + '_')).sort()
    : [];
  const localCover = fs.existsSync(COVER_DIR)
    ? fs.readdirSync(COVER_DIR).find((f) => f.startsWith(String(product.id) + '.'))
    : null;

  let coverUrl = product.cover || '';
  const shotUrls = [];

  const uploadLocal = async (absPath) => {
    const form = buildMultipart('file', absPath);
    const r = await request('POST', '/api/admin/upload/cover', { token, form });
    return r.url;
  };

  if (localCover) {
    coverUrl = await uploadLocal(path.join(COVER_DIR, localCover));
    console.log('   封面 →', coverUrl);
  }
  for (const f of localShots) {
    const url = await uploadLocal(path.join(DETAIL_DIR, f));
    shotUrls.push(url);
    console.log('   截图 →', url);
  }

  let details = null;
  try {
    details = product.details ? JSON.parse(product.details) : {};
  } catch {
    details = {};
  }
  if (shotUrls.length) details.screenshots = shotUrls;
  if (!coverUrl && shotUrls.length) coverUrl = shotUrls[0];

  await conn2.query(
    'UPDATE products SET status=1, run_status=1, cover=?, details=?, price=99, original_price=199 WHERE id=?',
    [coverUrl || '', JSON.stringify(details), product.id]
  );
  await conn2.end();

  const preview = `${API_BASE}/products/${product.id}`;
  console.log('\n✅ 完成。请打开预览:');
  console.log(preview);
  console.log('列表页:', API_BASE + '/');
}

main().catch((e) => {
  console.error('失败:', e.message || e);
  try {
    if (fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(BACKUP_PATH, JSON_PATH);
      fs.unlinkSync(BACKUP_PATH);
      console.error('已恢复 products.json');
    }
  } catch {
    /* ignore */
  }
  process.exit(1);
});
