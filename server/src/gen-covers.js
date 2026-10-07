#!/usr/bin/env node
/**
 * 商品封面补全 / 生成
 *
 * 优先：从 source_path 旁或目录内找运行截图；
 * 找不到：生成品牌占位 SVG，避免后台/前台出现「—」。
 *
 * 用法：
 *   node src/gen-covers.js              # 默认只补缺失
 *   node src/gen-covers.js --all        # 全量重刷（已有封面也会覆盖）
 *   node src/gen-covers.js --limit 50
 *   node src/gen-covers.js --tech SpringBoot
 *   node src/gen-covers.js --placeholders-only  # 仅给仍无图的生成占位
 */
'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const COVER_DIR = path.resolve(__dirname, '../uploads/covers');
const IMG_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;
const PRIORITY = [
  /^主(页|界面|页面)/i, /^首页/i, /^登录/i, /^index/i, /^login/i,
  /^系统/, /^运行截图/, /^界面/, /^项目截图/, /^截图/
];
const DIR_HINTS = ['运行截图', '项目截图', '截图', '图片', '演示视频', '界面', '效果图', 'screenshot'];

function parseArgs(argv) {
  const args = argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const techIdx = args.indexOf('--tech');
  return {
    all: args.includes('--all'),
    placeholdersOnly: args.includes('--placeholders-only'),
    limit: limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity,
    techFilter: techIdx >= 0 ? args[techIdx + 1] : null
  };
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapTitle(title, maxLen = 28) {
  const t = String(title || '源码项目').replace(/《已调试》/g, '').trim();
  if (t.length <= maxLen) return [t];
  const mid = Math.min(maxLen, Math.floor(t.length / 2));
  let cut = t.lastIndexOf(' ', mid);
  if (cut < 8) cut = mid;
  return [t.slice(0, cut).trim(), t.slice(cut).trim()].filter(Boolean).slice(0, 2);
}

function makePlaceholderSvg(product) {
  const tech = escapeXml((product.tech || '源码').slice(0, 24));
  const lines = wrapTitle(product.title, 22).map(escapeXml);
  const line1 = lines[0] || '源码项目';
  const line2 = lines[1] || '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0b"/>
      <stop offset="100%" stop-color="#1c1917"/>
    </linearGradient>
  </defs>
  <rect width="800" height="500" fill="url(#g)"/>
  <rect x="36" y="36" width="728" height="428" rx="18" fill="none" stroke="#3f3f46" stroke-width="1.5"/>
  <rect x="56" y="64" width="120" height="32" rx="8" fill="#0d9488"/>
  <text x="116" y="85" text-anchor="middle" fill="#fff" font-size="14" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-weight="700">${tech}</text>
  <text x="56" y="200" fill="#fafafa" font-size="28" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-weight="700">${line1}</text>
  ${line2 ? `<text x="56" y="242" fill="#e4e4e7" font-size="24" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-weight="600">${line2}</text>` : ''}
  <text x="56" y="420" fill="#71717a" font-size="14" font-family="Segoe UI, Microsoft YaHei, sans-serif">源码商城 · 封面待换真实截图</text>
</svg>`;
}

function coverFileExists(coverUrl) {
  if (!coverUrl) return false;
  const base = path.basename(String(coverUrl));
  return fs.existsSync(path.join(COVER_DIR, base));
}

function collectImages(dir, nameHint) {
  const out = [];
  const stack = [{ d: dir, depth: 0 }];
  while (stack.length) {
    const { d, depth } = stack.pop();
    if (depth > 3) continue;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (DIR_HINTS.some((h) => e.name.includes(h)) || depth < 2) {
          stack.push({ d: full, depth: depth + 1 });
        }
      } else if (IMG_RE.test(e.name)) {
        out.push({ path: full, name: e.name, dirName: path.basename(d), dirDepth: depth });
      }
    }
  }
  if (nameHint) out.sort((a, b) => scoreImg(b, nameHint) - scoreImg(a, nameHint));
  return out;
}

function scoreImg(img, nameHint) {
  let s = 0;
  const n = img.name.toLowerCase();
  const hint = (nameHint || '').toLowerCase().replace(/\.(zip|rar|7z)$/, '');
  if (hint && n.includes(hint.slice(0, 12))) s += 80;
  for (let i = 0; i < PRIORITY.length; i++) {
    if (PRIORITY[i].test(n)) { s += 50 - i * 5; break; }
  }
  if (DIR_HINTS.some((h) => (img.dirName || '').includes(h))) s += 25;
  if (/^\.(png|jpg|jpeg)$/i.test(path.extname(n))) s += 10;
  return s;
}

const PREFER_COVER_BYTES = 800 * 1024;

function pickBest(candidates, nameHint) {
  if (!candidates.length) return null;
  let best = null;
  let bestScore = -1;
  let smallest = null;
  for (const c of candidates) {
    let size = 0;
    try { size = fs.statSync(c.path).size; } catch { continue; }
    if (!smallest || size < smallest.size) smallest = { path: c.path, size };
    if (size > PREFER_COVER_BYTES) continue;
    const s = scoreImg(c, nameHint) + (c.dirName.includes('运行截图') ? 20 : c.dirName.includes('项目截图') ? 15 : 0);
    if (s > bestScore) { bestScore = s; best = c.path; }
  }
  return best || (smallest ? smallest.path : null);
}

/** 压缩包旁可能存在的同名解压目录 / 截图目录 */
function siblingDirs(srcFile) {
  const dir = path.dirname(srcFile);
  const base = path.basename(srcFile).replace(/\.(zip|rar|7z)$/i, '');
  const candidates = [];
  const tryNames = [
    base,
    base.replace(/（.*?）/g, '').trim(),
    base.replace(/\(.*?\)/g, '').trim(),
    `${base}源码`,
    '运行截图',
    '项目截图',
    '截图'
  ];
  for (const name of tryNames) {
    if (!name) continue;
    const full = path.join(dir, name);
    try {
      if (fs.existsSync(full) && fs.statSync(full).isDirectory()) candidates.push(full);
    } catch { /* ignore */ }
  }
  return candidates;
}

function collectImagesShallow(dir, maxDepth = 1) {
  const out = [];
  const stack = [{ d: dir, depth: 0 }];
  while (stack.length) {
    const { d, depth } = stack.pop();
    if (depth > maxDepth) continue;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (depth < maxDepth && DIR_HINTS.some((h) => e.name.includes(h))) {
          stack.push({ d: full, depth: depth + 1 });
        }
      } else if (IMG_RE.test(e.name)) {
        out.push({ path: full, name: e.name, dirName: path.basename(d), dirDepth: depth });
      }
    }
  }
  return out;
}

function findScreenshot(product) {
  const src = product.source_path;
  if (!src) return null;
  if (!fs.existsSync(src)) return null;

  let candidates = [];
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    candidates = collectImages(src);
  } else {
    const dir = path.dirname(src);
    const base = path.basename(src).replace(/\.(zip|rar|7z)$/i, '');
    // 压缩包：只扫同级图片 + 同名解压目录，避免把整仓递归扫爆
    candidates = collectImagesShallow(dir, 0).filter((c) => {
      const hint = base.slice(0, 10);
      return !hint || c.name.includes(hint) || DIR_HINTS.some((h) => c.dirName.includes(h));
    });
    for (const sib of siblingDirs(src)) {
      candidates = candidates.concat(collectImages(sib, base));
    }
  }
  return pickBest(candidates, path.basename(src));
}

function writePlaceholder(product) {
  const outPath = path.join(COVER_DIR, `${product.id}.svg`);
  fs.writeFileSync(outPath, makePlaceholderSvg(product), 'utf8');
  return `/uploads/covers/${product.id}.svg`;
}

function copyCover(product, imgPath) {
  const ext = path.extname(imgPath).toLowerCase() || '.png';
  const outPath = path.join(COVER_DIR, `${product.id}${ext}`);
  fs.copyFileSync(imgPath, outPath);
  return `/uploads/covers/${product.id}${ext}`;
}

async function fillCovers(options = {}) {
  const opts = {
    all: false,
    placeholdersOnly: false,
    limit: Infinity,
    techFilter: null,
    ...options
  };

  if (!fs.existsSync(COVER_DIR)) fs.mkdirSync(COVER_DIR, { recursive: true });

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'code_shop'
  });

  let sql = 'SELECT id, title, tech, type, source_path, cover FROM products WHERE is_deleted=0';
  const params = [];
  if (opts.techFilter) { sql += ' AND tech=?'; params.push(opts.techFilter); }
  if (!opts.all) {
    sql += " AND (cover IS NULL OR cover='')";
  }
  sql += ' ORDER BY id ASC';
  if (Number.isFinite(opts.limit)) { sql += ' LIMIT ?'; params.push(opts.limit); }

  const [rows] = await conn.query(sql, params);
  const byId = new Map();
  for (const p of rows) byId.set(p.id, p);

  if (!opts.all) {
    const [broken] = await conn.query(
      "SELECT id, title, tech, type, source_path, cover FROM products WHERE is_deleted=0 AND cover IS NOT NULL AND cover<>''"
    );
    for (const p of broken) {
      if (!coverFileExists(p.cover)) byId.set(p.id, p);
    }
  }

  const list = [...byId.values()].sort((a, b) => a.id - b.id);

  const stats = { total: list.length, fromShot: 0, placeholder: 0, fail: 0 };
  const t0 = Date.now();

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    try {
      let coverUrl = null;
      if (!opts.placeholdersOnly) {
        const shot = findScreenshot(p);
        if (shot) {
          coverUrl = copyCover(p, shot);
          stats.fromShot++;
        }
      }
      if (!coverUrl) {
        coverUrl = writePlaceholder(p);
        stats.placeholder++;
      }
      await conn.query('UPDATE products SET cover=? WHERE id=?', [coverUrl, p.id]);
      if ((stats.fromShot + stats.placeholder) % 100 === 0) {
        console.log(`  进度 ${stats.fromShot + stats.placeholder}/${list.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      }
    } catch (e) {
      stats.fail++;
      console.error(`  失败 #${p.id}: ${e.message}`);
    }
  }

  await conn.end();
  stats.elapsedMs = Date.now() - t0;
  return stats;
}

async function main() {
  const opts = parseArgs(process.argv);
  console.log(`模式: ${opts.all ? '全量' : '仅缺失'}${opts.placeholdersOnly ? ' + 仅占位' : ''}`);
  const stats = await fillCovers(opts);
  console.log(
    `\n完成: 截图 ${stats.fromShot}, 占位 ${stats.placeholder}, 失败 ${stats.fail}, 合计 ${stats.total}, 耗时 ${(stats.elapsedMs / 1000).toFixed(1)}s`
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error('封面生成失败:', e);
    process.exit(1);
  });
}

module.exports = { fillCovers, makePlaceholderSvg };
