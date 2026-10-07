/**
 * 数据库初始化：
 *  - 创建 code_shop 库
 *  - 建表
 *  - 从 data/products.json 导入商品（幂等：已有数据则跳过）
 *  - 创建默认管理员 admin / admin123
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT, 10) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'code_shop';

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(64) DEFAULT '',
  role ENUM('user','admin','superadmin','ops') DEFAULT 'user',
  is_disabled TINYINT(1) DEFAULT 0,
  proposal_credits INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_no VARCHAR(32) DEFAULT '',
  title VARCHAR(255) NOT NULL,
  tech VARCHAR(32) DEFAULT '',
  type ENUM('folder','archive') DEFAULT 'folder',
  size_mb INT DEFAULT 0,
  has_paper TINYINT(1) DEFAULT 0,
  has_ppt TINYINT(1) DEFAULT 0,
  has_video TINYINT(1) DEFAULT 0,
  has_db TINYINT(1) DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 99.00,
  original_price DECIMAL(10,2) DEFAULT 199.00,
  status TINYINT(1) DEFAULT 1,
  is_deleted TINYINT(1) DEFAULT 0,
  cover VARCHAR(255) DEFAULT '',
  details TEXT,
  description TEXT,
  source_path VARCHAR(500) DEFAULT '',
  keywords VARCHAR(500) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tech (tech),
  INDEX idx_status (status),
  INDEX idx_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  total_amount DECIMAL(10,2) DEFAULT 0,
  status ENUM('pending','paid','shipped','completed','cancelled') DEFAULT 'pending',
  pay_method VARCHAR(16) DEFAULT '',
  shipping_info VARCHAR(1000) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  shipped_at DATETIME NULL,
  INDEX idx_user (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  product_title VARCHAR(255) DEFAULT '',
  price DECIMAL(10,2) DEFAULT 0,
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_no VARCHAR(32) NOT NULL UNIQUE,
  amount DECIMAL(10,2) DEFAULT 0,
  status ENUM('unused','used') DEFAULT 'unused',
  used_by INT NULL,
  used_order VARCHAR(32) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME NULL,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_product (user_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(64) PRIMARY KEY,
  v VARCHAR(1000) DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  kind VARCHAR(16) DEFAULT 'source',
  name VARCHAR(255) NOT NULL,
  path VARCHAR(500) DEFAULT '',
  size_mb INT DEFAULT 0,
  ext VARCHAR(16) DEFAULT '',
  sort INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS delivery_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  order_no VARCHAR(32) DEFAULT '',
  user_id INT DEFAULT 0,
  method VARCHAR(32) DEFAULT 'qq',
  content VARCHAR(2000) DEFAULT '',
  operator VARCHAR(64) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT DEFAULT 0,
  admin_name VARCHAR(64) DEFAULT '',
  action VARCHAR(64) DEFAULT '',
  target VARCHAR(255) DEFAULT '',
  detail VARCHAR(2000) DEFAULT '',
  ip VARCHAR(64) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin (admin_id),
  INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS search_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT 0,
  keyword VARCHAR(100) DEFAULT '',
  result_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_keyword (keyword),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hot_words (
  id INT AUTO_INCREMENT PRIMARY KEY,
  word VARCHAR(100) NOT NULL UNIQUE,
  weight INT DEFAULT 0,
  type ENUM('manual','auto') DEFAULT 'auto',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT NOT NULL,
  order_id INT DEFAULT 0,
  rating TINYINT DEFAULT 5,
  content VARCHAR(1000) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product (product_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS custom_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(32) DEFAULT '',
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  tech VARCHAR(64) DEFAULT '',
  budget DECIMAL(10,2) DEFAULT 0,
  deadline VARCHAR(32) DEFAULT '',
  quote_price DECIMAL(10,2) DEFAULT 0,
  status ENUM('pending_quote','quoted','accepted','in_progress','delivered','completed','cancelled') DEFAULT 'pending_quote',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id), INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS custom_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  user_id INT DEFAULT 0,
  from_role ENUM('user','admin') DEFAULT 'user',
  content VARCHAR(2000) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT DEFAULT 0,
  name VARCHAR(255) DEFAULT '',
  url VARCHAR(500) DEFAULT '',
  size_mb INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_memberships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan VARCHAR(32) NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  status ENUM('active','expired') DEFAULT 'active',
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS commissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  referrer_id INT NOT NULL,
  buyer_id INT NOT NULL,
  amount DECIMAL(10,2) DEFAULT 0,
  status ENUM('pending','settled') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_referrer (referrer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS enterprise_leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org VARCHAR(128) DEFAULT '',
  contact VARCHAR(128) DEFAULT '',
  need TEXT,
  scale VARCHAR(64) DEFAULT '',
  status VARCHAR(16) DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pay_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  order_no VARCHAR(32) DEFAULT '',
  user_id INT NOT NULL,
  channel VARCHAR(16) DEFAULT 'mock',
  trade_no VARCHAR(64) DEFAULT '',
  amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(16) DEFAULT 'success',
  raw_callback TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  order_no VARCHAR(32) DEFAULT '',
  user_id INT NOT NULL,
  reason VARCHAR(500) DEFAULT '',
  amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(16) DEFAULT 'pending',
  admin_note VARCHAR(500) DEFAULT '',
  operator VARCHAR(32) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  handled_at DATETIME NULL,
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(64) DEFAULT '',
  type VARCHAR(16) DEFAULT 'full',
  amount DECIMAL(10,2) DEFAULT 0,
  threshold DECIMAL(10,2) DEFAULT 0,
  stock INT DEFAULT 0,
  per_user INT DEFAULT 1,
  expires_at DATETIME NULL,
  enabled TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coupon_id INT NOT NULL,
  user_id INT NOT NULL,
  status VARCHAR(16) DEFAULT 'unused',
  used_order_id INT DEFAULT 0,
  claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  enabled TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS articles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  summary VARCHAR(500) DEFAULT '',
  content MEDIUMTEXT,
  category VARCHAR(32) DEFAULT '',
  tags VARCHAR(200) DEFAULT '',
  cover VARCHAR(255) DEFAULT '',
  status TINYINT DEFAULT 0,
  views INT DEFAULT 0,
  sort_weight INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_category (category),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  summary VARCHAR(500) DEFAULT '',
  cover VARCHAR(255) DEFAULT '',
  content_md MEDIUMTEXT,
  client_scene VARCHAR(500) DEFAULT '',
  service_type VARCHAR(16) DEFAULT 'custom',
  tech VARCHAR(64) DEFAULT '',
  domain VARCHAR(64) DEFAULT '',
  duration_label VARCHAR(64) DEFAULT '',
  scope_out VARCHAR(500) DEFAULT '',
  result_points_json TEXT,
  deliverables_json TEXT,
  gallery_json MEDIUMTEXT,
  related_product_ids VARCHAR(200) DEFAULT '',
  related_service_slugs VARCHAR(200) DEFAULT '',
  status TINYINT DEFAULT 0,
  views INT DEFAULT 0,
  sort_weight INT DEFAULT 0,
  published_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_service (service_type),
  INDEX idx_tech (tech),
  INDEX idx_sort (sort_weight, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(32) DEFAULT 'system',
  title VARCHAR(200) DEFAULT '',
  content VARCHAR(1000) DEFAULT '',
  is_read TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS proposal_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_no VARCHAR(32) NOT NULL,
  user_id INT DEFAULT 0,
  guest_key VARCHAR(64) DEFAULT '',
  mode VARCHAR(16) DEFAULT 'qa',
  status VARCHAR(16) DEFAULT 'draft',
  profile_json MEDIUMTEXT,
  outline_json MEDIUMTEXT,
  content_md MEDIUMTEXT,
  error_message VARCHAR(500) DEFAULT '',
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  provider VARCHAR(32) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_session_no (session_no),
  INDEX idx_user (user_id),
  INDEX idx_guest (guest_key),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS proposal_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  day CHAR(10) NOT NULL,
  subject_type VARCHAR(16) NOT NULL,
  subject_key VARCHAR(64) NOT NULL,
  count INT DEFAULT 0,
  UNIQUE KEY uk_day_subject (day, subject_type, subject_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS visit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(64) DEFAULT '',
  path VARCHAR(255) DEFAULT '',
  referrer VARCHAR(255) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_source (source),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function main() {
  // 1. 连接（不指定库）
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD
  });
  console.log('[1] 已连接 MySQL');

  await conn.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE ${DB_NAME}`);
  console.log('[2] 数据库就绪: ' + DB_NAME);

  const statements = CREATE_TABLES.split(';').map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await conn.query(stmt);
  }
  console.log('[3] 数据表就绪');

  // 3.1 幂等迁移：为旧库补充新增列
  await ensureColumn(conn, 'users', 'is_disabled', "TINYINT(1) DEFAULT 0");
  await ensureColumn(conn, 'users', 'proposal_credits', 'INT DEFAULT 0');
  await ensureColumn(conn, 'products', 'is_deleted', "TINYINT(1) DEFAULT 0");
  await ensureColumn(conn, 'products', 'details', 'TEXT');
  await ensureColumn(conn, 'products', 'kind', "VARCHAR(16) DEFAULT 'code'");
  await ensureColumn(conn, 'products', 'category', "VARCHAR(32) DEFAULT ''");
  await ensureColumn(conn, 'products', 'run_status', 'TINYINT DEFAULT 0');
  await ensureColumn(conn, 'products', 'run_env', "VARCHAR(500) DEFAULT ''");
  await ensureColumn(conn, 'products', 'demo_url', "VARCHAR(500) DEFAULT ''");
  await ensureColumn(conn, 'products', 'video_url', "VARCHAR(500) DEFAULT ''");
  await ensureColumn(conn, 'products', 'sales', 'INT DEFAULT 0');
  await ensureColumn(conn, 'products', 'views', 'INT DEFAULT 0');
  await ensureColumn(conn, 'products', 'sort_weight', 'INT DEFAULT 0');
  await ensureColumn(conn, 'products', 'qa_note', "VARCHAR(1000) DEFAULT ''");
  await ensureColumn(conn, 'products', 'verified_at', 'DATETIME NULL');
  await ensureColumn(conn, 'products', 'pan_link', "VARCHAR(500) DEFAULT ''");
  await ensureColumn(conn, 'products', 'pan_code', "VARCHAR(64) DEFAULT ''");
  await ensureColumn(conn, 'products', 'meta_title', "VARCHAR(255) DEFAULT ''");
  await ensureColumn(conn, 'products', 'meta_keywords', "VARCHAR(500) DEFAULT ''");
  await ensureColumn(conn, 'products', 'meta_description', "VARCHAR(1000) DEFAULT ''");
  await ensureColumn(conn, 'products', 'pinyin', "VARCHAR(800) DEFAULT ''");
  await ensureColumn(conn, 'products', 'pinyin_init', "VARCHAR(200) DEFAULT ''");
  await ensureColumn(conn, 'orders', 'remark', "VARCHAR(500) DEFAULT ''");
  await ensureColumn(conn, 'orders', 'referrer_id', 'INT DEFAULT 0');
  await ensureColumn(conn, 'orders', 'refunded_at', 'DATETIME NULL');
  await ensureColumn(conn, 'orders', 'discount_amount', 'DECIMAL(10,2) DEFAULT 0');
  await ensureColumn(conn, 'users', 'ref_code', "VARCHAR(32) DEFAULT ''");
  await ensureOrderStatusEnum(conn);
  await ensureUserRoleEnum(conn);
  await ensureColumn(conn, 'coupons', 'scope_tech', "VARCHAR(64) DEFAULT ''");
  await ensureColumn(conn, 'coupons', 'scope_category', "VARCHAR(64) DEFAULT ''");
  console.log('[3.1] 迁移检查完成');

  // 3.2 默认系统设置（客服 / 发货说明 / Banner）
  const DEFAULT_SETTINGS = {
    service_qq: '',
    service_wechat: '',
    service_wechat_qr: '',
    service_qq_qr: '',
    service_notice: '购买后请添加客服 QQ / 微信，发送订单号即可获取源码下载方式。',
    ship_notice: '支付成功后请添加客服 QQ 并发送订单号，客服核实后立即发货（手动发货）。',
    banner_text: '海量毕业设计源码',
    banner_sub: 'SpringBoot / SSM / JSP+Servlet 全栈源码，含论文、PPT、数据库脚本',
    banner_badge: '{n}+ 套毕设源码 · 即买即用',
    banner_title: '海量毕业设计源码',
    banner_title_hl: '毕业设计',
    banner_title2: '一站即买即用',
    banner_search_ph: '搜索你要的源码，如：图书管理、商城、预约',
    banner_stat4_num: '100%',
    banner_stat4_label: '已验证可运行',
    proposal_enabled: '1',
    proposal_register_gift: '1',
    proposal_disclaimer: '本助手生成内容仅供学习参考，请遵守学校学术规范，严禁直接用于学术不端。请自行核对事实与参考文献。'
  };
  let seeded = 0;
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    const [r] = await conn.query('SELECT COUNT(*) AS c FROM settings WHERE k=?', [k]);
    if (r[0].c === 0) {
      await conn.query('INSERT INTO settings (k, v) VALUES (?,?)', [k, v]);
      seeded++;
    }
  }
  if (seeded) console.log(`[3.2] 已写入默认设置 ${seeded} 项`);

  // 3.3 搜索全文索引（ngram 中文分词，幂等）
  const [ft] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME='products' AND INDEX_NAME='ft_search'`,
    [DB_NAME]
  );
  if (ft[0].c === 0) {
    await conn.query(
      'ALTER TABLE products ADD FULLTEXT INDEX ft_search (title, keywords, description, category) WITH PARSER ngram'
    );
    console.log('[3.3] 已创建搜索全文索引 ft_search (ngram)');
  } else {
    console.log('[3.3] 搜索全文索引已存在');
  }

  // 3.4 文章全文索引（ngram，与 products 一致）
  const [ftArt] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME='articles' AND INDEX_NAME='ft_articles'`,
    [DB_NAME]
  );
  if (ftArt[0].c === 0) {
    await conn.query(
      'ALTER TABLE articles ADD FULLTEXT INDEX ft_articles (title, summary, tags, category) WITH PARSER ngram'
    );
    console.log('[3.4] 已创建文章全文索引 ft_articles (ngram)');
  } else {
    console.log('[3.4] 文章全文索引已存在');
  }

  // 2. 导入商品
  const [rows] = await conn.query('SELECT COUNT(*) AS c FROM products');
  if (rows[0].c > 0) {
    console.log('[4] products 已有数据，跳过导入 (' + rows[0].c + ' 条)');
  } else {
    const jsonPath = path.resolve(__dirname, '../../data/products.json');
    if (!fs.existsSync(jsonPath)) {
      console.warn('[4] 未找到 products.json，跳过商品导入');
    } else {
      const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const batch = [];
      for (const p of products) {
        batch.push([
          String(p.no ?? ''),
          p.title || p.name || '',
          p.tech || '',
          p.type || 'folder',
          p.sizeMB || 0,
          p.hasPaper ? 1 : 0,
          p.hasPpt ? 1 : 0,
          p.hasVideo ? 1 : 0,
          p.hasDb ? 1 : 0,
          '99.00',
          '199.00',
          1,
          '',
          p.title || '',
          p.sourcePath || '',
          p.keywords || ''
        ]);
      }
      const sql = `INSERT INTO products
        (product_no, title, tech, type, size_mb, has_paper, has_ppt, has_video, has_db,
         price, original_price, status, cover, description, source_path, keywords)
        VALUES ?`;
      // 分批插入，避免单条过长
      for (let i = 0; i < batch.length; i += 200) {
        await conn.query(sql, [batch.slice(i, i + 200)]);
      }
      console.log(`[4] 导入商品 ${batch.length} 条`);
    }
  }

  // 3. 默认管理员（超管）
  const [admins] = await conn.query("SELECT COUNT(*) AS c FROM users WHERE role IN ('admin','superadmin')");
  if (admins[0].c === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await conn.query('INSERT INTO users (username, password_hash, nickname, role) VALUES (?,?,?,?)',
      ['admin', hash, '管理员', 'superadmin']);
    console.log('[5] 创建默认管理员 admin / admin123（superadmin）');
  } else {
    console.log('[5] 管理员已存在，跳过');
  }

  await conn.end();
  console.log('\n初始化完成 ✔');
  console.log('启动后端: cd server && npm start');
}

main().catch((e) => {
  console.error('初始化失败:', e.message);
  process.exit(1);
});

// 幂等添加列（列不存在时）
async function ensureColumn(conn, table, column, ddl) {
  const [cols] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [DB_NAME, table, column]
  );
  if (cols[0].c === 0) {
    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    console.log(`  迁移: ${table}.${column} 已添加`);
  }
}

// 幂等扩展 users.role ENUM（补充 superadmin / ops）
async function ensureUserRoleEnum(conn) {
  const [cols] = await conn.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' AND COLUMN_NAME='role'`,
    [DB_NAME]
  );
  if (!cols.length) return;
  const ct = cols[0].COLUMN_TYPE;
  if (!ct.includes("'superadmin'") || !ct.includes("'ops'")) {
    await conn.query(
      "ALTER TABLE users MODIFY COLUMN role ENUM('user','admin','superadmin','ops') DEFAULT 'user'"
    );
    console.log('  迁移: users.role 已补充 superadmin / ops');
  }
}

// 幂等扩展 orders.status ENUM（补充 refunded）
async function ensureOrderStatusEnum(conn) {
  const [cols] = await conn.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='orders' AND COLUMN_NAME='status'`,
    [DB_NAME]
  );
  if (!cols.length) return;
  if (!cols[0].COLUMN_TYPE.includes("'refunded'")) {
    await conn.query(
      "ALTER TABLE orders MODIFY COLUMN status ENUM('pending','paid','shipped','completed','cancelled','refunded') DEFAULT 'pending'"
    );
    console.log('  迁移: orders.status 已补充 refunded');
  }
}
