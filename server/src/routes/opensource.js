const express = require('express');
const fs = require('fs');
const path = require('path');
const { createCache } = require('../lib/cache');
const { logger } = require('../lib/logger');

const router = express.Router();
const cache = createCache(60 * 1000, 10);
const DATA_FILE = path.resolve(__dirname, '../../data/opensource.json');
const EMPTY = { total: 0, items: [] };

router.get('/', (req, res) => {
  try {
    const cached = cache.get('opensource');
    if (cached) return res.json(cached);

    if (!fs.existsSync(DATA_FILE)) {
      cache.set('opensource', EMPTY);
      return res.json(EMPTY);
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = EMPTY;
    }
    if (!data || !Array.isArray(data.items)) {
      data = EMPTY;
    }
    cache.set('opensource', data);
    res.json(data);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.json(EMPTY);
  }
});

module.exports = router;
