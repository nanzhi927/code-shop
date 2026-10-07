const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'code-shop-secret-2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

function sign(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function authRequired(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: '请先登录' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ message: '登录已过期，请重新登录' });
  }
}

/** 有 token 则解析，无效/缺失则当游客继续 */
function optionalAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return next();
  try {
    req.user = jwt.verify(token, SECRET);
  } catch {
    /* ignore */
  }
  next();
}

const ADMIN_ROLES = ['admin', 'superadmin', 'ops'];

function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (!isAdminRole(req.user.role)) return res.status(403).json({ message: '无权限' });
    next();
  });
}

function superadminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ message: '仅超级管理员可操作' });
    next();
  });
}

module.exports = { sign, authRequired, optionalAuth, adminRequired, superadminRequired, ADMIN_ROLES, isAdminRole, SECRET };
