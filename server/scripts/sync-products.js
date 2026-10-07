#!/usr/bin/env node
/**
 * 商品增量同步脚本
 *  - 读取 data/products.json（扫描脚本产物）
 *  - 与数据库比对（按 source_path 匹配）：
 *      * 新增商品 → INSERT（并探测生成详情/封面）
 *      * 已有商品 → 更新 title/tech/体积/材料 等变更字段（不覆盖手动改的价格）
 *      * 默认不下架数据库中已消失的商品（可用 --disable-missing 开启）
 *  - 为缺失详情的商品探测生成：功能模块 / 技术点 / 数据表 / 简介 / 截图图册
 *
 * 用法：
 *   cd D:\code-shop\server && node scripts/sync-products.js            # 增量同步
 *   node scripts/sync-products.js --force-details                      # 全量重探测详情（老商品补详情）
 *   node scripts/sync-products.js --folders-only                       # 只处理文件夹商品（跳过压缩包）
 *   node scripts/sync-products.js --limit 50                           # 限量调试
 *   node scripts/sync-products.js --no-probe                           # 只同步不探测详情
 *   node scripts/sync-products.js --disable-missing                    # 数据库里消失的商品自动下架
 */
'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { pinyin } = require('pinyin-pro');
const probe = require('../src/lib/probe');

require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const ROOT = path.resolve(__dirname, '../..');
const JSON_PATH = path.join(ROOT, 'data/products.json');
const DETAIL_DIR = path.resolve(__dirname, '../uploads/detail');
const COVER_DIR = path.resolve(__dirname, '../uploads/covers');

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };
  return {
    limit: parseInt(get('--limit'), 10) || Infinity,
    forceDetails: args.includes('--force-details'),
    noProbe: args.includes('--no-probe'),
    disableMissing: args.includes('--disable-missing'),
    foldersOnly: args.includes('--folders-only')
  };
}

function computePinyinInit(title, arr) {
  const lowerTitle = title.toLowerCase();
  return arr.map((el) => {
    const elLower = el.toLowerCase();
    const idx = lowerTitle.indexOf(elLower);
    if (idx >= 0) {
      const origSlice = title.slice(idx, idx + el.length);
      if (!/[\u4e00-\u9fff]/.test(origSlice)) return el;
    }
    return el[0] || '';
  }).join('').toLowerCase();
}

function computePinyin(title) {
  const arr = pinyin(title, { toneType: 'none', type: 'array', nonZh: 'consecutive' });
  return {
    pinyin: arr.join('').toLowerCase(),
    pinyinInit: computePinyinInit(title, arr)
  };
}

// 环境标记：扫描产物键 -> 展示键（与前端 runStatus.js/详情页约定一致）
const ENV_KEY_MAP = { pom: 'maven', packageJson: 'node', applicationYml: 'springBoot', sql: 'sql', vue: 'vue', webXml: 'servlet', mybatis: 'mybatis', jsp: 'jsp' };
function envToRunEnv(m) {
  if (!m || typeof m !== 'object') return '';
  const out = {};
  for (const [k, v] of Object.entries(m)) {
    if (v && ENV_KEY_MAP[k]) out[ENV_KEY_MAP[k]] = true;
  }
  return JSON.stringify(out).slice(0, 500);
}

async function main() {
  const opts = parseArgs();
  if (!fs.existsSync(JSON_PATH)) {
    console.error('未找到 ' + JSON_PATH + '，请先运行 npm run scan');
    process.exit(1);
  }
  const list = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')).slice(0, opts.limit);
  let effectiveList = list;
  if (opts.foldersOnly) {
    effectiveList = list.filter((p) => p.type === 'folder');
  }
  console.log(`products.json 共 ${list.length} 条（${opts.limit === Infinity ? '全量' : '限量'}${opts.foldersOnly ? '，仅文件夹' : ''}），本次处理 ${effectiveList.length} 条`);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'code_shop'
  });

  // 建立 source_path -> 数据库记录 索引
  const [existing] = await conn.query(
    'SELECT id, source_path, title, tech, size_mb, has_paper, has_ppt, has_video, has_db, cover, details, price, category, run_env, qa_note FROM products'
  );
  const byPath = new Map();
  for (const r of existing) if (r.source_path) byPath.set(r.source_path.toLowerCase(), r);

  if (!fs.existsSync(DETAIL_DIR)) fs.mkdirSync(DETAIL_DIR, { recursive: true });
  if (!fs.existsSync(COVER_DIR)) fs.mkdirSync(COVER_DIR, { recursive: true });

  let inserted = 0, updated = 0, needProbe = 0, skipped = 0, fileRows = 0;
  const t0 = Date.now();

  for (let i = 0; i < effectiveList.length; i++) {
    const p = effectiveList[i];
    const srcKey = (p.sourcePath || '').toLowerCase();
    const exist = byPath.get(srcKey);

    // 字段归一化
    const row = {
      product_no: String(p.no ?? ''),
      title: p.title || p.name || '',
      tech: p.tech || '其他',
      type: p.type || 'folder',
      size_mb: p.sizeMB || 0,
      has_paper: p.hasPaper ? 1 : 0,
      has_ppt: p.hasPpt ? 1 : 0,
      has_video: p.hasVideo ? 1 : 0,
      has_db: p.hasDb ? 1 : 0,
      source_path: p.sourcePath || '',
      keywords: p.keywords || [p.name, p.title].filter(Boolean).join(' '),
      category: p.category || '',
      qa_note: (p.qaNote || '').slice(0, 1000),
      run_env: envToRunEnv(p.envMarkers),
      files: Array.isArray(p.files) ? p.files : []
    };

    if (!exist) {
      // ---- 新增商品（未验证 run_status=0，需人工质检后才上架） ----
      const py = computePinyin(row.title);
      await conn.query(
        `INSERT INTO products (product_no, title, tech, type, size_mb, has_paper, has_ppt, has_video, has_db,
           price, original_price, status, cover, description, source_path, keywords, is_deleted,
           kind, category, run_status, run_env, qa_note, pinyin, pinyin_init)
         VALUES (?,?,?,?,?,?,?,?,?, 99, 199, 0, '', '', ?, ?, 0, 'code', ?, 0, ?, ?, ?, ?)`,
        [row.product_no, row.title, row.tech, row.type, row.size_mb,
         row.has_paper, row.has_ppt, row.has_video, row.has_db, row.source_path, row.keywords,
         row.category, row.run_env, row.qa_note, py.pinyin, py.pinyinInit]
      );
      const [r] = await conn.query('SELECT LAST_INSERT_ID() AS id');
      const newId = r[0].id;
      console.log(`  [新增·未上架] #${newId} ${row.title}`);
      inserted++;
      needProbe++;
      if (!opts.noProbe) await enrichDetails(conn, { id: newId, ...row }, opts);
      await syncFiles(conn, newId, row.files);
    } else if (!opts.noProbe && (opts.forceDetails || !exist.details)) {
      // ---- 已有商品：补详情 ----
      await enrichDetails(conn, { id: exist.id, ...row }, opts);
      needProbe++;
    } else if (!opts.noProbe && opts.forceDetails) {
      await enrichDetails(conn, { id: exist.id, ...row }, opts);
    }

    // ---- 字段变更更新（价格不动；run_status 不覆盖人工质检结果） ----
    if (exist) {
      const changed =
        exist.title !== row.title || exist.tech !== row.tech ||
        exist.size_mb !== row.size_mb || exist.has_paper !== row.has_paper ||
        exist.has_ppt !== row.has_ppt || exist.has_video !== row.has_video ||
        exist.has_db !== row.has_db || exist.category !== row.category ||
        exist.run_env !== row.run_env;
      if (changed) {
        const py = computePinyin(row.title);
        await conn.query(
          `UPDATE products SET title=?, tech=?, size_mb=?, has_paper=?, has_ppt=?, has_video=?, has_db=?, keywords=?,
                  category=?, run_env=?, pinyin=?, pinyin_init=?
           WHERE id=?`,
          [row.title, row.tech, row.size_mb, row.has_paper, row.has_ppt, row.has_video, row.has_db,
           row.keywords, row.category, row.run_env, py.pinyin, py.pinyinInit, exist.id]
        );
        console.log(`  [更新] #${exist.id} ${row.title}`);
        updated++;
      }
      // 质检备注在扫描时可能带新信息（如目录名新增"待做"标注），仅当新值非空且与旧值不同时覆盖
      if (row.qa_note && row.qa_note !== (exist.qa_note || '')) {
        await conn.query('UPDATE products SET qa_note=? WHERE id=?', [row.qa_note, exist.id]);
      }
      // 文件清单同步（归并后）
      if (row.files.length) {
        fileRows += await syncFiles(conn, exist.id, row.files);
      }
    }
    byPath.delete(srcKey);
    if ((i + 1) % 200 === 0) console.log(`  进度 ${i + 1}/${effectiveList.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }

  // 下架数据库中已消失的商品
  let disabled = 0;
  if (opts.disableMissing && byPath.size) {
    const ids = [...byPath.values()].map((r) => r.id);
    await conn.query('UPDATE products SET status=0 WHERE id IN (?)', [ids]);
    disabled = ids.length;
    console.log(`[下架] 数据库存在但扫描产物缺失的商品 ${disabled} 条（多为归并吸收的重复包）`);
  }

  console.log(`\n完成: 新增 ${inserted}, 更新 ${updated}, 补/探测详情 ${needProbe}, 下架 ${disabled}, 文件行 ${fileRows}, 耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log('提示: 后续想重新探测全部商品详情可用 --force-details');
  await conn.end();
}

// 同步商品文件清单（归并材料包）：先删后插
async function syncFiles(conn, productId, files) {
  if (!files || !files.length) return 0;
  await conn.query('DELETE FROM product_files WHERE product_id=?', [productId]);
  const rows = files
    .slice(0, 50)
    .map((f, i) => [productId, f.kind || 'other', String(f.name || '').slice(0, 255), String(f.path || '').slice(0, 500), f.sizeMB || 0, String(f.ext || '').slice(0, 16), f.sort ?? i]);
  await conn.query('INSERT INTO product_files (product_id, kind, name, path, size_mb, ext, sort) VALUES ?', [rows]);
  return rows.length;
}

// 探测并写入商品详情（截图图册 + 功能模块 + 技术点 + 数据表 + 简介）
async function enrichDetails(conn, product, opts) {
  const src = product.source_path;
  if (!src || !fs.existsSync(src)) return;

  const stat = fs.statSync(src);
  const isDir = stat.isDirectory();
  const isArchive = !isDir && probe.ARCHIVE_RE.test(src);

  let shots = [];
  let features = [];
  let tech_points = [];
  let db_tables = [];
  let dir_tree = null;
  let shotSources = []; // 本地图片路径或 zip 条目

  if (isDir) {
    // ---- 目录型：直接扫描 ----
    const baseDir = src;
    shotSources = probe.collectImages(baseDir, null);
    features = probe.probeFeatures(src);
    tech_points = probe.probeTechPoints(src, product.tech);
    db_tables = probe.probeDbTables(src);
    dir_tree = probe.probeDirTree(src);
  } else if (isArchive) {
    // ---- 压缩包型：读取包内条目 ----
    const r = probe.probeArchive(src, product.tech);
    if (r) {
      shots = r.shots;
      features = r.features;
      tech_points = r.tech_points;
      db_tables = r.db_tables;
      shotSources = r.shots;
    }
    dir_tree = probe.probeDirTree(src);
  }

  // 1. 截图：目录直接复制；压缩包按需提取到临时目录再复制
  const shotUrls = [];
  const tmpShot = path.join(require('os').tmpdir(), 'probe-shot-' + process.pid);
  if (isDir) {
    for (let k = 0; k < Math.min(6, shotSources.length); k++) {
      const c = shotSources[k];
      const ext = path.extname(c.path).toLowerCase();
      const outPath = path.join(DETAIL_DIR, `${product.id}_${k + 1}${ext}`);
      try {
        fs.copyFileSync(c.path, outPath);
        shotUrls.push(`/uploads/detail/${product.id}_${k + 1}${ext}`);
      } catch { /* 单个失败跳过 */ }
    }
  } else if (isArchive) {
    try {
      fs.mkdirSync(tmpShot, { recursive: true });
      probe.extractArchiveEntries(src, tmpShot, shotSources.slice(0, 6).map((s) => s.path));
      const extracted = probe.collectImages(tmpShot, null);
      for (let k = 0; k < Math.min(6, extracted.length); k++) {
        const c = extracted[k];
        const ext = path.extname(c.path).toLowerCase();
        const outPath = path.join(DETAIL_DIR, `${product.id}_${k + 1}${ext}`);
        try {
          fs.copyFileSync(c.path, outPath);
          shotUrls.push(`/uploads/detail/${product.id}_${k + 1}${ext}`);
        } catch { /* 忽略 */ }
      }
    } finally {
      fs.rmSync(tmpShot, { recursive: true, force: true });
    }
  }
  shots = shotUrls;

  // 2. 生成结构化简介（末尾带签名，便于后续覆盖；手动编辑的简介保留）
  const built = probe.buildIntro(
    {
      title: product.title,
      tech: product.tech,
      category: product.category,
      has_paper: product.has_paper,
      has_ppt: product.has_ppt,
      has_video: product.has_video,
      has_db: product.has_db
    },
    { features, tech_points, db_tables, dir_tree }
  );
  const desc = built.text + '\n\n——由源码探测自动生成，可手动修改';

  const details = JSON.stringify({
    screenshots: shots,
    features: built.intro.features.length ? built.intro.features : features,
    tech_points,
    db_tables,
    dir_tree,
    intro: built.intro
  });
  await conn.query(
    'UPDATE products SET details=?, description=IF(description IS NULL OR description=\'\' OR description=title OR description LIKE ? OR description LIKE ? OR description LIKE ?, ?, description) WHERE id=?',
    [details, '%由源码探测自动生成%', '本商品为「%', '【项目概述】%', desc, product.id]
  );

  // 3. 没有封面时用第一张截图当封面
  if (!product.cover && shots.length) {
    const coverFile = path.join(DETAIL_DIR, path.basename(shots[0]));
    if (fs.existsSync(coverFile)) {
      const ext = path.extname(coverFile).toLowerCase();
      const coverOut = path.join(COVER_DIR, `${product.id}${ext}`);
      try {
        fs.copyFileSync(coverFile, coverOut);
        await conn.query('UPDATE products SET cover=? WHERE id=?', [`/uploads/covers/${product.id}${ext}`, product.id]);
      } catch { /* 忽略 */ }
    }
  }
  console.log(`  [详情] #${product.id} ${product.title} 截图${shots.length} 模块${features.length} 表${db_tables.length}`);
}

main().catch((e) => {
  console.error('同步失败:', e);
  process.exit(1);
});
