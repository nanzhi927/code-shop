const express = require('express');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');
const { logger } = require('../lib/logger');

const router = express.Router();

// 商品评价列表（公开）
router.get('/product/:pid', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT r.id, r.rating, r.content, r.created_at, u.username FROM reviews r LEFT JOIN users u ON r.user_id=u.id WHERE r.product_id=? ORDER BY r.id DESC LIMIT 50',
      [req.params.pid]
    );
    res.json(rows);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 提交评价（需登录 + 已完成订单含该商品）
router.post('/', authRequired, async (req, res) => {
  try {
    const { productId, orderId, rating, content } = req.body;
    const pid = parseInt(productId);
    const oid = parseInt(orderId);
    if (!pid || !oid) return res.status(400).json({ message: '参数缺失' });
    const [o] = await pool.query(
      "SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.id=? AND o.user_id=? AND o.status='completed' AND oi.product_id=?",
      [oid, req.user.id, pid]
    );
    if (!o.length) return res.status(400).json({ message: '仅已完成订单中的商品可评价' });
    const [ex] = await pool.query('SELECT id FROM reviews WHERE order_id=? AND product_id=?', [oid, pid]);
    if (ex.length) return res.status(400).json({ message: '该商品已评价过' });
    const r = Math.max(1, Math.min(5, parseInt(rating) || 5));
    const c = String(content || '').slice(0, 1000);
    await pool.query(
      'INSERT INTO reviews (product_id, user_id, order_id, rating, content) VALUES (?,?,?,?,?)',
      [pid, req.user.id, oid, r, c]
    );
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

module.exports = router;
