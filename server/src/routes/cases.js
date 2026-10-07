const express = require('express');
const { pinyin } = require('pinyin-pro');
const pool = require('../db');
const { adminRequired } = require('../middleware/auth');
const { logger } = require('../lib/logger');

const router = express.Router();
const adminRouter = express.Router();

const SERVICE_TYPES = ['custom', 'modify', 'deploy', 'defense', 'mixed'];
const SERVICE_LABELS = {
  custom: '定制开发',
  modify: '二次修改',
  deploy: '代跑部署',
  defense: '答辩加购',
  mixed: '组合服务'
};

const LIST_FIELDS = `id, slug, title, summary, cover, client_scene, service_type, tech, domain,
  duration_label, scope_out, result_points_json, deliverables_json, gallery_json,
  related_product_ids, related_service_slugs,
  status, views, sort_weight, published_at, created_at, updated_at`;

let tableReady = false;

async function ensureColumn(col, defSql) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cases' AND COLUMN_NAME=?`,
    [col]
  );
  if (!rows[0].c) await pool.query(`ALTER TABLE cases ADD COLUMN ${col} ${defSql}`);
}

async function ensureTables() {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(120) NOT NULL UNIQUE,
      title VARCHAR(200) NOT NULL,
      summary VARCHAR(500) DEFAULT '',
      cover VARCHAR(255) DEFAULT '',
      content_md MEDIUMTEXT,
      client_scene VARCHAR(500) DEFAULT '',
      service_type VARCHAR(16) DEFAULT 'custom',
      tech VARCHAR(64) DEFAULT '',
      domain VARCHAR(64) DEFAULT '',
      duration_label VARCHAR(64) DEFAULT '',
      scope_out VARCHAR(500) DEFAULT '',
      result_points_json TEXT,
      deliverables_json TEXT,
      gallery_json MEDIUMTEXT,
      related_product_ids VARCHAR(200) DEFAULT '',
      related_service_slugs VARCHAR(200) DEFAULT '',
      status TINYINT DEFAULT 0,
      views INT DEFAULT 0,
      sort_weight INT DEFAULT 0,
      published_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_service (service_type),
      INDEX idx_tech (tech),
      INDEX idx_sort (sort_weight, published_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await ensureColumn('duration_label', "VARCHAR(64) DEFAULT ''");
  await ensureColumn('scope_out', "VARCHAR(500) DEFAULT ''");
  await ensureColumn('deliverables_json', 'TEXT');
  await pool.query("ALTER TABLE cases MODIFY COLUMN client_scene VARCHAR(500) DEFAULT ''").catch(() => {});
  tableReady = true;
}

router.use(async (req, res, next) => {
  try {
    await ensureTables();
    next();
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '案例服务初始化失败' });
  }
});
adminRouter.use(async (req, res, next) => {
  try {
    await ensureTables();
    next();
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '案例服务初始化失败' });
  }
});

function sanitizeContent(raw) {
  let s = String(raw == null ? '' : raw);
  s = s.replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  s = s.replace(/<\s*\/?\s*script[^>]*>/gi, '');
  s = s.replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '');
  s = s.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  s = s.replace(/javascript\s*:/gi, '');
  s = s.replace(/vbscript\s*:/gi, '');
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
  if (!slug) slug = `case-${Date.now()}`;
  return slug;
}

async function ensureUniqueSlug(base, excludeId) {
  let slug = String(base || '').trim().slice(0, 120);
  if (!slug) slug = `case-${Date.now()}`;
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? slug : `${slug.slice(0, 100)}-${i + 1}`.slice(0, 120);
    const [rows] = excludeId
      ? await pool.query('SELECT id FROM cases WHERE slug=? AND id<>? LIMIT 1', [candidate, excludeId])
      : await pool.query('SELECT id FROM cases WHERE slug=? LIMIT 1', [candidate]);
    if (!rows.length) return candidate;
  }
  return `${slug.slice(0, 90)}-${Date.now()}`.slice(0, 120);
}

function parseJsonArray(raw, mapFn, max = 20) {
  let arr = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw || '[]'); } catch { arr = []; }
  }
  if (!Array.isArray(arr)) arr = [];
  return arr.map(mapFn).filter(Boolean).slice(0, max);
}

function parseIdList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n) && n > 0).slice(0, 12);
  }
  return String(raw || '')
    .split(/[,，\s]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 12);
}

function parseSlugList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 8);
  }
  return String(raw || '')
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseBody(body = {}) {
  const serviceType = String(body.service_type || 'custom').trim();
  return {
    title: String(body.title || '').trim().slice(0, 200),
    slug: String(body.slug || '').trim().slice(0, 120),
    summary: String(body.summary || '').trim().slice(0, 500),
    cover: String(body.cover || '').trim().slice(0, 255),
    content_md: sanitizeContent(body.content_md || body.content || ''),
    client_scene: String(body.client_scene || '').trim().slice(0, 500),
    service_type: SERVICE_TYPES.includes(serviceType) ? serviceType : 'custom',
    tech: String(body.tech || '').trim().slice(0, 64),
    domain: String(body.domain || '').trim().slice(0, 64),
    duration_label: String(body.duration_label || '').trim().slice(0, 64),
    scope_out: String(body.scope_out || '').trim().slice(0, 500),
    result_points_json: JSON.stringify(
      parseJsonArray(body.result_points ?? body.result_points_json, (s) => String(s || '').trim().slice(0, 100), 8)
    ),
    deliverables_json: JSON.stringify(
      parseJsonArray(body.deliverables ?? body.deliverables_json, (s) => String(s || '').trim().slice(0, 120), 12)
    ),
    gallery_json: JSON.stringify(
      parseJsonArray(body.gallery ?? body.gallery_json, (g) => {
        if (!g) return null;
        if (typeof g === 'string') {
          const url = g.trim().slice(0, 255);
          return url ? { url, caption: '' } : null;
        }
        const url = String(g.url || '').trim().slice(0, 255);
        if (!url) return null;
        return { url, caption: String(g.caption || '').trim().slice(0, 120) };
      }, 12)
    ),
    related_product_ids: parseIdList(body.related_product_ids).join(','),
    related_service_slugs: parseSlugList(body.related_service_slugs).join(','),
    status: Number(body.status) === 1 ? 1 : 0,
    sort_weight: parseInt(body.sort_weight, 10) || 0
  };
}

function publicCase(row) {
  if (!row) return null;
  const result_points = parseJsonArray(row.result_points_json, (s) => String(s || '').trim(), 8);
  const deliverables = parseJsonArray(row.deliverables_json, (s) => String(s || '').trim(), 12);
  const gallery = parseJsonArray(row.gallery_json, (g) => {
    if (!g) return null;
    if (typeof g === 'string') return { url: g, caption: '' };
    return { url: String(g.url || ''), caption: String(g.caption || '') };
  }, 12).filter((g) => g.url);
  const related_product_ids = parseIdList(row.related_product_ids);
  const related_service_slugs = parseSlugList(row.related_service_slugs);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    cover: row.cover,
    content_md: row.content_md,
    client_scene: row.client_scene,
    service_type: row.service_type,
    service_label: SERVICE_LABELS[row.service_type] || row.service_type,
    tech: row.tech,
    domain: row.domain,
    duration_label: row.duration_label || '',
    scope_out: row.scope_out || '',
    result_points,
    deliverables,
    gallery,
    related_product_ids,
    related_service_slugs,
    status: row.status,
    views: row.views,
    sort_weight: row.sort_weight,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function loadRelatedProducts(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT id, title, tech, cover, price, sales, category FROM products
     WHERE id IN (${placeholders}) AND is_deleted=0 AND status=1`,
    ids
  );
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => map.get(id)).filter(Boolean);
}

/* ========== 公开 ========== */

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(40, Math.max(1, parseInt(req.query.pageSize, 10) || 12));
    const serviceType = String(req.query.service_type || '').trim();
    const tech = String(req.query.tech || '').trim();
    const domain = String(req.query.domain || '').trim();
    const keyword = String(req.query.keyword || '').trim().slice(0, 80);

    const where = ['status=1'];
    const params = [];
    if (serviceType && serviceType !== '全部' && SERVICE_TYPES.includes(serviceType)) {
      where.push('service_type=?');
      params.push(serviceType);
    }
    if (tech && tech !== '全部') {
      where.push('tech=?');
      params.push(tech);
    }
    if (domain && domain !== '全部') {
      where.push('domain=?');
      params.push(domain);
    }
    if (keyword) {
      where.push('(title LIKE ? OR summary LIKE ? OR client_scene LIKE ?)');
      const like = `%${keyword}%`;
      params.push(like, like, like);
    }

    const whereSql = where.join(' AND ');
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM cases WHERE ${whereSql}`, params);
    const offset = (page - 1) * pageSize;
    const [list] = await pool.query(
      `SELECT ${LIST_FIELDS} FROM cases WHERE ${whereSql}
       ORDER BY sort_weight DESC, COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [svcRows] = await pool.query(
      `SELECT service_type AS name, COUNT(*) AS cnt FROM cases WHERE status=1 GROUP BY service_type ORDER BY cnt DESC`
    );
    const [techRows] = await pool.query(
      `SELECT tech AS name, COUNT(*) AS cnt FROM cases WHERE status=1 AND tech<>'' GROUP BY tech ORDER BY cnt DESC`
    );
    const [domainRows] = await pool.query(
      `SELECT domain AS name, COUNT(*) AS cnt FROM cases WHERE status=1 AND domain<>'' GROUP BY domain ORDER BY cnt DESC`
    );

    res.json({
      list: list.map(publicCase),
      total,
      page,
      pageSize,
      facets: {
        service_types: svcRows.map((r) => ({
          name: r.name,
          label: SERVICE_LABELS[r.name] || r.name,
          cnt: r.cnt
        })),
        techs: techRows,
        domains: domainRows
      },
      service_labels: SERVICE_LABELS
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '获取案例列表失败' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(404).json({ message: '案例不存在' });
    const [rows] = await pool.query(
      `SELECT ${LIST_FIELDS}, content_md FROM cases WHERE slug=? AND status=1 LIMIT 1`,
      [slug]
    );
    if (!rows.length) return res.status(404).json({ message: '案例不存在或未发布' });
    await pool.query('UPDATE cases SET views = views + 1 WHERE id=?', [rows[0].id]);
    const item = publicCase({ ...rows[0], views: (rows[0].views || 0) + 1 });
    item.related_products = await loadRelatedProducts(item.related_product_ids);
    res.json(item);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '获取案例失败' });
  }
});

/* ========== 后台 ========== */

adminRouter.get('/', adminRequired, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const keyword = String(req.query.keyword || '').trim();
    const status = req.query.status;
    const where = ['1=1'];
    const params = [];
    if (status === '0' || status === '1') {
      where.push('status=?');
      params.push(Number(status));
    }
    if (keyword) {
      where.push('(title LIKE ? OR slug LIKE ?)');
      const like = `%${keyword}%`;
      params.push(like, like);
    }
    const whereSql = where.join(' AND ');
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM cases WHERE ${whereSql}`, params);
    const offset = (page - 1) * pageSize;
    const [list] = await pool.query(
      `SELECT ${LIST_FIELDS} FROM cases WHERE ${whereSql}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.json({ list: list.map(publicCase), total, page, pageSize, service_labels: SERVICE_LABELS });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '获取案例列表失败' });
  }
});

adminRouter.get('/:id', adminRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${LIST_FIELDS}, content_md FROM cases WHERE id=? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: '案例不存在' });
    res.json(publicCase(rows[0]));
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '获取案例失败' });
  }
});

adminRouter.post('/', adminRequired, async (req, res) => {
  try {
    const data = parseBody(req.body);
    if (!data.title) return res.status(400).json({ message: '标题不能为空' });
    if (!data.summary) return res.status(400).json({ message: '请填写一句话结果（摘要）' });
    const slug = await ensureUniqueSlug(data.slug || slugifyTitle(data.title));
    const publishedAt = data.status === 1 ? new Date() : null;
    const [ret] = await pool.query(
      `INSERT INTO cases
       (slug, title, summary, cover, content_md, client_scene, service_type, tech, domain,
        duration_label, scope_out, result_points_json, deliverables_json, gallery_json,
        related_product_ids, related_service_slugs, status, sort_weight, published_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        slug, data.title, data.summary, data.cover, data.content_md, data.client_scene,
        data.service_type, data.tech, data.domain, data.duration_label, data.scope_out,
        data.result_points_json, data.deliverables_json, data.gallery_json,
        data.related_product_ids, data.related_service_slugs, data.status, data.sort_weight, publishedAt
      ]
    );
    res.json({ id: ret.insertId, slug, message: '已创建' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'slug 已存在' });
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '创建案例失败' });
  }
});

adminRouter.put('/:id', adminRequired, async (req, res) => {
  try {
    const [exist] = await pool.query('SELECT id, status, published_at FROM cases WHERE id=? LIMIT 1', [req.params.id]);
    if (!exist.length) return res.status(404).json({ message: '案例不存在' });
    const data = parseBody(req.body);
    if (!data.title) return res.status(400).json({ message: '标题不能为空' });
    if (!data.summary) return res.status(400).json({ message: '请填写一句话结果（摘要）' });
    const slug = await ensureUniqueSlug(data.slug || slugifyTitle(data.title), exist[0].id);
    let publishedAt = exist[0].published_at;
    if (data.status === 1 && !publishedAt) publishedAt = new Date();
    if (data.status === 0) publishedAt = publishedAt || null;
    await pool.query(
      `UPDATE cases SET
       slug=?, title=?, summary=?, cover=?, content_md=?, client_scene=?, service_type=?, tech=?, domain=?,
       duration_label=?, scope_out=?, result_points_json=?, deliverables_json=?, gallery_json=?,
       related_product_ids=?, related_service_slugs=?, status=?, sort_weight=?, published_at=?
       WHERE id=?`,
      [
        slug, data.title, data.summary, data.cover, data.content_md, data.client_scene,
        data.service_type, data.tech, data.domain, data.duration_label, data.scope_out,
        data.result_points_json, data.deliverables_json, data.gallery_json,
        data.related_product_ids, data.related_service_slugs, data.status, data.sort_weight,
        publishedAt, req.params.id
      ]
    );
    res.json({ message: '已更新', slug });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'slug 已存在' });
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '更新案例失败' });
  }
});

adminRouter.post('/:id/toggle', adminRequired, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, status, published_at FROM cases WHERE id=? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: '案例不存在' });
    const next = rows[0].status === 1 ? 0 : 1;
    const publishedAt = next === 1 && !rows[0].published_at ? new Date() : rows[0].published_at;
    await pool.query('UPDATE cases SET status=?, published_at=? WHERE id=?', [next, publishedAt, req.params.id]);
    res.json({ message: next === 1 ? '已发布' : '已下架', status: next });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '切换状态失败' });
  }
});

adminRouter.delete('/:id', adminRequired, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM cases WHERE id=?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: '案例不存在' });
    res.json({ message: '已删除' });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '删除案例失败' });
  }
});

module.exports = router;
module.exports.adminRouter = adminRouter;
module.exports.ensureTables = ensureTables;
module.exports.SERVICE_LABELS = SERVICE_LABELS;
