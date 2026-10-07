<template>
  <div class="page-container article-detail" v-loading="loading">
    <template v-if="article">
      <header class="hero">
        <div class="crumb">
          <router-link to="/articles">教程</router-link>
          <span>/</span>
          <span>{{ article.category || '未分类' }}</span>
        </div>
        <h1 class="title">{{ article.title }}</h1>
        <div class="meta">
          <span v-if="article.category" class="cat">{{ article.category }}</span>
          <span>浏览 {{ article.views || 0 }}</span>
          <span>{{ formatDate(article.updated_at || article.created_at) }}</span>
        </div>
        <p v-if="article.summary" class="summary">{{ article.summary }}</p>
      </header>

      <div class="content md-body" v-html="htmlContent"></div>

      <section v-if="relatedProducts.length" class="related">
        <h2 class="section-title">相关源码</h2>
        <div class="rel-grid">
          <router-link
            v-for="p in relatedProducts"
            :key="p.id"
            :to="`/products/${p.id}`"
            class="rel-card"
          >
            <ProductCover :product="p" />
            <div class="rel-body">
              <div class="rel-title">{{ p.title }}</div>
              <div class="rel-meta">
                <span class="rel-price">¥{{ p.price }}</span>
                <span class="rel-tech">{{ p.tech }}</span>
              </div>
            </div>
          </router-link>
        </div>
      </section>

      <section class="cta-row">
        <router-link class="cta-card" to="/opensource">
          <h3>先在开源项目里找找</h3>
          <p>免费浏览可参考的开源实现，再决定是否购买成品源码</p>
        </router-link>
      </section>

      <section v-if="hasContact" class="contact-block">
        <h2 class="section-title">联系我们</h2>
        <div class="contact-body">
          <div class="contact-texts">
            <p v-if="settings.service_qq">客服 QQ：{{ settings.service_qq }}</p>
            <p v-if="settings.service_wechat">客服微信：{{ settings.service_wechat }}</p>
            <p v-if="settings.service_notice" class="tips">{{ settings.service_notice }}</p>
          </div>
          <div v-if="settings.service_wechat_qr || settings.service_qq_qr" class="qr-list">
            <div v-if="settings.service_wechat_qr" class="qr-item">
              <el-image :src="settings.service_wechat_qr" fit="contain" style="width:140px;height:140px" lazy />
              <span>微信</span>
            </div>
            <div v-if="settings.service_qq_qr" class="qr-item">
              <el-image :src="settings.service_qq_qr" fit="contain" style="width:140px;height:140px" lazy />
              <span>QQ</span>
            </div>
          </div>
        </div>
      </section>
    </template>

    <div v-else-if="!loading" class="empty-illus">
      <div class="ei-icon">📭</div>
      <p class="ei-title">文章不存在或未发布</p>
      <p class="ei-desc">可能已下线，去教程列表看看其他内容吧</p>
      <el-button type="primary" @click="router.push('/articles')">返回教程列表</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import http from '../../api';
import ProductCover from '../../components/ProductCover.vue';
import { setSeo, resetSeo, setJsonLd, removeJsonLd, SITE_NAME } from '../../composables/useSeo';
import { renderMarkdown } from '../../utils/markdown';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const article = ref(null);
const relatedProducts = ref([]);
const settings = ref({});

const htmlContent = computed(() => renderMarkdown(article.value?.content || ''));
const hasContact = computed(() => {
  const s = settings.value || {};
  return !!(s.service_qq || s.service_wechat || s.service_wechat_qr || s.service_qq_qr || s.service_notice);
});

function formatDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function toIso(v) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

async function loadRelated(a) {
  relatedProducts.value = [];
  const keywords = [
    ...(String(a.tags || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean)),
    String(a.category || '').trim()
  ].filter(Boolean);
  if (!keywords.length) return;
  // 逐个标签单独查再合并：拼成整串（如「SpringBoot 论文」）后端会按短语匹配而搜不到任何商品
  const picked = new Map();
  for (const kw of keywords.slice(0, 3)) {
    if (picked.size >= 6) break;
    try {
      const res = await http.get('/products', { params: { keyword: kw, pageSize: 6, sort: 'sales' } });
      (res.list || []).forEach((p) => { if (p && !picked.has(p.id)) picked.set(p.id, p); });
    } catch { /* 忽略单个标签失败 */ }
  }
  relatedProducts.value = [...picked.values()].slice(0, 6);
}

async function loadSettings() {
  try {
    settings.value = await http.get('/settings/public');
  } catch {
    settings.value = {};
  }
}

async function load() {
  loading.value = true;
  article.value = null;
  relatedProducts.value = [];
  removeJsonLd('article-detail');
  try {
    const a = await http.get(`/articles/${route.params.slug}`);
    article.value = a;
    const desc = (a.summary || '').slice(0, 150) || undefined;
    const kws = [a.category, a.tags, '毕设教程', '毕业设计'].filter(Boolean).join(',');
    setSeo({
      title: `${a.title} - ${SITE_NAME}`,
      description: desc,
      keywords: kws
    });
    setJsonLd('article-detail', {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: a.title,
      description: desc,
      datePublished: toIso(a.created_at),
      dateModified: toIso(a.updated_at || a.created_at),
      author: { '@type': 'Organization', name: SITE_NAME }
    });
    await loadRelated(a);
  } catch {
    article.value = null;
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.slug, () => {
  if (route.name === 'article-detail') load();
});

onMounted(() => {
  load();
  loadSettings();
});
onBeforeUnmount(() => {
  resetSeo();
  removeJsonLd('article-detail');
});
</script>

<style scoped>
.article-detail { padding: 28px 0 56px; max-width: 740px; }
.hero { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
.crumb {
  display: flex; gap: 8px; align-items: center;
  font-size: 13px; color: var(--text-3); margin-bottom: 14px;
}
.crumb a { color: var(--text-2); text-decoration: none; }
.crumb a:hover { color: var(--ink); }
.title {
  margin: 0 0 14px;
  font-family: var(--font-display);
  font-size: clamp(24px, 4vw, 32px);
  line-height: 1.28; letter-spacing: -.02em;
  color: var(--text-1); font-weight: 720;
}
.meta {
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
  font-size: 13px; color: var(--text-3); margin-bottom: 16px;
}
.cat {
  border: 1px solid var(--border); background: var(--bg-alt);
  color: var(--text-2); padding: 2px 9px; border-radius: 999px;
  font-size: 12px; font-weight: 600;
}
.summary {
  margin: 0; padding: 14px 16px;
  background: linear-gradient(180deg, var(--bg-alt), transparent);
  border-left: 3px solid var(--ink); color: var(--text-2);
  font-size: 14.5px; line-height: 1.75;
  border-radius: 0 10px 10px 0;
}

/* —— 正文阅读排版 —— */
.content {
  font-size: 16px; line-height: 1.9; color: var(--text-2);
  word-break: break-word; letter-spacing: .01em;
}
.content :deep(> *:first-child) { margin-top: 0; }

.content :deep(h2) {
  margin: 2.1em 0 .7em; padding-top: .35em;
  font-family: var(--font-display);
  font-size: 1.28em; line-height: 1.35; letter-spacing: -.015em;
  color: var(--text-1); font-weight: 720;
  position: relative; padding-left: 14px;
}
.content :deep(h2)::before {
  content: ""; position: absolute; left: 0; top: .55em; bottom: .2em;
  width: 3px; border-radius: 2px; background: var(--ink);
}
.content :deep(h3) {
  margin: 1.6em 0 .55em;
  font-size: 1.08em; line-height: 1.4;
  color: var(--text-1); font-weight: 680;
}
.content :deep(h1) {
  margin: 1.8em 0 .7em;
  font-family: var(--font-display);
  font-size: 1.4em; color: var(--text-1); font-weight: 720;
}

.content :deep(p) { margin: 0 0 1.05em; }
.content :deep(p + p) { margin-top: -.15em; }

.content :deep(strong) {
  color: var(--text-1); font-weight: 700;
  background: linear-gradient(180deg, transparent 62%, rgba(13, 148, 136, .14) 62%);
  padding: 0 1px;
}

.content :deep(a) {
  color: var(--ink); text-decoration: underline;
  text-decoration-thickness: 1px; text-underline-offset: 3px;
}
.content :deep(a:hover) { color: #0d9488; }

.content :deep(ul),
.content :deep(ol) {
  margin: 0 0 1.2em; padding-left: 0;
  list-style: none;
}
.content :deep(ul > li),
.content :deep(ol > li) {
  position: relative;
  margin: 0 0 .55em;
  padding-left: 1.35em;
  line-height: 1.75;
}
.content :deep(ul > li)::before {
  content: ""; position: absolute; left: .35em; top: .72em;
  width: 5px; height: 5px; border-radius: 50%; background: var(--ink);
}
.content :deep(ol) { counter-reset: md-ol; }
.content :deep(ol > li) { counter-increment: md-ol; }
.content :deep(ol > li)::before {
  content: counter(md-ol);
  position: absolute; left: 0; top: .15em;
  width: 1.15em; height: 1.15em; border-radius: 6px;
  display: grid; place-items: center;
  font-size: 11.5px; font-weight: 700; font-family: var(--font-num);
  background: var(--bg-alt); color: var(--text-1); border: 1px solid var(--border);
}

.content :deep(.md-task) { margin: 0 0 1.25em; padding: 12px 14px;
  background: var(--bg-alt); border: 1px solid var(--border); border-radius: 12px;
}
.content :deep(.md-task-item) {
  display: flex; gap: 10px; align-items: flex-start;
  margin: 0 0 .55em; padding-left: 0 !important; line-height: 1.65;
}
.content :deep(.md-task-item:last-child) { margin-bottom: 0; }
.content :deep(.md-task-item)::before { display: none !important; }
.content :deep(.md-check) {
  flex-shrink: 0; width: 16px; height: 16px; margin-top: .28em;
  border: 1.5px solid var(--border-strong); border-radius: 4px; background: var(--surface);
}
.content :deep(.md-check.checked) {
  border-color: var(--ink); background: var(--ink);
  box-shadow: inset 0 0 0 2px var(--surface);
}
.content :deep(.md-task-item.is-done .md-task-text) {
  color: var(--text-3); text-decoration: line-through;
}

.content :deep(blockquote) {
  margin: 0 0 1.25em; padding: 12px 16px 12px 18px;
  border-left: 3px solid #0d9488;
  background: rgba(13, 148, 136, .06);
  border-radius: 0 10px 10px 0;
  color: var(--text-2);
}
.content :deep(blockquote p) { margin: 0 0 .45em; }
.content :deep(blockquote p:last-child) { margin-bottom: 0; }

.content :deep(.md-rule) {
  border: 0; height: 1px; margin: 2em 0;
  background: linear-gradient(90deg, transparent, var(--border-strong), transparent);
}

.content :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: .88em; background: var(--bg-alt); color: var(--text-1);
  padding: 1px 6px; border-radius: 5px; border: 1px solid var(--border);
}
.content :deep(pre) {
  background: #111113; color: #e4e4e7;
  border: 1px solid #27272a; border-radius: 12px;
  padding: 16px 18px; overflow: auto; margin: 0 0 1.25em;
  font-size: 13.5px; line-height: 1.65;
}
.content :deep(pre code) {
  background: transparent; border: 0; padding: 0; color: inherit; font-size: inherit;
}

.content :deep(.md-figure) {
  margin: 0 0 1.4em; padding: 0;
}
.content :deep(.md-figure img),
.content :deep(p > img) {
  display: block; width: 100%; height: auto;
  border-radius: 12px; border: 1px solid var(--border);
  background: var(--bg-alt);
}
.content :deep(figcaption) {
  margin-top: 8px; text-align: center;
  font-size: 12.5px; color: var(--text-3); line-height: 1.5;
}

.content :deep(.md-table-wrap) {
  overflow-x: auto; margin: 0 0 1.35em;
  border: 1px solid var(--border); border-radius: 12px;
  -webkit-overflow-scrolling: touch;
}
.content :deep(table) {
  width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.55;
}
.content :deep(th),
.content :deep(td) {
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  padding: 11px 14px; text-align: left; vertical-align: top;
}
.content :deep(th:last-child),
.content :deep(td:last-child) { border-right: 0; }
.content :deep(tr:last-child td) { border-bottom: 0; }
.content :deep(th) {
  background: var(--bg-alt); font-weight: 680; color: var(--text-1);
  font-size: 13px; white-space: nowrap;
}
.content :deep(td) { color: var(--text-2); }
.content :deep(tbody tr:nth-child(even) td) { background: rgba(250, 250, 250, .7); }

.section-title {
  margin: 40px 0 16px; font-size: 18px; font-weight: 700; color: var(--text-1);
}
.rel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}
.rel-card {
  display: block; color: inherit; text-decoration: none;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); overflow: hidden; cursor: pointer;
  transition: transform .18s var(--ease);
}
.rel-card:hover { transform: translateY(-2px); }
.rel-body { padding: 10px 12px 12px; }
.rel-title {
  font-size: 13.5px; line-height: 1.4; color: var(--text-1);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  min-height: 2.8em; margin-bottom: 6px;
}
.rel-meta { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
.rel-price { color: var(--ink); font-weight: 700; }
.rel-tech { color: var(--text-3); }

.cta-row { margin-top: 28px; }
.cta-card {
  display: block; padding: 18px 20px;
  border: 1px solid var(--border); border-radius: var(--r-lg);
  background: var(--bg-alt); color: inherit; text-decoration: none;
}
.cta-card h3 { margin: 0 0 6px; font-size: 16px; color: var(--text-1); }
.cta-card p { margin: 0; font-size: 13px; color: var(--text-2); }
.cta-card:hover { border-color: var(--ink); }

.contact-block {
  margin-top: 8px; padding: 18px 20px;
  border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface);
}
.contact-block .section-title { margin-top: 0; }
.contact-body {
  display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between; align-items: flex-start;
}
.contact-texts p { margin: 0 0 8px; font-size: 14px; color: var(--text-1); }
.contact-texts .tips { color: var(--text-3); font-size: 13px; }
.qr-list { display: flex; gap: 16px; }
.qr-item { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12px; color: var(--text-3); }

.empty-illus { text-align: center; padding: 80px 16px; }
.ei-icon { font-size: 36px; margin-bottom: 10px; }
.ei-title { font-size: 16px; font-weight: 650; color: var(--text-1); margin: 0 0 6px; }
.ei-desc { font-size: 13px; color: var(--text-3); margin: 0 0 16px; }

@media (max-width: 640px) {
  .article-detail { padding: 16px 0 40px; }
  .title { font-size: 22px; }
  .content { font-size: 15.5px; line-height: 1.85; }
  .content :deep(h2) { font-size: 1.18em; margin-top: 1.7em; }
  .content :deep(.md-task) { padding: 10px 12px; }
}
</style>
