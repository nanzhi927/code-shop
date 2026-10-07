<template>
  <div class="page-container pay-page" v-loading="loading">
    <h2 class="page-title">订单支付</h2>

    <template v-if="order && paidDone">
      <div class="success-card">
        <div class="success-icon">✓</div>
        <h3 class="success-title">支付信息已提交</h3>
        <p class="success-desc">
          下一步：添加客服微信 / QQ → 发送订单号 → 获取源码下载方式。
        </p>
        <div class="order-copy-row">
          <span class="order-copy-label">订单号</span>
          <code class="order-no">{{ order.order_no }}</code>
          <button type="button" class="copy-btn" @click="copyOrderNo">复制</button>
        </div>
        <p v-if="contactLine" class="success-contact">{{ contactLine }}</p>
        <div v-if="serviceWechatQr || serviceQqQr" class="qr-row">
          <div v-if="serviceWechatQr" class="qr-item">
            <el-image :src="serviceWechatQr" class="qr-img" fit="contain" lazy />
            <span>微信客服</span>
          </div>
          <div v-if="serviceQqQr" class="qr-item">
            <el-image :src="serviceQqQr" class="qr-img" fit="contain" lazy />
            <span>QQ 客服</span>
          </div>
        </div>
        <StoreButton variant="solid" to="/orders">去我的订单</StoreButton>
      </div>
    </template>

    <template v-else-if="order && order.status !== 'pending'">
      <div class="checkout-card status-card">
        <h3 class="status-title">{{ statusTitle }}</h3>
        <p class="status-sub">订单号 {{ order.order_no }}</p>
        <StoreButton variant="solid" to="/orders">去我的订单</StoreButton>
      </div>
    </template>

    <template v-else-if="order">
      <div class="checkout-card amount-card">
        <div class="order-meta">订单号：{{ order.order_no }}</div>
        <div class="pay-amount">¥{{ order.total_amount }}</div>
        <div class="pay-amount-label">应付金额</div>
        <div v-if="order.items?.length" class="order-items">
          <div v-for="item in order.items" :key="item.id" class="oi">
            <span>{{ item.product_title }}</span>
            <span>¥{{ item.price }}</span>
          </div>
        </div>
      </div>

      <div class="checkout-card">
        <h3>支付方式</h3>
        <div v-if="enabledPayMethods.length" class="pay-methods">
          <button
            v-if="payOn.alipay"
            type="button"
            class="pay-opt"
            :class="{ active: payMethod === 'alipay' }"
            @click="payMethod = 'alipay'"
          >支付宝扫码</button>
          <button
            v-if="payOn.wechat"
            type="button"
            class="pay-opt"
            :class="{ active: payMethod === 'wechat' }"
            @click="payMethod = 'wechat'"
          >微信扫码</button>
          <button
            v-if="payOn.card"
            type="button"
            class="pay-opt"
            :class="{ active: payMethod === 'card' }"
            @click="payMethod = 'card'"
          >卡密兑换</button>
        </div>
        <p v-else class="warn-tip">暂无可用支付方式，请联系客服</p>

        <div v-if="payMethod === 'card'" class="card-input">
          <el-input v-model="cardNo" placeholder="请输入卡密，如 ABCD-EFGH-..." />
        </div>

        <p v-if="qrSelected && !currentQrUrl" class="warn-tip">管理员尚未配置收款码，请联系客服</p>
      </div>

      <div v-if="qrSelected && currentQrUrl" class="checkout-card">
        <h3>{{ payMethod === 'alipay' ? '支付宝' : '微信' }}收款码</h3>
        <el-image :src="currentQrUrl" class="pay-qr" fit="contain" lazy />
        <p v-if="settings.pay_notice" class="pay-notice">{{ settings.pay_notice }}</p>
        <p class="pay-tip">请使用对应 App 扫码付款，付款完成后点击下方按钮。</p>
      </div>

      <div class="submit-bar">
        <StoreButton variant="outline" to="/orders">返回订单</StoreButton>
        <StoreButton
          variant="solid"
          :loading="submitting"
          :disabled="!enabledPayMethods.length || (qrSelected && !currentQrUrl)"
          @click="submitPay"
        >
          {{ qrSelected ? '我已完成付款' : '确认支付' }}
        </StoreButton>
      </div>
    </template>

    <div v-else-if="!loading" class="empty-illus">
      <div class="ei-icon">空</div>
      <p class="ei-title">订单不存在或无权查看</p>
      <StoreButton variant="solid" to="/orders">去我的订单</StoreButton>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import http from '../../api';
import StoreButton from '../../components/store/StoreButton.vue';
import { statusText } from '../../utils/orderStatus';
import { setSeo } from '../../composables/useSeo';

const route = useRoute();
const loading = ref(true);
const submitting = ref(false);
const order = ref(null);
const paidDone = ref(false);
const payMethod = ref('');
const cardNo = ref('');
const settings = ref({
  alipay_qr: '',
  wechat_qr: '',
  pay_notice: '',
  service_qq: '',
  service_wechat: '',
  service_wechat_qr: '',
  service_qq_qr: '',
  pay_card_enabled: '1',
  pay_alipay_enabled: '1',
  pay_wechat_enabled: '1'
});

const serviceWechatQr = computed(() => String(settings.value.service_wechat_qr || '').trim());
const serviceQqQr = computed(() => String(settings.value.service_qq_qr || '').trim());

const payOn = computed(() => ({
  card: settings.value.pay_card_enabled !== '0',
  alipay: settings.value.pay_alipay_enabled !== '0',
  wechat: settings.value.pay_wechat_enabled !== '0'
}));

const enabledPayMethods = computed(() =>
  ['alipay', 'wechat', 'card'].filter((m) => payOn.value[m])
);

watch(enabledPayMethods, (list) => {
  if (!list.includes(payMethod.value)) {
    payMethod.value = list[0] || '';
  }
}, { immediate: true });

const qrSelected = computed(() => payMethod.value === 'alipay' || payMethod.value === 'wechat');
const currentQrUrl = computed(() => {
  if (payMethod.value === 'alipay') return settings.value.alipay_qr || '';
  if (payMethod.value === 'wechat') return settings.value.wechat_qr || '';
  return '';
});

const statusTitle = computed(() => {
  if (!order.value) return '';
  if (order.value.status === 'pending') return '待支付';
  return statusText(order.value.status) || '订单已处理';
});

const contactLine = computed(() => {
  const ss = order.value?.shipSettings || settings.value || {};
  const parts = [];
  if (ss.service_wechat) parts.push(`微信：${ss.service_wechat}`);
  if (ss.service_qq) parts.push(`QQ：${ss.service_qq}`);
  return parts.join(' · ');
});

async function copyOrderNo() {
  const no = order.value?.order_no;
  if (!no) return;
  try {
    await navigator.clipboard.writeText(String(no));
    ElMessage.success('订单号已复制');
  } catch {
    ElMessage.warning('复制失败，请手动选中订单号');
  }
}

async function loadOrder() {
  loading.value = true;
  try {
    order.value = await http.get(`/orders/${route.params.orderId}`);
  } catch {
    order.value = null;
  } finally {
    loading.value = false;
  }
}

async function loadSettings() {
  try {
    settings.value = { ...settings.value, ...(await http.get('/settings/public')) };
  } catch {
    // 忽略
  }
}

async function submitPay() {
  if (submitting.value || !order.value) return;
  if (!enabledPayMethods.value.length) {
    ElMessage.warning('暂无可用支付方式，请联系客服');
    return;
  }
  if (payMethod.value === 'card' && !cardNo.value) {
    ElMessage.warning('请输入卡密');
    return;
  }
  if (qrSelected.value && !currentQrUrl.value) {
    ElMessage.warning('管理员尚未配置收款码，请联系客服');
    return;
  }
  submitting.value = true;
  try {
    const payRes = await http.post(`/orders/${order.value.id}/pay`, {
      method: payMethod.value,
      cardNo: cardNo.value
    });
    const ss = payRes.shipSettings || settings.value || {};
    if (ss.service_qq || ss.service_wechat) {
      settings.value = { ...settings.value, ...ss };
    }
    if (order.value.shipSettings) {
      order.value.shipSettings = { ...order.value.shipSettings, ...ss };
    } else {
      order.value = { ...order.value, shipSettings: ss };
    }
    ElMessage.success(payRes.message || '支付成功');
    paidDone.value = true;
    order.value = { ...order.value, status: payRes.autoShipped ? 'shipped' : 'paid' };
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  setSeo({
    title: '订单支付 - 毕设源码商城',
    description: '支付毕业设计 / 毕设源码订单，获取完整源码与资料。',
    keywords: '订单支付,毕设源码,毕业设计'
  });
  await Promise.all([loadOrder(), loadSettings()]);
});
</script>

<style scoped>
.pay-page { padding-bottom: 40px; }
.page-title { margin: 16px 0 20px; }
.checkout-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 24px; margin-bottom: 16px;
}
.checkout-card h3 {
  font-size: 15px; font-weight: 600; margin: 0 0 14px; color: var(--text-1);
  font-family: var(--font-display);
}
.amount-card { text-align: center; }
.order-meta { font-size: 13px; color: var(--text-3); margin-bottom: 8px; }
.pay-amount {
  font-size: 36px; font-weight: 650; color: var(--price); line-height: 1.2;
  font-family: var(--font-num); font-variant-numeric: tabular-nums; letter-spacing: -.03em;
}
.pay-amount-label { font-size: 13px; color: var(--text-3); margin-top: 4px; margin-bottom: 16px; }
.order-items { text-align: left; border-top: 1px solid var(--border); padding-top: 12px; }
.oi {
  display: flex; justify-content: space-between; padding: 8px 0;
  font-size: 14px; color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.pay-methods { display: flex; flex-wrap: wrap; gap: 10px; }
.pay-opt {
  appearance: none; cursor: pointer; font-family: inherit;
  height: 44px; padding: 0 18px; border-radius: 10px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-2); font-size: 14px; font-weight: 500;
  transition: border-color .18s, background .18s, color .18s;
}
.pay-opt:hover { border-color: var(--ink); color: var(--text-1); }
.pay-opt.active {
  background: var(--ink); border-color: var(--ink); color: #fff; font-weight: 600;
}
.card-input { margin-top: 14px; max-width: 360px; }
.warn-tip { margin: 12px 0 0; font-size: 13px; color: var(--text-3); }
.pay-qr {
  width: 220px; height: 220px; border: 1px solid var(--border);
  border-radius: 8px; background: #fff;
}
.pay-tip { margin-top: 12px; font-size: 13px; color: var(--text-3); }
.pay-notice { margin-top: 12px; font-size: 14px; color: var(--text-2); white-space: pre-wrap; }
.submit-bar { display: flex; justify-content: flex-end; gap: 12px; padding-bottom: 24px; }

.success-card, .status-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 48px 24px; margin-bottom: 16px;
  text-align: center;
}
.status-title {
  margin: 0 0 8px; font-size: 20px; font-weight: 650;
  font-family: var(--font-display); color: var(--text-1);
}
.status-sub { margin: 0 0 24px; font-size: 14px; color: var(--text-3); }
.success-icon {
  width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 16px;
  border: 1.5px solid var(--border); color: var(--text-1);
  display: grid; place-items: center; font-size: 22px; font-weight: 600;
  font-family: var(--font-num);
}
.success-title {
  font-size: 20px; font-weight: 650; margin: 0 0 10px; color: var(--text-1);
  font-family: var(--font-display);
}
.success-desc { font-size: 14px; color: var(--text-2); line-height: 1.7; margin: 0 0 12px; }
.success-contact { font-size: 14px; color: var(--text-2); font-weight: 500; margin: 0 0 16px; }
.order-copy-row {
  display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin: 0 auto 16px; padding: 10px 14px;
  background: var(--bg-alt); border: 1px solid var(--border); border-radius: 10px;
}
.order-copy-label { font-size: 13px; color: var(--text-3); }
.order-no { font-size: 14px; font-weight: 600; color: var(--text-1); font-family: var(--font-num); }
.copy-btn {
  appearance: none; border: 1px solid var(--border); background: var(--surface);
  border-radius: 8px; padding: 4px 10px; font-size: 12.5px; font-family: inherit;
  color: var(--text-2); cursor: pointer;
}
.copy-btn:hover { border-color: var(--ink); color: var(--text-1); }
.qr-row {
  display: flex; justify-content: center; gap: 28px; flex-wrap: wrap;
  margin: 0 0 24px;
}
.qr-item { display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 13px; color: var(--text-2); }
.qr-img { width: 148px; height: 148px; border: 1px solid var(--border); border-radius: 8px; background: #fff; }

@media (max-width: 768px) {
  .submit-bar {
    flex-direction: column; align-items: stretch;
    padding-bottom: calc(24px + var(--mobile-nav-h, 56px) + env(safe-area-inset-bottom));
  }
  .submit-bar :deep(.store-btn) { width: 100%; }
  .pay-opt { flex: 1; min-width: 0; }
  .success-title { font-size: 18px; }
}
</style>
