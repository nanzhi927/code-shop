/**
 * 最小 Markdown 子集 → HTML，并做 XSS 剥离。
 * 支持：标题、段落、列表、任务清单、引用、分隔线、表格、代码块、加粗、链接、图片。
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeAttrUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^\s*javascript\s*:/i.test(u) || /^\s*vbscript\s*:/i.test(u) || /^\s*data\s*:/i.test(u)) {
    return '';
  }
  return escapeHtml(u);
}

function sanitizeHtml(html) {
  let s = String(html || '');
  s = s.replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  s = s.replace(/<\s*\/?\s*script[^>]*>/gi, '');
  s = s.replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '');
  s = s.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  s = s.replace(/javascript\s*:/gi, '');
  s = s.replace(/vbscript\s*:/gi, '');
  return s;
}

function inlineFormat(text) {
  let s = escapeHtml(text);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, alt, url) => {
    const safe = sanitizeAttrUrl(url);
    if (!safe) return '';
    return `<img src="${safe}" alt="${escapeHtml(alt)}" loading="lazy" />`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label, url) => {
    const safe = sanitizeAttrUrl(url);
    if (!safe) return escapeHtml(label);
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

function isTableRow(line) {
  const t = String(line || '').trim();
  return t.includes('|') && /^\|?.+\|/.test(t);
}

function isTableSep(line) {
  const t = String(line || '').trim();
  if (!t.includes('|') && !t.includes('-')) return false;
  const cells = splitTableCells(t);
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function splitTableCells(line) {
  let t = String(line || '').trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

function renderTable(rows) {
  if (!rows.length) return '';
  const [header, ...body] = rows;
  const thead = `<thead><tr>${header.map((c) => `<th>${inlineFormat(c)}</th>`).join('')}</tr></thead>`;
  const tbody = body.length
    ? `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inlineFormat(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
    : '';
  return `<div class="md-table-wrap"><table>${thead}${tbody}</table></div>`;
}

function renderFigureFromLine(line) {
  const m = String(line || '').trim().match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
  if (!m) return null;
  const alt = m[1] || '';
  const safe = sanitizeAttrUrl(m[2]);
  if (!safe) return '';
  const cap = alt
    ? `<figcaption>${escapeHtml(alt)}</figcaption>`
    : '';
  return `<figure class="md-figure"><img src="${safe}" alt="${escapeHtml(alt)}" loading="lazy" />${cap}</figure>`;
}

export function renderMarkdown(src) {
  const raw = String(src || '').replace(/\r\n/g, '\n');
  if (!raw.trim()) return '';

  const lines = raw.split('\n');
  const out = [];
  let i = 0;
  let inCode = false;
  let codeLang = '';
  let codeBuf = [];
  let listType = null; // ul | ol | task
  let listBuf = [];

  function flushList() {
    if (!listType || !listBuf.length) {
      listType = null;
      listBuf = [];
      return;
    }
    if (listType === 'task') {
      out.push(
        `<ul class="md-task">${listBuf
          .map((item) => {
            const checked = item.checked ? ' checked' : '';
            const cls = item.checked ? ' is-done' : '';
            return `<li class="md-task-item${cls}"><span class="md-check${checked}" aria-hidden="true"></span><span class="md-task-text">${inlineFormat(item.text)}</span></li>`;
          })
          .join('')}</ul>`
      );
    } else {
      const tag = listType === 'ol' ? 'ol' : 'ul';
      out.push(`<${tag}>${listBuf.map((t) => `<li>${inlineFormat(t)}</li>`).join('')}</${tag}>`);
    }
    listType = null;
    listBuf = [];
  }

  while (i < lines.length) {
    const line = lines[i];

    if (inCode) {
      if (/^```/.test(line)) {
        out.push(
          `<pre><code class="lang-${escapeHtml(codeLang)}">${escapeHtml(codeBuf.join('\n'))}</code></pre>`
        );
        inCode = false;
        codeLang = '';
        codeBuf = [];
      } else {
        codeBuf.push(line);
      }
      i += 1;
      continue;
    }

    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      flushList();
      inCode = true;
      codeLang = fence[1] || '';
      codeBuf = [];
      i += 1;
      continue;
    }

    if (/^\s*---+\s*$/.test(line) || /^\s*\*\*\*+\s*$/.test(line)) {
      flushList();
      out.push('<hr class="md-rule" />');
      i += 1;
      continue;
    }

    // GFM 表格
    if (
      isTableRow(line)
      && !isTableSep(line)
      && i + 1 < lines.length
      && isTableSep(lines[i + 1])
    ) {
      flushList();
      const rows = [splitTableCells(line)];
      i += 2;
      while (i < lines.length && isTableRow(lines[i]) && !isTableSep(lines[i])) {
        rows.push(splitTableCells(lines[i]));
        i += 1;
      }
      out.push(renderTable(rows));
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineFormat(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushList();
      const buf = [quote[1]];
      i += 1;
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote>${buf.map((t) => `<p>${inlineFormat(t)}</p>`).join('')}</blockquote>`);
      continue;
    }

    const figure = renderFigureFromLine(line);
    if (figure !== null) {
      flushList();
      if (figure) out.push(figure);
      i += 1;
      continue;
    }

    const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (task) {
      if (listType && listType !== 'task') flushList();
      listType = 'task';
      listBuf.push({ checked: /x/i.test(task[1]), text: task[2] });
      i += 1;
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ul) {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listBuf.push(ul[1]);
      i += 1;
      continue;
    }

    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ol) {
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listBuf.push(ol[1]);
      i += 1;
      continue;
    }

    if (!line.trim()) {
      flushList();
      i += 1;
      continue;
    }

    flushList();
    out.push(`<p>${inlineFormat(line)}</p>`);
    i += 1;
  }

  flushList();
  if (inCode) {
    out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  }

  return sanitizeHtml(out.join('\n'));
}

export { sanitizeHtml, escapeHtml };
