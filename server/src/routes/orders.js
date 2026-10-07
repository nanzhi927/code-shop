const express = require('express');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');
const { logger } = require('../lib/logger');
const { createPayment } = require('../lib/payProvider');
const { notify } = require('../lib/notify');

const router = express.Router();
router.use(authRequired);

function genOrderNo() {
  const d = new Date();
  const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return ts + rand;
}

function genTradeNo() {
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return 'T' + Date.now() + rand;
}

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// 客服/发货设置（公开信息，供订单页展示"加客服QQ发货"）
async function getShipSettings() {
  const [rows] = await pool.query(
    "SELECT k, v FROM settings WHERE k IN ('service_qq','service_wechat','service_notice','ship_notice')"
  );
  const map = {};
  for (const r of rows) map[r.k] = r.v;
  return map;
}

async function getPayEnabled(connOrPool) {
  const [rows] = await connOrPool.query(
    "SELECT k, v FROM settings WHERE k IN ('pay_mock_enabled','pay_card_enabled','pay_alipay_enabled','pay_wechat_enabled')"
  );
  const map = {};
  for (const r of rows) map[r.k] = r.v;
  return {
    mock: map.pay_mock_enabled !== '0',
    card: map.pay_card_enabled !== '0',
    alipay: map.pay_alipay_enabled !== '0',
    wechat: map.pay_wechat_enabled !== '0'
  };
}

// 创建订单（可含多商品）
// body: { productIds: [1,2,3], userCouponId? }
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { productIds, remark, userCouponId } = req.body;
    if (!Array.isArray(productIds) || !productIds.length) {
      throw fail(400, '请选择商品');
    }
    const uniq = [...new Set(productIds.map(Number))];
    const placeholders = uniq.map(() => '?').join(',');
    const [rows] = await conn.query(
      `SELECT id, title, price, status, pan_link, pan_code, tech, category FROM products WHERE id IN (${placeholders})`,
      uniq
    );
    if (!rows.length) throw fail(400, '商品不存在');
    const off = rows.find((p) => p.status !== 1);
    if (off) throw fail(400, `商品「${off.title}」已下架`);

    const subtotal = rows.reduce((s, p) => s + Number(p.price), 0);
    let orderNo = genOrderNo();
    const remarkStr = String(remark || '').slice(0, 500);

    // 会员折扣
    const [mem] = await conn.query(
      "SELECT plan FROM user_memberships WHERE user_id=? AND status='active' AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY id DESC LIMIT 1",
      [req.user.id]
    );
    const planDiscount = { monthly: 0.9, quarterly: 0.9, yearly: 0.85 };
    const rate = mem.length ? (planDiscount[mem[0].plan] ?? 0.9) : 1;
    const afterMember = Math.round(subtotal * rate * 100) / 100;

    // 优惠券（会员折扣后再减）
    let discount = 0;
    let userCouponRow = null;
    if (userCouponId) {
      const [ucRows] = await conn.query(
        `SELECT uc.*, c.name, c.type, c.amount, c.threshold, c.enabled, c.scope_tech, c.scope_category
         FROM user_coupons uc JOIN coupons c ON uc.coupon_id=c.id
         WHERE uc.id=? AND uc.user_id=? FOR UPDATE`,
        [userCouponId, req.user.id]
      );
      if (!ucRows.length) throw fail(400, '优惠券不存在');
      userCouponRow = ucRows[0];
      if (userCouponRow.status !== 'unused') throw fail(400, '优惠券不可用');
      if (userCouponRow.expires_at && new Date(userCouponRow.expires_at) <= new Date()) {
        throw fail(400, '优惠券已过期');
      }
      if (!userCouponRow.enabled) throw fail(400, '优惠券已停用');
      const scopeTech = String(userCouponRow.scope_tech || '').trim();
      const scopeCategory = String(userCouponRow.scope_category || '').trim();
      if (scopeTech || scopeCategory) {
        const mismatch = rows.find((p) =>
          (scopeTech && p.tech !== scopeTech) || (scopeCategory && p.category !== scopeCategory)
        );
        if (mismatch) throw fail(400, '优惠券不适用于所选商品');
      }
      if (subtotal < Number(userCouponRow.threshold)) {
        throw fail(400, `订单未满 ${userCouponRow.threshold} 元，无法使用该优惠券`);
      }
      if (userCouponRow.type === 'full') {
        discount = Math.min(Number(userCouponRow.amount), afterMember);
      } else if (userCouponRow.type === 'discount') {
        discount = Math.round(afterMember * (1 - Number(userCouponRow.amount)) * 100) / 100;
      } else {
        throw fail(400, '优惠券类型无效');
      }
      discount = Math.round(discount * 100) / 100;
    }
    const finalTotal = Math.max(0, Math.round((afterMember - discount) * 100) / 100);

    // 推荐人
    let referrerId = 0;
    const refCode = req.body.referrerCode;
    if (refCode) {
      const [ref] = await conn.query('SELECT id FROM users WHERE ref_code=?', [refCode]);
      if (ref.length && ref[0].id !== req.user.id) referrerId = ref[0].id;
    }

    let orderId;
    try {
      const [r] = await conn.query(
        'INSERT INTO orders (order_no, user_id, total_amount, discount_amount, status, remark, referrer_id) VALUES (?,?,?,?,?,?,?)',
        [orderNo, req.user.id, finalTotal, discount, 'pending', remarkStr, referrerId]
      );
      orderId = r.insertId;
    } catch (insertErr) {
      if (insertErr.code === 'ER_DUP_ENTRY' && insertErr.message.includes('order_no')) {
        orderNo = genOrderNo();
        const [r] = await conn.query(
          'INSERT INTO orders (order_no, user_id, total_amount, discount_amount, status, remark, referrer_id) VALUES (?,?,?,?,?,?,?)',
          [orderNo, req.user.id, finalTotal, discount, 'pending', remarkStr, referrerId]
        );
        orderId = r.insertId;
      } else {
        throw insertErr;
      }
    }
    for (const p of rows) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, product_title, price) VALUES (?,?,?,?)',
        [orderId, p.id, p.title, p.price]
      );
    }
    if (userCouponRow) {
      await conn.query(
        "UPDATE user_coupons SET status='used', used_order_id=? WHERE id=? AND status='unused'",
        [orderId, userCouponRow.id]
      );
    }
    await conn.commit();
    res.json({ orderId, orderNo, total: finalTotal, originalTotal: subtotal, memberDiscount: rate < 1, rate });
  } catch (e) {
    await conn.rollback();
    if (e.status) return res.status(e.status).json({ message: e.message });
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  } finally {
    conn.release();
  }
});

// 我的订单列表（支持状态筛选 + 分页）
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 10));
    const status = req.query.status;
    let where = 'user_id=?';
    const params = [req.user.id];
    if (status && status !== '全部') {
      where += ' AND status=?';
      params.push(status);
    }
    const [totalRows] = await pool.query(`SELECT COUNT(*) AS c FROM orders WHERE ${where}`, params);
    const [orders] = await pool.query(
      `SELECT * FROM orders WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    // 附带每个订单的商品明细 + 最近一条发货记录
    const orderIds = orders.map((o) => o.id);
    let items = [];
    let deliveries = [];
    if (orderIds.length) {
      const placeholders = orderIds.map(() => '?').join(',');
      [items] = await pool.query(
        `SELECT * FROM order_items WHERE order_id IN (${placeholders})`,
        orderIds
      );
      [deliveries] = await pool.query(
        `SELECT dl.* FROM delivery_logs dl
         JOIN (SELECT order_id, MAX(id) AS mid FROM delivery_logs WHERE order_id IN (${placeholders}) GROUP BY order_id) t
           ON dl.id=t.mid`,
        orderIds
      );
    }
    const byOrder = {};
    for (const it of items) {
      (byOrder[it.order_id] = byOrder[it.order_id] || []).push(it);
    }
    const byDelivery = {};
    for (const d of deliveries) byDelivery[d.order_id] = d;
    const shipSettings = await getShipSettings();
    res.json({
      list: orders.map((o) => ({ ...o, items: byOrder[o.id] || [], delivery: byDelivery[o.id] || null })),
      total: totalRows[0].c,
      page,
      pageSize,
      shipSettings
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 我的退款列表
router.get('/refunds', async (req, res) => {
  try {
    const [list] = await pool.query(
      `SELECT r.*, o.status AS order_status
       FROM refunds r LEFT JOIN orders o ON r.order_id=o.id
       WHERE r.user_id=? ORDER BY r.id DESC`,
      [req.user.id]
    );
    res.json({ list });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 订单详情
router.get('/:id', async (req, res) => {
  try {
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    );
    if (!orders.length) return res.status(404).json({ message: '订单不存在' });
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id=?', [orders[0].id]);
    const [deliveries] = await pool.query(
      'SELECT * FROM delivery_logs WHERE order_id=? ORDER BY id DESC LIMIT 5',
      [orders[0].id]
    );
    const shipSettings = await getShipSettings();
    res.json({ ...orders[0], items, deliveries, shipSettings });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 订单支付流水
router.get('/:id/payrecords', async (req, res) => {
  try {
    const [orders] = await pool.query(
      'SELECT id FROM orders WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    );
    if (!orders.length) return res.status(404).json({ message: '订单不存在' });
    const [list] = await pool.query(
      'SELECT id, channel, trade_no, amount, status, created_at FROM pay_records WHERE order_id=? ORDER BY id DESC',
      [req.params.id]
    );
    res.json({ list });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 支付订单
// body: { method: 'mock' | 'card' | 'alipay' | 'wechat', cardNo }
router.post('/:id/pay', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { method, cardNo } = req.body;
    const [orders] = await conn.query('SELECT * FROM orders WHERE id=? AND user_id=?', [
      req.params.id,
      req.user.id
    ]);
    if (!orders.length) throw fail(404, '订单不存在');
    const order = orders[0];
    if (order.status !== 'pending') throw fail(400, '订单状态不允许支付');

    const payEnabled = await getPayEnabled(conn);
    if (method === 'mock' && (process.env.PAY_MOCK_DISABLED === '1' || !payEnabled.mock)) {
      throw fail(400, '该支付方式已关闭');
    }
    if (method === 'card' && !payEnabled.card) throw fail(400, '该支付方式已关闭');
    if (method === 'alipay' && !payEnabled.alipay) throw fail(400, '该支付方式已关闭');
    if (method === 'wechat' && !payEnabled.wechat) throw fail(400, '该支付方式已关闭');

    let channel = 'mock';
    let tradeNo;
    const isQrPay = method === 'alipay' || method === 'wechat';
    if (method === 'card') {
      channel = 'card';
      if (!cardNo) throw fail(400, '请填写卡密');
      const [cards] = await conn.query(
        "SELECT * FROM cards WHERE card_no=? AND status='unused'",
        [cardNo]
      );
      if (!cards.length) throw fail(400, '卡密无效或已被使用');
      const card = cards[0];
      if (Number(card.amount) < Number(order.total_amount)) {
        throw fail(400, `卡密余额 ${card.amount} 元不足支付 ${order.total_amount} 元`);
      }
      await conn.query("UPDATE cards SET status='used', used_by=?, used_order=?, used_at=NOW() WHERE id=?",
        [req.user.id, order.order_no, card.id]);
      tradeNo = genTradeNo();
    } else if (method === 'mock') {
      try {
        const pay = await createPayment({
          channel: 'mock',
          orderNo: order.order_no,
          amount: order.total_amount,
          user: req.user
        });
        tradeNo = pay.tradeNo;
      } catch (err) {
        if (err.status === 400) throw fail(400, err.message);
        throw err;
      }
    } else if (isQrPay) {
      channel = method;
      const qrKey = method === 'alipay' ? 'alipay_qr' : 'wechat_qr';
      const [qrRows] = await conn.query('SELECT v FROM settings WHERE k=?', [qrKey]);
      if (!qrRows.length || !String(qrRows[0].v || '').trim()) {
        throw fail(400, method === 'alipay' ? '管理员尚未配置支付宝收款码' : '管理员尚未配置微信收款码');
      }
      const rand = Math.floor(Math.random() * 9000) + 1000;
      tradeNo = 'QR' + Date.now() + rand;
    } else {
      throw fail(400, '不支持的支付方式');
    }

    // 仅 pending→paid 时写入，保证销量累加幂等（重复支付请求不会再次累加）
    const [paidUpd] = await conn.query(
      "UPDATE orders SET status='paid', pay_method=?, paid_at=NOW() WHERE id=? AND status='pending'",
      [method, order.id]
    );
    if (!paidUpd.affectedRows) throw fail(400, '订单状态不允许支付');

    // 按订单项数量累加商品销量（order_items 无独立 quantity 字段，每行计 1）
    await conn.query(
      `UPDATE products p
       INNER JOIN (
         SELECT product_id, COUNT(*) AS qty
         FROM order_items WHERE order_id=?
         GROUP BY product_id
       ) t ON p.id = t.product_id
       SET p.sales = IFNULL(p.sales, 0) + t.qty`,
      [order.id]
    );

    await conn.query(
      'INSERT INTO pay_records (order_id, order_no, user_id, channel, trade_no, amount, status) VALUES (?,?,?,?,?,?,?)',
      [order.id, order.order_no, req.user.id, channel, tradeNo, order.total_amount, 'success']
    );

    // 扫码支付不自动发货，需客服人工核对收款；mock/card 若商品配有网盘链接则自动发货
    let autoShipped = false;
    if (!isQrPay) {
      const [items] = await conn.query(
        'SELECT oi.product_id, p.title, p.pan_link, p.pan_code FROM order_items oi JOIN products p ON oi.product_id=p.id WHERE oi.order_id=?',
        [order.id]
      );
      const deliverable = items.filter((it) => it.pan_link);
      if (deliverable.length) {
        const content = deliverable.map((it) =>
          `${it.title}：${it.pan_link}${it.pan_code ? '  提取码：' + it.pan_code : ''}`
        ).join('\n');
        await conn.query("UPDATE orders SET status='shipped', shipping_info=?, shipped_at=NOW() WHERE id=?",
          [content, order.id]);
        await conn.query(
          'INSERT INTO delivery_logs (order_id, order_no, user_id, method, content, operator) VALUES (?,?,?,?,?,?)',
          [order.id, order.order_no, req.user.id, 'auto', content, 'system']
        );
        autoShipped = true;
      }
    }

    // 推荐返佣（支付成功后写入）
    if (order.referrer_id) {
      const [ex] = await conn.query('SELECT id FROM commissions WHERE order_id=?', [order.id]);
      if (!ex.length) {
        const comm = Math.round(Number(order.total_amount) * 10) / 100; // 10% 返佣
        if (comm > 0) {
          await conn.query(
            'INSERT INTO commissions (order_id, referrer_id, buyer_id, amount, status) VALUES (?,?,?,?,?)',
            [order.id, order.referrer_id, req.user.id, comm, 'pending']
          );
        }
      }
    }

    await conn.commit();
    if (autoShipped) {
      notify(req.user.id, 'order', '订单已自动发货', `订单 ${order.order_no} 已自动发货，请到「我的订单」查看网盘链接与提取码。`);
    }
    const shipSettings = await getShipSettings();
    res.json({
      ok: true,
      autoShipped,
      message: isQrPay
        ? '支付信息已提交，请添加客服微信/QQ 发送订单号，客服核对收款后立即发货'
        : autoShipped
          ? '支付成功！源码已自动发货，请到「我的订单」查看网盘链接与提取码。'
          : '支付成功！请添加客服 QQ 发送订单号获取源码（手动发货）',
      orderNo: order.order_no,
      shipSettings
    });
  } catch (e) {
    await conn.rollback();
    if (e.status) return res.status(e.status).json({ message: e.message });
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  } finally {
    conn.release();
  }
});

// 申请退款
router.post('/:id/refund', async (req, res) => {
  try {
    const { reason, amount } = req.body;
    const refundAmount = parseFloat(amount);
    if (!reason || !String(reason).trim()) return res.status(400).json({ message: '请填写退款原因' });
    if (!refundAmount || refundAmount <= 0) return res.status(400).json({ message: '退款金额无效' });

    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    );
    if (!orders.length) return res.status(404).json({ message: '订单不存在' });
    const order = orders[0];
    if (!['paid', 'shipped'].includes(order.status)) {
      return res.status(400).json({ message: '当前订单状态不可申请退款' });
    }
    if (refundAmount > Number(order.total_amount)) {
      return res.status(400).json({ message: '退款金额不能超过订单金额' });
    }

    const [pending] = await pool.query(
      "SELECT id FROM refunds WHERE order_id=? AND status='pending'",
      [order.id]
    );
    if (pending.length) return res.status(400).json({ message: '该订单已有待处理的退款申请' });

    const [r] = await pool.query(
      'INSERT INTO refunds (order_id, order_no, user_id, reason, amount, status) VALUES (?,?,?,?,?,?)',
      [order.id, order.order_no, req.user.id, String(reason).slice(0, 500), refundAmount, 'pending']
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 确认收货
router.post('/:id/confirm', async (req, res) => {
  try {
    const [orders] = await pool.query(
      "SELECT id FROM orders WHERE id=? AND user_id=? AND status='shipped'",
      [req.params.id, req.user.id]
    );
    if (!orders.length) return res.status(400).json({ message: '订单状态不允许确认收货' });
    await pool.query("UPDATE orders SET status='completed' WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 取消订单
router.post('/:id/cancel', async (req, res) => {
  try {
    const [orders] = await pool.query(
      "SELECT id FROM orders WHERE id=? AND user_id=? AND status='pending'",
      [req.params.id, req.user.id]
    );
    if (!orders.length) return res.status(400).json({ message: '只能取消待支付订单' });
    await pool.query("UPDATE orders SET status='cancelled' WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

module.exports = router;
