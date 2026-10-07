<template>
  <div class="page-container">
    <h2 class="page-title">会员订阅</h2>

    <el-alert v-if="mine" type="success" show-icon :closable="false" class="mb">
      <template #title>当前会员：{{ mine.plan === 'yearly' ? '年卡' : mine.plan === 'quarterly' ? '季卡' : '月卡' }} · 到期 {{ fmt(mine.expires_at) }}</template>
    </el-alert>

    <div class="plan-grid">
      <div v-for="(p, i) in plans" :key="p.id" class="plan-card hover-lift" :class="{ active: mine?.plan === p.id }" v-reveal="{value: i*80}">
        <div class="plan-name">{{ p.name }}</div>
        <div class="plan-price">¥{{ p.price }}<span>/{{ p.days }}天</span></div>
        <ul class="plan-ben">
          <li v-for="b in p.benefits" :key="b">{{ b }}</li>
        </ul>
        <el-button :type="mine?.plan === p.id ? 'success' : 'primary'" :disabled="mine?.plan === p.id" @click="buy(p.id)">
          {{ mine?.plan === p.id ? '当前套餐' : '开通' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import http from '../../api';

const plans = ref([]);
const mine = ref(null);

async function load() {
  plans.value = await http.get('/services/membership/plans');
  try { mine.value = await http.get('/services/membership/mine'); } catch { mine.value = null; }
}
function fmt(t) { return t ? String(t).slice(0, 10) : '—'; }
function buy(id) {
  ElMessageBox.confirm('模拟支付开通，确认订阅？', '开通会员').then(async () => {
    await http.post('/services/membership/buy', { planId: id });
    ElMessage.success('开通成功');
    load();
  }).catch(() => {});
}
onMounted(load);
</script>

<style scoped>
.page-title { margin: 16px 0; }
.mb { margin-bottom: 18px; }
.plan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.plan-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 28px 24px; text-align: center; box-shadow: none;
  display: flex; flex-direction: column; gap: 14px; align-items: center;
  transition: border-color .2s;
}
.plan-card.active { border-color: var(--ink); box-shadow: var(--shadow-md); }
.plan-name { font-size: 17px; font-weight: 750; }
.plan-price { font-size: 34px; font-weight: 850; color: var(--ink); }
.plan-price span { font-size: 14px; color: var(--text-3); font-weight: 400; }
.plan-ben { list-style: none; padding: 0; margin: 0; text-align: left; width: 100%; }
.plan-ben li { font-size: 13px; color: var(--text-2); padding: 5px 0 5px 22px; position: relative; }
.plan-ben li::before { content: '✓'; position: absolute; left: 0; color: var(--accent); font-weight: 700; }
</style>
