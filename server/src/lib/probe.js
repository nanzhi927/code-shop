'use strict';
/**
 * 源码目录探测模块（供 sync-products.js / gen-covers.js 共用）
 *  - collectImages:  收集目录下可用截图
 *  - probeFeatures:  探测功能模块（Controller / JSP / HTML 文件名）
 *  - probeTechPoints: 探测技术点（框架 / 配置文件）
 *  - probeDbTables:   读取 .sql 提取数据表名
 *  - buildDescription: 基于探测结果生成项目简介
 */
const fs = require('fs');
const path = require('path');

const IMG_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;
const PRIORITY = [
  /^主(页|界面|页面)/i, /^首页/i, /^登录/i, /^index/i, /^login/i,
  /^系统/, /^运行截图/, /^界面/, /^项目截图/, /^截图/
];
const DIR_HINTS = ['运行截图', '项目截图', '截图', '图片', '演示视频', '界面'];

// 收集目录下的候选图片（限制深度）
function collectImages(dir, nameHint) {
  const out = [];
  const stack = [{ d: dir, depth: 0 }];
  while (stack.length) {
    const { d, depth } = stack.pop();
    if (depth > 3) continue;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (DIR_HINTS.some((h) => e.name.includes(h)) || depth < 2) {
          stack.push({ d: full, depth: depth + 1 });
        }
      } else if (IMG_RE.test(e.name)) {
        out.push({ path: full, name: e.name, dirName: path.basename(d), dirDepth: depth });
      }
    }
  }
  if (nameHint) out.sort((a, b) => scoreImg(b, nameHint) - scoreImg(a, nameHint));
  return out;
}

function scoreImg(img, nameHint) {
  let s = 0;
  const n = img.name.toLowerCase();
  const hint = (nameHint || '').toLowerCase().replace(/\.(zip|rar|7z)$/, '');
  if (hint && n.includes(hint)) s += 100;
  for (let i = 0; i < PRIORITY.length; i++) {
    if (PRIORITY[i].test(n)) { s += 50 - i * 5; break; }
  }
  if (/^\.(png|jpg|jpeg)$/i.test(path.extname(n))) s += 10;
  return s;
}

const PREFER_COVER_BYTES = 800 * 1024;

function pickBest(candidates, nameHint) {
  if (!candidates.length) return null;
  let best = null;
  let bestScore = -1;
  let smallest = null;
  for (const c of candidates) {
    let size = 0;
    try { size = fs.statSync(c.path).size; } catch { continue; }
    if (!smallest || size < smallest.size) smallest = { path: c.path, size };
    if (size > PREFER_COVER_BYTES) continue;
    const s = scoreImg(c, nameHint) + (c.dirName.includes('运行截图') ? 20 : c.dirName.includes('项目截图') ? 15 : 0);
    if (s > bestScore) { bestScore = s; best = c.path; }
  }
  return best || (smallest ? smallest.path : null);
}

// 源码关键目录名（探测时对这些目录不限制深度，避免 SpringBoot src/main/java/... 探测不到）
const DEEP_DIR_RE = /^(src|main|java|controller|service|services|dao|mapper|mappers|entity|entities|model|models|bean|beans|webapp|WEB-INF|jsp|jsps|views|admin|user|pojo|po|vo|dto)$/i;

// 递归读取目录下某类文件（对源码关键目录不限深度），用于功能模块/数据表探测
function walkFiles(dir, { maxDepth = 4, predicate }) {
  const out = [];
  const stack = [{ d: dir, depth: 0 }];
  while (stack.length) {
    const { d, depth } = stack.pop();
    if (depth > maxDepth) continue;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (/node_modules|target|\.git|\.idea|__MACOSX|venv|dist$/.test(e.name)) continue;
        // 关键源码目录不计深度；否则按正常深度累加
        const nextDepth = DEEP_DIR_RE.test(e.name) ? depth : depth + 1;
        stack.push({ d: full, depth: nextDepth });
      } else if (e.isFile() && predicate(e.name)) {
        out.push(full);
      }
    }
  }
  return out;
}

// 通用过滤词（不作为功能模块）
const COMMON_WORDS = /^(index|login|logi|register|reg|common|commons|error|404|500|main|home|head|foot|footer|header|left|right|menu|top|bottom|welcome|succ|fail|success|about|util|utils|test|config|admin|base|result|page|web|app|breadcrumbs|通用|配置|首页|登录|注册|退出|留言|下载|上传|查看|列表|搜索)$/i;

// 常见源码功能命名 → 中文（JSP / Controller 文件名翻译）
const EN_ZH = {
  add: '添加', create: '添加', insert: '添加', new: '新增',
  list: '列表', all: '列表', query: '查询', search: '搜索', select: '查询', find: '查询',
  edit: '编辑', update: '修改', modify: '修改', alter: '修改', delete: '删除', del: '删除', remove: '删除',
  editor: '编辑', viewer: '浏览', or: '',
  view: '查看', show: '查看', detail: '详情', details: '详情', info: '信息', information: '信息',
  manage: '管理', management: '管理', admin: '后台', backstage: '后台',
  login: '登录', logout: '退出', register: '注册', regist: '注册', sign: '注册',
  user: '用户', users: '用户', member: '会员', members: '会员', account: '账号',
  adminuser: '管理员', manager: '管理员',
  goods: '商品', product: '商品', products: '商品', commodity: '商品', shop: '商城', shopping: '购物',
  order: '订单', orders: '订单', cart: '购物车', pay: '支付', payment: '支付', refund: '退款',
  news: '新闻', notice: '公告', notices: '公告', announce: '公告', message: '留言', messages: '留言',
  comment: '评论', comments: '评论', feedback: '反馈', suggest: '建议', suggestion: '建议',
  book: '图书', books: '图书', movie: '电影', movies: '电影', music: '音乐', video: '视频', film: '影视',
  novel: '小说', reader: '读者', author: '作者', genre: '分类', chapter: '章节', essay: '文章', article: '文章', blog: '博客', forum: '论坛', post: '帖子',
  student: '学生', students: '学生', teacher: '教师', teachers: '教师', course: '课程', courses: '课程',
  class: '班级', classes: '班级', grade: '成绩', score: '成绩', exam: '考试', tests: '考试', test: '考试',
  room: '房间', house: '房源', home: '首页', hotel: '酒店', restaurant: '餐厅', food: '美食',
  hospital: '医院', doctor: '医生', patient: '患者', clinic: '诊所', drug: '药品',
  car: '车辆', cars: '车辆', vehicle: '车辆', parking: '停车', ticket: '票务', tickets: '票务',
  pet: '宠物', pets: '宠物', adopt: '领养', donate: '捐赠', rescue: '救助', charity: '公益',
  dorm: '宿舍', dormitory: '宿舍', library: '图书馆', bookborrow: '借书', borrow: '借阅', return: '归还',
  task: '任务', tasks: '任务', project: '项目', projects: '项目', research: '科研', paper: '论文',
  meeting: '会议', meet: '会议', conference: '会议', schedule: '排班', appointment: '预约', booking: '预约',
  delivery: '配送', express: '快递', logistic: '物流', logistics: '物流', stock: '库存', inventory: '库存',
  employee: '员工', staff: '员工', attendance: '考勤', salary: '工资', payroll: '薪酬', recruit: '招聘', recruitment: '招聘',
  job: '岗位', jobs: '岗位', resume: '简历', position: '职位', apply: '申请', interview: '面试',
  party: '党建', red: '红色', sports: '体育', activity: '活动', activities: '活动', club: '社团', association: '社团',
  vote: '投票', survey: '问卷', questionnaire: '问卷', answer: '答题', topic: '选题', selectcourse: '选课',
  teach: '教学', education: '教育', study: '学习', learn: '学习', training: '培训', train: '培训',
  upload: '上传', download: '下载', file: '文件', files: '文件', document: '文档', documents: '文档',
  report: '报表', statistic: '统计', statistics: '统计', data: '数据', charts: '图表', chart: '图表', analyze: '分析', analysis: '分析', center: '个人中心',
  // 拼音/业务词（毕设源码常见粘连命名）
  tushu: '图书', shuji: '书籍', fenlei: '分类', yuyue: '预约', jieyue: '借阅', guihuan: '归还',
  tuihuan: '退还', xinxi: '信息', discuss: '讨论', pinglun: '评论', tuijian: '推荐',
  recommend: '推荐', preference: '偏好', favorite: '收藏', collect: '收藏', collection: '收藏',
  steup: '设置', setup: '设置', setting: '设置', settings: '设置', system: '系统',
  banner: '轮播', carousel: '轮播', config: '配置', role: '角色', permission: '权限',
  menu: '菜单', dict: '字典', log: '日志', logs: '日志', token: '令牌',
  address: '地址', category: '分类', type: '类型', status: '状态',
  store: '门店', merchant: '商家', vendor: '供应商', brand: '品牌',
  warehouse: '仓库', supplier: '供应商', purchase: '采购', sale: '销售', sales: '销售',
  forum: '论坛', board: '板块', reply: '回复', like: '点赞', follow: '关注',
  profile: '资料', avatar: '头像', password: '密码', reset: '重置',
  check: '审核', audit: '审核', approve: '审批', publish: '发布',
  dashboard: '仪表盘', overview: '总览', index: '首页',
  storeup: '收藏', xuesheng: '学生', messages: '消息', common: '通用'
};

function translateFeature(name) {
  const words = name.toLowerCase().split(/\s+/).filter(Boolean);
  const translated = words.map((w) => {
    const zh = EN_ZH[w];
    if (zh) return zh;
    // 组合词，如 addgoods -> 添加商品
    let merged = '';
    let cursor = 0;
    while (cursor < w.length) {
      let matched = null;
      // 前缀匹配已知词（优先长词）
      for (let len = Math.min(12, w.length - cursor); len >= 2; len--) {
        const part = w.slice(cursor, cursor + len);
        if (EN_ZH[part] !== undefined) { matched = EN_ZH[part]; cursor += len; merged += matched; break; }
      }
      if (matched === null) { merged += w[cursor]; cursor++; }
    }
    return merged;
  });
  // 丢弃翻译后仍为孤立单字母/纯数字的词（如 a、1）
  const filtered = translated.filter((t) => t && !/^[a-z0-9]+$/i.test(t));
  return filtered.join('') || name;
}

function cleanFeature(name) {
  const cleaned = name
    .replace(/\.(jsp|html|htm|vue|js|java)$/i, '')
    .replace(/(Controller|ServiceImpl|Service|Dao|Mapper|Repository|Action|Servlet)$/i, '')
    // camelCase → 空格，便于分词翻译
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .trim();
  const zh = translateFeature(cleaned);
  // 翻译后若仍以大量拉丁字母为主，说明词典未覆盖，丢弃该噪音项
  const letters = (zh.match(/[A-Za-z]/g) || []).length;
  const hans = (zh.match(/[\u4e00-\u9fff]/g) || []).length;
  if (letters > 4 && hans === 0) return '';
  if (letters > hans * 2 && hans < 2) return '';
  return zh;
}

function uniq(list, limit = 20) {
  const seen = new Set();
  const out = [];
  for (const it of list) {
    const k = String(it || '').trim();
    if (!k) continue;
    if (COMMON_WORDS.test(k)) continue;
    if (k.length < 2) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= limit) break;
  }
  return out;
}

// 探测功能模块：Controller 类名 + JSP/HTML 页面名
function probeFeatures(dir) {
  const feats = [];
  for (const f of walkFiles(dir, { predicate: (n) => /Controller\.java$/.test(n) })) {
    feats.push(cleanFeature(path.basename(f)));
  }
  for (const f of walkFiles(dir, {
    predicate: (n) => /\.(jsp|html|htm)$/i.test(n),
    maxDepth: 5
  })) {
    feats.push(cleanFeature(path.basename(f)));
  }
  return uniq(feats);
}

// 探测技术点：框架配置文件 / 目录结构
function probeTechPoints(dir, tech) {
  const points = [];
  const files = walkFiles(dir, { predicate: () => true, maxDepth: 3 }).map((f) => path.basename(f).toLowerCase());
  const allNames = files.join('|');

  const base = (tech || '').toString().trim();
  if (base) points.push(base);
  if (allNames.includes('pom.xml')) points.push('Maven');
  if (allNames.includes('package.json')) points.push('npm/Node');
  if (/application\.(yml|yaml|properties)/.test(allNames)) points.push('Spring Boot');
  if (/mybatis/.test(allNames) || allNames.includes('mapper')) points.push('MyBatis');
  if (allNames.includes('web.config') || allNames.includes('web.xml')) points.push('Servlet/JSP');
  if (/\.sql$/.test(allNames)) points.push('数据库脚本');
  if (/\.vue$/.test(allNames)) points.push('Vue');
  if (/\.(mp4|avi|mov)$/i.test(allNames)) points.push('演示视频');
  if (/\.(ppt|pptx)$/i.test(allNames)) points.push('PPT 讲解');

  return uniq(points, 10);
}

// ============================== 压缩包探测 ==============================
// 用系统 tar (bsdtar/libarchive) 读取 zip/rar/7z 内部，不整体解压。

const ARCHIVE_RE = /\.(zip|rar|7z)$/i;

// 列出压缩包内全部条目路径（含目录，目录以 / 结尾）
// 注意：zip 内中文条目名常为 GBK 编码，tar 直接输出原始字节，需按 GBK 解码
function listArchiveEntries(archivePath) {
  const { execFileSync } = require('child_process');
  try {
    const buf = execFileSync('tar', ['-tf', archivePath], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    const text = decodeArchiveText(buf);
    return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// 压缩包条目文本解码：优先 GBK（Windows zip 常见），若 GBK 解码后仍有大量替换符则退回 utf8
function decodeArchiveText(buf) {
  try {
    const gbk = new TextDecoder('gbk').decode(buf);
    // GBK 解码后若出现 U+FFFD 说明字节不是 GBK（可能是 utf8 zip），退回 utf8
    if (gbk.includes('\uFFFD')) return buf.toString('utf8');
    return gbk;
  } catch {
    return buf.toString('utf8');
  }
}

// 从压缩包提取条目：纯 ASCII 路径直接指定；含非 ASCII（中文）用 --include '*/<文件名>' 通配，规避编码
function extractArchiveEntries(archivePath, dest, entries) {
  const { execFileSync } = require('child_process');
  if (!entries.length) return;
  const asciiEntries = [];
  const asciiByWildcard = [];
  const nonAsciiBases = [];
  for (const e of entries) {
    if (/^[\x20-\x7E/\\]+$/.test(e)) {
      asciiEntries.push(e);
    } else {
      const base = e.split(/[\\/]/).pop();
      if (base && /^[\x20-\x7E]+$/.test(base)) {
        asciiByWildcard.push('*/' + base);
        nonAsciiBases.push(base);
      } else {
        // 文件名也含中文：退回 --include 通配（尽量匹配）
        if (base) {
          asciiByWildcard.push('*/' + base);
          nonAsciiBases.push(base);
        }
      }
    }
  }

  const run = (args) => {
    try {
      execFileSync('tar', args, { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024, windowsHide: true });
      return true;
    } catch {
      return false;
    }
  };

  // 1) 纯 ASCII 精确路径
  if (asciiEntries.length) run(['-xf', archivePath, '-C', dest, ...asciiEntries]);
  // 2) 含中文条目的文件名通配
  const uniqBases = [...new Set(asciiByWildcard)];
  for (const w of uniqBases) {
    run(['-xf', archivePath, '-C', dest, '--include', w]);
  }
}

// 从压缩包提取 .sql 并解析数据表名（限制提取大小/数量）
function probeArchiveDbTables(archivePath, entries) {
  const sqlEntries = entries.filter((p) => /\.sql$/i.test(p)).slice(0, 3);
  if (!sqlEntries.length) return [];
  const tmp = path.join(require('os').tmpdir(), 'probe-arch-' + process.pid);
  fs.mkdirSync(tmp, { recursive: true });
  extractArchiveEntries(archivePath, tmp, sqlEntries);
  const tables = [];
  for (const f of walkFiles(tmp, { predicate: () => true, maxDepth: 3 })) {
    if (!/\.sql$/i.test(f)) continue;
    let content;
    try {
      content = fs.readFileSync(f, 'utf8');
      if (content.length > 5 * 1024 * 1024) continue;
    } catch { continue; }
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z_][\w]*)`?/gi;
    let m;
    while ((m = re.exec(content)) !== null) tables.push(m[1]);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return uniq(tables, 15);
}

// 前端资源目录：其中的页面多为框架组件/构建产物，不算业务功能模块
const FEAT_RESOURCE_RE = /(^|\/)(components|assets|static|dist|public|node_modules|img|images|css|fonts|icons)(\/|$)/i;

// 从压缩包条目路径探测功能模块（Controller.java / jsp / html / vue）
function probeArchiveFeatures(entries) {
  const feats = [];
  for (const p of entries) {
    const base = p.split(/[\\/]/).pop();
    if (!base) continue;
    if (/Controller\.java$/i.test(base)) {
      feats.push(cleanFeature(base));
    } else if (/\.jsp$/i.test(base)) {
      feats.push(cleanFeature(base));
    } else if (/\.(html|htm|vue)$/i.test(base)) {
      // 业务页面（非前端框架组件/构建产物）才算功能模块
      if (FEAT_RESOURCE_RE.test(p)) continue;
      feats.push(cleanFeature(base));
    }
  }
  return uniq(feats);
}

// 从压缩包条目路径探测技术点
function probeArchiveTechPoints(entries, tech) {
  const points = [];
  const allNames = entries.join('|').toLowerCase();
  const base = (tech || '').toString().trim();
  if (base) points.push(base);
  if (allNames.includes('pom.xml')) points.push('Maven');
  if (allNames.includes('package.json')) points.push('npm/Node');
  if (/application\.(yml|yaml|properties)/.test(allNames)) points.push('Spring Boot');
  if (/mybatis/.test(allNames) || allNames.includes('/mapper/')) points.push('MyBatis');
  if (allNames.includes('web.config') || allNames.includes('web.xml')) points.push('Servlet/JSP');
  if (/\.sql$/.test(allNames)) points.push('数据库脚本');
  if (/\.vue$/.test(allNames)) points.push('Vue');
  if (/\.(mp4|avi|mov)$/i.test(allNames)) points.push('演示视频');
  if (/\.(ppt|pptx)$/i.test(allNames)) points.push('PPT 讲解');
  return uniq(points, 10);
}

// 从压缩包提取 .sql 并解析数据表名（限制提取大小/数量）
function probeArchiveDbTables(archivePath, entries) {
  const sqlEntries = entries.filter((p) => /\.sql$/i.test(p)).slice(0, 3);
  if (!sqlEntries.length) return [];
  const tmp = path.join(require('os').tmpdir(), 'probe-arch-' + process.pid);
  fs.mkdirSync(tmp, { recursive: true });
  extractArchiveEntries(archivePath, tmp, sqlEntries);
  const tables = [];
  for (const f of walkFiles(tmp, { predicate: () => true, maxDepth: 3 })) {
    if (!/\.sql$/i.test(f)) continue;
    let content;
    try {
      content = fs.readFileSync(f, 'utf8');
      if (content.length > 5 * 1024 * 1024) continue;
    } catch { continue; }
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z_][\w]*)`?/gi;
    let m;
    while ((m = re.exec(content)) !== null) tables.push(m[1]);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return uniq(tables, 15);
}

// 资源目录提示：这些目录里的图片大概率是页面素材而非运行截图
const RESOURCE_DIR_RE = /(assets|static|img|images?|icons?|fonts|css|dist|node_modules|avatar|logo|banner|background|pic|image)(\/|\\|$)/i;
// 运行截图目录提示：这些目录里的图片最可能是真实运行截图
const SHOT_DIR_HINTS = ['运行截图', '项目截图', '截图', '界面', '演示', '页面', '图片', '效果图', '主界面'];

// 从压缩包内挑选截图（优先"运行截图"等目录，其次文件名含登录/首页；排除资源素材）
function pickArchiveScreenshots(entries) {
  const imgs = [];
  for (const p of entries) {
    const base = p.split(/[\\/]/).pop();
    if (!base || !IMG_RE.test(base)) continue;
    const dirPath = p.slice(0, p.length - base.length);
    imgs.push({
      path: p,
      name: base,
      dirPath,
      dirName: dirPath.split(/[\\/]/).filter(Boolean).pop() || '',
      dirDepth: dirPath.split(/[\\/]/).filter(Boolean).length
    });
  }

  const score = (im) => {
    let s = 0;
    // 目录含运行截图等提示词 → 强优先
    for (const h of SHOT_DIR_HINTS) {
      if (im.dirPath.includes(h)) { s += 80; break; }
    }
    // 文件名含登录/首页/主界面 → 优先
    for (const p of PRIORITY) {
      if (p.test(im.name)) { s += 40; break; }
    }
    // 深层资源目录 → 弱化
    if (RESOURCE_DIR_RE.test(im.dirPath)) s -= 60;
    // 靠近根目录（浅层）→ 优先
    if (im.dirDepth <= 1) s += 15;
    // png/jpg 优先于 gif
    if (/\.(png|jpe?g)$/i.test(im.name)) s += 10;
    return s;
  };

  imgs.sort((a, b) => score(b) - score(a));
  return imgs.slice(0, 6);
}

// 整体探测一个压缩包：返回 { shots, features, tech_points, db_tables }
function probeArchive(archivePath, tech) {
  const entries = listArchiveEntries(archivePath);
  if (!entries.length) return null;
  return {
    shots: pickArchiveScreenshots(entries),
    features: probeArchiveFeatures(entries),
    tech_points: probeArchiveTechPoints(entries, tech),
    db_tables: probeArchiveDbTables(archivePath, entries)
  };
}

// 读取 .sql 提取数据表名
function probeDbTables(dir) {
  const tables = [];
  const sqlFiles = walkFiles(dir, { predicate: (n) => /\.sql$/i.test(n), maxDepth: 4 });
  for (const f of sqlFiles) {
    let content;
    try {
      content = fs.readFileSync(f, 'utf8');
      if (content.length > 5 * 1024 * 1024) continue; // 跳过超大文件
    } catch { continue; }
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z_][\w]*)`?/gi;
    let m;
    while ((m = re.exec(content)) !== null) tables.push(m[1]);
  }
  return uniq(tables, 15);
}

/**
 * 探测真实项目目录树（文件夹直读；压缩包用条目列表）
 * 返回 { name, type:'dir'|'file', children?, count?, hint? }
 */
const DIR_SKIP = /^(node_modules|target|\.git|\.idea|\.vscode|\.mvn|__pycache__|dist|build|out|\.settings|logs?)$/i;
const DIR_TREE_HINTS = [
  { re: /^controller$/i, hint: '接口控制层' },
  { re: /^service$/i, hint: '业务服务层' },
  { re: /^dao$|^mapper$/i, hint: '数据访问层' },
  { re: /^entity$|^domain$|^model$/i, hint: '实体 / 模型' },
  { re: /^resources$/i, hint: '配置与静态资源' },
  { re: /^admin$/i, hint: '管理端前端' },
  { re: /^front$/i, hint: '用户端前端' },
  { re: /^运行截图$|截图|screenshot/i, hint: '运行效果截图' },
  { re: /^static$/i, hint: '静态资源' },
  { re: /^utils?$|^util$/i, hint: '工具类' },
  { re: /^config$/i, hint: '配置类' },
  { re: /^interceptor$/i, hint: '拦截器' }
];

function dirHint(name) {
  for (const h of DIR_TREE_HINTS) if (h.re.test(name)) return h.hint;
  return '';
}

function probeDirTreeFromFs(rootPath, opts = {}) {
  const maxNodes = opts.maxNodes || 48;
  const rootName = path.basename(rootPath);
  let nodes = 0;

  function walk(abs, name, depth) {
    if (nodes >= maxNodes) return null;
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      return null;
    }

    if (stat.isFile()) {
      nodes++;
      return { name, type: 'file' };
    }

    // 目录
    nodes++;
    let entries = [];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return { name, type: 'dir', children: [] };
    }
    entries = entries
      .filter((e) => !DIR_SKIP.test(e.name) && !e.name.startsWith('.'))
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name, 'zh'));

    // 截图目录：折叠为计数，避免刷屏
    if (/截图|screenshot|运行效果/i.test(name)) {
      const imgs = entries.filter((e) => e.isFile() && /\.(png|jpe?g|webp|gif|bmp)$/i.test(e.name));
      return {
        name,
        type: 'dir',
        hint: dirHint(name) || '运行效果截图',
        count: imgs.length || entries.length,
        summary: `${imgs.length || entries.length} 个文件`
      };
    }

    // mapper / 大量同类型文件：显示摘要 + 少量样例
    const onlyFiles = entries.every((e) => e.isFile());
    if (onlyFiles && entries.length > 6) {
      const sample = entries.slice(0, 3).map((e) => ({ name: e.name, type: 'file' }));
      return {
        name,
        type: 'dir',
        hint: dirHint(name),
        count: entries.length,
        children: [...sample, { name: `… 另有 ${entries.length - 3} 个文件`, type: 'more' }]
      };
    }

    // 深度控制：源码主链路（src/main/java/com、resources）多展一层
    const deepKeep = /^(java|resources|src|main|com|admin|front|controller|service|dao|entity|utils|mapper|config)$/i.test(name);
    const maxDepth = deepKeep || depth < 3 ? 6 : 4;
    if (depth >= maxDepth) {
      const dirs = entries.filter((e) => e.isDirectory()).length;
      const files = entries.filter((e) => e.isFile()).length;
      return {
        name,
        type: 'dir',
        hint: dirHint(name),
        summary: [dirs ? `${dirs} 个目录` : '', files ? `${files} 个文件` : ''].filter(Boolean).join(' · ')
      };
    }

    const children = [];
    for (const e of entries) {
      if (nodes >= maxNodes) {
        children.push({ name: '…', type: 'more' });
        break;
      }
      const child = walk(path.join(abs, e.name), e.name, depth + 1);
      if (child) children.push(child);
    }
    return { name, type: 'dir', hint: dirHint(name), children };
  }

  const tree = walk(rootPath, rootName, 0);
  return tree;
}

function probeDirTreeFromArchive(archivePath) {
  const entries = listArchiveEntries(archivePath);
  if (!entries.length) return null;
  // 建虚拟树
  const root = { name: path.basename(archivePath).replace(/\.(zip|rar|7z)$/i, ''), type: 'dir', children: [] };
  const index = new Map([['', root]]);

  const clean = entries
    .map((e) => e.replace(/\\/g, '/').replace(/\/$/, ''))
    .filter((e) => e && !e.split('/').some((p) => DIR_SKIP.test(p)));

  for (const rel of clean.slice(0, 800)) {
    const parts = rel.split('/').filter(Boolean);
    let prefix = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const parentKey = prefix;
      prefix = prefix ? prefix + '/' + part : part;
      if (index.has(prefix)) continue;
      const parent = index.get(parentKey);
      if (!parent) break;
      const isFile = i === parts.length - 1 && !entries.some((x) => x.replace(/\\/g, '/').startsWith(rel + '/'));
      // 粗判：若存在以 rel/ 开头的条目则是目录
      const asDir = clean.some((x) => x.startsWith(prefix + '/'));
      const node = { name: part, type: asDir ? 'dir' : 'file', children: asDir ? [] : undefined, hint: asDir ? dirHint(part) : '' };
      if (!parent.children) parent.children = [];
      parent.children.push(node);
      index.set(prefix, node);
      if (index.size > 60) break;
    }
    if (index.size > 60) break;
  }

  // 压缩包树过大时做一层折叠（截图/大量文件）
  function collapse(node, depth = 0) {
    if (!node.children) return node;
    if (/截图|screenshot/i.test(node.name)) {
      const n = node.children.length;
      return { name: node.name, type: 'dir', hint: '运行效果截图', summary: `${n} 个文件` };
    }
    if (depth > 4) {
      return {
        name: node.name,
        type: 'dir',
        hint: node.hint,
        summary: `${node.children.length} 项`
      };
    }
    node.children = node.children.slice(0, 12).map((c) => collapse(c, depth + 1));
    return node;
  }
  return collapse(root);
}

function probeDirTree(src) {
  if (!src || !fs.existsSync(src)) return null;
  const st = fs.statSync(src);
  if (st.isDirectory()) return probeDirTreeFromFs(src);
  if (ARCHIVE_RE.test(src)) return probeDirTreeFromArchive(src);
  return null;
}

/** 目录树 → 纯文本（用于 description） */
function formatDirTreeText(tree, prefix = '', isLast = true, lines = [], depth = 0) {
  if (!tree || lines.length > 40) return lines;
  const branch = depth === 0 ? '' : isLast ? '└─ ' : '├─ ';
  const extra = tree.summary ? `  (${tree.summary})` : tree.hint ? `  — ${tree.hint}` : '';
  lines.push(`${prefix}${branch}${tree.name}${tree.type === 'dir' && tree.children ? '/' : ''}${extra}`);
  if (tree.children?.length) {
    const nextPrefix = depth === 0 ? '' : prefix + (isLast ? '   ' : '│  ');
    tree.children.forEach((c, i) => {
      formatDirTreeText(c, nextPrefix, i === tree.children.length - 1, lines, depth + 1);
    });
  }
  return lines;
}

/**
 * 根据功能点生成毕设风格「功能结构图」树
 * 结构：系统 → 前台用户端 / 后台管理端 → 叶子功能
 */
function buildFuncTree(productTitle, features = []) {
  const rootName = String(productTitle || '系统').replace(/的设计与实现$/g, '').replace(/设计与实现$/g, '').trim() || '本系统';
  const list = (features || []).map((f) => String(f).trim()).filter(Boolean);
  if (!list.length) return null;

  const FRONT_HINT = /预约|收藏|讨论|浏览|购物|下单|支付|评价|留言|前台|首页|借阅|退还|查询|检索|个人中心|我的/;
  const BACK_HINT = /管理|分类|审核|统计|配置|用户|学生|教师|管理员|新闻|公告|文件|消息|权限|角色|日志|后台|报表/;

  const front = [];
  const back = [];
  for (const f of list) {
    const isFront = FRONT_HINT.test(f);
    const isBack = BACK_HINT.test(f);
    if (isFront && !isBack) front.push(f);
    else if (isBack && !isFront) back.push(f);
    else if (isFront && isBack) {
      // 兼有：偏业务交互放前台，偏管理放后台
      if (/管理|分类|用户|学生|教师|新闻|文件|消息/.test(f)) back.push(f);
      else front.push(f);
    } else {
      // 无明确倾向：含图书/商品等业务词 → 前台，否则后台
      if (/图书|商品|课程|订单|活动|宠物|房源|电影/.test(f)) front.push(f);
      else back.push(f);
    }
  }

  // 保证两侧都有内容：若一侧为空，从另一侧挪几个过去
  if (!front.length && back.length) {
    const move = back.splice(0, Math.ceil(back.length / 2));
    front.push(...move);
  }
  if (!back.length && front.length) {
    const move = front.splice(Math.ceil(front.length / 2));
    back.push(...move);
  }

  const children = [];
  if (front.length) {
    children.push({
      name: '前台用户端',
      children: front.slice(0, 8).map((name) => ({ name }))
    });
  }
  if (back.length) {
    children.push({
      name: '后台管理端',
      children: back.slice(0, 8).map((name) => ({ name }))
    });
  }

  return {
    name: rootName.length > 18 ? rootName.slice(0, 18) + '…' : rootName,
    children
  };
}

/**
 * 生成结构化项目简介（多段中文，便于详情页分段渲染）
 * 同时返回 intro 对象供 details.intro 使用
 */
function buildIntro(product, { features = [], tech_points = [], db_tables = [], dir_tree = null } = {}) {
  const tech = product.tech || 'JavaWeb';
  const category = product.category || '';
  const title = product.title || '该项目';

  const materials = [];
  if (product.has_paper) materials.push({ key: 'paper', label: '毕业论文 / 设计说明书' });
  if (product.has_ppt) materials.push({ key: 'ppt', label: '答辩 PPT' });
  if (product.has_video) materials.push({ key: 'video', label: '演示 / 讲解视频' });
  if (product.has_db) materials.push({ key: 'db', label: '数据库脚本（可直接导入）' });
  materials.unshift({ key: 'source', label: '完整可运行源码' });

  const featList = features.filter(Boolean).slice(0, 12);
  const techList = tech_points.filter(Boolean).slice(0, 8);
  const tableList = db_tables
    .filter(Boolean)
    .map((t) => {
      const zh = cleanFeature(String(t));
      if (zh && zh !== t && /[\u4e00-\u9fff]/.test(zh)) return `${zh}（${t}）`;
      return t;
    })
    .slice(0, 10);

  const overviewParts = [
    `基于 ${tech} 的完整毕设源码，适合毕业设计 / 课程设计直接落地或二次开发。`
  ];
  if (category) {
    overviewParts.push(`业务方向偏「${category}」。`);
  }
  if (featList.length) {
    overviewParts.push(
      `主要覆盖 ${featList.slice(0, 5).join('、')}${featList.length > 5 ? ' 等' : ''}模块，结构清晰，便于演示与答辩讲解。`
    );
  } else {
    overviewParts.push('项目结构完整，便于本地导入运行与功能演示。');
  }

  const scenario = [
    '计算机 / 软件工程等专业毕业设计选题参考',
    '课程设计、实训周、综合实训项目',
    '学习 ' + tech + ' 工程结构与业务拆分的练手项目',
    '在现有源码基础上做功能增改、界面优化'
  ];

  const delivery = [
    '下单后由客服通过网盘发送完整资料包',
    '源码仅供学习交流，请遵守学术诚信，勿用于不当用途',
    '如遇环境配置问题，可联系客服协助排查常见启动问题'
  ];

  const func_tree = buildFuncTree(title, featList);
  const tree = dir_tree || null;

  const intro = {
    overview: overviewParts.join(''),
    materials: materials.map((m) => m.label),
    features: featList,
    tech_stack: techList,
    db_tables: tableList,
    scenario,
    delivery,
    func_tree,
    dir_tree: tree
  };

  // 纯文本版（兼容旧前端 / SEO）：分段换行
  const lines = [];
  lines.push('【项目概述】');
  lines.push(intro.overview);
  lines.push('');
  lines.push('【交付内容】');
  intro.materials.forEach((m, i) => lines.push(`${i + 1}. ${m}`));
  if (featList.length) {
    lines.push('');
    lines.push('【核心功能】');
    featList.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
  }
  if (func_tree?.children?.length) {
    lines.push('');
    lines.push('【功能结构】');
    lines.push(func_tree.name);
    for (const branch of func_tree.children) {
      lines.push(`├─ ${branch.name}`);
      (branch.children || []).forEach((leaf, i, arr) => {
        const last = i === arr.length - 1;
        lines.push(`${last ? '│  └─' : '│  ├─'} ${leaf.name}`);
      });
    }
  }
  if (tree) {
    lines.push('');
    lines.push('【项目目录】（来自源码真实探测）');
    formatDirTreeText(tree).forEach((l) => lines.push(l));
  }
  if (techList.length) {
    lines.push('');
    lines.push('【技术架构】');
    lines.push(techList.join(' · '));
  }
  if (tableList.length) {
    lines.push('');
    lines.push('【数据库】');
    lines.push(`共探测到 ${tableList.length} 张核心数据表：${tableList.join('、')}${db_tables.length > tableList.length ? ' 等' : ''}。`);
  }
  lines.push('');
  lines.push('【适用场景】');
  scenario.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push('');
  lines.push('【购买说明】');
  delivery.forEach((s, i) => lines.push(`${i + 1}. ${s}`));

  return { text: lines.join('\n'), intro };
}

// 生成项目简介纯文本（兼容旧调用）
function buildDescription(product, probeResult = {}) {
  return buildIntro(product, probeResult).text;
}

module.exports = {
  collectImages,
  pickBest,
  walkFiles,
  probeFeatures,
  probeTechPoints,
  probeDbTables,
  probeDirTree,
  buildDescription,
  buildIntro,
  buildFuncTree,
  formatDirTreeText,
  uniq,
  ARCHIVE_RE,
  probeArchive,
  listArchiveEntries,
  extractArchiveEntries,
  pickArchiveScreenshots
};
