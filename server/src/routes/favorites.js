const express = require('express');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');
const { logger } = require('../lib/logger');

const router = express.Router();
router.use(authRequired);

// 我的收藏列表（含商品信息）
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.id, f.product_id, f.created_at,
              p.title, p.tech, p.price, p.original_price, p.cover, p.status, p.has_paper
       FROM favorites f
       JOIN products p ON p.id = f.product_id
       WHERE f.user_id=? AND p.is_deleted=0
       ORDER BY f.id DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 是否已收藏
router.get('/status/:productId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM favorites WHERE user_id=? AND product_id=?',
      [req.user.id, parseInt(req.params.productId, 10)]
    );
    res.json({ favorited: rows.length > 0 });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 添加收藏
router.post('/', async (req, res) => {
  try {
    const productId = parseInt(req.body.productId, 10);
    if (!productId) return res.status(400).json({ message: '参数错误' });
    const [rows] = await pool.query('SELECT id FROM products WHERE id=? AND status=1 AND is_deleted=0', [productId]);
    if (!rows.length) return res.status(400).json({ message: '商品不存在' });
    await pool.query(
      'INSERT INTO favorites (user_id, product_id) VALUES (?,?) ON DUPLICATE KEY UPDATE id=id',
      [req.user.id, productId]
    );
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 取消收藏
router.delete('/:productId', async (req, res) => {
  try {
    await pool.query('DELETE FROM favorites WHERE user_id=? AND product_id=?', [
      req.user.id,
      parseInt(req.params.productId, 10)
    ]);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

module.exports = router;
