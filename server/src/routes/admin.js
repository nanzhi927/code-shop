const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { adminRequired, superadminRequired, ADMIN_ROLES } = require('../middleware/auth');
const { logger } = require('../lib/logger');
const { notify } = require('../lib/notify');

const router = express.Router();
router.use(adminRequired);

// 管理员操作日志
async function adminLog(req, action, target, detail) {
  try {
    await pool.query(
      'INSERT INTO admin_logs (admin_id, admin_name, action, target, detail, ip) VALUES (?,?,?,?,?,?)',
      [req.user.id, req.user.username, action, String(target || '').slice(0, 255), String(detail || '').slice(0, 2000), req.ip || '']
    );
  } catch { /* 日志失败不影响主流程 */ }
}

// 封面图上传（multer）
const COVER_DIR = path.resolve(__dirname, '../../uploads/covers');
if (!fs.existsSync(COVER_DIR)) fs.mkdirSync(COVER_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, COVER_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.png').toLowerCase();
      cb(null, `cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  }
});

router.post('/upload/cover', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请选择图片文件' });
  res.json({ url: '/uploads/covers/' + req.file.filename });
});

// 介绍视频上传（mp4 / webm，最大 200MB）
const VIDEO_DIR = path.resolve(__dirname, '../../uploads/videos');
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, VIDEO_DIR),
    filename: (_req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.mp4').toLowerCase();
      cb(null, `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /video\/(mp4|webm|quicktime|x-msvideo|ogg)$/i.test(file.mimetype)
      || /\.(mp4|webm|mov|avi)$/i.test(file.originalname || '');
    cb(ok ? null : new Error('仅支持 mp4 / webm / mov 视频'), ok);
  }
});

router.post('/upload/video', (req, res) => {
  uploadVideo.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || '上传失败' });
    if (!req.file) return res.status(400).json({ message: '请选择视频文件' });
    res.json({ url: '/uploads/videos/' + req.file.filename });
  });
});

// 收款码上传
const QR_DIR = path.resolve(__dirname, '../../uploads/qr');
if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });
const uploadQr = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, QR_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.png').toLowerCase();
      cb(null, `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  }
});

router.post('/upload/qr', uploadQr.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请选择图片文件' });
  const url = '/uploads/qr/' + req.file.filename;
  await adminLog(req, 'upload.qr', req.file.filename, url);
  res.json({ url });
});

// 真实成交：排除 mock 模拟支付与未选择支付方式的测试单
const REAL_PAY = "pay_method IN ('alipay','wechat','card')";
const REAL_PAID = `status IN ('paid','shipped','completed') AND ${REAL_PAY}`;

// ---------- 统计 ----------
router.get('/stats', async (req, res) => {
  try {
    const [p] = await pool.query('SELECT COUNT(*) AS c, SUM(status=1 AND is_deleted=0) AS on_sale FROM products WHERE is_deleted=0');
    const [o] = await pool.query(
      `SELECT COUNT(*) AS c,
              SUM(status='paid' AND ${REAL_PAY}) AS paid,
              SUM(status='shipped' AND ${REAL_PAY}) AS shipped,
              SUM(status='completed' AND ${REAL_PAY}) AS done
       FROM orders`
    );
    const [u] = await pool.query("SELECT COUNT(*) AS c FROM users WHERE role='user'");
    const [sales] = await pool.query(
      `SELECT IFNULL(SUM(total_amount),0) AS amt FROM orders WHERE ${REAL_PAID}`
    );
    const [[visits7]] = await pool.query(
      'SELECT COUNT(*) AS c FROM visit_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    res.json({
      products: p[0].c,
      onSale: p[0].on_sale,
      orders: o[0].c,
      paidOrders: o[0].paid || 0,
      shippedOrders: o[0].shipped || 0,
      completedOrders: o[0].done || 0,
      users: u[0].c,
      sales: sales[0].amt,
      visits7d: Number(visits7.c) || 0
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// ---------- 商品管理 ----------
router.get('/products', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
    const { keyword, tech, status } = req.query;
    const where = ['is_deleted=0'];
    const params = [];
    if (keyword) {
      where.push('(title LIKE ? OR product_no LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (tech && tech !== '全部') {
      where.push('tech=?');
      params.push(tech);
    }
    if (status === '0' || status === '1') {
      where.push('status=?');
      params.push(parseInt(status));
    }
    const whereSql = 'WHERE ' + where.join(' AND ');
    const [totalRows] = await pool.query(`SELECT COUNT(*) AS c FROM products ${whereSql}`, params);
    const [list] = await pool.query(
      `SELECT id, product_no, title, tech, type, category, size_mb, has_paper, has_ppt, has_video, has_db,
              price, original_price, status, cover, description, source_path, created_at,
              run_status, qa_note, run_env, verified_at,
              demo_url, video_url, sort_weight, sales, views, keywords,
              pan_link, pan_code, meta_title, meta_keywords, meta_description
       FROM products ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    res.json({ list, total: totalRows[0].c, page, pageSize });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 新建商品
router.post('/products', async (req, res) => {
  try {
    const { product_no, title, tech, type, category, size_mb, has_paper, has_ppt, has_video, has_db,
            price, original_price, status, cover, description, source_path, kind, qa_note, run_status,
            demo_url, video_url, sort_weight, keywords,
            pan_link, pan_code, meta_title, meta_keywords, meta_description } = req.body;
    if (!title) return res.status(400).json({ message: '标题必填' });
    const [r] = await pool.query(
      `INSERT INTO products (product_no, title, tech, type, category, size_mb, has_paper, has_ppt, has_video, has_db,
         price, original_price, status, cover, description, source_path, keywords, kind, qa_note, run_status,
         demo_url, video_url, sort_weight, pan_link, pan_code, meta_title, meta_keywords, meta_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [product_no || '', title, tech || '', type || 'folder', category || '', size_mb || 0,
       has_paper ? 1 : 0, has_ppt ? 1 : 0, has_video ? 1 : 0, has_db ? 1 : 0,
       price || 99, original_price || price || 99, status === 0 ? 0 : 1, cover || '',
       description || '', source_path || '', keywords || title, kind || 'code', qa_note || '', run_status || 0,
       demo_url || '', video_url || '', sort_weight || 0,
       pan_link || '', pan_code || '', meta_title || '', meta_keywords || '', meta_description || '']
    );
    await adminLog(req, 'product.create', title, `id=${r.insertId}`);
    res.json({ id: r.insertId });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 更新商品
router.put('/products/:id', async (req, res) => {
  try {
    const { product_no, title, tech, type, category, size_mb, has_paper, has_ppt, has_video, has_db,
            price, original_price, status, cover, description, source_path, kind, qa_note, run_status,
            demo_url, video_url, sort_weight, keywords,
            pan_link, pan_code, meta_title, meta_keywords, meta_description } = req.body;
    if (!title) return res.status(400).json({ message: '标题必填' });
    await pool.query(
      `UPDATE products SET product_no=?, title=?, tech=?, type=?, category=?, size_mb=?, has_paper=?, has_ppt=?, has_video=?, has_db=?,
              price=?, original_price=?, status=?, cover=?, description=?, source_path=?, keywords=?,
              kind=?, qa_note=?, run_status=?, demo_url=?, video_url=?, sort_weight=?,
              pan_link=?, pan_code=?, meta_title=?, meta_keywords=?, meta_description=?
       WHERE id=?`,
      [product_no || '', title, tech || '', type || 'folder', category || '', size_mb || 0,
       has_paper ? 1 : 0, has_ppt ? 1 : 0, has_video ? 1 : 0, has_db ? 1 : 0,
       price || 0, original_price || price || 0, status === 0 ? 0 : 1, cover || '',
       description || '', source_path || '', keywords || title, kind || 'code', qa_note || '', run_status || 0,
       demo_url || '', video_url || '', sort_weight || 0,
       pan_link || '', pan_code || '', meta_title || '', meta_keywords || '', meta_description || '', req.params.id]
    );
    await adminLog(req, 'product.update', title, `id=${req.params.id}`);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 质检登记：设置运行状态 + 备注（P0 质检工作流核心接口）
// body: { run_status: 0|1|2|3, qa_note: string }
router.post('/products/:id/qa', async (req, res) => {
  try {
    const runStatus = [0, 1, 2, 3].includes(parseInt(req.body.run_status, 10)) ? parseInt(req.body.run_status, 10) : 0;
    const qaNote = String(req.body.qa_note || '').slice(0, 1000);
    const verifiedAt = runStatus > 0 ? new Date() : null;
    const [rows] = await pool.query('SELECT title FROM products WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: '商品不存在' });
    await pool.query(
      'UPDATE products SET run_status=?, qa_note=?, verified_at=? WHERE id=?',
      [runStatus, qaNote, verifiedAt, req.params.id]
    );
    await adminLog(req, 'product.qa', rows[0].title, `run_status=${runStatus}`);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 批量操作：批量上/下架、批量改质检状态
// body: { ids: [1,2], action: 'onsale'|'offsale'|'qa', run_status? }
router.post('/products/batch', async (req, res) => {
  try {
    const ids = (req.body.ids || []).map(Number).filter(Boolean);
    const action = req.body.action;
    if (!ids.length) return res.status(400).json({ message: '请选择商品' });
    const ph = ids.map(() => '?').join(',');
    if (action === 'onsale' || action === 'offsale') {
      await pool.query(`UPDATE products SET status=${action === 'onsale' ? 1 : 0} WHERE id IN (${ph})`, ids);
      await adminLog(req, `product.batch.${action}`, '', `${ids.length} 条`);
    } else if (action === 'qa') {
      const rs = [0, 1, 2, 3].includes(parseInt(req.body.run_status, 10)) ? parseInt(req.body.run_status, 10) : 0;
      const verifiedAt = rs > 0 ? new Date() : null;
      await pool.query(`UPDATE products SET run_status=?, verified_at=? WHERE id IN (${ph})`, [rs, verifiedAt, ...ids]);
      await adminLog(req, 'product.batch.qa', '', `${ids.length} 条 -> ${rs}`);
    } else {
      return res.status(400).json({ message: '不支持的操作' });
    }
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 补全缺失封面：有截图则拷贝，否则生成 SVG 占位
router.post('/products/fill-covers', async (req, res) => {
  try {
    const { fillCovers } = require('../gen-covers');
    const placeholdersOnly = !!req.body?.placeholdersOnly;
    const limit = Math.min(2000, Math.max(1, parseInt(req.body?.limit, 10) || 2000));
    const stats = await fillCovers({ all: false, placeholdersOnly, limit });
    await adminLog(
      req,
      'product.fill-covers',
      '',
      `截图 ${stats.fromShot} / 占位 ${stats.placeholder} / 失败 ${stats.fail}`
    );
    res.json({ ok: true, ...stats });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '补全封面失败：' + (e.message || '未知错误') });
  }
});

router.get('/products/cover-stats', async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN cover IS NULL OR cover='' THEN 1 ELSE 0 END) AS missing
      FROM products WHERE is_deleted=0`);
    res.json({ total: Number(row.total) || 0, missing: Number(row.missing) || 0 });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 上/下架
router.post('/products/:id/toggle', async (req, res) => {
  try {
    await pool.query('UPDATE products SET status=1-status WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 删除商品（软删除，保留历史订单展示与数据可恢复）
router.delete('/products/:id', async (req, res) => {
  try {
    await pool.query("UPDATE products SET is_deleted=1 WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// ---------- 订单管理 ----------
router.get('/orders', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
    const { status, orderNo } = req.query;
    const where = [];
    const params = [];
    if (status && status !== '全部') {
      where.push('status=?');
      params.push(status);
    }
    if (orderNo) {
      where.push('order_no LIKE ?');
      params.push(`%${orderNo}%`);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [totalRows] = await pool.query(`SELECT COUNT(*) AS c FROM orders ${whereSql}`, params);
    const [list] = await pool.query(
      `SELECT o.*, u.username FROM orders o LEFT JOIN users u ON o.user_id=u.id
       ${whereSql} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    // 商品明细
    const ids = list.map((o) => o.id);
    let items = [];
    if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      [items] = await pool.query(`SELECT * FROM order_items WHERE order_id IN (${ph})`, ids);
    }
    const byOrder = {};
    for (const it of items) (byOrder[it.order_id] = byOrder[it.order_id] || []).push(it);
    res.json({ list: list.map((o) => ({ ...o, items: byOrder[o.id] || [] })), total: totalRows[0].c, page, pageSize });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 批量发货
router.post('/orders/batch-ship', async (req, res) => {
  try {
    const { shipping_info, method } = req.body;
    const orderIds = (req.body.orderIds || []).map((id) => parseInt(id, 10)).filter(Boolean);
    if (!shipping_info) return res.status(400).json({ message: '请填写发货信息' });
    if (!orderIds.length) return res.status(400).json({ message: '请选择订单' });
    if (orderIds.length > 100) return res.status(400).json({ message: '单次最多发货 100 单' });
    const shipMethod = method || 'pan';
    let shipped = 0;
    const skipped = [];
    for (const id of orderIds) {
      const [orders] = await pool.query('SELECT order_no, user_id, status FROM orders WHERE id=?', [id]);
      if (!orders.length) {
        skipped.push({ id, reason: '订单不存在' });
        continue;
      }
      const order = orders[0];
      if (order.status !== 'paid') {
        skipped.push({ id, reason: `状态为 ${order.status}，非已支付` });
        continue;
      }
      const [r] = await pool.query(
        "UPDATE orders SET status='shipped', shipping_info=?, shipped_at=NOW() WHERE id=? AND status='paid'",
        [shipping_info, id]
      );
      if (r.affectedRows === 1) {
        await pool.query(
          'INSERT INTO delivery_logs (order_id, order_no, user_id, method, content, operator) VALUES (?,?,?,?,?,?)',
          [id, order.order_no, order.user_id, shipMethod, shipping_info, req.user.username]
        );
        shipped++;
      } else {
        skipped.push({ id, reason: '发货失败' });
      }
    }
    await adminLog(req, 'order.batch-ship', '', `${shipped} 单发货（跳过 ${skipped.length}）`);
    res.json({ ok: true, shipped, skipped });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 手动发货（QQ/网盘/其他）—— 记录发货日志
router.post('/orders/:id/ship', async (req, res) => {
  try {
    const { shipping_info, method } = req.body;
    if (!shipping_info) return res.status(400).json({ message: '请填写发货信息' });
    const [orders] = await pool.query(
      "SELECT o.*, u.username FROM orders o LEFT JOIN users u ON o.user_id=u.id WHERE o.id=? AND o.status='paid'",
      [req.params.id]
    );
    if (!orders.length) return res.status(400).json({ message: '只能给已支付订单发货' });
    const order = orders[0];
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("UPDATE orders SET status='shipped', shipping_info=?, shipped_at=NOW() WHERE id=?",
        [shipping_info, req.params.id]);
      await conn.query(
        'INSERT INTO delivery_logs (order_id, order_no, user_id, method, content, operator) VALUES (?,?,?,?,?,?)',
        [order.id, order.order_no, order.user_id, method || 'qq', shipping_info, req.user.username]
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    await adminLog(req, 'order.ship', order.order_no, `发给 ${order.username}`);
    notify(order.user_id, 'order', '订单已发货', `订单 ${order.order_no} 已发货：${String(shipping_info).slice(0, 200)}`);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 发货信息修改（已发货订单补充）+ 记录日志
router.post('/orders/:id/reship', async (req, res) => {
  try {
    const { shipping_info } = req.body;
    if (!shipping_info) return res.status(400).json({ message: '请填写发货信息' });
    const [orders] = await pool.query("SELECT * FROM orders WHERE id=?", [req.params.id]);
    if (!orders.length) return res.status(404).json({ message: '订单不存在' });
    await pool.query("UPDATE orders SET shipping_info=? WHERE id=?", [shipping_info, req.params.id]);
    await pool.query(
      'INSERT INTO delivery_logs (order_id, order_no, user_id, method, content, operator) VALUES (?,?,?,?,?,?)',
      [orders[0].id, orders[0].order_no, orders[0].user_id, 'reship', shipping_info, req.user.username]
    );
    await adminLog(req, 'order.reship', orders[0].order_no, '补充发货信息');
    notify(orders[0].user_id, 'order', '发货信息已更新', `订单 ${orders[0].order_no} 已发货：${String(shipping_info).slice(0, 200)}`);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 后台订单详情（含买家、商品、发货记录）
router.get('/orders/:id(\\d+)', async (req, res) => {
  try {
    const [orders] = await pool.query(
      'SELECT o.*, u.username, u.nickname FROM orders o LEFT JOIN users u ON o.user_id=u.id WHERE o.id=?',
      [req.params.id]
    );
    if (!orders.length) return res.status(404).json({ message: '订单不存在' });
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id=?', [req.params.id]);
    const [deliveries] = await pool.query('SELECT * FROM delivery_logs WHERE order_id=? ORDER BY id DESC', [req.params.id]);
    res.json({ ...orders[0], items, deliveries });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 质检统计（质检中心概览）
router.get('/stats/qa', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT run_status, COUNT(*) AS cnt,
              SUM(status=1) AS on_sale,
              SUM(qa_note <> '' ) AS has_note
       FROM products WHERE is_deleted=0 GROUP BY run_status`
    );
    const [total] = await pool.query('SELECT COUNT(*) AS c FROM products WHERE is_deleted=0');
    res.json({ total: total[0].c, byStatus: rows });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 质检中心商品列表（按 run_status 筛选）
router.get('/qa/products', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
    const runStatus = req.query.run_status;
    const keyword = (req.query.keyword || '').trim();
    const where = ['is_deleted=0'];
    const params = [];
    if (runStatus !== undefined && runStatus !== '' && runStatus !== '全部') {
      where.push('run_status=?');
      params.push(parseInt(runStatus));
    }
    if (keyword) {
      where.push('(title LIKE ? OR product_no LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const whereSql = 'WHERE ' + where.join(' AND ');
    const [totalRows] = await pool.query(`SELECT COUNT(*) AS c FROM products ${whereSql}`, params);
    const [list] = await pool.query(
      `SELECT id, product_no, title, tech, type, size_mb, price, status, run_status, qa_note, verified_at, created_at,
              (SELECT COUNT(*) FROM product_files WHERE product_id=products.id) AS file_count
       FROM products ${whereSql} ORDER BY run_status ASC, id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    res.json({ list, total: totalRows[0].c, page, pageSize });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// ---------- 卡密管理 ----------
router.post('/cards/generate', async (req, res) => {
  try {
    const count = Math.min(500, Math.max(1, parseInt(req.body.count) || 1));
    const amount = parseFloat(req.body.amount) || 99;
    const cards = [];
    const used = new Set();
    for (let i = 0; i < count; i++) {
      let code;
      do {
        code = genCode();
      } while (used.has(code));
      used.add(code);
      cards.push([code, amount]);
    }
    await pool.query('INSERT INTO cards (card_no, amount) VALUES ?', [cards]);
    res.json({ ok: true, count, cards: cards.map((c) => c[0]) });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.get('/cards', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
    const { status } = req.query;
    let where = '';
    const params = [];
    if (status && status !== '全部') {
      where = 'WHERE status=?';
      params.push(status);
    }
    const [totalRows] = await pool.query(`SELECT COUNT(*) AS c FROM cards ${where}`, params);
    const [list] = await pool.query(
      `SELECT * FROM cards ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    res.json({ list, total: totalRows[0].c, page, pageSize });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) s += '-';
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

// ---------- 用户管理 ----------
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
    const keyword = (req.query.keyword || '').trim();
    let where = "WHERE role='user'";
    const params = [];
    if (keyword) {
      where += ' AND (username LIKE ? OR nickname LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const [totalRows] = await pool.query(`SELECT COUNT(*) AS c FROM users ${where}`, params);
    const [list] = await pool.query(
      `SELECT id, username, nickname, is_disabled, proposal_credits, created_at, (SELECT COUNT(*) FROM orders WHERE user_id=users.id) AS order_count
       FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    res.json({ list, total: totalRows[0].c, page, pageSize });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 重置用户密码
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { password } = req.body;
    const pwd = (password || '123456').toString();
    if (pwd.length < 6) return res.status(400).json({ message: '密码至少 6 位' });
    const hash = bcrypt.hashSync(pwd, 10);
    await pool.query('UPDATE users SET password_hash=? WHERE id=? AND role=?', [hash, req.params.id, 'user']);
    res.json({ ok: true, password: pwd });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 禁用/启用用户
router.post('/users/:id/toggle', async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_disabled=1-is_disabled WHERE id=? AND role=?', [req.params.id, 'user']);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// ---------- 管理员账号（仅超级管理员） ----------
router.get('/admins', superadminRequired, async (req, res) => {
  try {
    const [list] = await pool.query(
      "SELECT id, username, nickname, role, is_disabled, created_at FROM users WHERE role IN ('admin','superadmin','ops') ORDER BY id"
    );
    await adminLog(req, 'admin.list', '', `${list.length} 人`);
    res.json({ list });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.post('/admins', superadminRequired, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ message: '用户名和密码必填' });
    if (!ADMIN_ROLES.includes(role)) return res.status(400).json({ message: '无效的管理员角色' });
    const [ex] = await pool.query('SELECT id FROM users WHERE username=?', [username]);
    if (ex.length) return res.status(400).json({ message: '用户名已存在' });
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query(
      'INSERT INTO users (username, password_hash, nickname, role) VALUES (?,?,?,?)',
      [username, hash, username, role]
    );
    await adminLog(req, 'admin.create', username, `id=${r.insertId} role=${role}`);
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.put('/admins/:id', superadminRequired, async (req, res) => {
  try {
    const { role } = req.body;
    const targetId = parseInt(req.params.id, 10);
    if (targetId === req.user.id) return res.status(400).json({ message: '不能修改自己的角色' });
    if (!ADMIN_ROLES.includes(role)) return res.status(400).json({ message: '无效的管理员角色' });
    const [rows] = await pool.query('SELECT id, username FROM users WHERE id=?', [targetId]);
    if (!rows.length) return res.status(404).json({ message: '管理员不存在' });
    await pool.query('UPDATE users SET role=? WHERE id=?', [role, targetId]);
    await adminLog(req, 'admin.role', rows[0].username, `id=${targetId} role=${role}`);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.post('/admins/:id/toggle', superadminRequired, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (targetId === req.user.id) return res.status(400).json({ message: '不能禁用自己的账号' });
    const [rows] = await pool.query('SELECT id, username, is_disabled FROM users WHERE id=?', [targetId]);
    if (!rows.length) return res.status(404).json({ message: '管理员不存在' });
    await pool.query('UPDATE users SET is_disabled=1-is_disabled WHERE id=?', [targetId]);
    const disabled = !rows[0].is_disabled;
    await adminLog(req, 'admin.toggle', rows[0].username, `id=${targetId} disabled=${disabled}`);
    res.json({ ok: true, disabled });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// ---------- 导出 CSV ----------
function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const r of rows) lines.push(r.map(csvEscape).join(','));
  return '\ufeff' + lines.join('\r\n');
}

// 导出订单 CSV
router.get('/orders/export', async (req, res) => {
  try {
    const { status, orderNo } = req.query;
    const where = [];
    const params = [];
    if (status && status !== '全部') { where.push('status=?'); params.push(status); }
    if (orderNo) { where.push('order_no LIKE ?'); params.push(`%${orderNo}%`); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [list] = await pool.query(
      `SELECT o.order_no, u.username, o.total_amount, o.status, o.pay_method, o.created_at, o.paid_at, o.shipped_at
       FROM orders o LEFT JOIN users u ON o.user_id=u.id ${whereSql} ORDER BY o.id DESC`,
      params
    );
    const statusMap = { pending: '待支付', paid: '已支付待发货', shipped: '已发货', completed: '已完成', cancelled: '已取消', refunded: '已退款' };
    const rows = list.map((o) => [
      o.order_no, o.username, o.total_amount, statusMap[o.status] || o.status,
      o.pay_method || '', o.created_at, o.paid_at || '', o.shipped_at || ''
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(toCsv(['订单号', '买家', '金额', '状态', '支付方式', '下单时间', '支付时间', '发货时间'], rows));
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 导出卡密 CSV
router.get('/cards/export', async (req, res) => {
  try {
    const { status } = req.query;
    let where = '';
    const params = [];
    if (status && status !== '全部') { where = 'WHERE status=?'; params.push(status); }
    const [list] = await pool.query(`SELECT card_no, amount, status, used_order, created_at, used_at FROM cards ${where} ORDER BY id DESC`, params);
    const rows = list.map((c) => [
      c.card_no, c.amount, c.status === 'unused' ? '未使用' : '已使用', c.used_order || '', c.created_at, c.used_at || ''
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cards.csv"');
    res.send(toCsv(['卡密', '面值', '状态', '使用订单', '生成时间', '使用时间'], rows));
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// ---------- 仪表盘图表数据（只读聚合） ----------
// 销售趋势：近 14 天（仅真实支付：支付宝/微信/卡密）
router.get('/stats/sales-trend', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(COALESCE(paid_at, created_at), '%Y-%m-%d') AS d,
             IFNULL(SUM(total_amount),0) AS amt, COUNT(*) AS cnt
      FROM orders
      WHERE ${REAL_PAID}
        AND COALESCE(paid_at, created_at) >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
      GROUP BY DATE_FORMAT(COALESCE(paid_at, created_at), '%Y-%m-%d')
      ORDER BY d`);
    res.json(rows);
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

// 分类分布
router.get('/stats/category-dist', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT COALESCE(NULLIF(category,''),'未分类') AS name, COUNT(*) AS value
      FROM products WHERE is_deleted=0 GROUP BY name ORDER BY value DESC`);
    res.json(rows);
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

// 技术栈分布
router.get('/stats/tech-dist', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT tech AS name, COUNT(*) AS value FROM products WHERE is_deleted=0
      GROUP BY tech ORDER BY value DESC`);
    res.json(rows);
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

// 订单状态分布（排除 mock 测试单）
router.get('/stats/order-status', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT status, COUNT(*) AS value FROM orders
      WHERE pay_method <> 'mock'
      GROUP BY status`);
    const map = { pending: '待支付', paid: '已支付', shipped: '已发货', completed: '已完成', cancelled: '已取消', refunded: '已退款' };
    res.json(rows.map((r) => ({ name: map[r.status] || r.status, value: Number(r.value) || 0, raw: r.status })));
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

// 热销商品 Top8
router.get('/stats/top-products', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, title, tech, sales, views, price
      FROM products WHERE is_deleted=0 ORDER BY sales DESC, views DESC LIMIT 8`);
    res.json(rows);
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

// 最新订单（优先真实支付；不够则回退非 mock）
router.get('/stats/recent-orders', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.id, o.order_no, o.total_amount, o.status, o.pay_method, o.created_at, u.username
      FROM orders o LEFT JOIN users u ON o.user_id=u.id
      WHERE o.pay_method <> 'mock'
      ORDER BY o.id DESC LIMIT 8`);
    res.json(rows);
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});


// ---------- 操作日志 ----------
router.get('/logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
    const { action, keyword } = req.query;
    const where = []; const params = [];
    if (action && action !== '全部') { where.push('action LIKE ?'); params.push(`%${action}%`); }
    if (keyword) { where.push('(target LIKE ? OR detail LIKE ? OR admin_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [tr] = await pool.query(`SELECT COUNT(*) AS c FROM admin_logs ${whereSql}`, params);
    const [list] = await pool.query(
      `SELECT id, admin_name, action, target, detail, ip, created_at FROM admin_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    const [acts] = await pool.query('SELECT DISTINCT action FROM admin_logs ORDER BY action');
    res.json({ list, total: tr[0].c, page, pageSize, actions: acts.map((a) => a.action) });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

// ---------- 搜索分析 ----------
router.get('/stats/search', async (req, res) => {
  try {
    const [hot] = await pool.query('SELECT word, weight FROM hot_words ORDER BY weight DESC LIMIT 15');
    const [noResult] = await pool.query("SELECT keyword, COUNT(*) AS cnt FROM search_logs WHERE result_count=0 GROUP BY keyword ORDER BY cnt DESC LIMIT 15");
    const [top] = await pool.query("SELECT keyword, COUNT(*) AS cnt FROM search_logs GROUP BY keyword ORDER BY cnt DESC LIMIT 15");
    res.json({ hotWords: hot, noResultWords: noResult, topKeywords: top });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

// ---------- 访问来源 ----------
router.get('/stats/visits', async (req, res) => {
  try {
    const days = [7, 30].includes(parseInt(req.query.days, 10)) ? parseInt(req.query.days, 10) : 7;
    const [rows] = await pool.query(
      `SELECT IFNULL(NULLIF(source,''),'direct') AS source, COUNT(*) AS cnt
       FROM visit_logs
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY IFNULL(NULLIF(source,''),'direct')
       ORDER BY cnt DESC`,
      [days]
    );
    const list = rows.map((r) => ({ source: r.source, cnt: Number(r.cnt) || 0 }));
    const total = list.reduce((s, r) => s + r.cnt, 0);
    res.json({ list, total, days });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 访问趋势：近 14 天
router.get('/stats/visit-trend', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS cnt
      FROM visit_logs
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      ORDER BY d`);
    res.json(rows);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// ---------- 待办聚合 ----------
router.get('/todos', async (req, res) => {
  try {
    const [[ship]] = await pool.query(
      `SELECT COUNT(*) AS c FROM orders WHERE status='paid' AND ${REAL_PAY}`
    );
    const [[refund]] = await pool.query("SELECT COUNT(*) AS c FROM refunds WHERE status='pending'");
    const [[quote]] = await pool.query("SELECT COUNT(*) AS c FROM custom_orders WHERE status='pending_quote'");
    const [[leads]] = await pool.query("SELECT COUNT(*) AS c FROM enterprise_leads WHERE status='new'");
    res.json({
      pendingShip: Number(ship.c) || 0,
      pendingRefund: Number(refund.c) || 0,
      pendingQuote: Number(quote.c) || 0,
      newLeads: Number(leads.c) || 0
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// ---------- 转化漏斗 ----------
router.get('/stats/funnel', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
    const [[v]] = await pool.query(
      'SELECT COUNT(*) AS c FROM visit_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)',
      [days]
    );
    const [[pv]] = await pool.query(
      "SELECT COUNT(*) AS c FROM visit_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND path LIKE '/products/%'",
      [days]
    );
    const [[o]] = await pool.query(
      `SELECT COUNT(*) AS c FROM orders
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND (pay_method <> 'mock' OR pay_method IS NULL OR pay_method='')`,
      [days]
    );
    const [[p]] = await pool.query(
      `SELECT COUNT(*) AS c FROM orders
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND status IN ('paid','shipped','completed','refunded')
         AND ${REAL_PAY}`,
      [days]
    );
    const visits = Number(v.c) || 0;
    const productViews = Number(pv.c) || 0;
    const orders = Number(o.c) || 0;
    const paid = Number(p.c) || 0;
    // 转化率：分母为 0 时返回 null（前端显示「—」）；漏斗逐级递减，不允许超过 100%
    // （出现过 orders=43 / productViews=1 算出 4300% 的情况：分母过小时没有意义）
    const pct = (a, b) => {
      if (!b) return null;
      const r = Math.round((a / b) * 1000) / 10;
      return r > 100 ? 100 : r;
    };
    res.json({
      days,
      visits,
      productViews,
      orders,
      paid,
      rates: {
        visitToProduct: pct(productViews, visits),
        productToOrder: pct(orders, productViews),
        orderToPaid: pct(paid, orders),
        visitToPaid: pct(paid, visits)
      }
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// ---------- 评价管理 ----------
router.get('/reviews', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
    const [tr] = await pool.query('SELECT COUNT(*) AS c FROM reviews');
    const [list] = await pool.query(
      `SELECT r.id, r.rating, r.content, r.created_at, p.title AS product_title, u.username
       FROM reviews r LEFT JOIN products p ON r.product_id=p.id LEFT JOIN users u ON r.user_id=u.id
       ORDER BY r.id DESC LIMIT ? OFFSET ?`,
      [pageSize, (page - 1) * pageSize]
    );
    res.json({ list, total: tr[0].c, page, pageSize });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

router.delete('/reviews/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM reviews WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { logger.error(e.stack || e.message); res.status(500).json({ message: '服务器内部错误，请稍后再试' }); }
});

// ---------- 退款管理 ----------
router.get('/refunds', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
    const { status } = req.query;
    const where = [];
    const params = [];
    if (status && status !== '全部') {
      where.push('r.status=?');
      params.push(status);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [totalRows] = await pool.query(`SELECT COUNT(*) AS c FROM refunds r ${whereSql}`, params);
    const [list] = await pool.query(
      `SELECT r.*, u.username
       FROM refunds r
       LEFT JOIN users u ON r.user_id=u.id
       ${whereSql} ORDER BY r.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    res.json({ list, total: totalRows[0].c, page, pageSize });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.post('/refunds/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { action, admin_note } = req.body;
    if (!['approve', 'reject', 'refund'].includes(action)) {
      return res.status(400).json({ message: '不支持的操作' });
    }
    const [rows] = await conn.query('SELECT * FROM refunds WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: '退款申请不存在' });
    const refund = rows[0];
    const note = String(admin_note || '').slice(0, 500);
    const operator = req.user.username;

    await conn.beginTransaction();
    if (action === 'approve') {
      await conn.query(
        "UPDATE refunds SET status='approved', admin_note=?, operator=?, handled_at=NOW() WHERE id=?",
        [note, operator, refund.id]
      );
      await adminLog(req, 'refund.approve', refund.order_no, `id=${refund.id}`);
    } else if (action === 'reject') {
      await conn.query(
        "UPDATE refunds SET status='rejected', admin_note=?, operator=?, handled_at=NOW() WHERE id=?",
        [note, operator, refund.id]
      );
      await adminLog(req, 'refund.reject', refund.order_no, `id=${refund.id}`);
    } else if (action === 'refund') {
      await conn.query(
        "UPDATE refunds SET status='refunded', admin_note=?, operator=?, handled_at=NOW() WHERE id=?",
        [note, operator, refund.id]
      );
      await conn.query(
        "UPDATE orders SET status='refunded', refunded_at=NOW() WHERE id=?",
        [refund.order_id]
      );
      const [orderRows] = await conn.query('SELECT pay_method, order_no FROM orders WHERE id=?', [refund.order_id]);
      if (orderRows.length && orderRows[0].pay_method === 'card') {
        const [cardResult] = await conn.query(
          "UPDATE cards SET status='unused', used_by=NULL, used_order=NULL, used_at=NULL WHERE used_order=? AND status='used'",
          [orderRows[0].order_no]
        );
        if (cardResult.affectedRows > 0) {
          await adminLog(req, 'refund.card-restore', refund.order_no, `id=${refund.id} cards=${cardResult.affectedRows}`);
        }
      }
      await adminLog(req, 'refund.refund', refund.order_no, `id=${refund.id} amount=${refund.amount}`);
      notify(refund.user_id, 'refund', '退款已处理', `订单 ${refund.order_no} 的退款已处理完成。`);
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  } finally {
    conn.release();
  }
});

// ---------- 优惠券管理 ----------
function genCouponCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

router.get('/coupons', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
    const [totalRows] = await pool.query('SELECT COUNT(*) AS c FROM coupons');
    const [list] = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM user_coupons uc WHERE uc.coupon_id=c.id AND uc.status='used') AS used_count,
              (SELECT COUNT(*) FROM user_coupons uc WHERE uc.coupon_id=c.id) AS claimed_count
       FROM coupons c ORDER BY c.id DESC LIMIT ? OFFSET ?`,
      [pageSize, (page - 1) * pageSize]
    );
    res.json({ list, total: totalRows[0].c, page, pageSize });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.post('/coupons', async (req, res) => {
  try {
    const { name, type, amount, threshold, stock, per_user, expires_at, count, code, scope_tech, scope_category } = req.body;
    if (!name) return res.status(400).json({ message: '名称必填' });
    const scopeTech = String(scope_tech || '').slice(0, 64);
    const scopeCategory = String(scope_category || '').slice(0, 64);
    const cnt = Math.min(100, Math.max(1, parseInt(count) || 1));
    const codes = [];
    if (code) {
      await pool.query(
        'INSERT INTO coupons (code, name, type, amount, threshold, stock, per_user, expires_at, scope_tech, scope_category) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [code, name, type || 'full', amount || 0, threshold || 0, stock ?? 0, per_user ?? 1, expires_at || null, scopeTech, scopeCategory]
      );
      codes.push(code);
    } else {
      for (let i = 0; i < cnt; i++) {
        let c;
        let tries = 0;
        do {
          c = genCouponCode();
          const [ex] = await pool.query('SELECT id FROM coupons WHERE code=?', [c]);
          if (!ex.length) break;
          tries++;
        } while (tries < 20);
        await pool.query(
          'INSERT INTO coupons (code, name, type, amount, threshold, stock, per_user, expires_at, scope_tech, scope_category) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [c, name, type || 'full', amount || 0, threshold || 0, stock ?? 0, per_user ?? 1, expires_at || null, scopeTech, scopeCategory]
        );
        codes.push(c);
      }
    }
    await adminLog(req, 'coupon.create', name, `codes=${codes.join(',')}`);
    res.json({ ok: true, codes });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.put('/coupons/:id', async (req, res) => {
  try {
    const { enabled, name, amount, threshold, stock, per_user, expires_at } = req.body;
    const [rows] = await pool.query('SELECT name FROM coupons WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: '优惠券不存在' });
    await pool.query(
      'UPDATE coupons SET enabled=?, name=?, amount=?, threshold=?, stock=?, per_user=?, expires_at=? WHERE id=?',
      [enabled === 0 ? 0 : 1, name || rows[0].name, amount ?? 0, threshold ?? 0, stock ?? 0, per_user ?? 1, expires_at || null, req.params.id]
    );
    await adminLog(req, 'coupon.update', rows[0].name, `id=${req.params.id}`);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// ---------- 公告管理 ----------
router.get('/notices', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
    const [totalRows] = await pool.query('SELECT COUNT(*) AS c FROM notices');
    const [list] = await pool.query(
      'SELECT * FROM notices ORDER BY id DESC LIMIT ? OFFSET ?',
      [pageSize, (page - 1) * pageSize]
    );
    res.json({ list, total: totalRows[0].c, page, pageSize });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.post('/notices', async (req, res) => {
  try {
    const { title, content, enabled } = req.body;
    if (!title) return res.status(400).json({ message: '标题必填' });
    const [r] = await pool.query(
      'INSERT INTO notices (title, content, enabled) VALUES (?,?,?)',
      [title, content || '', enabled === 0 ? 0 : 1]
    );
    await adminLog(req, 'notice.create', title, `id=${r.insertId}`);
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.put('/notices/:id', async (req, res) => {
  try {
    const { title, content, enabled } = req.body;
    const [rows] = await pool.query('SELECT title FROM notices WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: '公告不存在' });
    await pool.query(
      'UPDATE notices SET title=?, content=?, enabled=?, updated_at=NOW() WHERE id=?',
      [title || rows[0].title, content ?? '', enabled === 0 ? 0 : 1, req.params.id]
    );
    await adminLog(req, 'notice.update', rows[0].title, `id=${req.params.id}`);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.delete('/notices/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT title FROM notices WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: '公告不存在' });
    await pool.query('DELETE FROM notices WHERE id=?', [req.params.id]);
    await adminLog(req, 'notice.delete', rows[0].title, `id=${req.params.id}`);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

module.exports = router;

