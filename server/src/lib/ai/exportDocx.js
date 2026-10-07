const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle
} = require('docx');

function inlineRuns(line) {
  // 简单处理 **加粗**
  const parts = String(line || '').split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return new TextRun({ text: p.slice(2, -2), bold: true, font: '宋体', size: 24 });
    }
    return new TextRun({ text: p, font: '宋体', size: 24 });
  });
}

function mdToParagraphs(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const paras = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      paras.push(new Paragraph({ children: [] }));
      continue;
    }
    if (/^#\s+/.test(line)) {
      paras.push(new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun({ text: line.replace(/^#\s+/, ''), bold: true, font: '黑体', size: 32 })]
      }));
      continue;
    }
    if (/^##\s+/.test(line)) {
      paras.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: line.replace(/^##\s+/, ''), bold: true, font: '黑体', size: 28 })]
      }));
      continue;
    }
    if (/^###\s+/.test(line)) {
      paras.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
        children: [new TextRun({ text: line.replace(/^###\s+/, ''), bold: true, font: '黑体', size: 26 })]
      }));
      continue;
    }
    if (/^>\s?/.test(line)) {
      paras.push(new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: line.replace(/^>\s?/, ''), italics: true, color: '666666', font: '宋体', size: 22 })]
      }));
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      paras.push(new Paragraph({
        spacing: { after: 60 },
        indent: { left: 420 },
        children: inlineRuns(`• ${line.replace(/^[-*]\s+/, '')}`)
      }));
      continue;
    }
    if (/^\|.+\|$/.test(line.trim()) || /^\|?\s*:?-{3,}/.test(line.trim())) {
      // 表格简化为普通行，避免复杂表格布局
      const cells = line.trim().split('|').filter(Boolean).map((c) => c.trim()).join('  |  ');
      if (/^:?-{3,}/.test(cells.replace(/\s+\|\s+/g, ''))) continue;
      paras.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: cells, font: '宋体', size: 22 })]
      }));
      continue;
    }
    paras.push(new Paragraph({
      spacing: { after: 120, line: 360 },
      indent: { firstLine: 480 },
      children: inlineRuns(line.trim())
    }));
  }
  return paras;
}

async function markdownToDocxBuffer(md, title = '开题报告') {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: title || '开题报告', bold: true, font: '黑体', size: 36 })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 8 } },
      children: [new TextRun({ text: '仅供学习参考 · 请按学校模板修订', color: '888888', font: '宋体', size: 18 })]
    }),
    ...mdToParagraphs(md)
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
        }
      },
      children
    }]
  });
  return Packer.toBuffer(doc);
}

module.exports = { markdownToDocxBuffer };
