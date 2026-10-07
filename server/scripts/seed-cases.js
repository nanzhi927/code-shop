/**
 * 信任向交付案例种子（叙述骨架，不使用教程插画冒充截图）
 * 用法：node scripts/seed-cases.js
 *
 * 真实界面截图请在后台上传后填入 gallery / cover。
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../src/db');
const { ensureTables } = require('../src/routes/cases');

const CASES = [
  {
    slug: 'topic-rename-lostfound-audit',
    title: '选题表改了名字，系统还是旧题——4 天改完并能演示认领审核',
    summary: '答辩前把失物招领改成学院选题表同名，并补上管理端认领审核，主流程可重复演示。',
    cover: '',
    client_scene: '计算机本科。手里已有一套能跑的失物招领工程，但学院选题表题目已改；管理端没有「认领申请 → 通过/驳回」，导师演示时要看这条闭环。',
    service_type: 'modify',
    tech: 'SpringBoot',
    domain: '校园教育',
    duration_label: '约 4 天',
    scope_out: '不做支付、不做小程序端；开题与答辩 PPT 由同学按学院模板自改。',
    result_points: [
      '登录页与系统名与选题表一致',
      '认领审核列表可操作、可演示',
      '演示账号与冷启动步骤写进交付说明'
    ],
    deliverables: [
      '改后工程包',
      '运行说明（含演示账号）',
      '改动清单（改了哪些页面/表）'
    ],
    gallery: [],
    related_service_slugs: ['custom'],
    related_product_ids: '',
    sort_weight: 100,
    content_md: `## 怎么做的

1. 对照选题表截图，全局替换系统名、登录文案、部分包内标题（先列清单再改，避免漏网）。
2. 在管理端增加认领申请列表：待审 / 通过 / 驳回，状态回写到用户端。
3. 用空库冷启动一遍：导入脚本 → 配库名密码 → 演示账号登录 → 走完「发布失物 → 认领 → 审核」。
4. 交付时附改动清单，方便同学写论文「系统实现」章节时对照截图。

## 验收怎么对

同学按演示账号自己点通主流程；导师要看的「审核」入口能在管理员角色下找到。`
  },
  {
    slug: 'bookstore-first-week-run',
    title: '书城工程克隆后起不来：两天把本机跑通并留下冷启动备忘',
    summary: '端口占用与库表导入卡住后，两天内前后端能联调，同学可按备忘自己再启动。',
    cover: '',
    client_scene: '课程设计第一周。仓库能克隆，但启动报错：8080 被占、数据库连不上、SQL 导入半截失败。节点紧，同学自己排查两天没结果。',
    service_type: 'deploy',
    tech: 'SpringBoot',
    domain: '电子商务',
    duration_label: '约 2 天',
    scope_out: '不改业务功能；若要改模块，另走二次开发评估。',
    result_points: [
      '空库导入成功，配置与说明一致',
      '前后端本机联调可登录',
      '留下一页冷启动备忘（端口/库/账号）'
    ],
    deliverables: [
      '可用的本地运行配置说明',
      '演示账号纸质/文档备份',
      '常见报错对照（端口、密码、依赖）'
    ],
    gallery: [],
    related_service_slugs: ['deploy', 'custom'],
    related_product_ids: '',
    sort_weight: 95,
    content_md: `## 怎么做的

1. 核对 JDK / Maven / MySQL 版本是否与工程说明一致，先对齐环境再谈业务。
2. 新建空库，完整导入 SQL；修正配置里的库名、账号、密码（最常见卡点）。
3. 释放或改掉被占用的 8080；确认前端代理地址与后端端口一致。
4. 写一页「下次自己怎么开」：启动顺序、账号、若再报错先看哪三处。

## 验收怎么对

同学合上电脑再开，按备忘能在 15 分钟内进到登录页并完成一次下单演示（或项目主流程）。`
  },
  {
    slug: 'clinic-stats-module-week',
    title: '预约系统缺号源统计：一周内加上管理端报表并能导出',
    summary: '保留原预约主流程，只扩管理端「按日号源占用」统计与 CSV 导出，便于论文截图。',
    cover: '',
    client_scene: '已有社区诊所预约主流程。开题写过「号源统计」，但工程里没做；导师要求答辩前管理端能看见每日占用。',
    service_type: 'custom',
    tech: 'SpringBoot',
    domain: '医疗健康',
    duration_label: '约 1 周',
    scope_out: '不做移动端适配；不改用户端预约交互；不代写测试章节正文。',
    result_points: [
      '管理端新增统计页（按日聚合）',
      '可导出 CSV 作附录',
      '与原预约表联动，不破坏旧流程'
    ],
    deliverables: [
      '含统计模块的工程',
      '接口与页面改动说明',
      '建议截图清单（论文用）'
    ],
    gallery: [],
    related_service_slugs: ['custom'],
    related_product_ids: '',
    sort_weight: 90,
    content_md: `## 怎么做的

1. 先读现有预约表结构，确认「号源 / 日期 / 状态」字段，避免另起炉灶。
2. 管理端加统计页：按日期聚合占用，表格为主，必要时简单折线。
3. 提供导出 CSV，方便附录；权限仍走原管理员角色。
4. 联调：预约几条测试数据 → 看统计是否对得上 → 导出打开核对。

## 验收怎么对

用管理员登录能看到统计页；导出文件行数与页面合计一致；用户端预约流程与改前相同。`
  },
  {
    slug: 'defense-ppt-flow-screen',
    title: '系统能演示但讲不清：加购 12 页答辩页序 + 3 分钟主流程录屏',
    summary: '按真实主流程整理答辩页序与备用录屏，同学上场自己讲；不代替答辩陈述。',
    cover: '',
    client_scene: '系统已能演示，但 PPT 结构散、没有备用录屏。答辩临近，需要「页序清楚 + 主流程可回放」。',
    service_type: 'defense',
    tech: 'Vue',
    domain: '校园教育',
    duration_label: '约 3～5 天',
    scope_out: '不代替答辩陈述；封面学院信息由同学按模板自改；不保证各校评分标准。',
    result_points: [
      '12～16 页演示向页序',
      '主流程 3 分钟左右录屏备用',
      '附简短问答要点清单'
    ],
    deliverables: [
      'PPT 源文件',
      '录屏文件',
      '问答要点一页纸'
    ],
    gallery: [],
    related_service_slugs: ['defense'],
    related_product_ids: '',
    sort_weight: 85,
    content_md: `## 怎么做的

1. 先和同学确认「必须演示的 3～5 个页面」，页序按：背景 → 架构 → 模块 → 演示 → 总结。
2. 按真实界面做页，少贴大段文字；关键截图留给同学答辩当天替换最新界面。
3. 录一条主流程备用：登录 → 核心业务 → 管理端一眼能看懂的结果页。
4. 给一页问答要点：环境怎么配、和开题差异怎么解释、没做的功能怎么诚实说边界。

## 验收怎么对

同学自己能对着 PPT 讲完一遍；录屏在断网或现场翻车时可投屏备用。`
  }
];

async function upsert(c) {
  const [exist] = await pool.query('SELECT id FROM cases WHERE slug=? LIMIT 1', [c.slug]);
  const fields = [
    c.title,
    c.summary,
    c.cover || '',
    c.content_md,
    c.client_scene,
    c.service_type,
    c.tech,
    c.domain,
    c.duration_label || '',
    c.scope_out || '',
    JSON.stringify(c.result_points || []),
    JSON.stringify(c.deliverables || []),
    JSON.stringify(c.gallery || []),
    c.related_product_ids || '',
    (c.related_service_slugs || []).join(','),
    1,
    c.sort_weight || 0
  ];
  if (exist.length) {
    await pool.query(
      `UPDATE cases SET title=?, summary=?, cover=?, content_md=?, client_scene=?, service_type=?, tech=?, domain=?,
       duration_label=?, scope_out=?, result_points_json=?, deliverables_json=?, gallery_json=?,
       related_product_ids=?, related_service_slugs=?, status=?, sort_weight=?,
       published_at=COALESCE(published_at, NOW()) WHERE id=?`,
      [...fields, exist[0].id]
    );
    return { slug: c.slug, action: 'updated' };
  }
  await pool.query(
    `INSERT INTO cases
     (slug, title, summary, cover, content_md, client_scene, service_type, tech, domain,
      duration_label, scope_out, result_points_json, deliverables_json, gallery_json,
      related_product_ids, related_service_slugs, status, sort_weight, published_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
    [c.slug, ...fields]
  );
  return { slug: c.slug, action: 'inserted' };
}

async function main() {
  await ensureTables();
  // 下架旧版「插画冒充截图」种子，避免继续误导
  const oldSlugs = [
    'campus-lost-modify-springboot',
    'bookstore-deploy-week1',
    'clinic-custom-module',
    'defense-ppt-add-on',
    'dorm-repair-mixed',
    'inventory-modify-fields'
  ];
  await pool.query(
    `UPDATE cases SET status=0 WHERE slug IN (${oldSlugs.map(() => '?').join(',')})`,
    oldSlugs
  );
  const results = [];
  for (const c of CASES) results.push(await upsert(c));
  const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM cases WHERE status=1');
  console.log(JSON.stringify({ ok: true, results, published: c }, null, 2));
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
