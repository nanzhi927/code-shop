<template>
  <div class="admin-page dash">
    <div class="dash-head fade-up">
      <div>
        <h2 class="page-title">数据概览</h2>
        <p class="dash-sub">成交仅统计支付宝 / 微信 / 卡密 · 更新于 {{ nowText }}</p>
      </div>
      <el-button @click="loadAll"><el-icon><Refresh /></el-icon> 刷新</el-button>
    </div>

    <!-- 待办聚合 -->
    <el-card class="todo-card fade-up" shadow="never">
      <template #header><span class="chart-title">待办</span></template>
      <div v-if="todoTotal > 0" class="todo-row">
        <button
          v-for="t in todoItems"
          :key="t.key"
          type="button"
          class="todo-item"
          :class="{ 'is-zero': !t.count }"
          @click="goTodo(t.to)"
        >
          <span class="todo-count">{{ t.count }}</span>
          <span class="todo-label">{{ t.label }}</span>
        </button>
      </div>
      <p v-else class="todo-empty">暂无待办事项</p>
    </el-card>

    <!-- KPI 卡片 -->
    <div class="kpi-row" v-loading="loading">
      <div class="kpi-card fade-up" v-for="(k, i) in kpis" :key="k.label" :style="{ animationDelay: (i * 0.05) + 's' }">
        <div class="kpi-icon" :style="{ background: k.bg }">
          <el-icon :size="20"><component :is="k.icon" /></el-icon>
        </div>
        <div class="kpi-body">
          <div class="kpi-num">{{ k.value }}</div>
          <div class="kpi-label">{{ k.label }}</div>
        </div>
      </div>
    </div>

    <!-- 图表区 -->
    <div class="chart-grid" v-loading="loading">
      <el-card class="chart-card fade-up" shadow="never">
        <template #header><span class="chart-title">真实成交（近 14 天）</span></template>
        <div v-if="hasTrend" ref="trendEl" class="chart"></div>
        <el-empty v-else description="近 14 天暂无支付宝/微信/卡密成交" :image-size="72" />
      </el-card>

      <el-card class="chart-card fade-up" shadow="never">
        <template #header><span class="chart-title">访问趋势（近 14 天）</span></template>
        <div v-if="hasVisitTrend" ref="visitTrendEl" class="chart"></div>
        <el-empty v-else description="还没有访问数据，打开前台逛几页后再刷新" :image-size="72" />
      </el-card>

      <el-card class="chart-card fade-up" shadow="never">
        <template #header><span class="chart-title">访问来源（近 7 天）</span></template>
        <div v-if="hasVisitSource" ref="visitSourceEl" class="chart"></div>
        <el-empty v-else description="还没有访问来源，分享带 utm_source 的链接后可见" :image-size="72" />
      </el-card>

      <el-card class="chart-card fade-up" shadow="never">
        <template #header><span class="chart-title">订单状态（不含 mock）</span></template>
        <div v-if="hasStatus" ref="statusEl" class="chart"></div>
        <el-empty v-else description="还没有非 mock 订单" :image-size="72" />
      </el-card>

      <el-card class="chart-card fade-up" shadow="never">
        <template #header><span class="chart-title">分类分布</span></template>
        <div v-if="hasCat" ref="catEl" class="chart"></div>
        <el-empty v-else description="暂无分类数据，上架商品后即可看到" :image-size="72" />
      </el-card>

      <el-card class="chart-card fade-up" shadow="never">
        <template #header><span class="chart-title">技术栈分布</span></template>
        <div v-if="hasTech" ref="techEl" class="chart"></div>
        <el-empty v-else description="暂无技术栈数据，上架商品后即可看到" :image-size="72" />
      </el-card>

      <el-card class="chart-card span-2 fade-up" shadow="never">
        <template #header><span class="chart-title">热销商品 Top 8</span></template>
        <div v-if="hasTop" ref="topEl" class="chart"></div>
        <el-empty v-else description="还没有销量数据，成交后这里会展示热销榜" :image-size="72" />
      </el-card>

      <el-card class="chart-card span-2 fade-up" shadow="never">
        <template #header><span class="chart-title">最新订单（不含 mock）</span></template>
        <el-table v-if="recentOrders.length" :data="recentOrders" size="default">
          <el-table-column prop="order_no" label="订单号" min-width="150" />
          <el-table-column prop="username" label="买家" width="120" />
          <el-table-column prop="pay_method" label="支付" width="90" />
          <el-table-column label="金额" width="110">
            <template #default="{ row }">¥{{ row.total_amount }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" effect="light" size="small">{{ statusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="下单时间" min-width="160">
            <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="还没有真实支付订单" :image-size="72" />
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import { Refresh, Goods, User, Money, Tickets, DataBoard, View } from '@element-plus/icons-vue';
import http from '../../api';

const router = useRouter();
const loading = ref(false);
const nowText = ref('');
const kpis = ref([]);
const recentOrders = ref([]);
const todos = ref({ pendingShip: 0, pendingRefund: 0, pendingQuote: 0, newLeads: 0 });
const hasTrend = ref(false);
const hasVisitTrend = ref(false);
const hasVisitSource = ref(false);
const hasStatus = ref(false);
const hasCat = ref(false);
const hasTech = ref(false);
const hasTop = ref(false);

const todoItems = computed(() => [
  { key: 'ship', label: '待发货', count: todos.value.pendingShip || 0, to: '/admin/orders' },
  { key: 'refund', label: '待处理退款', count: todos.value.pendingRefund || 0, to: '/admin/refunds' },
  { key: 'quote', label: '待报价定制', count: todos.value.pendingQuote || 0, to: '/admin/custom' },
  { key: 'leads', label: '新企业线索', count: todos.value.newLeads || 0, to: '/admin/enterprise' }
]);
const todoTotal = computed(() => todoItems.value.reduce((s, t) => s + (t.count || 0), 0));

function goTodo(path) {
  router.push(path);
}

const trendEl = ref(null);
const visitTrendEl = ref(null);
const visitSourceEl = ref(null);
const statusEl = ref(null);
const catEl = ref(null);
const techEl = ref(null);
const topEl = ref(null);

const charts = [];
function clearCharts() {
  while (charts.length) {
    const c = charts.pop();
    try { c.dispose(); } catch { /* ignore */ }
  }
}
function makeChart(elRef) {
  if (!elRef.value) return null;
  const c = echarts.init(elRef.value);
  charts.push(c);
  return c;
}
const BRAND = ['#0a0a0b', '#0d9488', '#14b8a6', '#52525b', '#34d399', '#f59e0b', '#e11d48'];
const AXIS = { color: '#71717a' };

function localDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function lastNDays(n) {
  const days = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(localDayKey(d).slice(5));
  }
  return days;
}
function dayMapKey(raw) {
  const s = String(raw || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(5, 10);
  return s.slice(5, 10);
}

async function loadAll() {
  loading.value = true;
  nowText.value = new Date().toLocaleString('zh-CN');
  clearCharts();
  try {
    const [stats, trend, visitTrend, visitSource, status, cat, tech, top, recent, todoRes] = await Promise.all([
      http.get('/admin/stats'),
      http.get('/admin/stats/sales-trend'),
      http.get('/admin/stats/visit-trend'),
      http.get('/admin/stats/visits', { params: { days: 7 } }),
      http.get('/admin/stats/order-status'),
      http.get('/admin/stats/category-dist'),
      http.get('/admin/stats/tech-dist'),
      http.get('/admin/stats/top-products'),
      http.get('/admin/stats/recent-orders'),
      http.get('/admin/todos').catch(() => ({ pendingShip: 0, pendingRefund: 0, pendingQuote: 0, newLeads: 0 }))
    ]);

    todos.value = {
      pendingShip: todoRes.pendingShip || 0,
      pendingRefund: todoRes.pendingRefund || 0,
      pendingQuote: todoRes.pendingQuote || 0,
      newLeads: todoRes.newLeads || 0
    };

    kpis.value = [
      { label: '商品总数', value: stats.products, icon: Goods, bg: 'linear-gradient(135deg,#0a0a0b,#27272a)' },
      { label: '在售商品', value: stats.onSale, icon: DataBoard, bg: 'linear-gradient(135deg,#0d9488,#0f766e)' },
      { label: '近7天访问', value: stats.visits7d ?? 0, icon: View, bg: 'linear-gradient(135deg,#2563eb,#1d4ed8)' },
      { label: '注册用户', value: stats.users, icon: User, bg: 'linear-gradient(135deg,#14b8a6,#059669)' },
      { label: '真实销售额', value: '¥' + Number(stats.sales).toLocaleString(), icon: Money, bg: 'linear-gradient(135deg,#f59e0b,#ea580c)' },
      { label: '待发货', value: stats.paidOrders ?? 0, icon: Tickets, bg: 'linear-gradient(135deg,#e11d48,#be123c)' }
    ];
    recentOrders.value = recent || [];

    hasTrend.value = Array.isArray(trend) && trend.some((r) => Number(r.amt) > 0);
    hasVisitTrend.value = Array.isArray(visitTrend) && visitTrend.some((r) => Number(r.cnt) > 0);
    hasVisitSource.value = Array.isArray(visitSource?.list) && visitSource.total > 0;
    hasStatus.value = Array.isArray(status) && status.some((r) => Number(r.value) > 0);
    hasCat.value = Array.isArray(cat) && cat.length > 0;
    hasTech.value = Array.isArray(tech) && tech.length > 0;
    hasTop.value = Array.isArray(top) && top.some((r) => Number(r.sales) > 0);

    await nextTick();
    if (hasTrend.value) renderTrend(trend);
    if (hasVisitTrend.value) renderVisitTrend(visitTrend);
    if (hasVisitSource.value) renderVisitSource(visitSource.list);
    if (hasStatus.value) renderStatus(status);
    if (hasCat.value) renderCat(cat);
    if (hasTech.value) renderTech(tech);
    if (hasTop.value) renderTop(top);
  } finally {
    loading.value = false;
  }
}

function renderTrend(rows) {
  const c = makeChart(trendEl);
  if (!c) return;
  const days = lastNDays(14);
  const map = {};
  rows.forEach((r) => { map[dayMapKey(r.d)] = Number(r.amt); });
  const data = days.map((d) => map[d] || 0);
  c.setOption({
    grid: { left: 48, right: 20, top: 24, bottom: 30 },
    tooltip: { trigger: 'axis', valueFormatter: (v) => '¥' + v },
    xAxis: { type: 'category', data: days, axisLine: { lineStyle: { color: '#e2e5ec' } }, axisLabel: { color: AXIS.color } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f1f5' } }, axisLabel: { color: AXIS.color } },
    series: [{
      type: 'line', smooth: true, data, symbol: 'circle', symbolSize: 7,
      lineStyle: { width: 3, color: '#0d9488' },
      itemStyle: { color: '#0d9488' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(13,148,136,.28)' },
          { offset: 1, color: 'rgba(13,148,136,.02)' }
        ])
      }
    }]
  });
}

function renderVisitTrend(rows) {
  const c = makeChart(visitTrendEl);
  if (!c) return;
  const days = lastNDays(14);
  const map = {};
  rows.forEach((r) => { map[dayMapKey(r.d)] = Number(r.cnt); });
  const data = days.map((d) => map[d] || 0);
  c.setOption({
    grid: { left: 48, right: 20, top: 24, bottom: 30 },
    tooltip: { trigger: 'axis', valueFormatter: (v) => v + ' 次' },
    xAxis: { type: 'category', data: days, axisLine: { lineStyle: { color: '#e2e5ec' } }, axisLabel: { color: AXIS.color } },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#f0f1f5' } }, axisLabel: { color: AXIS.color } },
    series: [{
      type: 'line', smooth: true, data, symbol: 'circle', symbolSize: 7,
      lineStyle: { width: 3, color: '#2563eb' },
      itemStyle: { color: '#2563eb' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(37,99,235,.22)' },
          { offset: 1, color: 'rgba(37,99,235,.02)' }
        ])
      }
    }]
  });
}

function renderVisitSource(rows) {
  const c = makeChart(visitSourceEl);
  if (!c) return;
  c.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: AXIS.color } },
    series: [{
      type: 'pie', radius: ['42%', '70%'], center: ['50%', '44%'],
      itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 6 },
      label: { show: false },
      data: rows.map((r, i) => ({
        name: r.source,
        value: r.cnt,
        itemStyle: { color: BRAND[i % BRAND.length] }
      }))
    }]
  });
}

function renderStatus(rows) {
  const c = makeChart(statusEl);
  if (!c) return;
  c.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: AXIS.color } },
    series: [{
      type: 'pie', radius: ['45%', '72%'], center: ['50%', '44%'],
      itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 6 },
      label: { show: false },
      data: rows.map((r, i) => ({ name: r.name, value: r.value, itemStyle: { color: BRAND[i % BRAND.length] } }))
    }]
  });
}

function renderCat(rows) {
  const c = makeChart(catEl);
  if (!c) return;
  c.setOption({
    tooltip: { trigger: 'item' },
    legend: { type: 'scroll', bottom: 0, textStyle: { color: AXIS.color } },
    series: [{
      type: 'pie', roseType: 'radius', radius: ['25%', '72%'], center: ['50%', '44%'],
      itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 5 },
      label: { color: AXIS.color },
      data: rows.map((r, i) => ({ name: r.name, value: r.value, itemStyle: { color: BRAND[i % BRAND.length] } }))
    }]
  });
}

function renderTech(rows) {
  const c = makeChart(techEl);
  if (!c) return;
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  c.setOption({
    grid: { left: 80, right: 24, top: 10, bottom: 10 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f1f5' } }, axisLabel: { color: AXIS.color } },
    yAxis: { type: 'category', data: sorted.map((r) => r.name), axisLine: { lineStyle: { color: '#e2e5ec' } }, axisLabel: { color: AXIS.color } },
    series: [{
      type: 'bar', data: sorted.map((r) => r.value), barWidth: 16,
      itemStyle: {
        borderRadius: [0, 8, 8, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#14b8a6' }, { offset: 1, color: '#0d9488' }
        ])
      }
    }]
  });
}

function renderTop(rows) {
  const c = makeChart(topEl);
  if (!c) return;
  const sorted = [...rows].sort((a, b) => a.sales - b.sales);
  c.setOption({
    grid: { left: 200, right: 40, top: 10, bottom: 10 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f1f5' } }, axisLabel: { color: AXIS.color } },
    yAxis: { type: 'category', data: sorted.map((r) => r.title.length > 16 ? r.title.slice(0, 16) + '…' : r.title), axisLine: { lineStyle: { color: '#e2e5ec' } }, axisLabel: { color: AXIS.color, width: 190, overflow: 'truncate' } },
    series: [{
      type: 'bar', data: sorted.map((r) => r.sales), barWidth: 14,
      itemStyle: {
        borderRadius: [0, 8, 8, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#27272a' }, { offset: 1, color: '#0a0a0b' }
        ])
      },
      label: { show: true, position: 'right', color: '#8a90a0' }
    }]
  });
}

function statusType(s) {
  return { pending: 'info', paid: 'warning', shipped: 'primary', completed: 'success', cancelled: 'danger' }[s] || 'info';
}
function statusText(s) {
  return { pending: '待支付', paid: '已支付', shipped: '已发货', completed: '已完成', cancelled: '已取消' }[s] || s;
}
function fmtTime(t) { return t ? String(t).slice(0, 19).replace('T', ' ') : '-'; }

function resize() { charts.forEach((c) => c.resize()); }
window.addEventListener('resize', resize);

onMounted(loadAll);
onBeforeUnmount(() => { window.removeEventListener('resize', resize); clearCharts(); });
</script>

<style scoped>
.dash-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 16px; gap: 12px; }
.dash-head .page-title { margin-bottom: 0; }
.dash-sub { color: var(--text-3); font-size: 13px; margin: 4px 0 0; }
.todo-card {
  margin-bottom: 16px; border: 1px solid var(--border); border-radius: 12px;
  --el-card-border-color: var(--border);
}
.todo-card :deep(.el-card__header) { padding: 12px 16px; border-bottom: 1px solid var(--border); }
.todo-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.todo-item {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 14px 16px; border: 1px solid var(--border); border-radius: 10px;
  background: var(--surface); cursor: pointer; text-align: left;
  transition: border-color .15s, box-shadow .15s;
}
.todo-item:hover { border-color: #0d9488; box-shadow: 0 2px 8px rgba(13,148,136,.08); }
.todo-item.is-zero { opacity: .55; }
.todo-count { font-size: 22px; font-weight: 750; color: var(--text-1); line-height: 1.2; }
.todo-label { font-size: 13px; color: var(--text-3); }
.todo-empty { margin: 8px 0; font-size: 14px; color: var(--text-3); }
.kpi-card {
  display: flex; align-items: center; gap: 14px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 16px 18px;
}
.kpi-icon {
  width: 42px; height: 42px; border-radius: 10px; display: grid; place-items: center; color: #fff; flex-shrink: 0;
}
.kpi-num { font-size: 22px; font-weight: 750; color: var(--text-1); line-height: 1.2; }
.kpi-label { font-size: 13px; color: var(--text-3); margin-top: 2px; }
.chart-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 16px; }
.chart-card.span-2 { grid-column: span 2; }
.chart-title { font-weight: 650; font-size: 14px; }
.chart { width: 100%; height: 280px; }
:deep(.chart-card) {
  border: 1px solid var(--border); border-radius: 12px;
  --el-card-border-color: var(--border);
}
:deep(.chart-card .el-card__header) {
  padding: 12px 16px; border-bottom: 1px solid var(--border);
}
@media (max-width: 900px) {
  .chart-grid { grid-template-columns: 1fr; }
  .chart-card.span-2 { grid-column: span 1; }
  .todo-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
