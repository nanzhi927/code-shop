/**
 * 仅刷新线上样本商品的简介 / 功能结构 / 真实目录（保留已上传截图 URL）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const probe = require('../src/lib/probe');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [rows] = await conn.query(
    'SELECT id, title, tech, category, has_paper, has_ppt, has_video, has_db, source_path, details, cover FROM products WHERE id=1'
  );
  if (!rows.length) throw new Error('商品 #1 不存在');
  const p = rows[0];
  if (!p.source_path || !fs.existsSync(p.source_path)) {
    throw new Error('本地源码路径不存在: ' + p.source_path);
  }

  let old = {};
  try {
    old = p.details ? JSON.parse(p.details) : {};
  } catch {
    old = {};
  }

  const features = probe.probeFeatures(p.source_path);
  const tech_points = probe.probeTechPoints(p.source_path, p.tech);
  const db_tables = probe.probeDbTables(p.source_path);
  const dir_tree = probe.probeDirTree(p.source_path);
  const built = probe.buildIntro(
    {
      title: p.title,
      tech: p.tech,
      category: p.category,
      has_paper: p.has_paper,
      has_ppt: p.has_ppt,
      has_video: p.has_video,
      has_db: p.has_db
    },
    { features, tech_points, db_tables, dir_tree }
  );

  const details = {
    screenshots: old.screenshots || [],
    features: built.intro.features,
    tech_points,
    db_tables,
    dir_tree,
    intro: built.intro
  };
  const desc = built.text + '\n\n——由源码探测自动生成，可手动修改';

  await conn.query('UPDATE products SET details=?, description=? WHERE id=?', [
    JSON.stringify(details),
    desc,
    p.id
  ]);
  await conn.end();

  console.log('已刷新 #' + p.id, p.title);
  console.log('概述:', built.intro.overview.slice(0, 100) + '…');
  console.log('功能结构:', JSON.stringify(built.intro.func_tree?.children?.map((c) => c.name)));
  console.log('目录根:', dir_tree?.name, '子项', dir_tree?.children?.length);
  console.log('目录预览:');
  console.log(probe.formatDirTreeText(dir_tree).slice(0, 25).join('\n'));
  console.log('截图保留:', (details.screenshots || []).length, '张');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
