const { systemPrompt, chapterUserPrompt, rewriteChapterPrompt } = require('./proposalPrompt');
const { chatMock, mockChapter } = require('./mock');
const { logger } = require('../logger');

function getConfig() {
  const apiKey = process.env.AI_API_KEY || '';
  const baseUrl = (process.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const model = process.env.AI_MODEL || 'deepseek-flash';
  const timeout = parseInt(process.env.AI_TIMEOUT_MS, 10) || 120000;
  const forceMock = process.env.AI_PROVIDER === 'mock' || !apiKey;
  return { apiKey, baseUrl, model, timeout, forceMock };
}

async function chatOpenAICompat(messages) {
  const cfg = getConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeout);
  try {
    const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.6,
        messages,
        // V4.1 Flash 默认可能开 thinking，开题需要直接正文
        thinking: { type: 'disabled' }
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`AI HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = String(data.choices?.[0]?.message?.content || '').trim();
    if (!content) throw new Error('AI 返回为空');
    return {
      content,
      tokensIn: data.usage?.prompt_tokens || 0,
      tokensOut: data.usage?.completion_tokens || 0,
      provider: 'openai_compatible'
    };
  } finally {
    clearTimeout(timer);
  }
}

async function generateChapter(ctx) {
  const cfg = getConfig();
  if (cfg.forceMock) return chatMock(ctx);
  try {
    return await chatOpenAICompat([
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: chapterUserPrompt(ctx.profile, ctx.chapter, ctx.index, ctx.total) }
    ]);
  } catch (e) {
    logger.warn(`[ai] 真实模型失败，回退 mock: ${e.message}`);
    const mock = await chatMock(ctx);
    mock.fallbackFrom = 'openai_compatible';
    mock.error = e.message;
    return mock;
  }
}

async function rewriteChapter({ profile, chapterTitle, oldContent, action }) {
  const cfg = getConfig();
  const chapter = { title: chapterTitle };
  if (cfg.forceMock) {
    let content = mockChapter(profile, chapter);
    if (action === 'expand') {
      content = `${content}\n\n结合模块「${(profile.modules || []).slice(0, 3).join('、')}」可进一步细化用例与数据流，形成可答辩的演示路径。`;
    } else if (action === 'shrink') {
      content = content.split('\n').filter(Boolean).slice(0, 3).join('\n\n');
    } else {
      content = `（改写稿）\n\n${content}`;
    }
    await new Promise((r) => setTimeout(r, 60));
    return { content, tokensIn: 120, tokensOut: Math.ceil(content.length / 4), provider: 'mock' };
  }
  try {
    return await chatOpenAICompat([
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: rewriteChapterPrompt(profile, chapterTitle, oldContent, action) }
    ]);
  } catch (e) {
    logger.warn(`[ai] 改写失败，回退 mock: ${e.message}`);
    let content = mockChapter(profile, chapter);
    if (action === 'expand') content += '\n\n（已扩写要点，请按学校要求补充细节。）';
    if (action === 'shrink') content = content.split('\n').filter(Boolean).slice(0, 3).join('\n\n');
    return { content, tokensIn: 80, tokensOut: Math.ceil(content.length / 4), provider: 'mock', error: e.message };
  }
}

async function generateReport(profile, outline, onChapter) {
  const parts = [];
  let tokensIn = 0;
  let tokensOut = 0;
  let provider = 'mock';
  const total = outline.length;
  parts.push(`# ${profile.title}\n`);
  parts.push(`> 本报告由开题助手生成，仅供学习参考，请按学校模板修订并核对参考文献。专业：${profile.major || '—'}｜层次：${profile.degree || '本科'}｜技术栈：${profile.tech}\n`);

  for (let i = 0; i < outline.length; i++) {
    const chapter = outline[i];
    if (typeof onChapter === 'function') {
      await onChapter({ type: 'chapter_start', index: i, total, title: chapter.title });
    }
    const r = await generateChapter({ profile, chapter, index: i, total });
    tokensIn += r.tokensIn || 0;
    tokensOut += r.tokensOut || 0;
    provider = r.provider || provider;
    const block = `\n## ${i + 1}. ${chapter.title}\n\n${r.content}\n`;
    parts.push(block);
    if (typeof onChapter === 'function') {
      await onChapter({
        type: 'chapter_done',
        index: i,
        total,
        title: chapter.title,
        content: r.content,
        provider: r.provider
      });
    }
  }

  return {
    contentMd: parts.join('\n').trim() + '\n',
    tokensIn,
    tokensOut,
    provider
  };
}

function splitMarkdownChapters(md) {
  const text = String(md || '');
  const re = /^##\s+(.+)$/gm;
  const matches = [...text.matchAll(re)];
  if (!matches.length) {
    return { preface: text, chapters: [] };
  }
  const preface = text.slice(0, matches[0].index).trimEnd();
  const chapters = matches.map((m, i) => {
    const start = m.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const block = text.slice(start, end).trimEnd();
    const titleLine = m[1].trim();
    const title = titleLine.replace(/^\d+[.、．)\s]+/, '').trim();
    const body = block.replace(/^##\s+.+\n?/, '').trim();
    return { title, titleLine, body, block };
  });
  return { preface, chapters };
}

function joinMarkdownChapters(preface, chapters) {
  const parts = [];
  if (preface) parts.push(preface.trimEnd());
  chapters.forEach((c, i) => {
    const title = c.titleLine || `${i + 1}. ${c.title}`;
    parts.push(`\n## ${title}\n\n${(c.body || '').trim()}\n`);
  });
  return parts.join('\n').trim() + '\n';
}

function parseModulesJson(raw) {
  let text = String(raw || '').trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  let arr;
  try {
    arr = JSON.parse(text);
  } catch {
    arr = text
      .split(/[\n,，、;；]/)
      .map((s) => s.replace(/^[\d.、．)\-\s"'\[]+|["'\]]+$/g, '').trim())
      .filter(Boolean);
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const m = String(item || '').trim().slice(0, 20);
    if (!m || m.length < 2 || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
    if (out.length >= 12) break;
  }
  return out;
}

function heuristicModules(title, domain) {
  const t = String(title || '');
  const base = ['用户登录注册', '个人中心', '消息通知', '数据统计报表', '后台管理'];
  const extras = [];
  if (/失物|招领/.test(t)) extras.push('失物信息发布', '认领申请', '认领审核', '物品分类检索');
  else if (/图书|借阅/.test(t)) extras.push('图书检索', '借还管理', '预约续借', '逾期提醒');
  else if (/商城|购物|电商/.test(t)) extras.push('商品浏览', '购物车', '订单管理', '评价售后');
  else if (/宿舍|报修/.test(t)) extras.push('报修提交', '工单派发', '进度查询', '评价反馈');
  else if (/预约|挂号/.test(t)) extras.push('号源预约', '就诊记录', '取消改期', '医生排班');
  else if (/考勤|人事/.test(t)) extras.push('考勤打卡', '请假审批', '部门管理', '薪资查询');
  else if (/点餐|外卖|餐饮/.test(t)) extras.push('菜品浏览', '在线下单', '配送跟踪', '商家管理');
  else {
    const domainMap = {
      校园教育: ['信息发布', '审核管理', '师生互动'],
      电子商务: ['商品管理', '订单履约', '营销活动'],
      医疗健康: ['预约挂号', '病历查询', '药品库存'],
      政务办公: ['事项申报', '流程审批', '进度公开'],
      餐饮外卖: ['菜品管理', '订单配送', '评价反馈'],
      图书管理: ['图书编目', '借还流通', '读者管理'],
      人事财务: ['组织架构', '考勤请假', '报表汇总'],
      物联网: ['设备接入', '实时监控', '告警推送']
    };
    extras.push(...(domainMap[domain] || ['核心业务办理', '业务查询', '业务审核']));
  }
  return [...new Set([...extras, ...base])].slice(0, 12);
}

async function suggestModules({ title, tech, domain }) {
  const cfg = getConfig();
  const fallback = heuristicModules(title, domain);
  if (cfg.forceMock) {
    return { modules: fallback, provider: 'mock' };
  }
  try {
    const res = await chatOpenAICompat([
      {
        role: 'system',
        content:
          '你是计算机毕设需求分析助手。根据题目输出功能模块清单。只返回 JSON 字符串数组，不要 markdown、不要解释。每个模块是 4～12 字的中文功能名。'
      },
      {
        role: 'user',
        content:
          `题目：${String(title || '').slice(0, 120)}\n技术栈：${tech || '未定'}\n业务领域：${domain || '其他'}\n\n` +
          '请给出 8～12 个贴合该题目的功能模块：包含登录/权限类通用项，以及题目特有的业务模块（不要全是空泛的「核心业务办理」）。只输出 JSON 数组。'
      }
    ]);
    const modules = parseModulesJson(res.content);
    if (modules.length >= 5) {
      return { modules, provider: res.provider || 'openai_compatible' };
    }
    return {
      modules: [...new Set([...modules, ...fallback])].slice(0, 12),
      provider: res.provider || 'openai_compatible'
    };
  } catch (e) {
    logger.warn(`[ai] 模块建议失败，回退启发式: ${e.message}`);
    return { modules: fallback, provider: 'mock', error: e.message };
  }
}

module.exports = {
  generateReport,
  generateChapter,
  rewriteChapter,
  suggestModules,
  getConfig,
  splitMarkdownChapters,
  joinMarkdownChapters
};
