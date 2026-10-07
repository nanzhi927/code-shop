const express = require('express');
const pool = require('../db');
const { logger } = require('../lib/logger');

const router = express.Router();

// 站点根地址：优先取环境变量 SITE_URL；
// 否则按请求头推导（Nginx 反代会带 Host / X-Forwarded-*），
// 保证 sitemap.xml 与 robots.txt 里输出的是真实对外地址，
// 而不是写死的 localhost。
const FALLBACK_BASE = 'http://62.234.122.127:40621';

function firstHeader(req, name) {
  const v = req.get(name);
  return v ? String(v).split(',')[0].trim() : '';
}

function siteBase(req) {
  const env = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (env) return env;

  const proto = firstHeader(req, 'x-forwarded-proto') || req.protocol || 'http';
  const host = firstHeader(req, 'x-forwarded-host') || firstHeader(req, 'host');
  if (host) return `${proto}://${host}`;

  return FALLBACK_BASE;
}

router.get('/sitemap.xml', async (req, res) => {
  try {
    const base = siteBase(req);
    const today = new Date().toISOString().slice(0, 10);

    const [products] = await pool.query(
      'SELECT id, product_no, title, created_at FROM products WHERE status=1 AND is_deleted=0 LIMIT 5000'
    );
    const [articles] = await pool.query(
      'SELECT slug, updated_at FROM articles WHERE status=1 LIMIT 5000'
    );

    const staticPages = [
      { path: '/', priority: '1.0', changefreq: 'daily' },
      { path: '/products', priority: '0.9', changefreq: 'daily' },
      { path: '/articles', priority: '0.8', changefreq: 'weekly' },
      { path: '/opensource', priority: '0.9', changefreq: 'weekly' },
      { path: '/services', priority: '0.7', changefreq: 'weekly' },
      { path: '/coupons', priority: '0.6', changefreq: 'weekly' }
    ];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const p of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${base}${p.path === '/' ? '' : p.path}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${p.changefreq}</changefreq>\n`;
      xml += `    <priority>${p.priority}</priority>\n`;
      xml += '  </url>\n';
    }

    for (const p of products) {
      const lastmod = p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : today;
      xml += '  <url>\n';
      xml += `    <loc>${base}/products/${p.id}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    }

    for (const a of articles) {
      const lastmod = a.updated_at ? new Date(a.updated_at).toISOString().slice(0, 10) : today;
      xml += '  <url>\n';
      xml += `    <loc>${base}/articles/${a.slug}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.7</priority>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';
    res.type('application/xml').send(xml);
  } catch (e) {
    logger.error(e.stack || e.message);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/robots.txt', (req, res) => {
  const base = siteBase(req);
  const text = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api',
    '',
    `Sitemap: ${base}/sitemap.xml`
  ].join('\n');
  res.type('text/plain').send(text);
});

module.exports = router;
