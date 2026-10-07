const express = require('express');
const pool = require('../db');
const rateLimit = require('../middleware/rateLimit');
const { resolveSourceFromReferrer } = require('../lib/visitSource');

const router = express.Router();

/** source+path 内存限频：同一路径 1 次/分钟 */
const rateMap = new Map();
const RATE_MS = 60 * 1000;

function pruneRate() {
  const now = Date.now();
  if (rateMap.size < 800) return;
  for (const [k, t] of rateMap) {
    if (now - t > RATE_MS) rateMap.delete(k);
  }
}

function normalizePath(raw) {
  let p = String(raw || '/').split('?')[0].trim() || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.startsWith('/api') || p.startsWith('/admin') || p.startsWith('/uploads')) return null;
  if (/\.(js|css|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot)$/i.test(p)) return null;
  return p.slice(0, 255);
}

// SPA 前台埋点：页面路由变化时上报（Vite 开发态也会生效）
router.post(
  '/',
  rateLimit({ windowMs: 60 * 1000, max: 120, message: '访问上报过于频繁' }),
  async (req, res) => {
    try {
      const pathStr = normalizePath(req.body?.path);
      if (!pathStr) return res.json({ ok: true, skipped: true });

      const referrer = String(req.body?.referrer || req.headers.referer || '').slice(0, 255);
      const source = resolveSourceFromReferrer(referrer, req.body?.source);

      const rateKey = `${source}|${pathStr}|${req.ip || ''}`;
      const now = Date.now();
      const last = rateMap.get(rateKey) || 0;
      if (now - last < RATE_MS) return res.json({ ok: true, throttled: true });
      rateMap.set(rateKey, now);
      pruneRate();

      await pool.query(
        'INSERT INTO visit_logs (source, path, referrer) VALUES (?,?,?)',
        [source, pathStr, referrer]
      );
      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  }
);

module.exports = router;
