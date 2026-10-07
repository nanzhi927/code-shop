<template>
  <div class="page-container">
    <h2 class="page-title">我的卡密</h2>
    <el-alert
      title="如何购买卡密？"
      type="info"
      :closable="false"
      description="卡密为线下购买商品：请联系客服获取卡密，然后在订单支付页选择「卡密兑换」支付。"
      style="margin-bottom: 16px"
    />
    <div v-if="settings.service_qq || settings.service_wechat" class="service-box">
      <span v-if="settings.service_qq">客服QQ：<b>{{ settings.service_qq }}</b></span>
      <span v-if="settings.service_wechat">客服微信：<b>{{ settings.service_wechat }}</b></span>
      <span v-if="settings.service_notice" class="notice">{{ settings.service_notice }}</span>
    </div>
    <div v-if="settings.alipay_qr || settings.wechat_qr" class="pay-qr-box">
      <h4 class="pay-qr-title">扫码付款</h4>
      <div class="pay-qr-list">
        <div v-if="settings.alipay_qr" class="pay-qr-item">
          <el-image :src="settings.alipay_qr" style="width: 160px; height: 160px" fit="contain" lazy />
          <p>支付宝收款码</p>
        </div>
        <div v-if="settings.wechat_qr" class="pay-qr-item">
          <el-image :src="settings.wechat_qr" style="width: 160px; height: 160px" fit="contain" lazy />
          <p>微信收款码</p>
        </div>
      </div>
      <p class="pay-qr-tip">扫码付款后请加客服微信发送订单号，核对后发货</p>
    </div>

    <el-table :data="cards" v-loading="loading" border stripe>
      <el-table-column prop="card_no" label="卡密" width="220" />
      <el-table-column prop="amount" label="面值" width="120">
        <template #default="{ row }">¥{{ row.amount }}</template>
      </el-table-column>
      <el-table-column prop="used_order" label="使用订单" min-width="180" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'unused' ? 'success' : 'info'">
            {{ row.status === 'unused' ? '未使用' : '已使用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="used_at" label="使用时间" width="170" />
    </el-table>
    <el-empty v-if="!loading && !cards.length" description="暂无卡密记录">
      <template #image>
        <div class="empty-illus" style="padding: 12px 0 0"><div class="ei-icon">🔑</div></div>
      </template>
    </el-empty>

    <el-pagination
      v-if="total > pageSize"
      class="pager"
      background
      layout="prev, pager, next, total"
      :total="total"
      :page-size="pageSize"
      :current-page="page"
      @current-change="onPage"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import http from '../../api';
import { setSeo } from '../../composables/useSeo';

const cards = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 10;
const total = ref(0);
const settings = ref({});

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/cards', { params: { page: page.value, pageSize } });
    cards.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}
function onPage(p) { page.value = p; load(); }

onMounted(async () => {
  setSeo({
    title: '我的卡密 - 毕设源码商城',
    description: '查看毕设源码卡密与兑换记录。',
    keywords: '卡密,毕设源码,毕业设计'
  });
  load();
  try {
    settings.value = await http.get('/settings/public');
  } catch { /* 忽略 */ }
});
</script>

<style scoped>
.page-title { margin: 16px 0 20px; }
.service-box {
  background: color-mix(in srgb, var(--brand-500) 8%, var(--surface));
  border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 14px 18px; margin-bottom: 16px; display: flex; gap: 28px;
  align-items: center; font-size: 14px; color: var(--text-2); flex-wrap: wrap;
}
.service-box .notice { color: var(--text-3); font-size: 13px; }
.pay-qr-box {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 18px 20px; margin-bottom: 16px; box-shadow: var(--shadow-card);
}
.pay-qr-title { margin: 0 0 12px; font-size: 15px; font-weight: 700; color: var(--text-1); }
.pay-qr-list { display: flex; gap: 24px; flex-wrap: wrap; }
.pay-qr-item { text-align: center; font-size: 13px; color: var(--text-2); font-weight: 600; }
.pay-qr-item p { margin: 6px 0 0; }
.pay-qr-tip { margin: 12px 0 0; font-size: 13px; color: var(--text-3); line-height: 1.6; }
.pager { margin-top: 16px; justify-content: center; }
</style>
