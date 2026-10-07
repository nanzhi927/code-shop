#!/usr/bin/env node
/**
 * 毕设源码库扫描导入脚本 v2（归并版）
 * 扫描两类源码目录，生成商品目录 JSON/CSV：
 *   1) 文件夹型（D:\从戎网站源码）：每个项目一个文件夹，含 代码/论文截图/运行截图 等
 *   2) 压缩包型（D:\整理代码）：springboot001...zip/rar 编号命名
 *
 * v2 新增：
 *   - 同目录归并：同一项目目录下多个压缩包（源码/论文/PPT/副本）合并为一个商品 + files[]
 *   - 跨目录去重：同编号(springbootXXX)且标题高度相似的项目只保留一条
 *   - 标题清洗：去除噪音标注（111111/待做/pf/LW PPT/副本/(1) 等），并提取注意事项到 qaNote
 *   - 业务分类：根据标题关键词归类（商城/校园/医疗…）
 *   - 运行环境标记：探测 pom.xml / package.json / application.yml / sql / vue 等
 *
 * 用法：
 *   node scripts/scan-sources.js          # 输出 data/products.json
 *   node scripts/scan-sources.js --csv    # 另输出 data/products.csv
 *   node scripts/scan-sources.js --limit 100  # 限制数量（调试用）
 *   node scripts/scan-sources.js --no-merge   # 关闭归并（旧版行为）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

// 辅助子目录关键词：出现在项目文件夹内部，不代表子项目
const HELPER_DIRS = /论文截图|运行截图|演示视频|项目截图|数据库脚本|文档报告|论文文档|论文等资料|常用jar包|背景图片|视频解说|项目源码|代码|截图|视频|文档|图片|visio源文件|数据库|运行|论文/;

// 材料标记：文件名含这些词 → 属于材料包而非主源码包
const MATERIAL_RE = /论文|开题|任务书|答辩|LW|PPT|演示|视频|截图|效果图|visio|readme|使用说明|部署文档|环境配置|数据库脚本|安装包/i;
// 副本标记
const COPY_RE = /\(\d+\)|（\d+）|副本| - 副本|- 副本|copy|\d{4,}$/;

// 集合目录标记：这些目录名是"一批项目"而不是单个项目
const COLLECTION_DIR_RE = /套|期|整理|合集|源码|项目|0-100|\d{2,}$|springboot\d{3}-?\d*套/i;

/**
 * 判断目录是否为"单个项目目录"（目录内多个压缩包应归并为一个商品）
 * 规则：目录名含项目编号(springbootXXX) → 项目目录；目录名像集合 → 非项目目录；
 *       其他情况：包数量 ≤3 视为项目目录（一个项目一般 1-3 个包）
 */
function shouldMergeDir(dirName, zipCount) {
  if (/springboot\d{3}/i.test(dirName)) return true;
  if (COLLECTION_DIR_RE.test(dirName)) return false;
  return zipCount <= 3;
}

// ---------- 技术栈识别 ----------
function detectTech(name) {
  const n = name.toLowerCase();
  if (n.includes('springboot') || n.includes('spring boot')) return 'SpringBoot';
  if (n.includes('ssm') || n.includes('springmvc') || n.includes('mybatis')) return 'SSM';
  if (n.includes('jsp') || n.includes('servlet') || n.includes('javaweb')) return 'JSP+Servlet';
  if (n.includes('vue')) return 'Vue';
  if (n.includes('android')) return 'Android';
  if (n.includes('python')) return 'Python';
  if (n.includes('微信小程序') || n.includes('小程序') || n.includes('weixin')) return '微信小程序';
  if (n.includes('uniapp') || n.includes('uni-app')) return 'uni-app';
  return '其他';
}

// 编号解析：springboot001 / 645 等
function parseNo(name) {
  const m = name.match(/(?:springboot)(\d{3})/i);
  return m ? parseInt(m[1], 10) : null;
}

// ---------- 标题噪音规则：清洗 + 提取注意事项 ----------
const NOISE_RULES = [
  { re: /\d{5,}/g, note: '标题含异常长数字标注' },
  { re: /待做|待开发|待定/g, note: '原目录标注"待做/待定"' },
  { re: /数据库导入失败/g, note: '原目录标注"数据库导入失败"' },
  { re: /启动页空白/g, note: '原目录标注"启动页空白"' },
  { re: /账号密码不知道|密码不知道/g, note: '原目录标注"账号密码不知道"' },
  { re: /【问题】|问题[版本]?$/g, note: '原目录标注"【问题】"' },
  { re: /^错[误版]?[（(]?[^）)]*[)）]?/g, note: '原目录标注"错版"' },
  { re: /^pf[\s_]*/g, note: '' },
  { re: /\s*pf\s*$/g, note: '' },
  { re: /LW\s*PPT/g, note: '含论文+PPT 材料包' },
  { re: /\s*LW\s*/g, note: '' },
  { re: /\s*PPT\s*/g, note: '' },
  { re: /\(1\)|（1）|\(2\)|（2）|_1\b|_2\b/g, note: '' },
  { re: /[-_ ]?副本\s*$/g, note: '' },
  { re: /[-_ ]?(修改后|修改版|优化版)?代码\s*$/g, note: '' },
  { re: /[（(].*?[)）]\s*$/g, note: '' },
  { re: /^[\d.]+\s*/g, note: '' },
  { re: /^B-\w+-\d*[-_ ]*/g, note: '' },
  { re: /^springboot\d{3}/g, note: '' },
  { re: /\s{2,}/g, note: '' }
];

/**
 * 清洗标题并提取注意事项
 * @returns {{title:string, qaNote:string}}
 */
function cleanTitleV2(name) {
  let t = String(name || '').trim();
  const notes = [];
  for (const rule of NOISE_RULES) {
    const before = t;
    t = t.replace(rule.re, (m) => {
      if (rule.note && !notes.includes(rule.note)) notes.push(rule.note);
      return ' ';
    });
    if (t === before) continue;
    t = t.replace(/\s+/g, ' ').trim();
  }
  t = t.replace(/[-_]+$/g, '').replace(/^\s*[-_]\s*/g, '').trim();
  return { title: t || String(name || '').trim(), qaNote: notes.join('；') };
}

// ---------- 业务分类 ----------
const CATEGORY_RULES = [
  [/商城|购物|电商|交易|秒杀|店铺|商品|购物车|进销存|订单系统|拍卖|二手|闲置|代购|网店/, '商城购物'],
  [/图书|图书馆|书城|教材|选课|教务|学生|教师|学校|校园|高校|宿舍|考勤|成绩|考试|作业|课程|学习|教学|教育|培训|实训|慕课|在线教育|招生|迎新|社团|竞赛|评优|助学贷款/, '校园教育'],
  [/医院|医疗|挂号|医生|药品|诊所|健康|体检|护理|康复|养老|疫情|防控|疫苗|防疫|血库|影像/, '医疗健康'],
  [/政务|政府|党建|办公|OA|公文|审批|信访|村委会|社区管理|电子政务/, '政务办公'],
  [/物业|家政|洗衣|维修|搬家|预约|生活服务|云盘|资料分享/, '生活服务'],
  [/餐厅|点餐|美食|外卖|餐饮|菜谱|食堂|咖啡|蛋糕|甜品|奶茶|火锅/, '餐饮美食'],
  [/旅游|酒店|民宿|景点|机票|火车票|出行|租车|导航|导游|度假/, '旅游出行'],
  [/音乐|视频|电影|影院|直播|游戏|小说|阅读|动漫|博客|论坛|社交|社区|摄影|相册|翻唱/, '娱乐影音'],
  [/物流|快递|仓储|配送|运输|供应链|货运|船舶/, '物流仓储'],
  [/汽车|车辆|停车|驾校|洗车/, '车辆交通'],
  [/房屋|房产|租赁|租房|公寓|物业/, '房产租赁'],
  [/宠物|领养|救助|公益|捐赠|流浪/, '宠物公益'],
  [/推荐|协同过滤|数据分析|可视化|大数据|Hadoop|机器学习|算法/, '智能算法'],
  [/音乐|歌词|K歌/, '娱乐影音']
];

function categorize(title) {
  for (const [re, cat] of CATEGORY_RULES) {
    if (re.test(title)) return cat;
  }
  return '其他';
}

// ---------- 运行环境标记 ----------
// 文件夹型：walk 顶层若干层文件名
function detectEnvMarkers(files) {
  const all = files.join('|').toLowerCase();
  return {
    pom: all.includes('pom.xml'),
    packageJson: all.includes('package.json'),
    applicationYml: /application\.(yml|yaml|properties)/.test(all),
    sql: /\.sql$/.test(all),
    vue: /\.vue$/.test(all),
    webXml: all.includes('web.xml'),
    mybatis: /mybatis/.test(all) || all.includes('/mapper/'),
    jsp: /\.jsp$/.test(all)
  };
}

function envMarkersToJson(m) {
  if (!m) return '';
  const out = {};
  if (m.pom) out.maven = true;
  if (m.packageJson) out.node = true;
  if (m.applicationYml) out.springBoot = true;
  if (m.sql) out.sql = true;
  if (m.vue) out.vue = true;
  if (m.webXml) out.servlet = true;
  if (m.mybatis) out.mybatis = true;
  if (m.jsp) out.jsp = true;
  return JSON.stringify(out);
}

// 从压缩包条目路径探测环境标记
function detectEnvMarkersFromEntries(entries) {
  const all = entries.join('|').toLowerCase();
  return detectEnvMarkers(all.split('|').map((p) => p.split(/[\\/]/).pop()));
}

// 材料类型分类（product_files.kind）
function classifyFileKind(name) {
  const n = String(name || '').toLowerCase();
  if (/论文|开题|任务书|说明书|报告|答辩/.test(n)) return 'paper';
  if (/\.(ppt|pptx)$/.test(n)) return 'ppt';
  if (/\.(mp4|avi|mov|wmv|flv|mkv)$/.test(n)) return 'video';
  if (/\.(png|jpe?g|webp|gif|bmp)$/.test(n) || /截图|界面|效果图/.test(n)) return 'screenshot';
  if (/\.(sql|db|mdf|bak)$/.test(n)) return 'db';
  return 'other';
}

// ---------- 判断项目文件夹内含哪些材料 ----------
function probeContents(dir, depth = 0) {
  const flags = { paper: false, ppt: false, video: false, db: false, readme: false };
  if (depth > 3) return flags;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return flags; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const sub = probeContents(full, depth + 1);
      for (const k of Object.keys(flags)) flags[k] = flags[k] || sub[k];
      if (Object.values(flags).every(Boolean)) return flags;
    } else {
      const n = e.name.toLowerCase();
      if (/论文|开题|说明书|任务书|报告/.test(n)) flags.paper = true;
      if (/\.(ppt|pptx)$/.test(n)) flags.ppt = true;
      if (/\.(mp4|avi|mov|wmv|flv|mkv)$/.test(n)) flags.video = true;
      if (/\.(sql|db|mdf|bak)$/.test(n)) flags.db = true;
      if (/readme|说明/.test(n)) flags.readme = true;
    }
  }
  return flags;
}

// 文件夹大小（迭代式递归，避免栈溢出）
function dirSize(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      try {
        if (e.isDirectory()) stack.push(full);
        else if (e.isFile()) total += fs.statSync(full).size;
      } catch { /* ignore */ }
    }
  }
  return total;
}

// ---------- 文件夹型扫描 ----------
function scanFolderType(rootDir, techHint, seen) {
  const products = [];
  const techRoots = [];
  try {
    for (const e of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (e.isDirectory()) techRoots.push(path.join(rootDir, e.name));
    }
  } catch { return products; }

  for (const techRoot of techRoots) {
    const tech = techHint || detectTech(path.basename(techRoot));
    let groups;
    try { groups = fs.readdirSync(techRoot, { withFileTypes: true }); } catch { continue; }
    for (const g of groups) {
      if (!g.isDirectory()) continue;
      const groupPath = path.join(techRoot, g.name);
      let items;
      try { items = fs.readdirSync(groupPath, { withFileTypes: true }); } catch { continue; }
      const hasSubDir = items.some((i) => i.isDirectory());
      if (!hasSubDir) {
        // 压缩包直接铺在 groupPath 下（集合目录，每个包 = 一个独立项目，不归并）
        const zips = items.filter((i) => i.isFile() && /\.(zip|rar|7z)$/i.test(i.name)).map((i) => path.join(groupPath, i.name));
        products.push(...buildArchiveGroup(zips, tech, seen, { merge: false }));
        continue;
      }
      for (const i of items) {
        if (i.isDirectory()) {
          const projectPath = path.join(groupPath, i.name);
          if (HELPER_DIRS.test(i.name) && !hasCodeDir(projectPath)) continue;
          products.push(makeFolderProduct(projectPath, tech, seen));
        } else if (i.isFile() && /\.(zip|rar|7z)$/i.test(i.name)) {
          products.push(makeArchiveProduct(path.join(groupPath, i.name), tech, seen));
        }
      }
    }
  }
  return products;
}

function hasCodeDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).some(
      (e) => e.isDirectory() && (HELPER_DIRS.test(e.name) === false || /代码|项目源码/.test(e.name))
    );
  } catch { return false; }
}

function makeFolderProduct(dir, tech, seen) {
  const name = path.basename(dir);
  const size = dirSize(dir);
  const flags = probeContents(dir);
  const { title, qaNote } = cleanTitleV2(name);
  const no = parseNo(name) || parseNo(path.basename(path.dirname(dir)));
  const id = 'F:' + dir.toLowerCase();
  seen.add(id);
  // 顶层文件环境探测（有限深度）
  const envFiles = [];
  try {
    const stack = [{ d: dir, depth: 0 }];
    while (stack.length) {
      const cur = stack.pop();
      if (cur.depth > 3) continue;
      const ents = fs.readdirSync(cur.d, { withFileTypes: true });
      for (const e of ents) {
        if (e.isDirectory()) stack.push({ d: path.join(cur.d, e.name), depth: cur.depth + 1 });
        else envFiles.push(e.name);
        if (envFiles.length > 4000) break;
      }
      if (envFiles.length > 4000) break;
    }
  } catch { /* ignore */ }
  return {
    id: cryptoId(name, dir),
    sourcePath: dir,
    type: 'folder',
    no,
    title,
    name,
    tech,
    category: categorize(title),
    qaNote,
    envMarkers: detectEnvMarkers(envFiles),
    sizeBytes: size,
    sizeMB: Math.round(size / 1048576),
    hasPaper: flags.paper,
    hasPpt: flags.ppt,
    hasVideo: flags.video,
    hasDb: flags.db,
    keywords: [name, title].join(' '),
    files: []
  };
}

function makeArchiveProduct(file, tech, seen) {
  const name = path.basename(file);
  const size = fs.statSync(file).size;
  const flags = probeContents(path.dirname(file), 1);
  const { title, qaNote } = cleanTitleV2(name.replace(/\.(zip|rar|7z)$/i, ''));
  const no = parseNo(name);
  const id = 'A:' + file.toLowerCase();
  seen.add(id);
  return {
    id: cryptoId(name, file),
    sourcePath: file,
    type: 'archive',
    no,
    title,
    name,
    tech: tech || detectTech(name),
    category: categorize(title),
    qaNote,
    envMarkers: null, // 压缩包需要列条目，延迟到 merge 阶段
    sizeBytes: size,
    sizeMB: Math.round(size / 1048576),
    hasPaper: flags.paper,
    hasPpt: flags.ppt,
    hasVideo: flags.video,
    hasDb: flags.db,
    keywords: [name, title].join(' '),
    files: []
  };
}

/**
 * 同目录压缩包归并：
 * 一个项目目录下多个 zip/rar → 主源码包(商品) + 其余材料(files[])
 * merge=false 时（集合目录），每个包独立成商品，不做归并
 */
function buildArchiveGroup(zipPaths, tech, seen, { merge = true } = {}) {
  if (!zipPaths.length) return [];
  const items = zipPaths.map((f) => makeArchiveProduct(f, tech, seen));
  if (!merge || items.length === 1) {
    return items;
  }
  // 主包候选：非材料标记 且 非副本
  const mains = items.filter((p) => !MATERIAL_RE.test(p.name) && !COPY_RE.test(p.name));
  const pick = mains.length
    ? mains.sort((a, b) => b.sizeBytes - a.sizeBytes)[0]
    : items.sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
  const extras = items.filter((p) => p !== pick);
  const files = extras.map((p, i) => ({
    kind: classifyFileKind(p.name),
    name: p.name,
    path: p.sourcePath,
    sizeMB: p.sizeMB,
    ext: path.extname(p.name).replace('.', ''),
    sort: i
  }));
  // 材料标记汇总到主商品
  const mergedFlags = extras.reduce(
    (acc, p) => ({
      paper: acc.paper || p.hasPaper,
      ppt: acc.ppt || p.hasPpt,
      video: acc.video || p.hasVideo,
      db: acc.db || p.hasDb
    }),
    { paper: pick.hasPaper, ppt: pick.hasPpt, video: pick.hasVideo, db: pick.hasDb }
  );
  pick.hasPaper = mergedFlags.paper;
  pick.hasPpt = mergedFlags.ppt;
  pick.hasVideo = mergedFlags.video;
  pick.hasDb = mergedFlags.db;
  pick.files = files;
  return [pick];
}

// ---------- 压缩包型扫描（按目录归并） ----------
function scanArchiveType(rootDir, seen) {
  const products = [];
  const byDir = new Map();
  const stack = [rootDir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && /\.(zip|rar|7z)$/i.test(e.name)) {
        const dir = path.dirname(full);
        if (!byDir.has(dir)) byDir.set(dir, []);
        byDir.get(dir).push(full);
      }
    }
  }
  for (const [dir, zips] of byDir.entries()) {
    products.push(...buildArchiveGroup(zips, 'SpringBoot', seen, { merge: shouldMergeDir(path.basename(dir), zips.length) }));
  }
  return products;
}

// ---------- 跨目录去重（同编号 + 标题高度相似） ----------
function titleSimilarity(a, b) {
  const x = a.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();
  const y = b.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return Math.min(x.length, y.length) / Math.max(x.length, y.length);
  // 公共子串比例（简化）
  let common = 0;
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] === y[i]) common++;
    else break;
  }
  return common / Math.max(x.length, y.length);
}

function dedupCrossRoot(products) {
  const keep = [];
  const groups = new Map();
  for (const p of products) {
    // 无编号商品不参与跨目录去重，直接保留
    if (p.no == null) { keep.push(p); continue; }
    const key = `${p.tech}|${p.no}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const dupIds = new Set();
  for (const group of groups.values()) {
    if (group.length <= 1) { keep.push(...group); continue; }
    // 计算两两相似度，相似则保留"质量最高"的（folder > archive，材料多，体积大）
    const used = new Array(group.length).fill(false);
    for (let i = 0; i < group.length; i++) {
      if (used[i]) continue;
      const cluster = [i];
      for (let j = i + 1; j < group.length; j++) {
        if (!used[j] && titleSimilarity(group[i].title, group[j].title) >= 0.5) {
          cluster.push(j);
          used[j] = true;
        }
      }
      if (cluster.length === 1) { keep.push(group[i]); continue; }
      const cands = cluster.map((k) => group[k]);
      const quality = (p) =>
        (p.type === 'folder' ? 100 : 0) +
        (p.hasPaper ? 10 : 0) + (p.hasPpt ? 5 : 0) + (p.hasVideo ? 5 : 0) +
        Math.min(50, Math.round(p.sizeMB / 10));
      cands.sort((a, b) => quality(b) - quality(a));
      const main = cands[0];
      const others = cands.slice(1);
      // 将其他根的包并入主商品 files（防止遗漏论文/PPT 材料）
      for (const o of others) {
        const kind = classifyFileKind(o.name);
        if (!main.files.some((f) => f.name === o.name)) {
          main.files.push({ kind, name: o.name, path: o.sourcePath, sizeMB: o.sizeMB, ext: path.extname(o.name).replace('.', ''), sort: main.files.length });
        }
        main.hasPaper = main.hasPaper || o.hasPaper;
        main.hasPpt = main.hasPpt || o.hasPpt;
        main.hasVideo = main.hasVideo || o.hasVideo;
        main.hasDb = main.hasDb || o.hasDb;
        dupIds.add(o.id);
      }
      keep.push(main);
    }
  }
  return { products: keep, dupCount: dupIds.size };
}

// ---------- 主流程 ----------
function main() {
  const t0 = performance.now();
  const args = process.argv.slice(2);
  const doCsv = args.includes('--csv');
  const noMerge = args.includes('--no-merge');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const seen = new Set();
  const products = [];

  const congRong = 'D:\\从戎网站源码';
  const zhengli = 'D:\\整理代码';

  if (fs.existsSync(congRong)) {
    console.log('扫描文件夹型: 从戎网站源码 ...');
    products.push(...scanFolderType(congRong, null, seen));
  }
  if (fs.existsSync(zhengli)) {
    console.log('扫描压缩包型: 整理代码 ...');
    products.push(...scanArchiveType(zhengli, seen));
  }

  // 压缩包环境标记（延迟探测：列条目，仅对主包）
  let envProbed = 0;
  if (!noMerge) {
    const probe = require(path.join(ROOT, 'server/src/lib/probe'));
    for (const p of products) {
      if (p.type !== 'archive') continue;
      const entries = probe.listArchiveEntries(p.sourcePath);
      if (entries.length) {
        p.envMarkers = detectEnvMarkersFromEntries(entries);
        envProbed++;
      }
    }
    console.log(`压缩包环境标记探测 ${envProbed} 个`);
  }

  let finalList = products;
  let dupCount = 0;
  if (!noMerge) {
    const r = dedupCrossRoot(products);
    finalList = r.products;
    dupCount = r.dupCount;
    console.log(`跨目录去重: 剔除重复 ${dupCount} 条`);
  }

  const total = finalList.length;
  console.log(`共扫描到 ${total} 个源码商品（归并前 ${products.length}）`);

  const byTech = {};
  const byType = {};
  const byCat = {};
  let totalMB = 0;
  for (const p of finalList) {
    byTech[p.tech] = (byTech[p.tech] || 0) + 1;
    byType[p.type] = (byType[p.type] || 0) + 1;
    byCat[p.category] = (byCat[p.category] || 0) + 1;
    totalMB += p.sizeMB;
  }
  console.log('\n== 技术栈分布 ==');
  for (const [k, v] of Object.entries(byTech).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
  console.log('== 类型分布 ==');
  for (const [k, v] of Object.entries(byType)) console.log(`  ${k}: ${v}`);
  console.log('== 分类分布(TOP10) ==');
  for (const [k, v] of Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${k}: ${v}`);
  console.log(`== 合计体积: ${(totalMB / 1024).toFixed(1)} GB ==`);

  const out = finalList.slice(0, limit);
  const json = path.join(DATA_DIR, 'products.json');
  fs.writeFileSync(json, JSON.stringify(out, null, 2), 'utf8');
  console.log(`已写入 ${json} (${out.length} 条)`);

  // 附注文件：归并中被吸收的重复包清单（供人工核对）
  if (!noMerge) {
    const notes = products
      .filter((p) => !finalList.some((f) => f.id === p.id))
      .map((p) => ({ sourcePath: p.sourcePath, name: p.name, title: p.title, no: p.no, tech: p.tech }));
    const notePath = path.join(DATA_DIR, 'merged-notes.json');
    fs.writeFileSync(notePath, JSON.stringify(notes, null, 2), 'utf8');
    console.log(`归并明细已写入 ${notePath} (${notes.length} 条被吸收)`);
  }

  if (doCsv) {
    const csv = path.join(DATA_DIR, 'products.csv');
    const header = 'no,title,tech,category,type,sizeMB,paper,ppt,video,db,qaNote,sourcePath';
    const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const rows = out.map((p) =>
      [p.no, p.title, p.tech, p.category, p.type, p.sizeMB, p.hasPaper ? 1 : 0, p.hasPpt ? 1 : 0, p.hasVideo ? 1 : 0, p.hasDb ? 1 : 0, p.qaNote, p.sourcePath].map(esc).join(',')
    );
    fs.writeFileSync(csv, [header, ...rows].join('\r\n'), 'utf8');
    console.log(`已写入 ${csv}`);
  }
  console.log(`耗时: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
}

// 简易稳定 id
function cryptoId(name, pathStr) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(pathStr).digest('hex').slice(0, 12);
}

main();
