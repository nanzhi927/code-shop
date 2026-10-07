const express = require('express');
const { pinyin } = require('pinyin-pro');
const pool = require('../db');
const { adminRequired } = require('../middleware/auth');
const { logger } = require('../lib/logger');

const router = express.Router();
const adminRouter = express.Router();

const LIST_FIELDS =
  'id, slug, title, summary, category, tags, cover, status, views, sort_weight, created_at, updated_at';

function sanitizeContent(raw) {
  let s = String(raw == null ? '' : raw);
  s = s.replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  s = s.replace(/<\s*\/?\s*script[^>]*>/gi, '');
  s = s.replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '');
  s = s.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  s = s.replace(/javascript\s*:/gi, '');
  s = s.replace(/vbscript\s*:/gi, '');
  s = s.replace(/data\s*:\s*text\/html/gi, '');
  return s;
}

function slugifyTitle(title) {
  const arr = pinyin(String(title || ''), {
    toneType: 'none',
    type: 'array',
    nonZh: 'consecutive'
  });
  let slug = arr
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
  if (!slug) slug = `article-${Date.now()}`;
  return slug;
}

async function ensureUniqueSlug(base, excludeId) {
  let slug = String(base || '').trim().slice(0, 120);
  if (!slug) slug = `article-${Date.now()}`;
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? slug : `${slug.slice(0, 100)}-${i + 1}`.slice(0, 120);
    const [rows] = excludeId
      ? await pool.query('SELECT id FROM articles WHERE slug=? AND id<>? LIMIT 1', [candidate, excludeId])
      : await pool.query('SELECT id FROM articles WHERE slug=? LIMIT 1', [candidate]);
    if (!rows.length) return candidate;
  }
  return `${slug.slice(0, 90)}-${Date.now()}`.slice(0, 120);
}

function parseBody(body = {}) {
  return {
    title: String(body.title || '').trim().slice(0, 200),
    slug: String(body.slug || '').trim().slice(0, 120),
    summary: String(body.summary || '').trim().slice(0, 500),
    content: sanitizeContent(body.content || ''),
    category: String(body.category || '').trim().slice(0, 32),
    tags: String(body.tags || '').trim().slice(0, 200),
    cover: String(body.cover || '').trim().slice(0, 255),
    status: Number(body.status) === 1 ? 1 : 0,
    sort_weight: parseInt(body.sort_weight, 10) || 0
  };
}

/* ========== 公开接口（仅已发布） ========== */

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 12));
    const category = String(req.query.category || '').trim();
    const keyword = String(req.query.keyword || '').trim().slice(0, 100);

    const where = ['status=1'];
    const params = [];

    if (category && category !== '全部') {
      where.push('category=?');
      params.push(category);
    }
    if (keyword) {
      where.push('(title LIKE ? OR summary LIKE ?)');
      const like = `%${keyword}%`;
      params.push(like, like);
    }

    const whereSql = where.join(' AND ');
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM articles WHERE ${whereSql}`,
      params
    );
    const offset = (page - 1) * pageSize;
    const [list] = await pool.query(
      `SELECT ${LIST_FIELDS} FROM articles WHERE ${whereSql}
       ORDER BY sort_weight DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const [catRows] = await pool.query(
      `SELECT COALESCE(NULLIF(category,''),'未分类') AS name, COUNT(*) AS cnt
       FROM articles WHERE status=1 GROUP BY name ORDER BY cnt DESC`
    );

    res.json({
      list,
      total,
      page,
      pageSize,
      facets: { categories: catRows }
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '获取文章列表失败' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT COALESCE(NULLIF(category,''),'未分类') AS name, COUNT(*) AS cnt
       FROM articles WHERE status=1 GROUP BY name ORDER BY cnt DESC`
    );
    res.json(rows);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '获取分类失败' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().slice(0, 120);
    if (!slug) return res.status(404).json({ message: '文章不存在' });

    const [rows] = await pool.query(
      `SELECT ${LIST_FIELDS}, content FROM articles WHERE slug=? AND status=1 LIMIT 1`,
      [slug]
    );
    if (!rows.length) return res.status(404).json({ message: '文章不存在或未发布' });

    const article = rows[0];
    article.content = sanitizeContent(article.content);
    pool.query('UPDATE articles SET views=views+1 WHERE id=?', [article.id]).catch(() => {});
    res.json(article);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '获取文章失败' });
  }
});

/* ========== 管理接口 ========== */

adminRouter.use(adminRequired);

adminRouter.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const keyword = String(req.query.keyword || '').trim().slice(0, 100);
    const status = req.query.status;

    const where = ['1=1'];
    const params = [];
    if (keyword) {
      where.push('(title LIKE ? OR summary LIKE ? OR slug LIKE ?)');
      const like = `%${keyword}%`;
      params.push(like, like, like);
    }
    if (status === '0' || status === '1') {
      where.push('status=?');
      params.push(Number(status));
    }

    const whereSql = where.join(' AND ');
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM articles WHERE ${whereSql}`,
      params
    );
    const offset = (page - 1) * pageSize;
    const [list] = await pool.query(
      `SELECT ${LIST_FIELDS} FROM articles WHERE ${whereSql}
       ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.json({ list, total, page, pageSize });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '获取文章列表失败' });
  }
});

adminRouter.get('/:id(\\d+)', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${LIST_FIELDS}, content FROM articles WHERE id=? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: '文章不存在' });
    rows[0].content = sanitizeContent(rows[0].content);
    res.json(rows[0]);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '获取文章失败' });
  }
});

adminRouter.post('/', async (req, res) => {
  try {
    const data = parseBody(req.body);
    if (!data.title) return res.status(400).json({ message: '标题不能为空' });

    let slug = data.slug || slugifyTitle(data.title);
    slug = await ensureUniqueSlug(slug);

    const [result] = await pool.query(
      `INSERT INTO articles
        (slug, title, summary, content, category, tags, cover, status, sort_weight)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        slug,
        data.title,
        data.summary,
        data.content,
        data.category,
        data.tags,
        data.cover,
        data.status,
        data.sort_weight
      ]
    );
    res.json({ id: result.insertId, slug, message: '创建成功' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'slug 已存在，请更换' });
    }
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '创建文章失败' });
  }
});

adminRouter.put('/:id(\\d+)', async (req, res) => {
  try {
    const id = req.params.id;
    const [exist] = await pool.query('SELECT id, slug FROM articles WHERE id=? LIMIT 1', [id]);
    if (!exist.length) return res.status(404).json({ message: '文章不存在' });

    const data = parseBody(req.body);
    if (!data.title) return res.status(400).json({ message: '标题不能为空' });

    let slug = data.slug || exist[0].slug || slugifyTitle(data.title);
    slug = await ensureUniqueSlug(slug, id);

    await pool.query(
      `UPDATE articles SET
        slug=?, title=?, summary=?, content=?, category=?, tags=?, cover=?,
        status=?, sort_weight=?
       WHERE id=?`,
      [
        slug,
        data.title,
        data.summary,
        data.content,
        data.category,
        data.tags,
        data.cover,
        data.status,
        data.sort_weight,
        id
      ]
    );
    res.json({ message: '已更新', slug });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'slug 已存在，请更换' });
    }
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '更新文章失败' });
  }
});

adminRouter.post('/:id(\\d+)/toggle', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, status FROM articles WHERE id=? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: '文章不存在' });
    const next = rows[0].status === 1 ? 0 : 1;
    await pool.query('UPDATE articles SET status=? WHERE id=?', [next, req.params.id]);
    res.json({ message: next === 1 ? '已发布' : '已设为草稿', status: next });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '切换状态失败' });
  }
});

adminRouter.delete('/:id(\\d+)', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM articles WHERE id=?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: '文章不存在' });
    res.json({ message: '已删除' });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '删除文章失败' });
  }
});

module.exports = router;
module.exports.adminRouter = adminRouter;
