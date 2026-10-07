/**
 * 简易内存限流中间件（固定窗口）
 * 用于登录/注册等敏感接口防止暴力破解与批量刷号。
 * 生产环境可替换为 redis 方案。
 */
const hits = new Map();

function rateLimit({ windowMs = 60 * 1000, max = 60, message = '请求过于频繁，请稍后再试' } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}|${req.method}|${req.path}`;
    const rec = hits.get(key) || { count: 0, start: now };
    if (now - rec.start > windowMs) {
      rec.count = 0;
      rec.start = now;
    }
    rec.count += 1;
    hits.set(key, rec);

    // 定期清理过期记录，避免内存无限增长
    if (hits.size > 10000) {
      for (const [k, v] of hits) {
        if (now - v.start > windowMs * 2) hits.delete(k);
      }
    }

    if (rec.count > max) {
      return res.status(429).json({ message });
    }
    next();
  };
}

module.exports = rateLimit;
