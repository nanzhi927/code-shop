const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authRequired, SECRET } = require('../middleware/auth');
const { logger } = require('../lib/logger');
const { createCache } = require('../lib/cache');

const router = express.Router();
const availableCache = createCache(10 * 1000);

function optionalUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// 可领取的优惠券（公开，登录用户附带已领数量）
router.get('/available', async (req, res) => {
  try {
    const user = optionalUser(req);
    const key = req.originalUrl;
    if (!user) {
      const cached = availableCache.get(key);
      if (cached) return res.json(JSON.parse(cached));
    }
    const [coupons] = await pool.query(
      `SELECT id, code, name, type, amount, threshold, stock, per_user, expires_at, enabled, scope_tech, scope_category
       FROM coupons
       WHERE enabled=1 AND (stock<0 OR stock>0) AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY id DESC`
    );
    if (user) {
      const [claimed] = await pool.query(
        'SELECT coupon_id, COUNT(*) AS cnt FROM user_coupons WHERE user_id=? GROUP BY coupon_id',
        [user.id]
      );
      const claimedMap = {};
      for (const c of claimed) claimedMap[c.coupon_id] = c.cnt;
      for (const c of coupons) c.claimedCount = claimedMap[c.id] || 0;
    }
    const payload = { list: coupons };
    if (!user) availableCache.set(key, JSON.stringify(payload));
    res.json(payload);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 我的优惠券
router.get('/mine', authRequired, async (req, res) => {
  try {
    const [list] = await pool.query(
      `SELECT uc.id, uc.status, uc.claimed_at, uc.expires_at, uc.used_order_id,
              c.code, c.name, c.type, c.amount, c.threshold
       FROM user_coupons uc JOIN coupons c ON uc.coupon_id=c.id
       WHERE uc.user_id=? ORDER BY uc.id DESC`,
      [req.user.id]
    );
    res.json({ list });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 领取优惠券
router.post('/:id/claim', authRequired, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const couponId = parseInt(req.params.id, 10);
    const [rows] = await conn.query('SELECT * FROM coupons WHERE id=? FOR UPDATE', [couponId]);
    if (!rows.length) throw fail(404, '优惠券不存在');
    const coupon = rows[0];
    if (!coupon.enabled) throw fail(400, '优惠券已停用');
    if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
      throw fail(400, '优惠券已过期');
    }
    if (coupon.stock === 0) throw fail(400, '优惠券已领完');

    const [claimed] = await conn.query(
      'SELECT COUNT(*) AS c FROM user_coupons WHERE coupon_id=? AND user_id=?',
      [couponId, req.user.id]
    );
    if (claimed[0].c >= coupon.per_user) {
      throw fail(400, '已达到领取上限');
    }

    if (coupon.stock > 0) {
      await conn.query('UPDATE coupons SET stock=stock-1 WHERE id=? AND stock>0', [couponId]);
    }

    await conn.query(
      'INSERT INTO user_coupons (coupon_id, user_id, expires_at) VALUES (?,?,?)',
      [couponId, req.user.id, coupon.expires_at]
    );
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    if (e.status) return res.status(e.status).json({ message: e.message });
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  } finally {
    conn.release();
  }
});

module.exports = router;
