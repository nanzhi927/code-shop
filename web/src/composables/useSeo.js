const SITE_TITLE = '毕设源码商城 - 毕业设计 / 课程设计源码与学习资料';
const SITE_DESCRIPTION =
  '毕设 / 课程设计源码商城：SpringBoot / SSM / JSP / 小程序 / Python 等主流技术栈，含源码工程、数据库脚本与运行说明；论文、PPT、演示视频以商品页标注为准。';
const SITE_KEYWORDS =
  '毕业设计,毕设,课程设计,毕设源码,Java源码,SpringBoot源码,SSM源码,源码商城';
const SITE_NAME = '毕设源码商城';
const JSON_LD_ATTR = 'data-seo-jsonld';

function upsertMeta(name, content, attr = 'name') {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function setSeo({ title, description, keywords } = {}) {
  if (title) {
    document.title = title;
    upsertMeta('og:title', title, 'property');
  }
  if (description) {
    upsertMeta('description', description);
    upsertMeta('og:description', description, 'property');
  }
  if (keywords) {
    upsertMeta('keywords', keywords);
  }
}

export function resetSeo() {
  document.title = SITE_TITLE;
  upsertMeta('description', SITE_DESCRIPTION);
  upsertMeta('keywords', SITE_KEYWORDS);
  upsertMeta('og:title', SITE_TITLE, 'property');
  upsertMeta('og:description', SITE_DESCRIPTION, 'property');
  clearJsonLd();
}

/** 按 id 写入/替换 JSON-LD，同 id 只保留一份，避免路由切换叠加 */
export function setJsonLd(id, data) {
  if (!id || !data) return;
  let el = document.querySelector(`script[type="application/ld+json"][${JSON_LD_ATTR}="${id}"]`);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute(JSON_LD_ATTR, id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function removeJsonLd(id) {
  if (!id) {
    clearJsonLd();
    return;
  }
  document
    .querySelectorAll(`script[type="application/ld+json"][${JSON_LD_ATTR}="${id}"]`)
    .forEach((el) => el.remove());
}

export function clearJsonLd() {
  document
    .querySelectorAll(`script[type="application/ld+json"][${JSON_LD_ATTR}]`)
    .forEach((el) => el.remove());
}

export function siteOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://62.234.122.127:40621';
}

/** 页面级 SEO：挂载时写入，卸载时清理对应 JSON-LD */
export function usePageSeo(opts = {}) {
  setSeo(opts);
  if (opts.jsonLdId && opts.jsonLd) {
    setJsonLd(opts.jsonLdId, opts.jsonLd);
  }
}

export { SITE_TITLE, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME };
