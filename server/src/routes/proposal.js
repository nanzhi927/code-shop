const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../db');
const { optionalAuth, adminRequired, isAdminRole } = require('../middleware/auth');
const { logger } = require('../lib/logger');
const {
  defaultOutline,
  normalizeOutline,
  normalizeProfile,
  validateProfile
} = require('../lib/ai/outline');
const { generateReport, getConfig, rewriteChapter, splitMarkdownChapters, joinMarkdownChapters, suggestModules } = require('../lib/ai/provider');
const { parseTemplateBuffer } = require('../lib/ai/parseTemplate');
const { markdownToDocxBuffer } = require('../lib/ai/exportDocx');

const router = express.Router();

const TEMPLATE_DIR = path.resolve(__dirname, '../../uploads/proposal');
fs.mkdirSync(TEMPLATE_DIR, { recursive: true });

const uploadTemplate = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMPLATE_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.docx';
      cb(null, `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const ok = name.endsWith('.docx') || name.endsWith('.pdf')
      || file.mimetype?.includes('word')
      || file.mimetype?.includes('officedocument')
      || file.mimetype === 'application/pdf';
    cb(ok ? null : new Error('仅支持 .docx / .pdf 模板'), ok);
  }
});

let tablesReady = false;

async function ensureColumn(table, column, ddl) {
  const [cols] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [table, column]
  );
  if (!cols[0].c) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

async function ensureTables() {
  if (tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS proposal_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_no VARCHAR(32) NOT NULL,
      user_id INT DEFAULT 0,
      guest_key VARCHAR(64) DEFAULT '',
      mode VARCHAR(16) DEFAULT 'qa',
      status VARCHAR(16) DEFAULT 'draft',
      profile_json MEDIUMTEXT,
      outline_json MEDIUMTEXT,
      template_file VARCHAR(255) DEFAULT '',
      template_text MEDIUMTEXT,
      content_md MEDIUMTEXT,
      error_message VARCHAR(500) DEFAULT '',
      tokens_in INT DEFAULT 0,
      tokens_out INT DEFAULT 0,
      provider VARCHAR(32) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_session_no (session_no),
      INDEX idx_user (user_id),
      INDEX idx_guest (guest_key),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS proposal_usage (
      id INT AUTO_INCREMENT PRIMARY KEY,
      day CHAR(10) NOT NULL,
      subject_type VARCHAR(16) NOT NULL,
      subject_key VARCHAR(64) NOT NULL,
      count INT DEFAULT 0,
      UNIQUE KEY uk_day_subject (day, subject_type, subject_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await ensureColumn('proposal_sessions', 'template_file', "VARCHAR(255) DEFAULT ''");
  await ensureColumn('proposal_sessions', 'template_text', 'MEDIUMTEXT');
  await ensureColumn('users', 'proposal_credits', 'INT DEFAULT 0');
  const [giftRow] = await pool.query("SELECT COUNT(*) AS c FROM settings WHERE k='proposal_register_gift'");
  if (!giftRow[0].c) {
    await pool.query("INSERT INTO settings (k, v) VALUES ('proposal_register_gift', '1')");
  } else {
    // 普通用户统一为注册赠送 1 次
    await pool.query("UPDATE settings SET v='1' WHERE k='proposal_register_gift'");
  }
  tablesReady = true;
}

function today() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function sessionNo() {
  return `KT${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function guestKeyFromReq(req) {
  const fromHeader = String(req.headers['x-guest-key'] || req.body?.guest_key || req.query?.guest_key || '').trim().slice(0, 64);
  if (fromHeader) return fromHeader;
  const ip = req.ip || req.socket?.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 32);
}

async function getSettingMap() {
  const [rows] = await pool.query(
    "SELECT k, v FROM settings WHERE k IN ('proposal_enabled','proposal_register_gift','proposal_disclaimer')"
  );
  const map = {};
  for (const r of rows) map[r.k] = r.v;
  return {
    enabled: map.proposal_enabled !== '0',
    registerGift: Math.max(0, parseInt(map.proposal_register_gift, 10) || 1),
    disclaimer: map.proposal_disclaimer || '本助手生成内容仅供学习参考，请遵守学校学术规范，严禁直接用于学术不端。请自行核对事实与参考文献。'
  };
}

async function getQuota(req) {
  const conf = await getSettingMap();
  const userId = req.user?.id || 0;
  if (userId) {
    const [rows] = await pool.query('SELECT proposal_credits, role FROM users WHERE id=?', [userId]);
    const role = rows[0]?.role || req.user?.role || 'user';
    if (isAdminRole(role)) {
      return {
        enabled: conf.enabled,
        limit: null,
        gift: conf.registerGift,
        remaining: null,
        unlimited: true,
        used: 0,
        subject: 'admin',
        need_login: false,
        disclaimer: conf.disclaimer
      };
    }
    const remaining = Math.max(0, parseInt(rows[0]?.proposal_credits, 10) || 0);
    return {
      enabled: conf.enabled,
      limit: conf.registerGift,
      gift: conf.registerGift,
      remaining,
      unlimited: false,
      used: Math.max(0, conf.registerGift - remaining),
      subject: 'user',
      need_login: false,
      disclaimer: conf.disclaimer
    };
  }
  const gk = guestKeyFromReq(req);
  return {
    enabled: conf.enabled,
    limit: conf.registerGift,
    gift: conf.registerGift,
    remaining: 0,
    unlimited: false,
    used: 0,
    subject: 'guest',
    need_login: true,
    guest_key: gk,
    disclaimer: conf.disclaimer
  };
}

/** 消耗 1 次注册赠送额度；管理员不扣次。成功返回 true */
async function consumeCredit(userId, role) {
  if (!userId) return false;
  if (isAdminRole(role || '')) return true;
  const [r] = await pool.query(
    'UPDATE users SET proposal_credits = proposal_credits - 1 WHERE id=? AND proposal_credits > 0',
    [userId]
  );
  return r.affectedRows > 0;
}

async function refundCredit(userId, role) {
  if (!userId || isAdminRole(role || '')) return;
  await pool.query('UPDATE users SET proposal_credits = proposal_credits + 1 WHERE id=?', [userId]);
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text || '');
  } catch {
    return fallback;
  }
}

function publicSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    session_no: row.session_no,
    mode: row.mode,
    status: row.status,
    profile: parseJson(row.profile_json, {}),
    outline: parseJson(row.outline_json, defaultOutline()),
    template_file: row.template_file || '',
    has_template: !!(row.template_file || row.template_text),
    content_md: row.content_md || '',
    error_message: row.error_message || '',
    tokens_in: row.tokens_in || 0,
    tokens_out: row.tokens_out || 0,
    provider: row.provider || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function loadOwned(id, req) {
  const [rows] = await pool.query('SELECT * FROM proposal_sessions WHERE id=?', [id]);
  const row = rows[0];
  if (!row) return null;
  const userId = req.user?.id || 0;
  const gk = guestKeyFromReq(req);
  if (userId && row.user_id === userId) return row;
  if (!userId && row.guest_key && row.guest_key === gk) return row;
  if (userId && row.user_id === 0 && row.guest_key === gk) return row;
  return null;
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.use(async (req, res, next) => {
  try {
    await ensureTables();
    next();
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '开题服务初始化失败' });
  }
});

router.get('/meta', optionalAuth, async (req, res) => {
  try {
    const quota = await getQuota(req);
    const ai = getConfig();
    res.json({
      ...quota,
      outline: defaultOutline(),
      ai_mode: ai.forceMock ? 'mock' : 'live',
      domains: ['校园教育', '电子商务', '医疗健康', '政务办公', '餐饮外卖', '图书管理', '人事财务', '物联网', '其他'],
      techs: ['SpringBoot', 'SSM', 'JSP+Servlet', 'Vue', '小程序', 'Python', '其他']
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.post('/sessions', optionalAuth, async (req, res) => {
  try {
    const conf = await getSettingMap();
    if (!conf.enabled) return res.status(503).json({ message: '免费开题暂未开放' });
    if (!req.user?.id) {
      return res.status(401).json({
        message: `请先使用手机号注册登录；注册即赠送 ${conf.registerGift} 次免费开题`,
        need_login: true,
        gift: conf.registerGift
      });
    }
    if (!req.body?.agreed) return res.status(400).json({ message: '请先勾选学术诚信与免责声明' });

    const profile = normalizeProfile(req.body.profile || req.body);
    const err = validateProfile(profile);
    if (err) return res.status(400).json({ message: err });

    const mode = ['qa', 'template', 'hybrid'].includes(req.body.mode) ? req.body.mode : 'qa';
    const outline = normalizeOutline(req.body.outline || defaultOutline());
    const no = sessionNo();
    const userId = req.user?.id || 0;
    const gk = guestKeyFromReq(req);

    const [r] = await pool.query(
      `INSERT INTO proposal_sessions
       (session_no, user_id, guest_key, mode, status, profile_json, outline_json)
       VALUES (?,?,?,?, 'ready', ?, ?)`,
      [no, userId, gk, mode, JSON.stringify(profile), JSON.stringify(outline)]
    );

    const [rows] = await pool.query('SELECT * FROM proposal_sessions WHERE id=?', [r.insertId]);
    res.json({ ok: true, session: publicSession(rows[0]), guest_key: gk });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.post('/sessions/:id/template', optionalAuth, (req, res) => {
  uploadTemplate.single('file')(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ message: err.message || '上传失败' });
      const row = await loadOwned(req.params.id, req);
      if (!row) return res.status(404).json({ message: '会话不存在' });
      if (!req.file) return res.status(400).json({ message: '请上传 docx 文件' });

      const buffer = fs.readFileSync(req.file.path);
      const parsed = await parseTemplateBuffer(buffer, req.file.originalname || req.file.filename);
      const outline = parsed.outline;
      const rel = `/uploads/proposal/${req.file.filename}`;
      const mode = row.mode === 'qa' ? 'hybrid' : (row.mode || 'template');

      await pool.query(
        `UPDATE proposal_sessions
         SET template_file=?, template_text=?, outline_json=?, mode=?, status='ready', error_message=''
         WHERE id=?`,
        [rel, parsed.text || '', JSON.stringify(outline), mode, row.id]
      );

      const [rows] = await pool.query('SELECT * FROM proposal_sessions WHERE id=?', [row.id]);
      res.json({
        ok: true,
        session: publicSession(rows[0]),
        parsed: parsed.parsed,
        rawTitles: parsed.rawTitles || [],
        message: parsed.parsed ? '已从模板解析章节' : '未能可靠识别章节，已使用默认大纲，请手动调整'
      });
    } catch (e) {
      logger.error(e.stack || e.message);
      res.status(500).json({ message: '模板解析失败，请换一份 docx 或手动编辑大纲' });
    }
  });
});

router.put('/sessions/:id/outline', optionalAuth, async (req, res) => {
  try {
    const row = await loadOwned(req.params.id, req);
    if (!row) return res.status(404).json({ message: '会话不存在' });
    if (row.status === 'generating') return res.status(409).json({ message: '正在生成中，请稍候' });

    const outline = normalizeOutline(req.body.outline);
    await pool.query(
      "UPDATE proposal_sessions SET outline_json=?, status='ready', error_message='' WHERE id=?",
      [JSON.stringify(outline), row.id]
    );
    const [rows] = await pool.query('SELECT * FROM proposal_sessions WHERE id=?', [row.id]);
    res.json({ ok: true, session: publicSession(rows[0]) });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

async function runGenerate(req, res, { stream }) {
  const conf = await getSettingMap();
  if (!conf.enabled) {
    if (stream) {
      sseWrite(res, 'error', { message: '免费开题暂未开放' });
      return res.end();
    }
    return res.status(503).json({ message: '免费开题暂未开放' });
  }

  const row = await loadOwned(req.params.id, req);
  if (!row) {
    if (stream) {
      sseWrite(res, 'error', { message: '会话不存在' });
      return res.end();
    }
    return res.status(404).json({ message: '会话不存在' });
  }
  if (row.status === 'generating') {
    if (stream) {
      sseWrite(res, 'error', { message: '正在生成中' });
      return res.end();
    }
    return res.status(409).json({ message: '正在生成中' });
  }

  const force = !!(req.body?.force || req.query?.force === '1');
  if (row.status === 'done' && row.content_md && !force) {
    if (stream) {
      sseWrite(res, 'done', { session: publicSession(row), reused: true, quota: await getQuota(req) });
      return res.end();
    }
    return res.json({ ok: true, session: publicSession(row), reused: true });
  }

  const userId = req.user?.id || 0;
  if (!userId) {
    const quota = await getQuota(req);
    const message = `请先使用手机号注册登录；注册即赠送 ${quota.gift} 次免费开题`;
    if (stream) {
      sseWrite(res, 'error', { message, quota });
      return res.end();
    }
    return res.status(401).json({ message, quota });
  }

  const quota = await getQuota(req);
  if (!quota.unlimited && quota.remaining <= 0) {
    const message = '免费开题次数已用完，如需更多请联系客服';
    if (stream) {
      sseWrite(res, 'error', { message, quota });
      return res.end();
    }
    return res.status(429).json({ message, quota });
  }

  const profile = normalizeProfile(parseJson(row.profile_json, {}));
  const outline = normalizeOutline(parseJson(row.outline_json, defaultOutline()));
  const err = validateProfile(profile);
  if (err) {
    if (stream) {
      sseWrite(res, 'error', { message: err });
      return res.end();
    }
    return res.status(400).json({ message: err });
  }

  const role = req.user?.role || '';
  const consumed = await consumeCredit(userId, role);
  if (!consumed) {
    const q = await getQuota(req);
    const message = '免费开题次数已用完，如需更多请联系客服';
    if (stream) {
      sseWrite(res, 'error', { message, quota: q });
      return res.end();
    }
    return res.status(429).json({ message, quota: q });
  }

  await pool.query("UPDATE proposal_sessions SET status='generating', error_message='' WHERE id=?", [row.id]);

  try {
    const result = await generateReport(profile, outline, stream
      ? async (evt) => { sseWrite(res, evt.type, evt); }
      : undefined);

    await pool.query(
      `UPDATE proposal_sessions SET status='done', content_md=?, tokens_in=?, tokens_out=?, provider=?, error_message='' WHERE id=?`,
      [result.contentMd, result.tokensIn, result.tokensOut, result.provider, row.id]
    );
    const [rows] = await pool.query('SELECT * FROM proposal_sessions WHERE id=?', [row.id]);
    const nextQuota = await getQuota(req);
    if (stream) {
      sseWrite(res, 'done', { session: publicSession(rows[0]), quota: nextQuota });
      return res.end();
    }
    return res.json({ ok: true, session: publicSession(rows[0]), quota: nextQuota });
  } catch (genErr) {
    logger.error(genErr.stack || genErr.message);
    // 生成失败退回次数（管理员不扣次故也不退）
    await refundCredit(userId, role);
    await pool.query(
      "UPDATE proposal_sessions SET status='failed', error_message=? WHERE id=?",
      [String(genErr.message || '生成失败').slice(0, 500), row.id]
    );
    if (stream) {
      sseWrite(res, 'error', { message: '生成失败，请稍后重试', quota: await getQuota(req) });
      return res.end();
    }
    return res.status(500).json({ message: '生成失败，请稍后重试', quota: await getQuota(req) });
  }
}

router.post('/sessions/:id/generate', optionalAuth, async (req, res) => {
  try {
    await runGenerate(req, res, { stream: false });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.get('/sessions/:id/stream', optionalAuth, async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    sseWrite(res, 'ready', { ok: true });
    await runGenerate(req, res, { stream: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    try {
      sseWrite(res, 'error', { message: '服务器内部错误，请稍后再试' });
      res.end();
    } catch { /* ignore */ }
  }
});

router.get('/sessions/:id/export.docx', optionalAuth, async (req, res) => {
  try {
    const row = await loadOwned(req.params.id, req);
    if (!row) return res.status(404).json({ message: '会话不存在' });
    if (!row.content_md) return res.status(400).json({ message: '请先生成报告' });
    const profile = parseJson(row.profile_json, {});
    const title = profile.title || '开题报告';
    const buf = await markdownToDocxBuffer(row.content_md, title);
    const filename = encodeURIComponent(`${title.slice(0, 40)}.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.send(buf);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '导出失败，请稍后再试' });
  }
});

router.get('/sessions/:id', optionalAuth, async (req, res) => {
  try {
    const row = await loadOwned(req.params.id, req);
    if (!row) return res.status(404).json({ message: '会话不存在' });
    res.json({ session: publicSession(row) });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.get('/mine', optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: '请先登录' });
    const [list] = await pool.query(
      'SELECT id, session_no, status, mode, profile_json, created_at, updated_at FROM proposal_sessions WHERE user_id=? ORDER BY id DESC LIMIT 50',
      [req.user.id]
    );
    res.json({
      list: list.map((r) => ({
        id: r.id,
        session_no: r.session_no,
        status: r.status,
        mode: r.mode,
        title: parseJson(r.profile_json, {}).title || '',
        created_at: r.created_at,
        updated_at: r.updated_at
      }))
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

/** 搜索可带入模块的源码商品 */
router.get('/suggest-products', optionalAuth, async (req, res) => {
  try {
    const keyword = String(req.query.keyword || '').trim().slice(0, 64);
    const tech = String(req.query.tech || '').trim().slice(0, 32);
    const params = [];
    let where = 'WHERE status=1 AND is_deleted=0';
    if (tech && tech !== '其他') {
      where += ' AND tech=?';
      params.push(tech);
    }
    if (keyword) {
      where += ' AND (title LIKE ? OR keywords LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const [list] = await pool.query(
      `SELECT id, title, tech, cover, sales, category FROM products ${where}
       ORDER BY sales DESC, id DESC LIMIT 12`,
      params
    );
    res.json({ list });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

/** AI 根据题目生成功能模块候选（可点选） */
router.post('/suggest-modules', optionalAuth, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim().slice(0, 120);
    if (!title) return res.status(400).json({ message: '请先填写题目' });
    const tech = String(req.body?.tech || '').trim().slice(0, 32);
    const domain = String(req.body?.domain || '').trim().slice(0, 32);
    const result = await suggestModules({ title, tech, domain });
    res.json({
      modules: result.modules || [],
      provider: result.provider || '',
      title,
      tech,
      domain
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '生成模块失败，请稍后重试' });
  }
});

/** 从商品详情提取功能模块 */
router.get('/product-modules/:id', optionalAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, title, tech, category, details FROM products WHERE id=? AND is_deleted=0',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: '商品不存在' });
    const p = rows[0];
    let details = {};
    try { details = JSON.parse(p.details || '{}') || {}; } catch { details = {}; }
    const intro = details.intro || {};
    let modules = [];
    if (Array.isArray(intro.features)) modules = intro.features;
    else if (Array.isArray(details.features)) modules = details.features;
    modules = modules.map((m) => String(m || '').trim()).filter(Boolean).slice(0, 12);
    res.json({
      id: p.id,
      title: p.title,
      tech: p.tech,
      category: p.category || '',
      modules,
      domainHint: p.category || ''
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

/** 单章重写 / 扩写 / 缩写（不占用每日完整生成额度，单会话最多 8 次） */
router.post('/sessions/:id/chapters/rewrite', optionalAuth, async (req, res) => {
  try {
    const row = await loadOwned(req.params.id, req);
    if (!row) return res.status(404).json({ message: '会话不存在' });
    if (!row.content_md) return res.status(400).json({ message: '请先生成全文' });
    if (row.status === 'generating') return res.status(409).json({ message: '正在生成中' });

    const action = ['rewrite', 'expand', 'shrink'].includes(req.body?.action) ? req.body.action : 'rewrite';
    const index = parseInt(req.body?.index, 10);
    if (!Number.isFinite(index) || index < 0) return res.status(400).json({ message: '章节序号无效' });

    const rawProfile = parseJson(row.profile_json, {});
    const profile = normalizeProfile(rawProfile);
    const { preface, chapters } = splitMarkdownChapters(row.content_md);
    if (!chapters.length || index >= chapters.length) {
      return res.status(400).json({ message: '未找到对应章节' });
    }

    const rewriteCount = Number(rawProfile._rewriteCount || 0);
    if (rewriteCount >= 8) {
      return res.status(429).json({ message: '本篇改写次数已达上限，请新建开题' });
    }

    const target = chapters[index];
    const result = await rewriteChapter({
      profile,
      chapterTitle: target.title,
      oldContent: target.body,
      action
    });
    chapters[index] = { ...target, body: result.content };
    const contentMd = joinMarkdownChapters(preface, chapters);
    const nextProfile = { ...rawProfile, ...profile, _rewriteCount: rewriteCount + 1 };

    await pool.query(
      `UPDATE proposal_sessions SET content_md=?, profile_json=?,
       tokens_in=tokens_in+?, tokens_out=tokens_out+?, provider=?, updated_at=NOW() WHERE id=?`,
      [contentMd, JSON.stringify(nextProfile), result.tokensIn || 0, result.tokensOut || 0, result.provider || row.provider, row.id]
    );
    const [rows] = await pool.query('SELECT * FROM proposal_sessions WHERE id=?', [row.id]);
    res.json({
      ok: true,
      session: publicSession(rows[0]),
      chapter: { index, title: target.title, content: result.content },
      rewriteLeft: Math.max(0, 8 - nextProfile._rewriteCount)
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '改写失败，请稍后再试' });
  }
});

router.get('/admin/sessions', adminRequired, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const status = String(req.query.status || '').trim();
    const where = status ? 'WHERE status=?' : '';
    const params = status ? [status] : [];
    const [tr] = await pool.query(`SELECT COUNT(*) AS c FROM proposal_sessions ${where}`, params);
    const [list] = await pool.query(
      `SELECT id, session_no, user_id, guest_key, mode, status, profile_json, tokens_in, tokens_out, provider, created_at, updated_at
       FROM proposal_sessions ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    const [usage] = await pool.query(
      'SELECT subject_type, SUM(count) AS cnt FROM proposal_usage WHERE day=? GROUP BY subject_type',
      [today()]
    );
    const [cost] = await pool.query(
      `SELECT COUNT(*) AS sessions,
              IFNULL(SUM(tokens_in),0) AS tokens_in,
              IFNULL(SUM(tokens_out),0) AS tokens_out,
              SUM(status='done') AS done_cnt
       FROM proposal_sessions WHERE DATE(created_at)=?`,
      [today()]
    );
    const [costAll] = await pool.query(
      `SELECT COUNT(*) AS sessions,
              IFNULL(SUM(tokens_in),0) AS tokens_in,
              IFNULL(SUM(tokens_out),0) AS tokens_out
       FROM proposal_sessions`
    );
    res.json({
      total: tr[0].c,
      page,
      pageSize,
      todayUsage: usage,
      costToday: cost[0],
      costAll: costAll[0],
      list: list.map((r) => ({
        ...r,
        title: parseJson(r.profile_json, {}).title || '',
        profile_json: undefined
      }))
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

module.exports = router;
