const express = require('express');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');
const { logger } = require('../lib/logger');

const router = express.Router();
router.use(authRequired);

// 我的卡密（分页）
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 10));
    const [totalRows] = await pool.query(
      'SELECT COUNT(*) AS c FROM cards WHERE used_by=?',
      [req.user.id]
    );
    const [rows] = await pool.query(
      'SELECT card_no, amount, status, used_order, used_at, created_at FROM cards WHERE used_by=? ORDER BY id DESC LIMIT ? OFFSET ?',
      [req.user.id, pageSize, (page - 1) * pageSize]
    );
    res.json({ list: rows, total: totalRows[0].c, page, pageSize });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

module.exports = router;
