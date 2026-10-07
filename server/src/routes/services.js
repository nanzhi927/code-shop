const express = require('express');
const pool = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { logger } = require('../lib/logger');
const { notify } = require('../lib/notify');

const router = express.Router();

async function adminLog(req, action, target, detail) {
  try {
    await pool.query(
      'INSERT INTO admin_logs (admin_id, admin_name, action, target, detail, ip) VALUES (?,?,?,?,?,?)',
      [req.user.id, req.user.username, action, String(target || '').slice(0, 255), String(detail || '').slice(0, 2000), req.ip || '']
    );
  } catch { /* 日志失败不影响主流程 */ }
}

async function loadCustomTemplates() {
  const [rows] = await pool.query("SELECT v FROM settings WHERE k='custom_templates'");
  if (!rows.length || !rows[0].v) return [];
  try {
    const arr = JSON.parse(rows[0].v);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function saveCustomTemplates(list) {
  const v = JSON.stringify(list.slice(0, 50));
  await pool.query(
    "INSERT INTO settings (k, v) VALUES ('custom_templates', ?) ON DUPLICATE KEY UPDATE v=VALUES(v)",
    [v]
  );
}

const PLANS = [
  { id: 'monthly', name: '月卡会员', price: 19, days: 30, discount: 0.9, benefits: ['全站商品 9 折', '每月免费领 2 套', '专属客服优先'] },
  { id: 'quarterly', name: '季卡会员', price: 49, days: 90, discount: 0.9, benefits: ['全站商品 9 折', '每月免费领 2 套', '专属客服优先', '选题趋势报告'] },
  { id: 'yearly', name: '年卡会员', price: 149, days: 365, discount: 0.85, benefits: ['全站商品 8.5 折', '每月免费领 5 套', '专属客服优先', '选题趋势报告', '优先接定制单'] }
];

function genNo(prefix) {
  const d = new Date();
  const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
  return prefix + ts + Math.floor(Math.random()*9000+1000);
}

/* ============ 定制工单（用户） ============ */
router.post('/custom', authRequired, async (req, res) => {
  try {
    const { title, description, tech, budget, deadline } = req.body;
    if (!title) return res.status(400).json({ message: '请填写需求标题' });
    const orderNo = genNo('C');
    const [r] = await pool.query(
      'INSERT INTO custom_orders (order_no, user_id, title, description, tech, budget, deadline) VALUES (?,?,?,?,?,?,?)',
      [orderNo, req.user.id, String(title).slice(0,255), String(description||'').slice(0,2000), tech||'', Number(budget)||0, deadline||'']
    );
    if (description) {
      await pool.query('INSERT INTO custom_messages (order_id, user_id, from_role, content) VALUES (?,?,?,?)',
        [r.insertId, req.user.id, 'user', String(description).slice(0,2000)]);
    }
    res.json({ id: r.insertId, orderNo });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.get('/custom/mine', authRequired, async (req, res) => {
  try {
    const [list] = await pool.query(
      'SELECT id, order_no, title, tech, budget, deadline, quote_price, status, created_at, updated_at FROM custom_orders WHERE user_id=? ORDER BY id DESC',
      [req.user.id]
    );
    res.json(list);
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.get('/custom/:id', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM custom_orders WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ message: '工单不存在' });
    const [msgs] = await pool.query('SELECT id, from_role, content, created_at FROM custom_messages WHERE order_id=? ORDER BY id ASC', [req.params.id]);
    res.json({ ...rows[0], messages: msgs });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.post('/custom/:id/message', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id FROM custom_orders WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ message: '工单不存在' });
    const content = String(req.body.content||'').slice(0,2000);
    if (!content) return res.status(400).json({ message: '内容为空' });
    await pool.query('INSERT INTO custom_messages (order_id, user_id, from_role, content) VALUES (?,?,?,?)',
      [req.params.id, req.user.id, 'user', content]);
    res.json({ ok: true });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.post('/custom/:id/accept', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id FROM custom_orders WHERE id=? AND user_id=? AND status='quoted'", [req.params.id, req.user.id]);
    if (!rows.length) return res.status(400).json({ message: '当前状态不可接受报价' });
    await pool.query("UPDATE custom_orders SET status='accepted' WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

/* ============ 会员 ============ */
router.get('/membership/plans', (req, res) => res.json(PLANS));

router.get('/membership/mine', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM user_memberships WHERE user_id=? AND status='active' AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY id DESC LIMIT 1",
      [req.user.id]
    );
    const m = rows[0] || null;
    if (m) { const p = PLANS.find(x=>x.id===m.plan); m.discount = p ? p.discount : 0.9; }
    res.json(m || null);
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.post('/membership/buy', authRequired, async (req, res) => {
  try {
    const plan = PLANS.find(p => p.id === req.body.planId);
    if (!plan) return res.status(400).json({ message: '套餐不存在' });
    // 模拟支付：直接激活
    const expires = new Date(Date.now() + plan.days * 86400000);
    await pool.query("UPDATE user_memberships SET status='expired' WHERE user_id=? AND status='active'", [req.user.id]);
    const [r] = await pool.query(
      'INSERT INTO user_memberships (user_id, plan, expires_at) VALUES (?,?,?)',
      [req.user.id, plan.id, expires]
    );
    res.json({ ok: true, id: r.insertId, plan: plan.name, expiresAt: expires });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

/* ============ 分销返佣 ============ */
router.get('/referral', authRequired, async (req, res) => {
  try {
    // 生成推广码
    const [u] = await pool.query('SELECT ref_code FROM users WHERE id=?', [req.user.id]);
    let code = u[0].ref_code;
    if (!code) {
      code = 'U' + (req.user.id + 10000).toString(36).toUpperCase();
      await pool.query('UPDATE users SET ref_code=? WHERE id=?', [code, req.user.id]);
    }
    const [invited] = await pool.query('SELECT COUNT(*) AS c FROM users WHERE ref_code IS NOT NULL');
    const [comm] = await pool.query(
      'SELECT IFNULL(SUM(amount),0) AS amt, COUNT(*) AS cnt FROM commissions WHERE referrer_id=?',
      [req.user.id]
    );
    const [settled] = await pool.query(
      "SELECT IFNULL(SUM(amount),0) AS amt FROM commissions WHERE referrer_id=? AND status='settled'",
      [req.user.id]
    );
    const link = `${req.protocol}://${req.get('host')}/?ref=${code}`;
    res.json({ code, link, invitedCount: invited[0].c, totalCommission: comm[0].amt, commissionCount: comm[0].cnt, settled: settled[0].amt });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.get('/referral/commissions', authRequired, async (req, res) => {
  try {
    const [list] = await pool.query(
      `SELECT c.id, c.order_id, c.amount, c.status, c.created_at, o.order_no, u.username AS buyer
       FROM commissions c LEFT JOIN orders o ON c.order_id=o.id LEFT JOIN users u ON c.buyer_id=u.id
       WHERE c.referrer_id=? ORDER BY c.id DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(list);
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

/* ============ B 端询价 ============ */
router.post('/enterprise/lead', async (req, res) => {
  try {
    const { org, contact, need, scale } = req.body;
    if (!contact) return res.status(400).json({ message: '请填写联系方式' });
    await pool.query(
      'INSERT INTO enterprise_leads (org, contact, need, scale) VALUES (?,?,?,?)',
      [String(org||'').slice(0,128), String(contact||'').slice(0,128), String(need||'').slice(0,1000), String(scale||'').slice(0,64)]
    );
    res.json({ ok: true });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

/* ============ 后台管理 ============ */
router.get('/admin/custom', adminRequired, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page)||1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize)||20);
    const status = req.query.status;
    const where = status && status!=='全部' ? "WHERE status=?" : '';
    const params = where ? [status] : [];
    const [tr] = await pool.query(`SELECT COUNT(*) AS c FROM custom_orders ${where}`, params);
    const [list] = await pool.query(
      `SELECT co.*, u.username FROM custom_orders co LEFT JOIN users u ON co.user_id=u.id
       ${where} ORDER BY co.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page-1)*pageSize]
    );
    res.json({ list, total: tr[0].c, page, pageSize });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.get('/admin/custom/:id(\\d+)', adminRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT co.*, u.username FROM custom_orders co LEFT JOIN users u ON co.user_id=u.id WHERE co.id=?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: '工单不存在' });
    const [msgs] = await pool.query('SELECT id, from_role, content, created_at FROM custom_messages WHERE order_id=? ORDER BY id ASC', [req.params.id]);
    res.json({ ...rows[0], messages: msgs });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.post('/admin/custom/:id(\\d+)/quote', adminRequired, async (req, res) => {
  try {
    const { quote_price, deadline } = req.body;
    await pool.query("UPDATE custom_orders SET quote_price=?, deadline=?, status='quoted' WHERE id=?",
      [Number(quote_price)||0, deadline||'', req.params.id]);
    const [rows] = await pool.query('SELECT user_id, order_no FROM custom_orders WHERE id=?', [req.params.id]);
    if (rows.length) {
      const { user_id, order_no } = rows[0];
      notify(user_id, 'custom', '定制需求已报价', `您的定制单 ${order_no} 已报价 ¥${quote_price}，请到「我的定制」查看并确认。`);
    }
    res.json({ ok: true });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.post('/admin/custom/:id(\\d+)/message', adminRequired, async (req, res) => {
  try {
    const content = String(req.body.content||'').slice(0,2000);
    if (!content) return res.status(400).json({ message: '内容为空' });
    const [rows] = await pool.query('SELECT user_id FROM custom_orders WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: '工单不存在' });
    await pool.query('INSERT INTO custom_messages (order_id, user_id, from_role, content) VALUES (?,?,?,?)',
      [req.params.id, rows[0].user_id, 'admin', content]);
    res.json({ ok: true });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.post('/admin/custom/:id(\\d+)/status', adminRequired, async (req, res) => {
  try {
    const ok = ['pending_quote','quoted','accepted','in_progress','delivered','completed','cancelled'];
    const st = req.body.status;
    if (!ok.includes(st)) return res.status(400).json({ message: '状态非法' });
    const [rows] = await pool.query('SELECT user_id, order_no FROM custom_orders WHERE id=?', [req.params.id]);
    await pool.query('UPDATE custom_orders SET status=? WHERE id=?', [st, req.params.id]);
    if (rows.length) {
      const { user_id, order_no } = rows[0];
      if (st === 'delivered') {
        notify(user_id, 'custom', '定制需求已交付', `您的定制单 ${order_no} 已交付，请验收。`);
      } else if (st === 'completed') {
        notify(user_id, 'custom', '定制需求已完成', `您的定制单 ${order_no} 已完成。`);
      } else if (st === 'cancelled') {
        notify(user_id, 'custom', '定制需求已取消', `您的定制单 ${order_no} 已取消。`);
      }
    }
    res.json({ ok: true });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.get('/admin/custom/templates', adminRequired, async (req, res) => {
  try {
    const list = await loadCustomTemplates();
    res.json({ list });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.post('/admin/custom/templates', adminRequired, async (req, res) => {
  try {
    const { name, tech, price, deadline, note } = req.body;
    if (!name) return res.status(400).json({ message: '模板名称必填' });
    const list = await loadCustomTemplates();
    list.push({
      name: String(name).slice(0, 64),
      tech: String(tech || '').slice(0, 64),
      price: Number(price) || 0,
      deadline: String(deadline || '').slice(0, 32),
      note: String(note || '').slice(0, 500)
    });
    await saveCustomTemplates(list);
    res.json({ ok: true });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.delete('/admin/custom/templates', adminRequired, async (req, res) => {
  try {
    const index = parseInt(req.query.index, 10);
    const list = await loadCustomTemplates();
    if (index < 0 || index >= list.length) return res.status(400).json({ message: '索引无效' });
    list.splice(index, 1);
    await saveCustomTemplates(list);
    res.json({ ok: true });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.post('/admin/custom/from-keyword', adminRequired, async (req, res) => {
  try {
    const keyword = String(req.body.keyword || '').trim();
    if (!keyword) return res.status(400).json({ message: '关键词不能为空' });
    const orderNo = 'CU' + Date.now();
    const [r] = await pool.query(
      'INSERT INTO custom_orders (order_no, user_id, title, description, status) VALUES (?,?,?,?,?)',
      [orderNo, req.user.id, `定制需求：${keyword}`, `由无结果搜索词「${keyword}」自动生成，等待报价。`, 'pending_quote']
    );
    await adminLog(req, 'custom.from-keyword', keyword, `id=${r.insertId} order_no=${orderNo}`);
    res.json({ ok: true, id: r.insertId });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.get('/admin/memberships', adminRequired, async (req, res) => {
  try {
    const [list] = await pool.query(
      `SELECT m.*, u.username FROM user_memberships m LEFT JOIN users u ON m.user_id=u.id ORDER BY m.id DESC LIMIT 100`
    );
    res.json(list);
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.get('/admin/referrals', adminRequired, async (req, res) => {
  try {
    const [list] = await pool.query(
      `SELECT u.id, u.username, u.ref_code,
        (SELECT COUNT(*) FROM commissions c WHERE c.referrer_id=u.id) AS comm_cnt,
        (SELECT IFNULL(SUM(amount),0) FROM commissions c WHERE c.referrer_id=u.id) AS comm_amt
       FROM users u WHERE u.ref_code<>'' ORDER BY comm_amt DESC LIMIT 50`
    );
    const [total] = await pool.query("SELECT IFNULL(SUM(amount),0) AS amt FROM commissions WHERE status='settled'");
    res.json({ list, totalSettled: total[0].amt });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.get('/admin/enterprise/leads', adminRequired, async (req, res) => {
  try {
    const [list] = await pool.query('SELECT * FROM enterprise_leads ORDER BY id DESC LIMIT 100');
    res.json(list);
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.post('/admin/enterprise/leads/:id', adminRequired, async (req, res) => {
  try {
    await pool.query('UPDATE enterprise_leads SET status=? WHERE id=?', [String(req.body.status||'new').slice(0,16), req.params.id]);
    res.json({ ok: true });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

/* ============ 数据洞察 ============ */
router.get('/admin/insight', adminRequired, async (req, res) => {
  try {
    const [catRows] = await pool.query("SELECT COALESCE(NULLIF(category,''),'未分类') AS name, COUNT(*) AS cnt, IFNULL(SUM(sales),0) AS sales FROM products WHERE is_deleted=0 GROUP BY name ORDER BY cnt DESC LIMIT 12");
    const [techRows] = await pool.query("SELECT tech AS name, COUNT(*) AS cnt FROM products WHERE is_deleted=0 GROUP BY tech ORDER BY cnt DESC");
    const [topKw] = await pool.query("SELECT keyword, COUNT(*) AS cnt FROM search_logs GROUP BY keyword ORDER BY cnt DESC LIMIT 12");
    const [noKw] = await pool.query("SELECT keyword, COUNT(*) AS cnt FROM search_logs WHERE result_count=0 GROUP BY keyword ORDER BY cnt DESC LIMIT 12");
    const [recent] = await pool.query("SELECT keyword, result_count, created_at FROM search_logs ORDER BY id DESC LIMIT 20");
    res.json({ categoryDist: catRows, techDist: techRows, topKeywords: topKw, noResultKeywords: noKw, recentSearches: recent });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

/* ============ 服务页卡片配置 ============ */
const DEFAULT_SERVICE_CARDS = [
  {
    id: 'c0',
    icon: '01',
    title: '免费开题助手',
    desc: '只填题目、点选确认，生成开题报告初稿；注册赠送次数',
    bg: 'linear-gradient(135deg,#0d9488,#115e59)',
    to: '/services/p/proposal',
    enabled: true,
    sort: 0
  },
  {
    id: 'c1',
    icon: '02',
    title: '定制开发 / 二次开发',
    desc: '改功能、改界面或从零搭建；提需求→报价→验收，平台担保',
    bg: 'linear-gradient(135deg,#0a0a0b,#27272a)',
    to: '/services/p/custom',
    enabled: true,
    sort: 1
  },
  {
    id: 'c2',
    icon: '03',
    title: '代跑 / 部署 / 环境搭建',
    desc: '源码跑不起来、要本地或服务器部署，按次协助',
    bg: 'linear-gradient(135deg,#0d9488,#0f766e)',
    to: '/services/p/deploy',
    enabled: true,
    sort: 2
  },
  {
    id: 'c7',
    icon: '04',
    title: '答辩 PPT / 讲解视频',
    desc: '源码加购：演示向 PPT 与录屏，辅助你自己答辩讲解',
    bg: 'linear-gradient(135deg,#27272a,#3f3f46)',
    to: '/services/p/defense',
    enabled: true,
    sort: 3
  }
];

const REMOVED_SERVICE_PATHS = [
  '/services/membership',
  '/services/referral',
  '/services/p/enterprise',
  '/services/enterprise',
  '/services/p/report',
  '/services/p/course'
];
const REMOVED_SERVICE_TITLES = [
  '会员订阅',
  '分销返佣',
  'B 端 / 机构批量采购',
  '机构批量采购',
  '选题趋势数据报告',
  '选题趋势',
  '付费课程 / 技术栈专栏',
  '付费课程'
];

function isRemovedServiceCard(c) {
  const to = String(c?.to || '');
  const title = String(c?.title || '');
  const id = String(c?.id || '');
  if (['c5', 'c6', 'c8'].includes(id)) return true;
  return REMOVED_SERVICE_PATHS.some((p) => to.includes(p))
    || REMOVED_SERVICE_TITLES.some((t) => title.includes(t));
}

const DEFAULT_SERVICE_PAGES = {
  proposal: {
    slug: 'proposal',
    title: '免费开题助手',
    subtitle: '问答收集选题与模块，AI 生成开题报告初稿，仅供学习参考',
    badge: '注册赠送 · 手机号登录',
    highlights: ['结构化问答或上传 docx 模板', '流式生成开题报告初稿', '导出 Word / 推荐站内源码'],
    body: '还没想清楚开题怎么写？用免费开题助手：手机号注册即赠送免费生成次数。填写题目、技术栈与功能模块，也可上传学校 docx/pdf 模板解析章节；确认大纲后由 AI 流式生成开题报告初稿，支持复制与导出 Word。\n\n内容仅供学习参考，请按学校模板修订，并自行核对参考文献。生成后可浏览相关源码，或转定制开发。',
    ctaText: '开始免费开题',
    ctaTo: '/services/proposal',
    contactTip: '需要按学校模板排版或二次开发，可联系客服。'
  },
  custom: {
    slug: 'custom',
    title: '定制开发 / 二次开发',
    subtitle: '基于现有源码或从零需求，1 个工作日内给出报价与工期，平台全程担保交付',
    badge: '平台担保 · 按阶段验收',
    highlights: ['需求澄清与技术方案', '按阶段报价与验收', '源码交付与部署协助'],
    body: '适合现有源码二次开发、功能增改、界面定制，以及按选题从零搭建的场景。提交需求后我们会在 1 个工作日内给出报价与工期评估，确认后再开工，进度与留言全程可追踪。',
    ctaText: '提交定制需求',
    ctaTo: '/services/custom',
    contactTip: '也可先添加客服微信沟通需求细节，再正式提交工单。',
    services: [
      { icon: '🧩', title: '功能增改', desc: '在现有源码上加模块、改逻辑、补接口，按改动量评估工期。' },
      { icon: '🎨', title: '界面定制', desc: '页面改版、移动端适配、主题配色与交互优化，答辩演示更顺眼。' },
      { icon: '🏗️', title: '从零定制', desc: '按选题与技术栈从零搭建：权限、业务模块、数据库与基础文档。' },
      { icon: '🐛', title: '改 Bug / 代跑', desc: '跑不起来、报错、环境问题；也可搭配代部署与初始化协助。' }
    ],
    steps: [
      { title: '提交需求', desc: '标题、技术栈、预算与功能说明' },
      { title: '评估报价', desc: '1 个工作日内回复报价与工期' },
      { title: '确认开工', desc: '接受报价后进入开发排期' },
      { title: '开发沟通', desc: '进度可查，留言补充细节' },
      { title: '交付验收', desc: '源码交付，确认后完结' }
    ],
    pricing: [
      { name: '小改 / 修 Bug', range: '¥99 – 399', note: '单点修复、样式微调、环境跑通，约 1–3 天' },
      { name: '模块增改', range: '¥399 – 1299', note: '新增业务模块、权限角色、报表导出等，约 3–7 天' },
      { name: '整站定制', range: '¥1299 起', note: '按需求从零或大幅改造，工期与报价单独评估' }
    ],
    faqs: [
      { q: '多久能给报价？', a: '工作日提交后，一般 1 个工作日内给出报价与工期；复杂需求可能先追问澄清。' },
      { q: '可以只要部分功能吗？', a: '可以。建议先写清「必须有 / 可以没有」的模块清单，便于精确评估。' },
      { q: '交付物包含什么？', a: '约定范围内的源码与必要说明；如需部署、答辩 PPT 或讲解视频，可一并备注。' },
      { q: '中途能否改需求？', a: '小调整可协商；范围明显扩大时会重新评估报价与工期，确认后再继续。' },
      { q: '支持哪些技术栈？', a: '以 SpringBoot / Vue / 小程序等站内常见栈为主；其它栈请先咨询客服确认档期。' }
    ]
  },
  modify: {
    slug: 'modify',
    title: '源码二次修改',
    subtitle: '你已有完整源码，我们按你的清单改题目、界面、模块与字段，改完交付可运行工程',
    badge: '拿现成源码改 · 按改动量报价',
    highlights: ['改题名 / 项目名 / 包名', '界面配色与布局调整', '加简单模块、改库表字段', '交付修改说明与数据库脚本'],
    body: '本页面向「手里已有一套完整可运行源码，只需要二次修改」的场景，与「从零定制」不同：我们不重写整站，而是在你提供的工程上按清单改动。\n\n常见改动包括：更换毕设题目与系统名称、调整页面配色与布局、增加简单业务模块、修改数据库字段与相关接口、替换部分技术栈组件（例如换图表库、换上传组件）等。\n\n交付物：修改后的完整源码 + 必要的数据库脚本 + 修改说明（改了哪些文件/表、如何启动）。流程：提需求清单 → 评估报价与工期 → 确认后修改 → 你本地验收。\n\n适用：源码能跑通、需求边界清晰、改动量可评估。不适用：源码残缺跑不起来且需大范围重构、需求反复推翻、需要从零设计业务与架构（这类请走「定制开发」）。',
    ctaText: '提交二次修改需求',
    ctaTo: '/services/custom',
    contactTip: '提交前请准备好：现有源码压缩包或网盘链接、必须改 / 可不改的清单、期望完成时间。',
    services: [
      { icon: '✏️', title: '改题目 / 改名称', desc: '系统标题、登录页文案、包名/模块名、数据库库名等标识性信息统一替换。' },
      { icon: '🎨', title: '界面配色与布局', desc: '主题色、导航结构、首页板块、表格/表单样式微调，让演示更贴合你的题目。' },
      { icon: '🧩', title: '加简单模块', desc: '在现有权限与菜单体系下增加列表/表单类模块，含基础增删改查。' },
      { icon: '🗄️', title: '改库表字段', desc: '增删字段、调整校验与前后端映射，并提供对应 SQL 脚本。' }
    ],
    steps: [
      { title: '提交需求', desc: '附上源码与修改清单（必须改 / 可不改）' },
      { title: '评估报价', desc: '按改动量给出报价与工期' },
      { title: '确认修改', desc: '接受报价后排期动手' },
      { title: '交付验收', desc: '交完整源码、脚本与修改说明，你本地跑通确认' }
    ],
    pricing: [
      { name: '文案 / 标识替换', range: '¥99 – 299', note: '题目、名称、Logo、基础文案，约 1–2 天' },
      { name: '界面 + 小模块', range: '¥299 – 799', note: '配色布局 + 1～2 个简单模块，约 2–5 天' },
      { name: '多模块 / 字段改造', range: '¥799 起', note: '多表字段联动或较大界面改版，单独评估' }
    ],
    faqs: [
      { q: '和「定制开发」有什么区别？', a: '二次修改基于你已有的完整源码按清单改；定制开发可以是从零搭建或大幅改造。没有可运行底稿时，更适合走定制。' },
      { q: '需要提供什么材料？', a: '可运行的源码包（或网盘）、启动方式说明、修改清单，以及目标技术栈/数据库版本。' },
      { q: '交付物有哪些？', a: '修改后的完整源码、数据库变更脚本、修改说明；如需协助本地启动，可在需求里备注。' },
      { q: '能否只改前端不改后端？', a: '可以。请在清单里写清范围，便于精确报价，避免漏改接口字段。' },
      { q: '源码本身跑不起来怎么办？', a: '需先排查环境或修复启动问题，可能单独计费；若工程残缺需大范围重写，建议转定制开发评估。' }
    ]
  },
  deploy: {
    slug: 'deploy',
    title: '代跑 / 部署 / 环境搭建',
    subtitle: '帮你把项目在本地或服务器跑起来，按次收费、边界清晰',
    badge: '按次服务 · 先说清范围',
    highlights: ['本地环境跑通', '数据库导入与账号初始化', '可选：服务器部署与域名'],
    body: '买了源码却卡在环境、依赖或数据库？按次协助常见栈（SpringBoot / Vue / 小程序等）把主流程跑通。\n\n下单前请说明：技术栈、操作系统、只要本地跑通还是需要公网部署。复杂二次开发请走「定制开发」。',
    ctaText: '联系客服下单',
    ctaTo: '/contact',
    contactTip: '下单前请说明技术栈、操作系统与是否需要公网部署。'
  },
  enterprise: {
    slug: 'enterprise',
    title: 'B 端 / 机构批量采购',
    subtitle: '学校、培训机构、辅导班打包授权，可开发票',
    badge: '模拟页 · 可后台编辑',
    highlights: ['批量授权与折扣', '合同与发票支持', '专属对接人'],
    body: '面向高校机房、培训机构、辅导班的批量采购场景，支持打包授权、课程配套与定制交付。\n\n提交询价后我们将在 1 个工作日内联系您确认清单与报价。',
    ctaText: '提交机构询价',
    ctaTo: '/services/enterprise',
    contactTip: '请准备好机构名称、采购规模与大致预算。'
  },
  report: {
    slug: 'report',
    title: '选题趋势数据报告',
    subtitle: '今年最火毕设选题 / 技术栈洞察，适合机构采购',
    badge: '模拟页 · 可后台编辑',
    highlights: ['热门选题 Top 榜', '技术栈占比分析', '可定制机构版报告'],
    body: '基于站内检索与成交数据整理的选题趋势报告，帮助机构把握当年热门方向与技术栈分布。\n\n当前为模拟展示，正式报告支持 PDF 交付与定制分析维度，请通过客服咨询采购。',
    ctaText: '咨询报告采购',
    ctaTo: '/contact',
    contactTip: '可说明需要的年份、学科范围与交付格式。'
  },
  defense: {
    slug: 'defense',
    title: '答辩 PPT / 讲解视频',
    subtitle: '源码加购：做成演示向 PPT 与录屏，方便你自己讲解',
    badge: '加购项 · 辅助演示',
    highlights: ['答辩 PPT 结构与页序', '功能演示录屏剪辑', '讲解要点提示（需你本人陈述）'],
    body: '适合已购站内源码、需要答辩演示材料的同学。我们按你的项目整理 PPT 页序与录屏，突出主流程与关键截图，便于你自己上场讲解。\n\n不代写论文、不代替答辩。具体套餐与报价请联系客服，并说明项目名称、答辩时长与是否需要出镜画面。',
    ctaText: '咨询加购制作',
    ctaTo: '/contact',
    contactTip: '请提供项目名称、答辩时长与是否需要出镜讲解。'
  },
  course: {
    slug: 'course',
    title: '付费课程 / 技术栈专栏',
    subtitle: '讲解视频系列化成课程，按技术栈系统学习',
    badge: '模拟页 · 可后台编辑',
    highlights: ['按技术栈分专栏', '配套源码实操', '持续更新章节'],
    body: '将源码讲解做成系列课程，从环境搭建到核心模块实现，适合自学与机构内训。\n\n课程体系仍在筹备中（模拟页），上线前可通过客服预约通知或浏览现有源码商品。',
    ctaText: '先逛源码商城',
    ctaTo: '/products',
    contactTip: '想预约某技术栈课程，可留言给客服。'
  }
};

const PAGE_SLUGS = Object.keys(DEFAULT_SERVICE_PAGES);

function normalizeCard(c, i = 0) {
  return {
    id: String(c.id || `c${i + 1}`),
    icon: String(c.icon || '📦').slice(0, 8),
    title: String(c.title || '').slice(0, 64),
    desc: String(c.desc || '').slice(0, 200),
    bg: String(c.bg || 'linear-gradient(135deg,#0a0a0b,#27272a)').slice(0, 120),
    to: String(c.to || '/services').slice(0, 120),
    enabled: c.enabled !== false && c.enabled !== 0 && c.enabled !== '0',
    sort: Number.isFinite(Number(c.sort)) ? Number(c.sort) : i
  };
}

function pickRichList(rawList, defList, mapFn, max) {
  const src = Array.isArray(rawList) && rawList.length ? rawList : (defList || []);
  return src.map(mapFn).filter(Boolean).slice(0, max);
}

function normalizePage(slug, raw = {}) {
  const def = DEFAULT_SERVICE_PAGES[slug] || { slug, title: slug, subtitle: '', badge: '', highlights: [], body: '', ctaText: '了解更多', ctaTo: '/services', contactTip: '' };
  const highlights = Array.isArray(raw.highlights)
    ? raw.highlights.map((h) => String(h || '').slice(0, 80)).filter(Boolean).slice(0, 8)
    : (def.highlights || []);
  const page = {
    slug,
    title: String(raw.title ?? def.title ?? '').slice(0, 80),
    subtitle: String(raw.subtitle ?? def.subtitle ?? '').slice(0, 160),
    badge: String(raw.badge ?? def.badge ?? '').slice(0, 40),
    highlights,
    body: String(raw.body ?? def.body ?? '').slice(0, 8000),
    ctaText: String(raw.ctaText ?? def.ctaText ?? '了解更多').slice(0, 40),
    ctaTo: String(raw.ctaTo ?? def.ctaTo ?? '/services').slice(0, 120),
    contactTip: String(raw.contactTip ?? def.contactTip ?? '').slice(0, 200)
  };
  if (def.services || raw.services) {
    page.services = pickRichList(raw.services, def.services, (s) => {
      if (!s || !String(s.title || '').trim()) return null;
      return {
        icon: String(s.icon || '📦').slice(0, 8),
        title: String(s.title || '').slice(0, 40),
        desc: String(s.desc || '').slice(0, 160)
      };
    }, 8);
  }
  if (def.steps || raw.steps) {
    page.steps = pickRichList(raw.steps, def.steps, (s) => {
      if (!s || !String(s.title || '').trim()) return null;
      return {
        title: String(s.title || '').slice(0, 40),
        desc: String(s.desc || '').slice(0, 80)
      };
    }, 8);
  }
  if (def.pricing || raw.pricing) {
    page.pricing = pickRichList(raw.pricing, def.pricing, (s) => {
      if (!s || !String(s.name || '').trim()) return null;
      return {
        name: String(s.name || '').slice(0, 40),
        range: String(s.range || '').slice(0, 40),
        note: String(s.note || '').slice(0, 120)
      };
    }, 8);
  }
  if (def.faqs || raw.faqs) {
    page.faqs = pickRichList(raw.faqs, def.faqs, (s) => {
      if (!s || !String(s.q || '').trim()) return null;
      return {
        q: String(s.q || '').slice(0, 80),
        a: String(s.a || '').slice(0, 400)
      };
    }, 12);
  }
  return page;
}

const TITLE_TO_PAGE = {
  '免费开题助手': '/services/p/proposal',
  '定制开发 / 二次开发': '/services/p/custom',
  '代跑 / 部署 / 环境搭建': '/services/p/deploy',
  '答辩 PPT / 讲解视频': '/services/p/defense'
};

function migrateCardLink(c) {
  const mapped = TITLE_TO_PAGE[c.title];
  if (!mapped) return c;
  const to = String(c.to || '');
  if (to.includes('/services/p/')) return c;
  if (isRemovedServiceCard(c)) return c;
  return { ...c, to: mapped };
}

function applyDefaultPriority(cards) {
  const byKey = new Map();
  for (const d of DEFAULT_SERVICE_CARDS) {
    byKey.set(d.id, d);
    byKey.set(d.to, d);
  }
  const used = new Set();
  const prioritized = [];
  for (const d of DEFAULT_SERVICE_CARDS) {
    const hit = cards.find((c) => c.id === d.id || c.to === d.to || c.title === d.title);
    if (hit) {
      prioritized.push(normalizeCard({
        ...hit,
        title: hit.title || d.title,
        desc: hit.desc || d.desc,
        to: d.to,
        sort: d.sort,
        enabled: hit.enabled !== false,
        icon: hit.icon && !/\p{Extended_Pictographic}/u.test(hit.icon) ? hit.icon : d.icon
      }, d.sort));
      used.add(hit.id);
    } else {
      prioritized.push(normalizeCard(d, d.sort));
    }
  }
  // 保留其它未下架的自定义卡片，排在后面
  for (const c of cards) {
    if (used.has(c.id)) continue;
    if (isRemovedServiceCard(c)) continue;
    if (prioritized.some((p) => p.id === c.id || p.to === c.to)) continue;
    prioritized.push(normalizeCard({ ...c, sort: 100 + prioritized.length }, prioritized.length));
  }
  return prioritized;
}

async function loadServiceCards() {
  const [rows] = await pool.query("SELECT v FROM settings WHERE k='service_cards'");
  if (!rows.length || !rows[0].v) return DEFAULT_SERVICE_CARDS.map((c, i) => normalizeCard(c, i));
  try {
    const arr = JSON.parse(rows[0].v);
    if (!Array.isArray(arr) || !arr.length) return DEFAULT_SERVICE_CARDS.map((c, i) => normalizeCard(c, i));
    const rawLen = arr.length;
    const cleaned = arr
      .map((c, i) => normalizeCard(c, i))
      .filter((c) => !isRemovedServiceCard(c))
      .map(migrateCardLink);
    const next = applyDefaultPriority(cleaned);
    // 旧货架含已下架卡片时，写回精简后的列表
    if (rawLen !== next.length || cleaned.length !== next.length) {
      try { await saveServiceCards(next); } catch { /* ignore persist race */ }
    }
    return next;
  } catch {
    return DEFAULT_SERVICE_CARDS.map((c, i) => normalizeCard(c, i));
  }
}

async function loadServicePages() {
  const [rows] = await pool.query("SELECT v FROM settings WHERE k='service_pages'");
  let stored = {};
  if (rows.length && rows[0].v) {
    try {
      const obj = JSON.parse(rows[0].v);
      if (obj && typeof obj === 'object') stored = obj;
    } catch { /* use defaults */ }
  }
  const out = {};
  for (const slug of PAGE_SLUGS) {
    const raw = stored[slug] || {};
    out[slug] = normalizePage(slug, raw);
    // 旧版「模拟页」未含富区块时，自动换成新默认介绍文案
    if (slug === 'custom' && !Array.isArray(raw.services)) {
      const d = DEFAULT_SERVICE_PAGES.custom;
      const badge = String(raw.badge || '');
      const body = String(raw.body || '');
      const sub = String(raw.subtitle || '');
      if (!badge || badge.includes('模拟')) out[slug].badge = d.badge;
      if (!sub || sub.includes('提需求 → 报价') || sub.includes('提需求→报价')) out[slug].subtitle = d.subtitle;
      if (!body || body.includes('模拟展示')) out[slug].body = d.body;
    }
    if ((slug === 'deploy' || slug === 'defense') && String(raw.badge || '').includes('模拟')) {
      const d = DEFAULT_SERVICE_PAGES[slug];
      out[slug].badge = d.badge;
      out[slug].subtitle = d.subtitle;
      out[slug].body = d.body;
      out[slug].highlights = d.highlights;
      out[slug].ctaText = d.ctaText;
    }
  }
  return out;
}

async function saveServicePages(pages) {
  const next = {};
  for (const slug of PAGE_SLUGS) {
    next[slug] = normalizePage(slug, (pages && pages[slug]) || {});
  }
  await pool.query(
    "INSERT INTO settings (k, v) VALUES ('service_pages', ?) ON DUPLICATE KEY UPDATE v=VALUES(v)",
    [JSON.stringify(next)]
  );
  return next;
}

async function saveServiceCards(list) {
  const normalized = (Array.isArray(list) ? list : []).slice(0, 30).map((c, i) => normalizeCard(c, i));
  await pool.query(
    "INSERT INTO settings (k, v) VALUES ('service_cards', ?) ON DUPLICATE KEY UPDATE v=VALUES(v)",
    [JSON.stringify(normalized)]
  );
  return normalized;
}

// 前台：启用中的服务卡片
router.get('/cards', async (req, res) => {
  try {
    const cards = await loadServiceCards();
    res.json({ list: cards.filter((c) => c.enabled).sort((a, b) => a.sort - b.sort) });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 后台：全部服务卡片
router.get('/admin/cards', adminRequired, async (req, res) => {
  try {
    const cards = await loadServiceCards();
    res.json({ list: cards.sort((a, b) => a.sort - b.sort) });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 后台：整表保存服务卡片
router.put('/admin/cards', adminRequired, async (req, res) => {
  try {
    const list = req.body?.list;
    if (!Array.isArray(list)) return res.status(400).json({ message: '请提交卡片列表' });
    const filtered = list.filter((c) => !isRemovedServiceCard(c));
    const saved = await saveServiceCards(filtered);
    await adminLog(req, 'service_cards.update', 'service_cards', `count=${saved.length}`);
    res.json({ ok: true, list: saved });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 前台：服务模拟页内容
router.get('/pages/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '');
    if (!PAGE_SLUGS.includes(slug)) return res.status(404).json({ message: '页面不存在' });
    const pages = await loadServicePages();
    res.json(pages[slug]);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 后台：全部服务页
router.get('/admin/pages', adminRequired, async (req, res) => {
  try {
    const pages = await loadServicePages();
    res.json({ list: PAGE_SLUGS.map((s) => pages[s]), slugs: PAGE_SLUGS });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 后台：保存全部服务页
router.put('/admin/pages', adminRequired, async (req, res) => {
  try {
    const body = req.body || {};
    let map = {};
    if (Array.isArray(body.list)) {
      for (const p of body.list) {
        if (p && PAGE_SLUGS.includes(p.slug)) map[p.slug] = p;
      }
    } else if (body.pages && typeof body.pages === 'object') {
      map = body.pages;
    } else {
      return res.status(400).json({ message: '请提交页面内容' });
    }
    const saved = await saveServicePages(map);
    await adminLog(req, 'service_pages.update', 'service_pages', `slugs=${PAGE_SLUGS.join(',')}`);
    res.json({ ok: true, list: PAGE_SLUGS.map((s) => saved[s]) });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

module.exports = router;
