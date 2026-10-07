const express = require('express');
const pool = require('../db');
const { logger } = require('../lib/logger');
const { createCache } = require('../lib/cache');

const router = express.Router();
const listCache = createCache(10 * 1000);

// 公告列表（仅启用）
router.get('/', async (req, res) => {
  try {
    const key = req.originalUrl;
    const cached = listCache.get(key);
    if (cached) return res.json(JSON.parse(cached));
    const [list] = await pool.query(
      'SELECT id, title, content, created_at, updated_at FROM notices WHERE enabled=1 ORDER BY id DESC'
    );
    const payload = { list };
    listCache.set(key, JSON.stringify(payload));
    res.json(payload);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

module.exports = router;
