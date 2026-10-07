/**
 * 默认开题大纲（无模板时）
 */
function defaultOutline() {
  return [
    { id: 'c1', title: '选题背景与意义', level: 1 },
    { id: 'c2', title: '国内外研究现状', level: 1 },
    { id: 'c3', title: '研究内容与目标', level: 1 },
    { id: 'c4', title: '研究方法与技术路线', level: 1 },
    { id: 'c5', title: '系统需求分析', level: 1 },
    { id: 'c6', title: '总体设计思路', level: 1 },
    { id: 'c7', title: '可行性分析', level: 1 },
    { id: 'c8', title: '进度安排', level: 1 },
    { id: 'c9', title: '预期成果', level: 1 },
    { id: 'c10', title: '参考文献', level: 1 }
  ];
}

function normalizeOutline(list) {
  if (!Array.isArray(list) || !list.length) return defaultOutline();
  return list
    .map((c, i) => ({
      id: String(c.id || `c${i + 1}`).slice(0, 32),
      title: String(c.title || '').trim().slice(0, 80),
      level: Number(c.level) === 2 ? 2 : 1
    }))
    .filter((c) => c.title)
    .slice(0, 16);
}

function normalizeProfile(raw = {}) {
  const modules = Array.isArray(raw.modules)
    ? raw.modules.map((m) => String(m || '').trim()).filter(Boolean).slice(0, 12)
    : String(raw.modulesText || '')
      .split(/[,，、\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);

  return {
    title: String(raw.title || '').trim().slice(0, 120),
    major: String(raw.major || '').trim().slice(0, 64),
    degree: String(raw.degree || '本科').trim().slice(0, 16),
    tech: String(raw.tech || '').trim().slice(0, 64),
    domain: String(raw.domain || '').trim().slice(0, 64),
    modules,
    background: String(raw.background || '').trim().slice(0, 300),
    innovation: String(raw.innovation || '').trim().slice(0, 300),
    wordCount: String(raw.wordCount || '约3000字').trim().slice(0, 32)
  };
}

function validateProfile(p) {
  if (!p.title) return '请填写开题题目';
  if (!p.tech) return '请填写技术栈';
  if (!p.domain) return '请填写业务领域';
  if (!p.modules.length) return '请至少填写 1 个功能模块';
  return null;
}

module.exports = { defaultOutline, normalizeOutline, normalizeProfile, validateProfile };
