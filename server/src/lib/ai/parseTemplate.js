const mammoth = require('mammoth');
const { defaultOutline, normalizeOutline } = require('./outline');

const HEADING_RE = /^(?:第[一二三四五六七八九十百零〇\d]+[章节部分]|[一二三四五六七八九十]+[、.．]|（[一二三四五六七八九十]+）|\([一二三四五六七八九十]+\)|\d+[、.．]\s*|[（(]?\d+[）)][.、．]?)\s*(.+)$/;
const PLAIN_NUM_RE = /^(\d{1,2})[.、．]\s*(.+)$/;

function cleanTitle(t) {
  return String(t || '')
    .replace(/\s+/g, ' ')
    .replace(/^[.\-—_]+|[.\-—_]+$/g, '')
    .trim()
    .slice(0, 80);
}

function looksLikeHeading(line) {
  const s = line.trim();
  if (!s || s.length > 60) return false;
  if (/^参考文献|^附录|^致谢/.test(s)) return true;
  if (HEADING_RE.test(s) || PLAIN_NUM_RE.test(s)) return true;
  if (/^[一二三四五六七八九十]+[、.．]/.test(s)) return true;
  return false;
}

function extractTitleFromLine(line) {
  const s = line.trim();
  let m = s.match(HEADING_RE);
  if (m) return cleanTitle(m[1] || s);
  m = s.match(PLAIN_NUM_RE);
  if (m) return cleanTitle(m[2] || s);
  return cleanTitle(s);
}

function outlineFromText(text) {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const titles = [];
  const seen = new Set();
  for (const line of lines) {
    if (!looksLikeHeading(line)) continue;
    const title = extractTitleFromLine(line);
    if (!title || title.length < 2) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    // 跳过明显非章节的短标签
    if (/^(目录|封面|姓名|学号|学院|专业|指导教师)$/.test(title)) continue;
    seen.add(key);
    titles.push(title);
    if (titles.length >= 16) break;
  }

  if (titles.length < 3) return { outline: defaultOutline(), parsed: false, rawTitles: titles };
  return {
    outline: normalizeOutline(titles.map((title, i) => ({ id: `t${i + 1}`, title, level: 1 }))),
    parsed: true,
    rawTitles: titles
  };
}

function outlineFromHtml(html) {
  const headings = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[2].replace(/<[^>]+>/g, '').trim();
    const title = cleanTitle(raw);
    if (title) headings.push(title);
  }
  if (headings.length >= 3) {
    return {
      outline: normalizeOutline(headings.slice(0, 16).map((title, i) => ({ id: `h${i + 1}`, title, level: 1 }))),
      parsed: true,
      rawTitles: headings
    };
  }
  const text = html.replace(/<[^>]+>/g, '\n');
  return outlineFromText(text);
}

async function parseDocxBuffer(buffer) {
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const textResult = await mammoth.extractRawText({ buffer });
  const fromHtml = outlineFromHtml(htmlResult.value || '');
  if (fromHtml.parsed) {
    return {
      ...fromHtml,
      text: String(textResult.value || '').slice(0, 20000),
      warnings: htmlResult.messages || []
    };
  }
  const fromText = outlineFromText(textResult.value || '');
  return {
    ...fromText,
    text: String(textResult.value || '').slice(0, 20000),
    warnings: textResult.messages || []
  };
}

async function parsePdfBuffer(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  const text = String(data.text || '');
  const fromText = outlineFromText(text);
  return {
    ...fromText,
    text: text.slice(0, 20000),
    warnings: []
  };
}

async function parseTemplateBuffer(buffer, filename = '') {
  const name = String(filename || '').toLowerCase();
  if (name.endsWith('.pdf')) return parsePdfBuffer(buffer);
  return parseDocxBuffer(buffer);
}

module.exports = { parseDocxBuffer, parsePdfBuffer, parseTemplateBuffer, outlineFromText, outlineFromHtml };
