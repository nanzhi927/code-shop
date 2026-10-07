<template>
  <div class="page-container cases-page">
    <header class="page-head">
      <h1 class="page-title">交付案例</h1>
      <p class="page-sub">看同学当时卡在哪、我们接了什么、几天交付——用真实处境建立预期，不是功能清单。</p>
    </header>

    <div class="filter-bar">
      <div class="chip-scroll">
        <FilterChip :active="!query.service_type" @click="setFilter('service_type', '')">全部</FilterChip>
        <FilterChip
          v-for="s in facets.service_types"
          :key="s.name"
          :active="query.service_type === s.name"
          :count="s.cnt"
          @click="setFilter('service_type', s.name)"
        >{{ s.label }}</FilterChip>
      </div>
      <span class="total">{{ total }} 个案例</span>
    </div>

    <div v-if="loading" class="story-list">
      <div v-for="n in 4" :key="n" class="story-card sk">
        <el-skeleton animated :rows="3" />
      </div>
    </div>

    <div v-else class="story-list">
      <article
        v-for="(c, i) in list"
        :key="c.id"
        class="story-card"
        v-reveal="{ value: (i % 5) * 35 }"
        @click="go(c.slug)"
      >
        <div class="story-meta">
          <span class="svc">{{ c.service_label }}</span>
          <span v-if="c.duration_label" class="dur">{{ c.duration_label }}</span>
          <span v-if="c.tech" class="muted">{{ c.tech }}</span>
        </div>
        <h2 class="story-title">{{ c.title }}</h2>
        <p v-if="c.client_scene" class="stuck">
          <span class="stuck-label">当时卡在</span>
          {{ c.client_scene }}
        </p>
        <p class="outcome">{{ c.summary }}</p>
        <ul v-if="c.result_points?.length" class="bullets">
          <li v-for="(p, j) in c.result_points.slice(0, 3)" :key="j">{{ p }}</li>
        </ul>
        <span class="read-more">看完整交付故事 →</span>
      </article>
    </div>

    <div v-if="!loading && !list.length" class="empty-illus">
      <p class="ei-title">暂无已发布案例</p>
      <p class="ei-desc">后台补上真实交付故事后，这里会出现处境与结果对照。</p>
    </div>

    <div v-if="total > pageSize" class="pager-wrap">
      <el-pagination
        background
        layout="prev, pager, next"
        :total="total"
        :page-size="pageSize"
        :current-page="query.page"
        @current-change="onPage"
      />
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import http from '../../api';
import FilterChip from '../../components/store/FilterChip.vue';
import { setSeo, resetSeo } from '../../composables/useSeo';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const list = ref([]);
const total = ref(0);
const pageSize = 10;
const facets = ref({ service_types: [] });
const query = reactive({ page: 1, service_type: '' });

function syncFromRoute() {
  query.page = Math.max(1, parseInt(route.query.page, 10) || 1);
  query.service_type = String(route.query.service_type || '');
}

function pushQuery() {
  const q = {};
  if (query.page > 1) q.page = String(query.page);
  if (query.service_type) q.service_type = query.service_type;
  router.replace({ path: '/cases', query: q });
}

function setFilter(key, val) {
  query[key] = query[key] === val ? '' : val;
  query.page = 1;
  pushQuery();
}

function onPage(p) {
  query.page = p;
  pushQuery();
}

function go(slug) {
  router.push(`/cases/${slug}`);
}

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/cases', {
      params: {
        page: query.page,
        pageSize,
        service_type: query.service_type || undefined
      }
    });
    list.value = res.list || [];
    total.value = res.total || 0;
    facets.value = res.facets || { service_types: [] };
  } catch {
    list.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

watch(() => route.query, () => {
  syncFromRoute();
  load();
}, { deep: true });

onMounted(() => {
  setSeo({
    title: '交付案例',
    description: '脱敏交付故事：卡点、边界、周期与结果，建立对定制与代跑的合理预期。'
  });
  syncFromRoute();
  load();
});
onBeforeUnmount(() => resetSeo());
</script>

<style scoped>
.cases-page { padding: 28px 0 64px; }
.page-head { margin-bottom: 22px; max-width: 640px; }
.page-title {
  margin: 0 0 10px; font-family: var(--font-display);
  font-size: clamp(26px, 4vw, 34px); font-weight: 720; letter-spacing: -.02em;
}
.page-sub { margin: 0; font-size: 15px; line-height: 1.7; color: var(--text-3); }

.filter-bar {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 20px;
}
.chip-scroll { display: flex; flex-wrap: wrap; gap: 8px; }
.total { font-size: 13px; color: var(--text-4); }

.story-list { display: flex; flex-direction: column; gap: 14px; max-width: 760px; }
.story-card {
  padding: 20px 22px 18px;
  border: 1px solid var(--border); border-radius: 14px;
  background: var(--surface); cursor: pointer;
  transition: border-color .18s, transform .18s var(--ease);
}
.story-card:hover { border-color: var(--ink); transform: translateY(-1px); }
.story-card.sk { cursor: default; min-height: 120px; }

.story-meta {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px;
  font-size: 12px;
}
.svc {
  font-weight: 650; color: var(--text-1);
  padding: 2px 9px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--bg-alt);
}
.dur { font-weight: 600; color: #0f766e; }
.muted { color: var(--text-4); }

.story-title {
  margin: 0 0 12px; font-size: 18px; line-height: 1.4; font-weight: 720; color: var(--text-1);
}
.stuck {
  margin: 0 0 10px; font-size: 14px; line-height: 1.7; color: var(--text-2);
  padding: 10px 12px; border-radius: 10px; background: var(--bg-alt);
}
.stuck-label {
  display: inline-block; margin-right: 6px;
  font-size: 12px; font-weight: 700; color: var(--text-3);
}
.outcome {
  margin: 0 0 10px; font-size: 15px; line-height: 1.65; color: var(--text-1); font-weight: 600;
}
.bullets {
  margin: 0 0 12px; padding-left: 1.1em; color: var(--text-3); font-size: 13.5px; line-height: 1.55;
}
.bullets li { margin: 2px 0; }
.read-more {
  font-size: 13px; font-weight: 650; color: var(--text-2);
}
.story-card:hover .read-more { color: var(--ink); }

.pager-wrap { margin-top: 24px; display: flex; justify-content: flex-start; }
.empty-illus { text-align: center; padding: 64px 16px; color: var(--text-3); }
.ei-title { margin: 0 0 8px; font-size: 16px; font-weight: 650; color: var(--text-1); }
.ei-desc { margin: 0; font-size: 14px; }
</style>
