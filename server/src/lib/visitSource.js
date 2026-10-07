const REF_MAP = [
  [/gitee\.com/i, 'gitee'],
  [/github\.com/i, 'github'],
  [/xiaohongshu\.com|xhslink\.com/i, 'xiaohongshu'],
  [/douyin\.com|iesdouyin\.com/i, 'douyin'],
  [/weibo\.com|weibo\.cn/i, 'weibo'],
  [/zhihu\.com/i, 'zhihu'],
  [/weixin\.qq\.com|wx\.qq\.com/i, 'wechat'],
  [/qq\.com/i, 'qq'],
  [/baidu\.com/i, 'baidu'],
  [/bing\.com/i, 'bing'],
  [/google\./i, 'google']
];

function resolveSourceFromReferrer(referrer, utmSource) {
  const utm = String(utmSource || '').trim().slice(0, 64);
  if (utm) return utm;

  const ref = String(referrer || '');
  if (!ref) return 'direct';

  let host = '';
  try {
    host = new URL(ref).hostname || '';
  } catch {
    host = ref;
  }
  for (const [re, name] of REF_MAP) {
    if (re.test(host) || re.test(ref)) return name;
  }
  return 'direct';
}

module.exports = { resolveSourceFromReferrer, REF_MAP };
