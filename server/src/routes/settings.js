const express = require('express');
const pool = require('../db');
const { adminRequired } = require('../middleware/auth');
const { logger } = require('../lib/logger');
const { createCache } = require('../lib/cache');

const router = express.Router();
const publicCache = createCache(10 * 1000);

const PAY_KEYS = ['pay_mock_enabled', 'pay_card_enabled', 'pay_alipay_enabled', 'pay_wechat_enabled'];
const PUBLIC_KEYS = [
  'service_qq', 'service_wechat', 'service_notice',
  'service_wechat_qr', 'service_qq_qr',
  'banner_text', 'banner_sub', 'banner_badge', 'banner_title', 'banner_title_hl', 'banner_title2',
  'banner_search_ph', 'banner_stat4_num', 'banner_stat4_label',
  'ship_notice', 'announcement', 'site_meta_description', 'alipay_qr', 'wechat_qr', 'pay_notice',
  'proposal_enabled', 'proposal_register_gift', 'proposal_disclaimer',
  ...PAY_KEYS
];

function mapPublic(map) {
  const out = {};
  for (const k of PUBLIC_KEYS) {
    if (PAY_KEYS.includes(k)) out[k] = map[k] === '0' ? '0' : '1';
    else out[k] = map[k] || '';
  }
  return out;
}

// 公开设置（前台展示客服信息 / 首页 Banner / 支付开关）
router.get('/public', async (req, res) => {
  try {
    const cached = publicCache.get('public');
    if (cached) return res.json(JSON.parse(cached));
    const [rows] = await pool.query('SELECT k, v FROM settings');
    const map = {};
    for (const r of rows) map[r.k] = r.v;
    const out = mapPublic(map);
    publicCache.set('public', JSON.stringify(out));
    res.json(out);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 后台读取全部设置
router.get('/', adminRequired, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT k, v FROM settings');
    const map = {};
    for (const r of rows) map[r.k] = r.v;
    for (const k of PAY_KEYS) {
      if (map[k] !== '0') map[k] = '1';
    }
    res.json(map);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 后台保存设置
router.put('/', adminRequired, async (req, res) => {
  try {
    const data = req.body || {};
    for (const k of PUBLIC_KEYS) {
      if (k in data) {
        let v = String(data[k] ?? '');
        if (PAY_KEYS.includes(k)) v = v === '0' ? '0' : '1';
        await pool.query(
          'INSERT INTO settings (k, v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)',
          [k, v]
        );
      }
    }
    publicCache.del('public');
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

module.exports = router;
module.exports.PAY_KEYS = PAY_KEYS;
