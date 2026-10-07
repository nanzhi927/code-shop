<template>
  <div class="page-container list-page">
    <div class="filter-panel">
      <div class="filter-row">
        <div class="sort-tabs" role="tablist">
          <button
            v-for="s in sortOptions"
            :key="s.value"
            type="button"
            role="tab"
            :class="{ active: query.sort === s.value }"
            @click="setSort(s.value)"
          >{{ s.label }}</button>
        </div>
        <span class="total-info">共 <b>{{ total }}</b> 套</span>
      </div>

      <div class="chip-row">
        <span class="chip-label">技术栈</span>
        <div ref="techScrollEl" class="chip-scroll">
          <FilterChip :active="query.tech === '全部'" @click="setTech('全部')">全部</FilterChip>
          <FilterChip
            v-for="t in techs"
            :key="t.name || t.tech"
            :active="query.tech === (t.name || t.tech)"
            :count="t.cnt"
            @click="setTech(t.name || t.tech)"
          >{{ t.name || t.tech }}</FilterChip>
        </div>
      </div>

      <div v-if="categories.length" class="chip-row">
        <span class="chip-label">分类</span>
        <div ref="catScrollEl" class="chip-scroll">
          <FilterChip :active="query.category === '全部'" @click="setCategory('全部')">全部</FilterChip>
          <FilterChip
            v-for="c in categories"
            :key="c.name"
            :active="query.category === c.name"
            :count="c.cnt"
            @click="setCategory(c.name)"
          >{{ c.name }}</FilterChip>
        </div>
      </div>

      <div class="filter-more">
        <button type="button" class="more-toggle" @click="showMore = !showMore">
          {{ showMore ? '收起筛选' : '更多筛选' }}
          <span class="more-chevron" :class="{ open: showMore }">▾</span>
        </button>
        <div v-show="showMore" class="more-body">
          <div class="flag-row">
            <FilterChip :active="query.has_paper === '1'" @click="toggleFlag('has_paper')">含论文</FilterChip>
            <FilterChip :active="query.has_ppt === '1'" @click="toggleFlag('has_ppt')">含PPT</FilterChip>
            <FilterChip :active="query.has_video === '1'" @click="toggleFlag('has_video')">含视频教程</FilterChip>
            <FilterChip :active="query.has_db === '1'" @click="toggleFlag('has_db')">含数据库</FilterChip>
            <FilterChip :active="query.has_demo === '1'" @click="toggleFlag('has_demo')">可在线演示</FilterChip>
            <FilterChip :active="query.has_intro_video === '1'" @click="toggleFlag('has_intro_video')">有介绍视频</FilterChip>
          </div>
          <div class="price-range">
            <input v-model="query.priceMin" class="price-input" placeholder="最低价" @keyup.enter="onSearch" />
            <span class="price-sep">–</span>
            <input v-model="query.priceMax" class="price-input" placeholder="最高价" @keyup.enter="onSearch" />
            <StoreButton variant="outline" class="price-btn" @click="onSearch">筛选</StoreButton>
            <StoreButton variant="ghost" class="price-btn" @click="clearFilters">重置</StoreButton>
          </div>
        </div>
      </div>
    </div>

    <div v-if="searchHistory.length && !query.keyword" class="history-row">
      <span class="history-label">搜索历史</span>
      <button
        v-for="kw in searchHistory"
        :key="kw"
        type="button"
        class="history-chip"
        @click="applyHistory(kw)"
      >
        {{ kw }}
        <span class="history-x" @click.stop="removeHistory(kw)">×</span>
      </button>
      <button type="button" class="history-clear" @click="clearHistory">清空</button>
    </div>

    <div v-if="loading" class="product-grid skeleton-grid">
      <div v-for="n in 8" :key="n" class="skeleton-card">
        <el-skeleton :rows="0" animated>
          <template #template>
            <el-skeleton-item variant="image" style="width: 100%; aspect-ratio: 16/10; border-radius: 10px" />
            <div style="padding: 12px 0 0">
              <el-skeleton-item variant="text" style="width: 60%" />
              <el-skeleton-item variant="text" style="width: 90%; margin-top: 8px" />
              <el-skeleton-item variant="text" style="width: 40%; margin-top: 8px" />
            </div>
          </template>
        </el-skeleton>
      </div>
    </div>
    <div v-else>
      <div class="product-grid">
        <ProductCard
          v-for="(p, i) in products"
          :key="p.id"
          :product="p"
          :eager="i < 8"
          :title-html="highlightHtml(p.title, query.keyword)"
          show-materials
          show-meta
          v-reveal="{ value: (i % 8) * 40 }"
        >
          <template #badges>
            <span v-if="p.run_status === 1" class="verified-badge">已验证</span>
            <span v-if="p.run_status === 2" class="warning-badge">有问题</span>
            <div v-if="p.demo_url || p.video_url" class="media-badges">
              <span v-if="p.demo_url" class="media-badge">可演示</span>
              <span v-if="p.video_url" class="media-badge">介绍视频</span>
            </div>
          </template>
        </ProductCard>
      </div>
      <div v-if="!loading && !products.length" class="empty-illus">
        <div class="ei-icon">空</div>
        <p class="ei-title">没有找到相关源码</p>
        <p class="ei-desc">试试换个关键词，或清空筛选条件重新逛逛</p>
        <StoreButton variant="solid" @click="clearFilters">清空筛选 · 去逛逛</StoreButton>
      </div>
    </div>

    <div v-if="total > 0" class="pager-wrap">
      <el-pagination
        class="pager"
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
import { ref, reactive, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import http from '../../api';
import ProductCard from '../../components/store/ProductCard.vue';
import FilterChip from '../../components/store/FilterChip.vue';
import StoreButton from '../../components/store/StoreButton.vue';
import { setSeo, resetSeo } from '../../composables/useSeo';

const PAGE_SIZES = [12, 20, 40];
const DEFAULT_PAGE_SIZE = 20;

const route = useRoute();
const router = useRouter();
const products = ref([]);
const techs = ref([]);
const categories = ref([]);
const total = ref(0);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const loading = ref(false);
const showMore = ref(false);
const techScrollEl = ref(null);
const catScrollEl = ref(null);
let loadSeq = 0;
const chipWheelCleanups = [];
const chipWheelBound = new WeakSet();

function bindChipWheel(el) {
  if (!el || chipWheelBound.has(el)) return;
  chipWheelBound.add(el);
  const handler = (e) => {
    if (el.scrollWidth <= el.clientWidth + 1) return;
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!dx) return;
    const atStart = el.scrollLeft <= 0 && dx < 0;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && dx > 0;
    if (atStart || atEnd) return;
    el.scrollLeft += dx;
    e.preventDefault();
  };
  el.addEventListener('wheel', handler, { passive: false });
  chipWheelCleanups.push(() => {
    el.removeEventListener('wheel', handler);
    chipWheelBound.delete(el);
  });
}

const sortOptions = [
  { value: 'latest', label: '最新上架' },
  { value: 'sales', label: '销量优先' },
  { value: 'hot', label: '热门浏览' },
  { value: 'price_asc', label: '价格升序' },
  { value: 'price_desc', label: '价格降序' }
];

const SEARCH_HISTORY_KEY = 'search_history';
const searchHistory = ref([]);

function loadSearchHistory() {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    searchHistory.value = Array.isArray(arr) ? arr : [];
  } catch {
    searchHistory.value = [];
  }
}

function saveSearchHistory() {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory.value));
}

function pushSearchHistory(keyword) {
  const kw = String(keyword || '').trim();
  if (!kw) return;
  searchHistory.value = [kw, ...searchHistory.value.filter((x) => x !== kw)].slice(0, 10);
  saveSearchHistory();
}

function removeHistory(kw) {
  searchHistory.value = searchHistory.value.filter((x) => x !== kw);
  saveSearchHistory();
}

function clearHistory() {
  searchHistory.value = [];
  saveSearchHistory();
}

function applyHistory(kw) {
  query.keyword = kw;
  onSearch();
}

function clearFilters() {
  query.keyword = '';
  query.tech = '全部';
  query.category = '全部';
  query.sort = 'latest';
  query.has_paper = '';
  query.has_ppt = '';
  query.has_video = '';
  query.has_db = '';
  query.has_demo = '';
  query.has_intro_video = '';
  query.priceMin = '';
  query.priceMax = '';
  onSearch();
}

function toggleFlag(key) {
  query[key] = query[key] === '1' ? '' : '1';
  onSearch();
}

function setSort(value) {
  if (query.sort === value) return;
  query.sort = value;
  onSearch();
}

function setTech(value) {
  query.tech = query.tech === value && value !== '全部' ? '全部' : value;
  onSearch();
}

function setCategory(value) {
  query.category = query.category === value && value !== '全部' ? '全部' : value;
  onSearch();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlightHtml(title, keyword) {
  const escaped = escapeHtml(title);
  if (!keyword) return escaped;
  const kw = String(keyword).trim();
  if (!kw) return escaped;
  const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return escaped.replace(re, '<em class="search-hl">$&</em>');
}

const query = reactive({
  page: 1,
  keyword: '',
  tech: '全部',
  category: '全部',
  sort: 'latest',
  has_paper: '',
  has_ppt: '',
  has_video: '',
  has_db: '',
  has_demo: '',
  has_intro_video: '',
  priceMin: '',
  priceMax: ''
});

function normalizeFilters(src, size) {
  const flag = (v) => (v === '1' || v === 1 ? '1' : '');
  const ps = parseInt(size ?? src.pageSize, 10);
  return {
    page: parseInt(src.page, 10) || 1,
    pageSize: PAGE_SIZES.includes(ps) ? ps : DEFAULT_PAGE_SIZE,
    keyword: src.keyword || '',
    tech: src.tech || '全部',
    category: src.category || '全部',
    sort: src.sort || 'latest',
    has_paper: flag(src.has_paper),
    has_ppt: flag(src.has_ppt),
    has_video: flag(src.has_video),
    has_db: flag(src.has_db),
    has_demo: flag(src.has_demo),
    has_intro_video: flag(src.has_intro_video),
    priceMin: src.priceMin || '',
    priceMax: src.priceMax || ''
  };
}

function currentFilters() {
  return normalizeFilters(query, pageSize.value);
}

function routeFilters() {
  return normalizeFilters(route.query);
}

function filtersEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function initFromRoute() {
  const n = routeFilters();
  Object.assign(query, {
    keyword: n.keyword,
    tech: n.tech,
    category: n.category,
    sort: n.sort,
    has_paper: n.has_paper,
    has_ppt: n.has_ppt,
    has_video: n.has_video,
    has_db: n.has_db,
    has_demo: n.has_demo,
    has_intro_video: n.has_intro_video,
    priceMin: n.priceMin,
    priceMax: n.priceMax,
    page: n.page
  });
  pageSize.value = n.pageSize;
  if (
    n.has_paper || n.has_ppt || n.has_video || n.has_db ||
    n.has_demo || n.has_intro_video || n.priceMin || n.priceMax
  ) {
    showMore.value = true;
  }
}

function applySeo() {
  if (query.keyword) {
    setSeo({
      title: `搜索：${query.keyword} - 毕业设计 / 毕设源码`,
      description: `查找与「${query.keyword}」相关的毕业设计、毕设、课程设计源码。`,
      keywords: `${query.keyword},毕业设计,毕设,课程设计,Java源码`
    });
  } else {
    setSeo({
      title: '全部源码 - 毕业设计 / 毕设 / 课程设计完整版',
      description: '浏览毕业设计与课程设计完整版源码：SpringBoot / SSM / Java，含论文、PPT、数据库脚本。',
      keywords: '毕业设计,毕设,课程设计,Java源码,SpringBoot源码,SSM源码'
    });
  }
}

async function load() {
  const seq = ++loadSeq;
  loading.value = true;
  try {
    const res = await http.get('/products', {
      params: { ...query, pageSize: pageSize.value }
    });
    if (seq !== loadSeq) return;
    products.value = res.list;
    total.value = res.total;
    if (res.facets) {
      techs.value = res.facets.techs || techs.value;
      categories.value = res.facets.categories || categories.value;
    }
    applySeo();
    scrollActiveChips();
  } finally {
    if (seq === loadSeq) loading.value = false;
  }
}

async function loadTechs() {
  techs.value = await http.get('/products/techs');
}

function buildUrlQuery() {
  const q = { ...query, pageSize: pageSize.value };
  Object.keys(q).forEach((k) => {
    if (
      q[k] === '' ||
      q[k] === '全部' ||
      (k === 'sort' && q[k] === 'latest') ||
      (k === 'page' && q[k] === 1) ||
      (k === 'pageSize' && q[k] === DEFAULT_PAGE_SIZE)
    ) {
      delete q[k];
    }
  });
  return q;
}

function syncToUrl() {
  const next = buildUrlQuery();
  const cur = { ...route.query };
  const nextKeys = Object.keys(next);
  const curKeys = Object.keys(cur);
  const same =
    nextKeys.length === curKeys.length &&
    nextKeys.every((k) => String(next[k]) === String(cur[k]));
  if (same) return;
  router.replace({ query: next });
}

function scrollTop() {
  window.scrollTo({ top: 0 });
}

async function scrollActiveChips() {
  await nextTick();
  [techScrollEl.value, catScrollEl.value].forEach((wrap) => {
    if (!wrap) return;
    const active = wrap.querySelector('.filter-chip.active');
    if (!active) return;
    // 只水平滚动容器，避免 scrollIntoView 连带整页跳动
    const wrapRect = wrap.getBoundingClientRect();
    const chipRect = active.getBoundingClientRect();
    const delta =
      chipRect.left - wrapRect.left - (wrapRect.width - chipRect.width) / 2;
    const nextLeft = Math.max(
      0,
      Math.min(wrap.scrollWidth - wrap.clientWidth, wrap.scrollLeft + delta)
    );
    wrap.scrollTo({ left: nextLeft, behavior: 'smooth' });
  });
}

function onSearch() {
  if (query.keyword?.trim()) pushSearchHistory(query.keyword.trim());
  query.page = 1;
  scrollTop();
  load();
  syncToUrl();
}

function onPage(p) {
  query.page = p;
  scrollTop();
  load();
  syncToUrl();
}

function onPageSize(size) {
  pageSize.value = size;
  query.page = 1;
  scrollTop();
  load();
  syncToUrl();
}

watch(
  () => route.query,
  () => {
    if (filtersEqual(routeFilters(), currentFilters())) return;
    initFromRoute();
    if (query.keyword?.trim()) pushSearchHistory(query.keyword.trim());
    scrollTop();
    load();
  }
);

onMounted(async () => {
  loadSearchHistory();
  initFromRoute();
  load();
  loadTechs();
  await nextTick();
  bindChipWheel(techScrollEl.value);
  bindChipWheel(catScrollEl.value);
});
onBeforeUnmount(() => {
  chipWheelCleanups.splice(0).forEach((fn) => fn());
  if (route.name === 'products') resetSeo();
});

watch(catScrollEl, (el) => {
  if (el) bindChipWheel(el);
});
watch(techScrollEl, (el) => {
  if (el) bindChipWheel(el);
});
</script>

<style scoped>
.list-page { padding-top: 16px; padding-bottom: 40px; }
.filter-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 16px 18px 14px;
  margin-bottom: 20px;
}
.filter-row {
  display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  margin-bottom: 14px; padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.sort-tabs {
  display: flex; gap: 4px; flex-wrap: wrap;
}
.sort-tabs button {
  appearance: none; background: none; border: 0; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 500;
  color: var(--text-3); padding: 6px 12px; border-radius: 8px;
  position: relative; transition: color .15s, background .15s;
}
.sort-tabs button:hover { color: var(--text-1); background: var(--bg-alt); }
.sort-tabs button.active {
  color: #fff; font-weight: 600; background: var(--ink);
}
.total-info { color: var(--text-3); font-size: 13px; margin-left: auto; }
.total-info b {
  color: var(--text-1); font-weight: 650;
  font-family: var(--font-num); font-variant-numeric: tabular-nums;
}

.chip-row {
  display: flex; align-items: center; gap: 10px;
  margin-top: 10px; min-width: 0;
}
.chip-label {
  font-size: 12.5px; color: var(--text-3); font-weight: 500;
  flex-shrink: 0; width: 3em;
}
.chip-scroll {
  display: flex; flex-wrap: nowrap; gap: 8px; flex: 1; min-width: 0;
  overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
  padding: 2px 0;
  overscroll-behavior-x: contain;
  touch-action: pan-x;
}
.chip-scroll::-webkit-scrollbar { display: none; }
.chip-scroll > :deep(*) { flex-shrink: 0; }

.filter-more { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
.more-toggle {
  appearance: none; background: none; border: 0; padding: 0;
  font-family: inherit; font-size: 13px; font-weight: 500;
  color: var(--text-3); cursor: pointer;
  display: inline-flex; align-items: center; gap: 4px;
}
.more-toggle:hover { color: var(--text-1); }
.more-chevron { display: inline-block; transition: transform .18s; font-size: 12px; }
.more-chevron.open { transform: rotate(180deg); }
.more-body {
  margin-top: 12px;
  display: flex; flex-direction: column; gap: 12px;
}
.flag-row { display: flex; flex-wrap: wrap; gap: 8px; }
.price-range { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.price-input {
  width: 88px; height: 36px; padding: 0 10px;
  border: 1px solid var(--border); border-radius: 8px;
  background: var(--surface); color: var(--text-1);
  font-family: inherit; font-size: 13px;
}
.price-input:focus { outline: none; border-color: var(--ink); }
.price-sep { color: var(--text-4); }
.price-btn { height: 36px !important; padding: 0 14px !important; font-size: 13px !important; }
.price-btn.is-ghost { border-color: var(--border); }

.history-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 0 0 16px; }
.history-label { font-size: 13px; color: var(--text-3); flex-shrink: 0; }
.history-chip {
  appearance: none; border: 1px solid var(--border); background: transparent;
  border-radius: 8px; padding: 4px 8px 4px 10px; font-size: 12.5px;
  color: var(--text-2); cursor: pointer; font-family: inherit;
  display: inline-flex; align-items: center; gap: 6px;
}
.history-chip:hover { border-color: var(--ink); color: var(--text-1); }
.history-x { color: var(--text-4); font-size: 14px; line-height: 1; }
.history-clear {
  appearance: none; border: 0; background: none; cursor: pointer;
  font-family: inherit; font-size: 12.5px; color: var(--text-3);
}
.history-clear:hover { color: var(--text-1); }

.verified-badge, .warning-badge {
  position: absolute; top: 8px; z-index: 2;
  font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px;
  color: #fff;
}
.verified-badge { left: 8px; background: #0a0a0b; }
.warning-badge { right: 8px; background: #78716c; }
.media-badges {
  position: absolute; left: 8px; bottom: 8px; z-index: 2;
  display: flex; flex-wrap: wrap; gap: 4px; max-width: calc(100% - 16px);
}
.media-badge {
  font-size: 11px; font-weight: 500; padding: 2px 7px; border-radius: 6px;
  color: #fff; background: rgba(10, 10, 11, .72);
}
.pager-wrap {
  margin-top: 28px; display: flex; justify-content: center;
  max-width: 100%; overflow-x: auto;
}
.pager { justify-content: center; flex-wrap: wrap; row-gap: 8px; }
.skeleton-card {
  background: var(--surface); border-radius: var(--r-lg); padding: 12px;
  border: 1px solid var(--border);
}
:deep(.search-hl) {
  color: var(--text-1); font-style: normal; font-weight: 700;
  background: var(--bg-alt); border-radius: 3px; padding: 0 2px;
}

@media (max-width: 768px) {
  .list-page { padding-top: 12px; padding-bottom: 24px; }
  .filter-panel { padding: 12px; margin-bottom: 14px; }
  .filter-row { gap: 8px; }
  .sort-tabs { width: 100%; overflow-x: auto; scrollbar-width: none; flex-wrap: nowrap; }
  .sort-tabs::-webkit-scrollbar { display: none; }
  .sort-tabs button { white-space: nowrap; }
  .total-info { margin-left: 0; width: 100%; font-size: 12.5px; }
  .price-input { flex: 1; width: auto; min-width: 0; }
  .chip-label { width: auto; }
  .pager-wrap { margin-top: 20px; }
}
</style>
