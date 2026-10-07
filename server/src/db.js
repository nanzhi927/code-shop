const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'code_shop',
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  enableKeepAlive: true,
  charset: 'utf8mb4',
  decimalNumbers: true
});

// 归还连接前复位事务，防止脏连接残留未提交事务导致 Lock wait timeout
const _getConnection = pool.getConnection.bind(pool);
pool.getConnection = async function getConnectionSafe() {
  const conn = await _getConnection();
  try {
    await conn.rollback();
  } catch {
    // ignore
  }
  return conn;
};

module.exports = pool;

const SLOW_MS = Number(process.env.SLOW_QUERY_MS) || 0;
if (SLOW_MS > 0) {
  const { logger } = require('../lib/logger');
  const orig = pool.query.bind(pool);
  pool.query = async (...a) => {
    const t = Date.now();
    try { return await orig(...a); }
    finally {
      const ms = Date.now() - t;
      if (ms > SLOW_MS) logger.warn('slow query ' + ms + 'ms: ' + String(a[0]).slice(0, 200));
    }
  };
}
