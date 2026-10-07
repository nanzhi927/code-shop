<template>
  <div class="page-container os-page">
    <div class="os-hero">
      <h1 class="os-title">开源项目（{{ total }} 个）</h1>
      <p class="os-desc">
        这里提供<strong>精简可运行的开源学习版</strong>，适合快速了解毕业设计 / 课程设计技术栈与项目结构。
        若需要<strong>完整源码、数据库脚本、演示录屏与论文资料</strong>，请前往本站
        <router-link to="/products" class="inline-link">商品页</router-link>选购完整版。
      </p>
      <div class="os-diff">
        <div class="diff-col">
          <h3>开源版（本页）</h3>
          <ul>
            <li>精简学习版，便于阅读与跑通</li>
            <li>公开仓库，适合入门与课设参考</li>
            <li>不含完整交付包与论文配套</li>
          </ul>
        </div>
        <div class="diff-col accent">
          <h3>完整版（商品页）</h3>
          <ul>
            <li>完整源码 + 数据库脚本</li>
            <li>演示录屏 + 论文 / PPT 资料</li>
            <li>即买即用，客服协助交付</li>
          </ul>
          <router-link to="/products" class="diff-cta">去选完整版 →</router-link>
        </div>
      </div>
    </div>

    <div class="filter-panel">
      <div class="filter-row">
        <el-input
          v-model="keyword"
          class="search-box"
          clearable
          :placeholder="`在 ${total} 个开源项目中搜索`"
          @clear="page = 1"
          @keyup.enter="page = 1"
        >
          <template #append>
            <el-button @click="page = 1">搜索</el-button>
          </template>
        </el-input>
        <span class="total-info">共 <b>{{ filtered.length }}</b> 个结果</span>
      </div>
      <div class="chip-row chip-scroll-wrap">
        <span class="chip-label">技术栈</span>
        <div class="chip-scroll">
          <button
            v-for="t in TECHS"
            :key="t"
            type="button"
            class="chip"
            :class="{ active: tech === t }"
            @click="tech = t; page = 1"
          >{{ t }}</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="os-grid">
      <div v-for="n in 8" :key="n" class="os-card sk">
        <div class="sk-line" />
        <div class="sk-line short" />
      </div>
    </div>
    <template v-else>
      <div v-if="paged.length" class="os-grid">
        <div v-for="item in paged" :key="item.slug || item.url" class="os-card">
          <h3 class="os-name">{{ item.title }}</h3>
          <span class="tech-tag">{{ item.tech || 'Java' }}</span>
          <a
            class="os-link"
            :href="item.url"
            target="_blank"
            rel="noopener nofollow"
          >查看仓库 →</a>
        </div>
      </div>
      <el-empty v-else description="没有匹配的开源项目" />

      <div v-if="filtered.length > PAGE_SIZE" class="pager">
        <el-pagination
          v-model:current-page="page"
          :page-size="PAGE_SIZE"
          :total="filtered.length"
          layout="prev, pager, next"
          background
        />
      </div>
    </template>

    <div class="os-cta-block">
      <h2 class="cta-title">获取完整源码</h2>
      <p class="cta-desc">
        开源版是精简学习版，便于理解项目骨架；完整版在商品页交付，包含源码、数据库脚本、演示录屏与论文资料，适合毕业设计 / 毕设 / 课程设计直接使用。
      </p>
      <div class="cta-links">
        <router-link to="/products" class="cta-main">浏览全部完整版源码 →</router-link>
        <router-link
          v-for="link in TECH_PRODUCT_LINKS"
          :key="link.query"
          :to="{ path: '/products', query: { tech: link.query } }"
          class="cta-tech"
        >{{ link.label }}</router-link>
      </div>
      <router-link to="/contact" class="cta-sub">没找到合适的？联系我们（微信 / QQ）</router-link>
    </div>

    <div v-if="settings.service_wechat_qr || settings.service_qq_qr" class="os-contact">
      <h3 class="contact-title">联系我们</h3>
      <div class="qr-list">
        <div v-if="settings.service_wechat_qr" class="qr-item">
          <el-image :src="settings.service_wechat_qr" style="width: 140px; height: 140px" fit="contain" lazy />
          <p class="qr-label">微信扫码</p>
        </div>
        <div v-if="settings.service_qq_qr" class="qr-item">
          <el-image :src="settings.service_qq_qr" style="width: 140px; height: 140px" fit="contain" lazy />
          <p class="qr-label">QQ 扫码</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import http from '../../api';
import { setSeo, resetSeo, setJsonLd, removeJsonLd } from '../../composables/useSeo';

const TECHS = ['全部', 'SpringBoot', 'SpringBoot + Vue', 'SSM', 'JSP+Servlet', 'Java'];
const PAGE_SIZE = 24;
const TECH_PRODUCT_LINKS = [
  { label: 'SpringBoot 完整版', query: 'SpringBoot' },
  { label: 'SSM 完整版', query: 'SSM' },
  { label: 'JSP 完整版', query: 'JSP+Servlet' }
];

const loading = ref(true);
const items = ref([]);
const total = ref(0);
const keyword = ref('');
const tech = ref('全部');
const page = ref(1);
const settings = ref({});

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return items.value.filter((it) => {
    if (kw && !(it.title || '').toLowerCase().includes(kw)) return false;
    if (tech.value === '全部') return true;
    const t = it.tech || '';
    if (tech.value === 'SpringBoot') {
      return t === 'SpringBoot' || (t.includes('SpringBoot') && !t.includes('Vue'));
    }
    return t === tech.value;
  });
});

const paged = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE;
  return filtered.value.slice(start, start + PAGE_SIZE);
});

watch(filtered, () => {
  const maxPage = Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE) || 1);
  if (page.value > maxPage) page.value = maxPage;
});

function applyItemListLd(list) {
  setJsonLd('opensource-list', {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '开源毕设 / 课程设计学习项目',
    numberOfItems: list.length,
    itemListElement: list.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.title
    }))
  });
}

onMounted(async () => {
  setSeo({
    title: '开源项目 - 毕业设计 / 毕设 / 课程设计 Java 源码学习版',
    description:
      '精简可运行的开源学习版：SpringBoot 源码、SSM 源码、Java 源码，适合毕业设计与课程设计入门；完整版含数据库脚本、演示录屏与论文资料见商品页。',
    keywords:
      '毕业设计,毕设,课程设计,Java源码,SpringBoot源码,SSM源码,开源项目,毕设源码'
  });
  loading.value = true;
  try {
    const [data, settingsRes] = await Promise.all([
      http.get('/opensource'),
      http.get('/settings/public').catch(() => ({}))
    ]);
    items.value = data.items || [];
    total.value = data.total || items.value.length;
    settings.value = settingsRes || {};
    applyItemListLd(items.value);
  } catch {
    items.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  removeJsonLd('opensource-list');
  resetSeo();
});
</script>

<style scoped>
.os-page { padding: 16px 0 48px; }
.os-hero { margin-bottom: 18px; }
.os-title {
  margin: 0 0 8px; font-size: 26px; font-weight: 800; letter-spacing: -.3px;
  color: var(--text-1);
}
.os-desc { margin: 0; color: var(--text-2); font-size: 14px; line-height: 1.7; max-width: 780px; }
.os-desc strong { color: var(--text-1); font-weight: 700; }
.inline-link { color: var(--ink, #0d9488); font-weight: 650; text-decoration: none; }
.inline-link:hover { opacity: .85; }

.os-diff {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  margin-top: 16px; max-width: 780px;
}
.diff-col {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg, 14px); padding: 14px 16px;
}
.diff-col.accent { border-color: var(--ink, #0d9488); }
.diff-col h3 { margin: 0 0 8px; font-size: 14px; font-weight: 750; color: var(--text-1); }
.diff-col ul { margin: 0; padding-left: 18px; color: var(--text-2); font-size: 13px; line-height: 1.7; }
.diff-cta {
  display: inline-block; margin-top: 10px; font-size: 13.5px; font-weight: 700;
  color: var(--ink, #0d9488); text-decoration: none;
}
.diff-cta:hover { opacity: .85; }

.filter-panel {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg, var(--radius, 14px)); padding: 18px 20px; margin-bottom: 20px;
}
.filter-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.search-box { width: 280px; max-width: 100%; }
.total-info { color: var(--text-3); font-size: 13px; margin-left: auto; }
.total-info b { color: var(--text-1); font-weight: 700; }

.chip-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; }
.chip-label { font-size: 12.5px; color: var(--text-3); font-weight: 600; margin-right: 4px; flex-shrink: 0; }
.chip {
  appearance: none; border: 1px solid var(--border); background: var(--bg-alt);
  color: var(--text-2); font-size: 13px; font-weight: 550;
  padding: 7px 14px; border-radius: 999px; cursor: pointer;
  transition: all .18s var(--ease, ease);
}
.chip:hover { border-color: var(--ink); color: var(--ink); }
.chip.active { background: var(--ink); border-color: var(--ink); color: #fff; font-weight: 650; }

.os-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.os-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg, 14px); padding: 16px 16px 14px;
  display: flex; flex-direction: column; gap: 10px;
  transition: border-color .18s, transform .18s;
}
.os-card:hover { border-color: var(--ink); transform: translateY(-2px); }
.os-name {
  margin: 0; font-size: 15px; font-weight: 700; color: var(--text-1);
  line-height: 1.45; min-height: 2.9em;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.tech-tag {
  align-self: flex-start;
  font-size: 12px; font-weight: 650; padding: 3px 8px; border-radius: 6px;
  background: var(--bg-alt); color: var(--text-2); border: 1px solid var(--border);
}
.os-link {
  margin-top: auto; font-size: 13px; font-weight: 650; color: var(--ink, #0d9488);
  text-decoration: none;
}
.os-link:hover { opacity: .85; }

.sk .sk-line {
  height: 14px; border-radius: 6px;
  background: linear-gradient(90deg, var(--bg-alt), var(--border), var(--bg-alt));
  background-size: 200% 100%; animation: shimmer 1.2s infinite;
}
.sk .sk-line.short { width: 40%; height: 12px; }
@keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

.pager { margin-top: 28px; display: flex; justify-content: center; }

.os-cta-block {
  margin-top: 40px; padding: 22px 20px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg, 14px);
}
.cta-title { margin: 0 0 8px; font-size: 18px; font-weight: 800; color: var(--text-1); }
.cta-desc { margin: 0 0 14px; color: var(--text-2); font-size: 14px; line-height: 1.7; max-width: 720px; }
.cta-links { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; }
.cta-main {
  font-size: 15px; font-weight: 700; color: #fff; text-decoration: none;
  background: var(--ink, #0d9488); padding: 10px 16px; border-radius: 10px;
}
.cta-main:hover { opacity: .9; }
.cta-tech {
  font-size: 13px; font-weight: 650; color: var(--text-1); text-decoration: none;
  border: 1px solid var(--border); padding: 8px 12px; border-radius: 10px;
  background: var(--bg-alt);
}
.cta-tech:hover { border-color: var(--ink); color: var(--ink); }
.cta-sub { font-size: 13.5px; color: var(--text-2); text-decoration: none; font-weight: 600; }
.cta-sub:hover { color: var(--ink, #0d9488); }

.os-contact { margin-top: 24px; }
.contact-title { margin: 0 0 12px; font-size: 15px; font-weight: 750; color: var(--text-1); }
.qr-list { display: flex; gap: 24px; flex-wrap: wrap; }
.qr-item { text-align: center; }
.qr-label { margin: 6px 0 0; font-size: 13px; font-weight: 600; color: var(--text-2); }

@media (max-width: 768px) {
  .os-title { font-size: 22px; }
  .os-diff { grid-template-columns: 1fr; }
  .filter-panel { padding: 12px; }
  .search-box { width: 100%; }
  .total-info { margin-left: 0; width: 100%; }
  .chip-row { flex-wrap: nowrap; }
  .chip-scroll {
    display: flex; flex-wrap: nowrap; gap: 8px; flex: 1; min-width: 0;
    overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
  }
  .chip-scroll::-webkit-scrollbar { display: none; }
  .chip { white-space: nowrap; }
  .os-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .os-card { padding: 12px; }
  .os-name { font-size: 13.5px; min-height: 0; }
}
@media (max-width: 420px) {
  .os-grid { grid-template-columns: 1fr; }
}
</style>
