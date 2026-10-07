/**
 * 开题报告 SSE 流式消费
 */
export async function streamProposalGenerate({ id, force = false, onEvent, signal } = {}) {
  const gk = localStorage.getItem('proposal_guest_key') || '';
  const token = localStorage.getItem('token') || '';
  const qs = new URLSearchParams({
    guest_key: gk,
    force: force ? '1' : '0'
  });
  const res = await fetch(`/api/proposal/sessions/${id}/stream?${qs}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal
  });
  if (!res.ok) {
    let msg = '生成失败';
    try {
      const j = await res.json();
      msg = j.message || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (!res.body) throw new Error('浏览器不支持流式响应');

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let currentEvent = 'message';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n');
    buffer = chunks.pop() || '';
    for (const raw of chunks) {
      const line = raw.replace(/\r$/, '');
      if (!line) {
        currentEvent = 'message';
        continue;
      }
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        const dataStr = line.slice(5).trim();
        let data = dataStr;
        try { data = JSON.parse(dataStr); } catch { /* keep string */ }
        if (onEvent) await onEvent(currentEvent, data);
      }
    }
  }
}
