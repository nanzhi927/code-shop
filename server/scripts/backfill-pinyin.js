#!/usr/bin/env node
'use strict';

const { pinyin } = require('pinyin-pro');
const pool = require('../src/db');

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

const BATCH = 500;
const CONCURRENCY = 20;

async function main() {
  const [rows] = await pool.query('SELECT id, title FROM products');
  console.log(`共 ${rows.length} 条商品待回填拼音`);

  let updated = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    for (let j = 0; j < batch.length; j += CONCURRENCY) {
      const chunk = batch.slice(j, j + CONCURRENCY);
      await Promise.all(chunk.map(async (row) => {
        const { pinyin: py, pinyinInit } = computePinyin(row.title || '');
        await pool.query('UPDATE products SET pinyin=?, pinyin_init=? WHERE id=?', [py, pinyinInit, row.id]);
        updated++;
        if (updated % 200 === 0) console.log(`  进度 ${updated}/${rows.length}`);
      }));
    }
  }

  console.log(`完成，共更新 ${updated} 条`);
  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error('回填失败:', e);
  process.exit(1);
});
