const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const auth = require('./routes/auth');
const products = require('./routes/products');
const orders = require('./routes/orders');
const cards = require('./routes/cards');
const admin = require('./routes/admin');
const settings = require('./routes/settings');
const favorites = require('./routes/favorites');
const reviews = require('./routes/reviews');
const notifications = require('./routes/notifications');
const services = require('./routes/services');
const coupons = require('./routes/coupons');
const notices = require('./routes/notices');
const seo = require('./routes/seo');
const proposal = require('./routes/proposal');
const opensource = require('./routes/opensource');
const articles = require('./routes/articles');
const cases = require('./routes/cases');
const visits = require('./routes/visits');
const rateLimit = require('./middleware/rateLimit');
const { visitLogMiddleware } = require('./middleware/visitLog');
const { logger, requestLogger } = require('./lib/logger');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);
app.use(express.urlencoded({ extended: true }));
app.use(visitLogMiddleware);

// 全站基础限流（宽松）
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 600, message: '请求过于频繁，请稍后再试' }));

// 登录/注册接口严格限流，防止暴力破解与刷号
app.use('/api/auth', rateLimit({ windowMs: 60 * 1000, max: 20, message: '操作过于频繁，请稍后再试' }));

// 开题生成较耗资源，单独收紧
app.use('/api/proposal', rateLimit({ windowMs: 60 * 1000, max: 30, message: '开题请求过于频繁，请稍后再试' }));

// 优化图自动接管：同 URL，优先返回 covers_opt / detail_opt / qr_opt
const uploadsRoot = path.resolve(__dirname, '../uploads');
const distDir = path.resolve(__dirname, '../../web/dist');
const OPT_KIND = {
  covers: { optDir: 'covers_opt', ext: '.jpg' },
  detail: { optDir: 'detail_opt', ext: '.jpg' },
  qr: { optDir: 'qr_opt', ext: '.png' }
};
const OPT_SAFE_RE = /^[A-Za-z0-9_\-./]+$/;

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const urlPath = req.path || '';
  if (!urlPath.startsWith('/uploads/')) return next();

  const m = urlPath.match(/^\/uploads\/(covers|detail|qr)\/(.+)$/);
  if (!m) return next();

  const kind = m[1];
  const rest = m[2];
  if (!OPT_SAFE_RE.test(rest) || rest.includes('..')) return next();

  const cfg = OPT_KIND[kind];
  const stem = rest.replace(/\.[^./]+$/, '');
  const optRel = stem + cfg.ext;
  const optFile = path.resolve(uploadsRoot, cfg.optDir, optRel);
  const relToRoot = path.relative(uploadsRoot, optFile);
  if (!relToRoot || relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) return next();

  if (!fs.existsSync(optFile)) return next();
  return res.sendFile(optFile, { maxAge: '7d' });
});

// 文本静态资源 gzip：zlib 预压缩 + 同目录 .gz 磁盘缓存（零依赖）
const GZIP_EXTS = new Set(['.js', '.mjs', '.css', '.html', '.svg', '.json', '.xml', '.txt', '.map']);
const UPLOADS_GZIP_EXTS = new Set(['.json', '.xml', '.txt']);
const GZIP_TYPES = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function isPathInside(rootDir, candidate) {
  const rel = path.relative(rootDir, candidate);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

app.use((req, res, next) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const accept = req.headers['accept-encoding'] || '';
    if (!String(accept).includes('gzip')) return next();

    let urlPath = req.path || '';
    try {
      urlPath = decodeURIComponent(urlPath);
    } catch {
      return next();
    }
    if (!urlPath || urlPath.includes('\0')) return next();

    let srcPath = null;
    let cacheControl = 'public, max-age=0';

    if (urlPath.startsWith('/uploads/')) {
      const ext = path.extname(urlPath).toLowerCase();
      if (!UPLOADS_GZIP_EXTS.has(ext)) return next();
      srcPath = path.resolve(uploadsRoot, urlPath.slice('/uploads/'.length));
      if (!isPathInside(uploadsRoot, srcPath)) return next();
      cacheControl = 'public, max-age=604800';
    } else if (urlPath.startsWith('/api')) {
      return next();
    } else {
      if (!fs.existsSync(distDir)) return next();
      const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
      if (!rel || rel.includes('..')) return next();
      srcPath = path.resolve(distDir, rel);
      if (!isPathInside(distDir, srcPath)) return next();
      const ext = path.extname(srcPath).toLowerCase();
      if (!GZIP_EXTS.has(ext)) return next();
      if (urlPath.startsWith('/assets/')) {
        cacheControl = 'public, max-age=31536000, immutable';
      }
    }

    const ext = path.extname(srcPath).toLowerCase();
    if (!GZIP_EXTS.has(ext)) return next();
    if (!fs.existsSync(srcPath)) return next();
    const srcStat = fs.statSync(srcPath);
    if (!srcStat.isFile()) return next();

    const gzPath = srcPath + '.gz';
    let body = null;
    if (fs.existsSync(gzPath)) {
      const gzStat = fs.statSync(gzPath);
      if (gzStat.mtimeMs >= srcStat.mtimeMs) {
        body = fs.readFileSync(gzPath);
      }
    }
    if (!body) {
      const compressed = zlib.gzipSync(fs.readFileSync(srcPath));
      try {
        fs.writeFileSync(gzPath, compressed);
      } catch {
        // 写盘失败则跳过缓存，仍发送压缩内容
      }
      body = compressed;
    }

    res.setHeader('Content-Type', GZIP_TYPES[ext] || 'application/octet-stream');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Content-Length', body.length);
    if (req.method === 'HEAD') return res.end();
    return res.end(body);
  } catch {
    return next();
  }
});

// 静态上传（封面等）— 原图回退；图片基本不变，7 天缓存
app.use('/uploads', express.static(uploadsRoot, { maxAge: '7d' }));

app.use('/api/auth', auth);
app.use('/api/products', products);
app.use('/api/orders', orders);
app.use('/api/cards', cards);
app.use('/api/settings', settings);
app.use('/api/favorites', favorites);
app.use('/api/reviews', reviews);
app.use('/api/notifications', notifications);
app.use('/api/services', services);
app.use('/api/coupons', coupons);
app.use('/api/notices', notices);
app.use('/api/proposal', proposal);
app.use('/api/opensource', opensource);
app.use('/api/articles', articles);
app.use('/api/admin/articles', articles.adminRouter);
app.use('/api/cases', cases);
app.use('/api/admin/cases', cases.adminRouter);
app.use('/api/visits', visits);
app.use('/api/admin', admin);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// /api 下未匹配路径统一返回 JSON 404（避免落到 SPA 回退返回 HTML）
app.use('/api', (req, res) => res.status(404).json({ message: '接口不存在' }));

app.use(seo);

// 生产模式：托管前端构建产物
if (fs.existsSync(distDir)) {
  // Vite 带 hash 的 /assets/*：长缓存 + immutable
  app.use(
    '/assets',
    express.static(path.join(distDir, 'assets'), { maxAge: '365d', immutable: true })
  );
  // 自托管字体（文件名固定、内容不变）：30 天缓存，避免每次访问回源校验
  app.use(
    '/fonts',
    express.static(path.join(distDir, 'fonts'), { maxAge: '30d', immutable: true })
  );
  // index.html 等其余产物：短缓存，避免发版后拿不到新页面
  app.use(express.static(distDir, { maxAge: 0 }));
  // SPA 路由回退（除 /api 和 /uploads 外）
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=0');
    res.sendFile(path.join(distDir, 'index.html'));
  });
  logger.info('前端静态资源已托管: web/dist');
}

// 统一错误处理
app.use((err, req, res, next) => {
  logger.error(err.stack || err.message);
  res.status(500).json({ message: '服务器内部错误，请稍后再试' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`API 服务已启动: http://localhost:${PORT}`);
});
