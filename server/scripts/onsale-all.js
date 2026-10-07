'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

function dirSize(d) {
  if (!fs.existsSync(d)) return { n: 0, b: 0 };
  let n = 0;
  let b = 0;
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) {
      const s = dirSize(p);
      n += s.n;
      b += s.b;
    } else {
      n++;
      b += fs.statSync(p).size;
    }
  }
  return { n, b };
}

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  const [u] = await c.query('UPDATE products SET status=1 WHERE is_deleted=0 AND status=0');
  console.log('onsale_updated', u.affectedRows);
  const [r] = await c.query(
    "SELECT COUNT(*) AS n, SUM(status=1) AS on1, SUM(cover IS NOT NULL AND cover<>'') AS withCover FROM products WHERE is_deleted=0"
  );
  console.log(r[0]);
  await c.end();
  const s = dirSize(path.resolve(__dirname, '../uploads'));
  console.log('uploads_files', s.n, 'uploads_mb', Math.round(s.b / 1024 / 1024));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
