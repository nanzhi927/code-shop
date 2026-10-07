const { systemPrompt, chapterUserPrompt } = require('./proposalPrompt');

function mockChapter(profile, chapter) {
  const title = profile.title || '课题';
  const tech = profile.tech || '相关技术';
  const mods = (profile.modules || []).join('、') || '核心业务模块';
  const domain = profile.domain || '目标领域';

  if (chapter.title.includes('背景')) {
    return [
      `随着信息化与${domain}业务数字化的推进，传统人工处理方式在效率与可追溯性方面逐渐显现不足。选题「${title}」旨在结合 ${tech} 技术栈，围绕 ${mods} 等业务能力，构建可演示、可扩展的业务系统原型。`,
      '',
      '本课题的意义主要体现在：一是服务实际场景中的信息流转与管理需求；二是帮助学生完整经历需求分析、设计实现与测试验证过程；三是为后续功能扩展与二次开发预留清晰模块边界。'
    ].join('\n');
  }
  if (chapter.title.includes('现状')) {
    return [
      `国内外在${domain}信息化方向已有较多管理系统与平台实践，常见方案多采用 B/S 架构，后端以 Java/Spring 生态或同类框架实现业务接口，前端负责可视化交互。`,
      '',
      `现有研究与产品在通用管理能力上较成熟，但针对「${title}」所强调的 ${mods} 等组合需求，仍可在流程闭环、权限划分与可演示性方面做针对性设计。本文拟在吸收已有经验基础上，结合 ${tech} 给出可落地的实现路径（以下论述为学习向归纳，具体文献请自行检索补充）。`
    ].join('\n');
  }
  if (chapter.title.includes('内容') || chapter.title.includes('目标')) {
    return [
      `研究内容包括：梳理「${title}」业务边界；完成 ${mods} 等模块的需求分析；基于 ${tech} 完成总体架构与主要接口设计；实现可运行原型并进行基础测试。`,
      '',
      '研究目标：形成结构清晰的需求与设计文档，交付可演示系统，并总结关键技术难点与改进方向。'
    ].join('\n');
  }
  if (chapter.title.includes('方法') || chapter.title.includes('技术路线')) {
    return [
      `技术路线拟采用：需求分析 → 概要/详细设计 → 编码实现 → 单元与联调测试 → 演示验收。`,
      '',
      `实现层优先使用 ${tech}，数据持久化采用关系型数据库；权限与业务规则集中在服务端校验。开发过程遵循模块化，优先打通 ${mods} 主路径，再完善辅助功能。`
    ].join('\n');
  }
  if (chapter.title.includes('需求')) {
    return [
      '### 功能需求',
      `- 围绕 ${mods} 提供增删改查、状态流转与基础查询统计能力。`,
      `- 区分普通用户与管理员（或业务审核角色）的权限边界。`,
      '',
      '### 非功能需求',
      '- 界面简洁，核心流程可在答辩环境演示。',
      '- 关键操作可追溯，异常有基本提示。',
      '- 代码结构清晰，便于说明与二次开发。'
    ].join('\n');
  }
  if (chapter.title.includes('设计') || chapter.title.includes('总体')) {
    return [
      `系统拟采用前后端分离或经典 MVC 分层。后端负责业务与数据访问，前端负责页面交互；数据库存储用户、业务主表及关联表。`,
      '',
      `模块上按 ${mods} 划分，降低耦合。接口风格保持一致，便于后续扩展消息通知、导入导出等能力。`
    ].join('\n');
  }
  if (chapter.title.includes('可行')) {
    return [
      `**技术可行性**：${tech} 与配套组件生态成熟，学习与部署成本可控。`,
      '',
      '**经济可行性**：以学习与课程设计为目标，主要成本为开发与调试时间。',
      '',
      '**操作可行性**：角色与流程贴近常见业务习惯，答辩演示路径短、可讲清楚。'
    ].join('\n');
  }
  if (chapter.title.includes('进度')) {
    return [
      '| 阶段 | 时间安排 | 主要工作 |',
      '| --- | --- | --- |',
      '| 第1-2周 | 需求分析 | 调研业务、确定功能清单与用例 |',
      '| 第3-4周 | 系统设计 | 架构、数据库、接口草案 |',
      '| 第5-8周 | 编码实现 | 完成 ' + mods + ' 等核心模块 |',
      '| 第9-10周 | 测试完善 | 联调、修缺陷、准备演示数据 |',
      '| 第11-12周 | 文档与答辩 | 完善说明书、答辩材料 |',
      '',
      '> 以上为参考排期，请按学校校历调整。'
    ].join('\n');
  }
  if (chapter.title.includes('预期') || chapter.title.includes('成果')) {
    return [
      `- 完成「${title}」可运行原型，覆盖 ${mods} 等核心流程。`,
      '- 形成需求说明、设计说明与必要测试记录。',
      '- 具备答辩演示能力，并明确后续可改进点（如移动端适配、消息推送等）。'
    ].join('\n');
  }
  if (chapter.title.includes('参考')) {
    return [
      '以下为**格式示例与检索方向**，请务必自行在知网/万方等核验后替换，禁止直接当作真实已读文献使用：',
      '',
      '[1] 作者. 文献题名[J]. 期刊名, 年, 卷(期): 页码.',
      '[2] 作者. 书名[M]. 出版地: 出版社, 年.',
      '[3] 作者. 学位论文题名[D]. 保存地: 保存单位, 年.',
      '',
      `建议检索关键词：${domain}；${tech}；信息系统；${(profile.modules || [])[0] || '业务管理'}。`
    ].join('\n');
  }
  return `围绕「${title}」与 ${tech}，结合 ${mods} 阐述「${chapter.title}」相关内容。请在定稿前按学校模板补充细节与规范用语。`;
}

async function chatMock({ profile, chapter, index, total }) {
  const content = mockChapter(profile, chapter);
  // 轻微延迟模拟生成
  await new Promise((r) => setTimeout(r, 40 + (index % 3) * 20));
  return {
    content,
    tokensIn: Math.ceil((systemPrompt().length + chapterUserPrompt(profile, chapter, index, total).length) / 4),
    tokensOut: Math.ceil(content.length / 4),
    provider: 'mock'
  };
}

module.exports = { chatMock, mockChapter };
