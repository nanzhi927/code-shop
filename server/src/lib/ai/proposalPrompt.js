function systemPrompt() {
  return [
    '你是高校毕业设计「开题报告」写作助手，面向本科/专科常见要求。',
    '根据用户提供的题目、技术栈与功能模块，撰写正式、条理清晰的开题报告章节初稿。',
    '要求：',
    '1. 使用简体中文，学术书面语，避免营销腔与口语。',
    '2. 紧扣用户给出的模块与技术栈，不要写空洞套话。',
    '3. 不得编造具体调研百分比、实验数据、真实用户访谈结论。',
    '4. 不得捏造不存在的论文、DOI、期刊卷期；参考文献仅给检索方向与格式示例，并提醒用户自行核实替换。',
    '5. 只输出当前章节正文 Markdown（可用二级/三级标题），不要重复输出报告大标题，不要包裹代码块。',
    '6. 内容仅供学习参考，不得暗示可直接用于学术不端。'
  ].join('\n');
}

function chapterUserPrompt(profile, chapter, index, total) {
  const modules = (profile.modules || []).join('、') || '待补充';
  return [
    `请撰写开题报告第 ${index + 1}/${total} 章：【${chapter.title}】`,
    '',
    '【课题信息】',
    `- 题目：${profile.title}`,
    `- 专业/层次：${profile.major || '未填'} / ${profile.degree || '本科'}`,
    `- 技术栈：${profile.tech}`,
    `- 业务领域：${profile.domain}`,
    `- 核心模块：${modules}`,
    `- 背景补充：${profile.background || '无'}`,
    `- 创新点：${profile.innovation || '无'}`,
    `- 篇幅期望：${profile.wordCount || '适中'}`,
    '',
    chapter.title.includes('参考')
      ? '本章请给出 5～8 条「示例参考文献格式」与检索关键词建议，明确标注需用户自行核验替换，禁止伪造真实文献条目细节。'
      : '本章正文建议 300～600 字，分段清晰。'
  ].join('\n');
}

/** action: rewrite | expand | shrink */
function rewriteChapterPrompt(profile, chapterTitle, oldContent, action) {
  const modules = (profile.modules || []).join('、') || '待补充';
  const actionHint = {
    rewrite: '请重写本章，保持主题一致但换一种表述与结构，避免与原文高度雷同。篇幅与原文相近。',
    expand: '请在保留原意基础上扩写本章，补充论证层次与模块关联说明，篇幅约为原文的 1.4～1.8 倍。',
    shrink: '请压缩本章，保留关键论点与模块信息，删除套话，篇幅约为原文的 50%～70%。'
  }[action] || '请重写本章。';

  return [
    `请对开题报告章节【${chapterTitle}】进行改写。`,
    actionHint,
    '',
    '【课题信息】',
    `- 题目：${profile.title}`,
    `- 技术栈：${profile.tech}`,
    `- 业务领域：${profile.domain}`,
    `- 核心模块：${modules}`,
    '',
    '【原文】',
    oldContent || '（空）',
    '',
    '只输出改写后的章节正文 Markdown，不要输出大标题，不要解释。'
  ].join('\n');
}

module.exports = { systemPrompt, chapterUserPrompt, rewriteChapterPrompt };

