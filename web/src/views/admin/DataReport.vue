<template>
  <div class="admin-page" v-loading="loading">
    <h2 class="page-title">数据洞察</h2>

    <el-card class="funnel-card" shadow="never">
      <template #header>
        <div class="visit-head">
          <span class="chart-title">转化漏斗</span>
          <el-radio-group v-model="funnelDays" size="small" @change="loadFunnel">
            <el-radio-button :label="7">近 7 天</el-radio-button>
            <el-radio-button :label="30">近 30 天</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <p class="funnel-note">说明：加购数据存在浏览器 localStorage，服务端无法统计，因此漏斗不含「加购」环节。</p>
      <div v-if="funnelHasData" ref="funnelEl" class="chart funnel-chart"></div>
      <el-empty v-else description="还没有访问或订单数据，先去分享引流" :image-size="72" />
      <div v-if="funnel" class="funnel-rates">
        <span>访问→详情 {{ fmtRate(funnel.rates?.visitToProduct) }}</span>
        <span>详情→下单 {{ fmtRate(funnel.rates?.productToOrder) }}</span>
        <span>下单→支付 {{ fmtRate(funnel.rates?.orderToPaid) }}</span>
        <span>访问→支付 {{ fmtRate(funnel.rates?.visitToPaid) }}</span>
      </div>
    </el-card>

    <div class="grid">
      <el-card class="cc" shadow="never">
        <template #header><span class="chart-title">分类分布（按套数 / 销量）</span></template>
        <div v-if="(data.categoryDist || []).length" ref="catEl" class="chart"></div>
        <el-empty v-else description="暂无分类数据，上架商品后即可看到" :image-size="72" />
      </el-card>
      <el-card class="cc" shadow="never">
        <template #header><span class="chart-title">技术栈分布</span></template>
        <div v-if="(data.techDist || []).length" ref="techEl" class="chart"></div>
        <el-empty v-else description="暂无技术栈数据，上架商品后即可看到" :image-size="72" />
      </el-card>
      <el-card class="cc" shadow="never">
        <template #header><span class="chart-title">热门搜索词 Top 12</span></template>
        <div v-if="(data.topKeywords || []).length" ref="topEl" class="chart"></div>
        <el-empty v-else description="还没有搜索数据，用户搜索后这里会展示" :image-size="72" />
      </el-card>
      <el-card class="cc" shadow="never">
        <template #header><span class="chart-title">无结果搜索词（选题缺口）</span></template>
        <div v-if="(data.noResultKeywords || []).length" ref="noEl" class="chart"></div>
        <el-empty v-else description="暂无无结果搜索词" :image-size="72" />
        <h4 class="sub-inline">无结果词（转定制）</h4>
        <el-table v-if="(data.noResultKeywords || []).length" :data="data.noResultKeywords" size="small">
          <el-table-column prop="keyword" label="关键词" min-width="140" />
          <el-table-column prop="cnt" label="次数" width="80" />
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button
                size="small"
                type="primary"
                plain
                :disabled="converted.has(row.keyword)"
                @click="convertKeyword(row.keyword)"
              >
                {{ converted.has(row.keyword) ? '已创建' : '转定制需求单' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无待转化关键词" :image-size="64" />
      </el-card>
      <el-card class="cc visit-card" shadow="never">
        <template #header>
          <div class="visit-head">
            <span class="chart-title">访问来源</span>
            <el-radio-group v-model="visitDays" size="small" @change="loadVisits">
              <el-radio-button :label="7">近 7 天</el-radio-button>
              <el-radio-button :label="30">近 30 天</el-radio-button>
            </el-radio-group>
          </div>
        </template>
        <div v-if="visitTotal > 0" ref="visitEl" class="chart"></div>
        <el-empty v-else description="还没有访问数据，先去分享引流" :image-size="72" />
        <p class="visit-total">合计 <b>{{ visitTotal }}</b> 次</p>
      </el-card>
    </div>

    <h3 class="sub">最近搜索记录</h3>
    <div class="admin-panel">
      <el-table v-if="(data.recentSearches || []).length" :data="data.recentSearches" size="small">
        <el-table-column prop="keyword" label="关键词" min-width="160" />
        <el-table-column label="结果数" width="100"><template #default="{ row }">{{ row.result_count }}</template></el-table-column>
        <el-table-column label="时间" min-width="160"><template #default="{ row }">{{ row.created_at }}</template></el-table-column>
      </el-table>
      <el-empty v-else description="还没有搜索记录" :image-size="72" />
    </div>

    <h3 class="sub">近 7 天来源 Top 10</h3>
    <div class="admin-panel">
      <el-table v-if="visitTop7.length" :data="visitTop7" size="small">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="source" label="来源" min-width="140" />
        <el-table-column prop="cnt" label="次数" width="100" />
      </el-table>
      <el-empty v-else description="还没有访问来源数据，先去分享引流" :image-size="72" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
import http from '../../api';

const loading = ref(false);
const data = ref({ categoryDist: [], techDist: [], topKeywords: [], noResultKeywords: [], recentSearches: [] });
const converted = ref(new Set());
const catEl = ref(null), techEl = ref(null), topEl = ref(null), noEl = ref(null), visitEl = ref(null), funnelEl = ref(null);
const charts = [];
const visitDays = ref(7);
const visitTotal = ref(0);
const visitTop7 = ref([]);
let visitChart = null;
const funnelDays = ref(30);
const funnel = ref(null);
// 转化率展示：后端在分母为 0 时返回 null，此时显示「—」而不是 0%，避免误导
function fmtRate(v) {
  return v === null || v === undefined ? '—' : `${v}%`;
}
const funnelHasData = computed(() => {
  const f = funnel.value;
  if (!f) return false;
  return (f.visits || 0) + (f.productViews || 0) + (f.orders || 0) + (f.paid || 0) > 0;
});

function bar(elRef, rows, labelKey, valKey, horizontal = true) {
  if (!elRef.value || !rows?.length) return;
  const c = echarts.init(elRef.value); charts.push(c);
  const sorted = [...rows].sort((a,b)=>a[valKey]-b[valKey]);
  c.setOption({
    grid: { left: horizontal?110:48, right: 24, top: 16, bottom: horizontal?16:30 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: horizontal?'value':'category', data: horizontal?undefined:sorted.map(r=>r[labelKey]), axisLabel: { color:'#8a90a0' }, splitLine: horizontal?{lineStyle:{color:'#f0f1f5'}}:{} },
    yAxis: { type: horizontal?'category':'value', data: horizontal?sorted.map(r=>r[labelKey]):undefined, axisLabel: { color:'#8a90a0' } },
    series: [{ type:'bar', data: sorted.map(r=>r[valKey]), barWidth: horizontal?14:'40%',
      itemStyle: { borderRadius: horizontal?[0,8,8,0]:[8,8,0,0],
        color: new echarts.graphic.LinearGradient(horizontal?0:0,0,horizontal?1:0,1,[{offset:0,color:'#14b8a6'},{offset:1,color:'#0d9488'}]) } }]
  });
}

function pie(elRef, rows) {
  if (!elRef.value || !rows?.length) return;
  if (!visitChart) {
    visitChart = echarts.init(elRef.value);
    charts.push(visitChart);
  }
  visitChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { type: 'scroll', bottom: 0, textStyle: { color: '#8a90a0', fontSize: 12 } },
    series: [{
      type: 'pie',
      radius: ['38%', '62%'],
      center: ['50%', '45%'],
      data: rows.map((r) => ({ name: r.source, value: r.cnt })),
      label: { color: '#52525b', fontSize: 12 },
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 }
    }]
  }, true);
}

function renderFunnel(f) {
  if (!funnelEl.value || !f) return;
  let c = charts.find((x) => x.getDom?.() === funnelEl.value);
  if (!c) {
    c = echarts.init(funnelEl.value);
    charts.push(c);
  }
  const steps = [
    { name: '页面访问', value: f.visits || 0 },
    { name: '商品详情', value: f.productViews || 0 },
    { name: '下单', value: f.orders || 0 },
    { name: '已支付', value: f.paid || 0 }
  ];
  c.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    series: [{
      type: 'funnel',
      left: '12%',
      width: '76%',
      top: 16,
      bottom: 16,
      minSize: '12%',
      maxSize: '100%',
      sort: 'descending',
      gap: 6,
      label: { show: true, position: 'inside', formatter: '{b}\n{c}', color: '#fff', fontSize: 13 },
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      data: steps.map((s, i) => ({
        ...s,
        itemStyle: { color: ['#0a0a0b', '#0d9488', '#14b8a6', '#34d399'][i] }
      }))
    }]
  }, true);
}

async function convertKeyword(keyword) {
  await http.post('/services/admin/custom/from-keyword', { keyword });
  converted.value.add(keyword);
  ElMessage.success('已创建定制需求单');
}

async function loadVisits() {
  try {
    const res = await http.get('/admin/stats/visits', { params: { days: visitDays.value } });
    visitTotal.value = res.total || 0;
    await nextTick();
    if (visitTotal.value > 0) pie(visitEl, res.list || []);
  } catch {
    visitTotal.value = 0;
  }
}

async function loadVisitTop7() {
  try {
    const res = await http.get('/admin/stats/visits', { params: { days: 7 } });
    visitTop7.value = (res.list || []).slice(0, 10);
  } catch {
    visitTop7.value = [];
  }
}

async function loadFunnel() {
  try {
    funnel.value = await http.get('/admin/stats/funnel', { params: { days: funnelDays.value } });
    await nextTick();
    if (funnelHasData.value) renderFunnel(funnel.value);
  } catch {
    funnel.value = null;
  }
}

async function load() {
  loading.value = true;
  try {
    data.value = await http.get('/services/admin/insight');
    await nextTick();
    bar(catEl, data.value.categoryDist, 'name', 'cnt');
    bar(techEl, data.value.techDist, 'name', 'cnt');
    bar(topEl, data.value.topKeywords, 'keyword', 'cnt');
    bar(noEl, data.value.noResultKeywords, 'keyword', 'cnt');
    await Promise.all([loadVisits(), loadVisitTop7(), loadFunnel()]);
  } finally { loading.value = false; }
}
function resize() { charts.forEach(c=>c.resize()); }
onMounted(() => { load(); window.addEventListener('resize', resize); });
onBeforeUnmount(() => { window.removeEventListener('resize', resize); charts.forEach(c=>c.dispose()); });
</script>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 22px; }
.chart-title { font-weight: 650; font-size: 14px; }
.chart { width: 100%; height: 260px; }
.funnel-chart { height: 300px; }
.sub { font-size: 15px; font-weight: 700; margin: 8px 0 12px; color: var(--text-1); }
.sub-inline { font-size: 13px; font-weight: 650; margin: 16px 0 10px; color: var(--text-2); }
.visit-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.visit-total { margin: 8px 0 0; font-size: 13px; color: var(--text-3); }
.visit-total b { color: var(--text-1); }
.funnel-card {
  margin-bottom: 16px; border: 1px solid var(--border); border-radius: 12px;
  --el-card-border-color: var(--border);
}
.funnel-note { margin: 0 0 8px; font-size: 13px; color: var(--text-3); line-height: 1.6; }
.funnel-rates {
  display: flex; flex-wrap: wrap; gap: 12px 20px; margin-top: 8px;
  font-size: 13px; color: var(--text-2);
}
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>
