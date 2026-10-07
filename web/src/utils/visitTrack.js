/**
 * 前台 SPA 访问埋点：路由变化时上报到 /api/visits
 * 解决 Vite 开发态 / 客户端路由不经 Express 导致 visit_logs 为空的问题。
 */
const UTM_KEY = 'utm_source';
let lastKey = '';
let lastAt = 0;
const THROTTLE_MS = 50 * 1000;

export function captureUtmFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    const s = (q.get('utm_source') || '').trim().slice(0, 64);
    if (s) sessionStorage.setItem(UTM_KEY, s);
  } catch {
    /* ignore */
  }
}

function currentSource() {
  try {
    return sessionStorage.getItem(UTM_KEY) || '';
  } catch {
    return '';
  }
}

export function trackPageview(path) {
  try {
    captureUtmFromUrl();
    const p = String(path || window.location.pathname || '/').split('?')[0] || '/';
    if (p.startsWith('/admin') || p.startsWith('/api')) return;

    const now = Date.now();
    const key = `${currentSource()}|${p}`;
    if (key === lastKey && now - lastAt < THROTTLE_MS) return;
    lastKey = key;
    lastAt = now;

    const body = JSON.stringify({
      path: p,
      referrer: document.referrer || '',
      source: currentSource() || undefined
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/visits', blob);
      return;
    }

    fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin'
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
