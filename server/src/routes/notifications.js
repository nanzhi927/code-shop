const express = require('express');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');
const { logger } = require('../lib/logger');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;
    const userId = req.user.id;

    const [totalRows] = await pool.query(
      'SELECT COUNT(*) AS c FROM notifications WHERE user_id=?',
      [userId]
    );
    const [unreadRows] = await pool.query(
      'SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND is_read=0',
      [userId]
    );
    const [list] = await pool.query(
      'SELECT id, type, title, content, is_read, created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?',
      [userId, pageSize, offset]
    );

    res.json({
      list,
      total: totalRows[0].c,
      unread: unreadRows[0].c,
      page,
      pageSize
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

router.post('/read', async (req, res) => {
  try {
    const ids = (req.body.ids || []).map((id) => parseInt(id, 10)).filter(Boolean);
    const userId = req.user.id;

    if (!ids.length) {
      await pool.query('UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0', [userId]);
    } else {
      const ph = ids.map(() => '?').join(',');
      await pool.query(
        `UPDATE notifications SET is_read=1 WHERE user_id=? AND id IN (${ph})`,
        [userId, ...ids]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

module.exports = router;
