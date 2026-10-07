const pool = require('../db');
const { logger } = require('../lib/logger');
const { resolveSourceFromReferrer } = require('../lib/visitSource');

const STATIC_EXT = /\.(js|css|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp4|webm|json|xml|txt|pdf|zip)$/i;

/** source+path 内存限频：1 次/分钟 */
const rateMap = new Map();
const RATE_MS = 60 * 1000;

function pruneRate() {
  const now = Date.now();
  if (rateMap.size < 500) return;
  for (const [k, t] of rateMap) {
    if (now - t > RATE_MS) rateMap.delete(k);
  }
}

function resolveSource(req) {
  return resolveSourceFromReferrer(
    req.headers.referer || req.headers.referrer,
    req.query.utm_source
  );
}

function pagePath(req) {
  const raw = String(req.originalUrl || req.url || req.path || '/').split('?')[0];
  return (raw || '/').slice(0, 255);
}

function shouldSkip(req, pathStr) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return true;
  const p = pathStr || pagePath(req);
  // SPA 路由改由前台 /api/visits 上报；中间件仅兜底直链 HTML（非 index 回退）
  if (p.startsWith('/api') || p.startsWith('/uploads') || p.startsWith('/admin')) return true;
  if (STATIC_EXT.test(p)) return true;
  // Express 托管 dist 时几乎所有路径都回 index.html，避免与前台埋点双计
  if (req.headers.accept && String(req.headers.accept).includes('text/html')) return true;
  return true;
}

function visitLogMiddleware(req, res, next) {
  const pathStr = pagePath(req);
  const skip = shouldSkip(req, pathStr);
  let source = '';
  let referrer = '';
  if (!skip) {
    source = resolveSource(req);
    referrer = String(req.headers.referer || req.headers.referrer || '').slice(0, 255);
  }

  next();

  if (skip) return;

  try {
    const rateKey = `${source}|${pathStr}`;
    const now = Date.now();
    const last = rateMap.get(rateKey) || 0;
    if (now - last < RATE_MS) return;
    rateMap.set(rateKey, now);
    pruneRate();

    setImmediate(() => {
      pool
        .query('INSERT INTO visit_logs (source, path, referrer) VALUES (?,?,?)', [source, pathStr, referrer])
        .catch(() => {});
    });
  } catch (e) {
    logger.error(e.stack || e.message);
  }
}

module.exports = { visitLogMiddleware, resolveSource };
