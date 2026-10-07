const express = require('express');
const pool = require('../db');
const { logger } = require('../lib/logger');
const { createCache } = require('../lib/cache');

const router = express.Router();
const techsCache = createCache(30 * 1000);
const categoriesCache = createCache(30 * 1000);
const hotCache = createCache(20 * 1000);

const LIST_COLS = `id, product_no, title, tech, type, category, size_mb, has_paper, has_ppt, has_video, has_db,
              price, original_price, cover, description, run_status, sales, views, sort_weight, status,
              demo_url, video_url`;

const ORDER_MAP = {
  latest: "(cover IS NULL OR cover='') ASC, sort_weight DESC, id DESC",
  newest: 'id DESC',
  price_asc: 'price ASC',
  price_desc: 'price DESC',
  sales: 'sales DESC, id DESC',
  hot: 'views DESC, sales DESC, id DESC'
};

/** 列表侧面筛选条件（可排除某一维度，供 facets 联动） */
function buildFacetWhere(query, { omit } = {}) {
  const parts = ['status=1', 'is_deleted=0'];
  const params = [];
  const { keyword, tech, category, priceMin, priceMax } = query;
  const mats = ['has_paper', 'has_ppt', 'has_video', 'has_db'];

  if (omit !== 'tech' && tech && tech !== '全部') {
    parts.push('tech=?');
    params.push(tech);
  }
  if (omit !== 'category' && category && category !== '全部') {
    parts.push('category=?');
    params.push(category);
  }
  for (const m of mats) {
    if (query[m] === '1' || query[m] === 'true') parts.push(`${m}=1`);
  }
  if (query.has_demo === '1' || query.has_demo === 'true') {
    parts.push("demo_url IS NOT NULL AND demo_url<>''");
  }
  if (query.has_intro_video === '1' || query.has_intro_video === 'true') {
    parts.push("video_url IS NOT NULL AND video_url<>''");
  }
  if (priceMin) { parts.push('price>=?'); params.push(Number(priceMin)); }
  if (priceMax) { parts.push('price<=?'); params.push(Number(priceMax)); }
  if (keyword) {
    const kwLike = `%${keyword}%`;
    const kwPinyin = `%${String(keyword).toLowerCase()}%`;
    parts.push('(title LIKE ? OR keywords LIKE ? OR pinyin LIKE ? OR pinyin_init LIKE ?)');
    params.push(kwLike, kwLike, kwPinyin, kwPinyin);
  }
  return { where: parts.join(' AND '), params };
}

// 记录搜索日志 + 热词权重（异步、失败忽略）
function logSearch(keyword, resultCount, userId = 0) {
  if (!keyword) return;
  const kw = String(keyword).trim().slice(0, 100);
  if (!kw) return;
  pool.query('INSERT INTO search_logs (user_id, keyword, result_count) VALUES (?,?,?)', [userId || 0, kw, resultCount || 0]).catch(() => {});
  pool.query(
    `INSERT INTO hot_words (word, weight, type) VALUES (?,1,'auto')
     ON DUPLICATE KEY UPDATE weight=weight+1, updated_at=NOW()`, [kw]
  ).catch(() => {});
}

// 商品列表（前台）—— P1 强搜索
// 参数：page,pageSize,keyword,tech,category,has_paper,has_ppt,has_video,has_db,priceMin,priceMax,sort
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 12));
    const {
      keyword, tech, category, priceMin, priceMax, sort
    } = req.query;
    const mats = ['has_paper', 'has_ppt', 'has_video', 'has_db'];
    const sortKey = ORDER_MAP[req.query.sort] ? req.query.sort : 'latest';

    const base = ['status=1', 'is_deleted=0'];
    const baseParams = [];
    if (tech && tech !== '全部') { base.push('tech=?'); baseParams.push(tech); }
    if (category && category !== '全部') { base.push('category=?'); baseParams.push(category); }
    for (const m of mats) {
      if (req.query[m] === '1' || req.query[m] === 'true') base.push(`${m}=1`);
    }
    if (req.query.has_demo === '1' || req.query.has_demo === 'true') {
      base.push("demo_url IS NOT NULL AND demo_url<>''");
    }
    if (req.query.has_intro_video === '1' || req.query.has_intro_video === 'true') {
      base.push("video_url IS NOT NULL AND video_url<>''");
    }
    if (priceMin) { base.push('price>=?'); baseParams.push(Number(priceMin)); }
    if (priceMax) { base.push('price<=?'); baseParams.push(Number(priceMax)); }

    // 关键词：优先全文索引，0 命中回退 LIKE
    const orderBy = ORDER_MAP[sortKey];

    let total, list;
    if (keyword) {
      const hasLatin = /[a-zA-Z]/.test(keyword);
      const kwLike = `%${keyword}%`;
      const kwPinyin = `%${keyword.toLowerCase()}%`;

      const runLikeFallback = async () => {
        const likeCond = hasLatin
          ? '(title LIKE ? OR keywords LIKE ? OR pinyin LIKE ? OR pinyin_init LIKE ?)'
          : '(title LIKE ? OR keywords LIKE ?)';
        const likeParams = hasLatin
          ? [kwLike, kwLike, kwPinyin, kwPinyin]
          : [kwLike, kwLike];
        const lkWhere = 'WHERE ' + [...base, likeCond].join(' AND ');
        const [tr2] = await pool.query(`SELECT COUNT(*) AS c FROM products ${lkWhere}`, [...baseParams, ...likeParams]);
        total = tr2[0].c;
        const [l2] = await pool.query(
          `SELECT ${LIST_COLS} FROM products ${lkWhere} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
          [...baseParams, ...likeParams, pageSize, (page - 1) * pageSize]
        );
        list = l2;
      };

      if (hasLatin) {
        // 含拉丁字母：跳过 FULLTEXT，直接 LIKE + 拼音兜底
        await runLikeFallback();
      } else {
        // 1) 全文索引命中
        const ftWhere = 'WHERE ' + [...base, 'MATCH(title, keywords, description, category) AGAINST(? IN BOOLEAN MODE)'].join(' AND ');
        const [tr] = await pool.query(`SELECT COUNT(*) AS c FROM products ${ftWhere}`, [...baseParams, keyword]);
        total = tr[0].c;
        if (total > 0) {
          const [l] = await pool.query(
            `SELECT ${LIST_COLS} FROM products ${ftWhere} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
            [...baseParams, keyword, pageSize, (page - 1) * pageSize]
          );
          list = l;
        } else {
          // 2) 全文 0 命中 → 回退 LIKE
          await runLikeFallback();
        }
      }
    } else {
      const ws = 'WHERE ' + base.join(' AND ');
      const [tr] = await pool.query(`SELECT COUNT(*) AS c FROM products ${ws}`, baseParams);
      total = tr[0].c;
      const [l] = await pool.query(
        `SELECT ${LIST_COLS} FROM products ${ws} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
        [...baseParams, pageSize, (page - 1) * pageSize]
      );
      list = l;
    }

    if (keyword) logSearch(keyword, total, req.user?.id);

    // facets：分类 / 技术栈数量随「其它」筛选联动
    const catFacet = buildFacetWhere(req.query, { omit: 'category' });
    const techFacet = buildFacetWhere(req.query, { omit: 'tech' });
    const [catRows] = await pool.query(
      `SELECT COALESCE(NULLIF(category,''),'未分类') AS name, COUNT(*) AS cnt FROM products WHERE ${catFacet.where} GROUP BY name ORDER BY cnt DESC`,
      catFacet.params
    );
    const [techRows] = await pool.query(
      `SELECT tech AS name, COUNT(*) AS cnt FROM products WHERE ${techFacet.where} GROUP BY tech ORDER BY cnt DESC`,
      techFacet.params
    );

    res.json({ list, total, page, pageSize, facets: { categories: catRows, techs: techRows } });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 技术栈分类统计（兼容旧调用）
router.get('/techs', async (req, res) => {
  try {
    const key = req.originalUrl;
    const cached = techsCache.get(key);
    if (cached) return res.json(JSON.parse(cached));
    const [rows] = await pool.query(
      'SELECT tech, COUNT(*) AS cnt FROM products WHERE status=1 AND is_deleted=0 GROUP BY tech ORDER BY cnt DESC'
    );
    techsCache.set(key, JSON.stringify(rows));
    res.json(rows);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 分类分布
router.get('/categories', async (req, res) => {
  try {
    const key = req.originalUrl;
    const cached = categoriesCache.get(key);
    if (cached) return res.json(JSON.parse(cached));
    const [rows] = await pool.query(
      "SELECT COALESCE(NULLIF(category,''),'未分类') AS name, COUNT(*) AS cnt FROM products WHERE status=1 AND is_deleted=0 GROUP BY name ORDER BY cnt DESC"
    );
    categoriesCache.set(key, JSON.stringify(rows));
    res.json(rows);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 搜索联想
router.get('/suggest', async (req, res) => {
  try {
    const q = (req.query.keyword || '').trim();
    if (!q) return res.json([]);
    const hasLatin = /[a-zA-Z]/.test(q);
    const kwLike = `%${q}%`;
    const kwPinyin = `%${q.toLowerCase()}%`;
    const likeCond = hasLatin
      ? '(title LIKE ? OR pinyin LIKE ? OR pinyin_init LIKE ?)'
      : 'title LIKE ?';
    const likeParams = hasLatin ? [kwLike, kwPinyin, kwPinyin] : [kwLike];
    const [rows] = await pool.query(
      `SELECT DISTINCT title FROM products WHERE status=1 AND is_deleted=0 AND ${likeCond} LIMIT 8`,
      likeParams
    );
    res.json(rows.map((r) => r.title));
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 热销榜
router.get('/hot', async (req, res) => {
  try {
    const key = req.originalUrl;
    const cached = hotCache.get(key);
    if (cached) return res.json(JSON.parse(cached));
    const [rows] = await pool.query(
      `SELECT ${LIST_COLS} FROM products WHERE status=1 AND is_deleted=0 ORDER BY sales DESC, views DESC LIMIT 8`
    );
    hotCache.set(key, JSON.stringify(rows));
    res.json(rows);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 相关推荐（同技术栈，排除自身）
router.get('/related/:id', async (req, res) => {
  try {
    const [self] = await pool.query('SELECT tech FROM products WHERE id=?', [req.params.id]);
    if (!self.length) return res.json([]);
    const [rows] = await pool.query(
      `SELECT ${LIST_COLS} FROM products WHERE status=1 AND is_deleted=0 AND tech=? AND id<>? ORDER BY sales DESC, id DESC LIMIT 4`,
      [self[0].tech, req.params.id]
    );
    res.json(rows);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 商品详情（含文件清单 + 评价 + 浏览量自增）
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, product_no, title, tech, type, category, size_mb, has_paper, has_ppt, has_video, has_db,
              price, original_price, cover, description, details, run_status, run_env, qa_note, kind,
              demo_url, video_url, sales, views, meta_title, meta_keywords, meta_description, created_at
       FROM products WHERE id=? AND status=1 AND is_deleted=0`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: '商品不存在或已下架' });
    const row = rows[0];
    pool.query('UPDATE products SET views=views+1 WHERE id=?', [req.params.id]).catch(() => {});

    let details = null;
    if (row.details) { try { details = JSON.parse(row.details); } catch { details = null; } }
    delete row.details;
    let runEnv = {};
    if (row.run_env) { try { runEnv = JSON.parse(row.run_env); } catch { runEnv = {}; } }
    delete row.run_env;

    const [files] = await pool.query(
      'SELECT id, kind, name, size_mb, ext FROM product_files WHERE product_id=? ORDER BY sort ASC, id ASC',
      [req.params.id]
    );
    const [reviews] = await pool.query(
      'SELECT r.id, r.rating, r.content, r.created_at, u.username FROM reviews r LEFT JOIN users u ON r.user_id=u.id WHERE r.product_id=? ORDER BY r.id DESC LIMIT 20',
      [req.params.id]
    );
    res.json({ ...row, details, runEnv, files, reviews });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

module.exports = router;
