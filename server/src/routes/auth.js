const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { sign, authRequired } = require('../middleware/auth');
const { logger } = require('../lib/logger');

const router = express.Router();

const PHONE_RE = /^1[3-9]\d{9}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

async function ensureProposalCreditsColumn() {
  const [cols] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='proposal_credits'`
  );
  if (!cols[0].c) {
    await pool.query('ALTER TABLE users ADD COLUMN proposal_credits INT DEFAULT 0');
  }
}

async function getRegisterGift() {
  const [rows] = await pool.query("SELECT v FROM settings WHERE k='proposal_register_gift'");
  const n = parseInt(rows[0]?.v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

function maskPhone(phone) {
  const p = String(phone || '');
  if (p.length === 11) return `${p.slice(0, 3)}****${p.slice(7)}`;
  return p;
}

// 注册（普通用户仅支持手机号）
router.post('/register', async (req, res) => {
  try {
    await ensureProposalCreditsColumn();
    const phone = String(req.body.phone || req.body.username || '').trim();
    const { password, nickname } = req.body;
    if (!phone || !password) return res.status(400).json({ message: '手机号和密码必填' });
    if (!PHONE_RE.test(phone)) {
      return res.status(400).json({ message: '请输入正确的 11 位手机号' });
    }
    if (!PASSWORD_RE.test(password)) {
      return res.status(400).json({ message: '密码至少 6 位且需同时包含字母和数字' });
    }
    const [exists] = await pool.query('SELECT id FROM users WHERE username=?', [phone]);
    if (exists.length) return res.status(400).json({ message: '该手机号已注册' });

    const gift = await getRegisterGift();
    const nick = String(nickname || '').trim() || maskPhone(phone);
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query(
      'INSERT INTO users (username, password_hash, nickname, role, proposal_credits) VALUES (?,?,?,?,?)',
      [phone, hash, nick, 'user', gift]
    );
    const user = { id: r.insertId, username: phone, nickname: nick, role: 'user', proposal_credits: gift };
    res.json({
      token: sign(user),
      user,
      proposal_gift: gift,
      message: gift > 0 ? `注册成功，已赠送 ${gift} 次免费开题` : '注册成功'
    });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 登录（普通用户用手机号；管理员等存量账号仍可用原用户名）
router.post('/login', async (req, res) => {
  try {
    const account = String(req.body.username || req.body.phone || '').trim();
    const { password } = req.body;
    if (!account || !password) return res.status(400).json({ message: '账号和密码必填' });
    const [rows] = await pool.query('SELECT * FROM users WHERE username=?', [account]);
    if (!rows.length) return res.status(400).json({ message: '账号或密码错误' });
    if (rows[0].is_disabled) return res.status(403).json({ message: '账号已被禁用，请联系管理员' });
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(400).json({ message: '账号或密码错误' });
    const user = {
      id: rows[0].id,
      username: rows[0].username,
      nickname: rows[0].nickname,
      role: rows[0].role,
      proposal_credits: rows[0].proposal_credits ?? 0
    };
    res.json({ token: sign(user), user });
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

// 当前用户
router.get('/me', authRequired, async (req, res) => {
  try {
    await ensureProposalCreditsColumn();
    const [rows] = await pool.query(
      'SELECT id, username, nickname, role, proposal_credits, created_at FROM users WHERE id=?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: '用户不存在' });
    res.json(rows[0]);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).json({ message: '服务器内部错误，请稍后再试' });
  }
});

module.exports = router;
