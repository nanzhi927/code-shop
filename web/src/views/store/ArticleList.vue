<template>
  <div class="page-container list-page">
    <header class="list-intro">
      <h1 class="list-title">毕设教程</h1>
    </header>

    <div class="filter-panel">
      <div class="filter-row">
        <el-input
          v-model="query.keyword"
          class="search-input"
          clearable
          placeholder="搜：选题、开题、答辩、SpringBoot…"
          @keyup.enter="onSearch"
          @clear="onSearch"
        >
          <template #append>
            <el-button @click="onSearch">搜索</el-button>
          </template>
        </el-input>
        <span class="total-info">共 <b>{{ total }}</b> 篇</span>
      </div>

      <div v-if="categories.length" class="chip-row chip-scroll-wrap">
        <span class="chip-label">分类</span>
        <div class="chip-scroll">
          <button
            class="chip"
            :class="{ active: query.category === '全部' }"
            @click="query.category = '全部'; onSearch()"
          >全部</button>
          <button
            v-for="c in categories"
            :key="c.name"
            class="chip"
            :class="{ active: query.category === c.name }"
            @click="query.category = c.name; onSearch()"
          >{{ c.name }} <em>{{ c.cnt }}</em></button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="article-grid skeleton-grid">
      <div v-for="n in 6" :key="n" class="skeleton-card">
        <el-skeleton animated :rows="3" />
      </div>
    </div>

    <div v-else>
      <div class="article-grid">
        <article
          v-for="a in list"
          :key="a.id"
          class="article-card"
          @click="goDetail(a.slug)"
        >
          <div class="cover-wrap">
            <img v-if="a.cover" :src="a.cover" :alt="a.title" loading="lazy" decoding="async" />
            <div v-else class="cover-placeholder">教程</div>
          </div>
          <div class="card-body">
            <div class="card-top">
              <span v-if="a.category" class="cat-tag">{{ a.category }}</span>
              <span class="meta-weak">浏览 {{ a.views || 0 }}</span>
            </div>
            <h3 class="card-title">{{ a.title }}</h3>
            <p class="card-summary">{{ a.summary || '暂无摘要' }}</p>
            <div class="card-meta">
              <span>{{ formatDate(a.created_at) }}</span>
            </div>
          </div>
        </article>
      </div>

      <div v-if="!list.length" class="empty-illus">
        <div class="ei-icon">📝</div>
        <p class="ei-title">暂无教程文章</p>
        <p class="ei-desc">换个关键词，或稍后回来看看最新毕设教程</p>
        <el-button type="primary" @click="clearFilters">清空筛选</el-button>
      </div>
    </div>

    <div v-if="total > 0" class="pager-wrap">
      <el-pagination
        class="pager"
        background
        layout="prev, pager, next, sizes, total"
        :page-sizes="[12, 20, 40]"
        :total="total"
        :page-size="pageSize"
        :current-page="query.page"
        @current-change="onPage"
        @size-change="onPageSize"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import http from '../../api';
import { setSeo, resetSeo } from '../../composables/useSeo';

const route = useRoute();
const router = useRouter();
const list = ref([]);
const categories = ref([]);
const total = ref(0);
const pageSize = ref(12);
const loading = ref(false);

const query = reactive({
  page: 1,
  keyword: '',
  category: '全部'
});

function formatDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function applySeo() {
  const kw = query.keyword?.trim();
  if (kw) {
    setSeo({
      title: `搜索：${kw} - 毕设教程与选题指南`,
      description: `查找与「${kw}」相关的毕业设计教程、选题指南与答辩技巧，帮助你更快完成毕设。`,
      keywords: `${kw},毕设教程,毕业设计选题指南,SpringBoot 毕设怎么做,毕设答辩常见问题`
    });
  } else {
    setSeo({
      title: '毕设教程与选题指南 - 毕业设计怎么做',
      description:
        '毕设教程合集：毕业设计选题指南、SpringBoot 毕设怎么做、课程设计落地步骤与毕设答辩常见问题，帮你少走弯路。',
      keywords:
        '毕设教程,毕业设计选题指南,SpringBoot 毕设怎么做,课程设计教程,毕设答辩常见问题,论文写作'
    });
  }
}

function syncToUrl() {
  const q = {};
  if (query.keyword) q.keyword = query.keyword;
  if (query.category && query.category !== '全部') q.category = query.category;
  if (query.page > 1) q.page = String(query.page);
  if (pageSize.value !== 12) q.pageSize = String(pageSize.value);
  router.replace({ path: '/articles', query: q });
}

function initFromRoute() {
  query.keyword = String(route.query.keyword || '');
  query.category = String(route.query.category || '全部');
  query.page = Math.max(1, parseInt(route.query.page, 10) || 1);
  pageSize.value = Math.min(40, Math.max(1, parseInt(route.query.pageSize, 10) || 12));
}

async function load() {
  loading.value = true;
  try {
    const params = {
      page: query.page,
      pageSize: pageSize.value
    };
    if (query.keyword.trim()) params.keyword = query.keyword.trim();
    if (query.category && query.category !== '全部') params.category = query.category;
    const res = await http.get('/articles', { params });
    list.value = res.list || [];
    total.value = res.total || 0;
    categories.value = res.facets?.categories || [];
    applySeo();
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  query.page = 1;
  load();
  syncToUrl();
}
function onPage(p) {
  query.page = p;
  load();
  syncToUrl();
}
function onPageSize(size) {
  pageSize.value = size;
  query.page = 1;
  load();
  syncToUrl();
}
function clearFilters() {
  query.keyword = '';
  query.category = '全部';
  query.page = 1;
  load();
  syncToUrl();
}
function goDetail(slug) {
  router.push(`/articles/${slug}`);
}

watch(
  () => route.query,
  () => {
    initFromRoute();
    load();
  }
);

onMounted(() => {
  initFromRoute();
  load();
});
onBeforeUnmount(() => {
  if (route.name === 'articles') resetSeo();
});
</script>

<style scoped>
.list-page { padding-top: 16px; padding-bottom: 40px; }
.list-intro { margin-bottom: 18px; }
.list-title {
  margin: 0; font-size: 24px; font-weight: 720; color: var(--text-1);
}
.filter-panel {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 18px 20px; margin-bottom: 20px;
}
.filter-row {
  display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
}
.search-input { max-width: 420px; flex: 1; }
.total-info { color: var(--text-3); font-size: 13px; margin-left: auto; }
.total-info b { color: var(--text-1); font-weight: 700; }

.chip-row {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  margin-top: 14px;
}
.chip-label {
  font-size: 12.5px; color: var(--text-3); font-weight: 600;
  margin-right: 4px; flex-shrink: 0;
}
.chip-scroll { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  appearance: none; border: 1px solid var(--border); background: var(--bg-alt);
  color: var(--text-2); font-size: 13px; font-weight: 550;
  padding: 7px 14px; border-radius: 999px; cursor: pointer;
  transition: all .18s var(--ease);
}
.chip em { font-style: normal; color: var(--text-3); margin-left: 3px; font-size: 11.5px; }
.chip:hover { border-color: var(--ink); color: var(--ink); }
.chip.active {
  background: var(--ink); border-color: var(--ink);
  color: #fff; font-weight: 650;
}
.chip.active em { color: rgba(255, 255, 255, .78); }

.article-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.article-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); overflow: hidden; cursor: pointer;
  transition: transform .18s var(--ease), box-shadow .18s var(--ease);
}
.article-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm, 0 6px 20px rgba(0,0,0,.06));
}
.cover-wrap {
  aspect-ratio: 16/9; background: var(--bg-alt); overflow: hidden;
}
.cover-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-3); font-size: 15px; font-weight: 600;
  background: linear-gradient(135deg, var(--bg-alt), var(--surface));
}
.card-body { padding: 14px 16px 16px; }
.card-top {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-bottom: 8px;
}
.cat-tag {
  font-size: 12px; color: var(--ink); background: var(--bg-alt);
  border: 1px solid var(--border); padding: 2px 8px; border-radius: 999px;
}
.meta-weak { font-size: 12px; color: var(--text-3); }
.card-title {
  margin: 0 0 8px; font-size: 16px; line-height: 1.45; color: var(--text-1);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.card-summary {
  margin: 0 0 10px; font-size: 13px; line-height: 1.6; color: var(--text-2);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  min-height: 2.8em;
}
.card-meta { font-size: 12px; color: var(--text-3); }
.pager-wrap { display: flex; justify-content: center; margin-top: 28px; }
.empty-illus {
  text-align: center; padding: 56px 16px; color: var(--text-2);
}
.ei-icon { font-size: 36px; margin-bottom: 10px; }
.ei-title { font-size: 16px; font-weight: 650; color: var(--text-1); margin: 0 0 6px; }
.ei-desc { font-size: 13px; color: var(--text-3); margin: 0 0 16px; }
.skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.skeleton-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 16px;
}
@media (max-width: 640px) {
  .search-input { max-width: none; width: 100%; }
  .total-info { margin-left: 0; width: 100%; }
}
</style>
