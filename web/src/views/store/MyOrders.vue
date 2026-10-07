<template>
  <div class="page-container">
    <div class="page-head">
      <h2 class="page-title">我的订单</h2>
      <el-button size="small" @click="openRefunds">售后记录</el-button>
    </div>

    <el-tabs v-model="activeTab" @tab-change="onTab">
      <el-tab-pane label="全部" name="all" />
      <el-tab-pane label="待支付" name="pending" />
      <el-tab-pane label="已支付" name="paid" />
      <el-tab-pane label="已发货" name="shipped" />
      <el-tab-pane label="已完成" name="completed" />
    </el-tabs>

    <div v-loading="loading">
      <div v-if="orders.length">
        <div v-for="order in orders" :key="order.id" class="order-card">
          <div class="order-head">
            <span class="order-head-left">
              订单号：{{ order.order_no }}
              <el-tag v-if="order.pay_method" size="small" type="info" class="pay-method-tag">{{ payMethodText(order.pay_method) }}</el-tag>
            </span>
            <el-tag :type="statusType(order.status)">{{ statusText(order.status) }}</el-tag>
          </div>
          <div class="order-items">
            <div v-for="item in order.items" :key="item.id" class="oi">
              <span>{{ item.product_title }}</span>
              <span>¥{{ item.price }}</span>
            </div>
          </div>
          <div v-if="order.remark" class="order-remark">留言：{{ order.remark }}</div>

          <div v-if="order.status === 'paid'" class="ship-alert">
            <el-alert type="warning" :closable="false" show-icon>
              <template #title>
                <span>请添加客服 QQ：<b>{{ shipSettings.service_qq || '—' }}</b><template v-if="shipSettings.service_wechat">（微信：{{ shipSettings.service_wechat }}）</template>，发送订单号 <b>{{ order.order_no }}</b> 获取源码。<template v-if="shipSettings.ship_notice">发货说明：{{ shipSettings.ship_notice }}</template></span>
              </template>
            </el-alert>
            <el-button size="small" type="primary" plain @click="copyText(order.order_no)">复制订单号</el-button>
          </div>

          <div v-if="['shipped','completed'].includes(order.status) && (order.shipping_info || order.delivery?.content)" class="ship-block">
            <div class="ship-block-head">
              <span class="ship-title">源码交付</span>
              <div class="ship-ops">
                <el-button size="small" @click="copyText(shipContent(order))">复制链接</el-button>
                <el-button v-if="extractUrl(shipContent(order))" size="small" type="primary" plain @click="openUrl(extractUrl(shipContent(order)))">打开网盘</el-button>
              </div>
            </div>
            <p class="ship-info">{{ shipContent(order) }}</p>
            <p v-if="order.delivery?.created_at" class="ship-time">发货时间：{{ order.delivery.created_at }}</p>
          </div>

          <div class="order-foot">
            <span class="order-amount">合计 ¥{{ order.total_amount }}</span>
            <div class="order-actions">
              <template v-if="order.status === 'pending'">
                <el-button size="small" @click="cancelOrder(order)">取消</el-button>
                <el-button size="small" type="primary" @click="payOrder(order)">去支付</el-button>
              </template>
              <template v-if="['paid', 'shipped'].includes(order.status)">
                <el-button size="small" type="warning" plain @click="openRefund(order)">申请售后</el-button>
              </template>
              <template v-if="order.status === 'shipped'">
                <el-button size="small" type="success" @click="confirmOrder(order)">确认收货</el-button>
              </template>
              <template v-if="order.status === 'completed'">
                <el-button size="small" type="warning" plain @click="openReview(order)">评价</el-button>
              </template>
              <el-button size="small" type="primary" plain @click="showShipping(order)">查看发货信息</el-button>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else-if="!loading" description="暂无订单">
        <template #image>
          <div class="empty-illus" style="padding: 20px 0 0">
            <div class="ei-icon">📋</div>
          </div>
        </template>
        <template #description>
          <p class="ei-title">暂无订单</p>
          <p class="ei-desc">去逛逛挑选心仪源码吧</p>
        </template>
        <el-button type="primary" @click="$router.push('/products')">去逛逛</el-button>
      </el-empty>
    </div>

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

    <el-dialog v-model="shippingVisible" title="发货信息" width="480px">
      <p v-if="shippingOrder?.shipping_info" class="ship-info">{{ shippingOrder.shipping_info }}</p>
      <p v-if="shippingOrder?.delivery?.content" class="ship-info">{{ shippingOrder.delivery.content }}</p>
      <p v-if="!shippingOrder?.shipping_info && !shippingOrder?.delivery?.content" class="ship-info">暂未发货，请耐心等待</p>
      <template #footer>
        <el-button @click="shippingVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reviewVisible" title="评价订单" width="460px">
      <el-form label-width="70px">
        <el-form-item label="评分">
          <el-rate v-model="reviewForm.rating" />
        </el-form-item>
        <el-form-item label="评价">
          <el-input v-model="reviewForm.content" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="说说源码质量、运行情况等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewVisible = false">取消</el-button>
        <el-button type="primary" :loading="reviewSubmitting" @click="submitReview">提交评价</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="refundsVisible" title="售后记录" width="720px">
      <el-table :data="refunds" v-loading="refundsLoading" border stripe empty-text="暂无售后记录">
        <el-table-column prop="order_no" label="订单号" width="170" />
        <el-table-column prop="reason" label="原因" min-width="140" show-overflow-tooltip />
        <el-table-column prop="amount" label="金额" width="90">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="refundStatusType(row.status)">{{ refundStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="admin_note" label="管理员备注" min-width="120" show-overflow-tooltip />
        <el-table-column prop="created_at" label="时间" width="160" />
      </el-table>
      <el-empty v-if="!refundsLoading && !refunds.length" description="暂无售后记录" />
      <template #footer>
        <el-button @click="refundsVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="refundVisible" title="申请售后" width="460px">
      <el-form label-width="80px">
        <el-form-item label="退款原因" required>
          <el-input v-model="refundForm.reason" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="请说明退款原因" />
        </el-form-item>
        <el-form-item label="退款金额" required>
          <el-input-number
            v-model="refundForm.amount"
            :min="0.01"
            :max="refundForm.maxAmount"
            :precision="2"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="refundVisible = false">取消</el-button>
        <el-button type="primary" :loading="refundSubmitting" @click="submitRefund">提交申请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import http from '../../api';
import { statusText, statusType } from '../../utils/orderStatus';
import { setSeo } from '../../composables/useSeo';

const router = useRouter();

const orders = ref([]);
const shipSettings = ref({});
const activeTab = ref('all');
const shippingVisible = ref(false);
const shippingOrder = ref(null);
const loading = ref(false);
const page = ref(1);
const pageSize = 10;
const total = ref(0);

const reviewVisible = ref(false);
const reviewSubmitting = ref(false);
const reviewForm = reactive({ productId: null, orderId: null, rating: 5, content: '' });

const refundsVisible = ref(false);
const refundsLoading = ref(false);
const refunds = ref([]);

const refundVisible = ref(false);
const refundSubmitting = ref(false);
const refundForm = reactive({ orderId: null, reason: '', amount: 0, maxAmount: 0 });

const REFUND_STATUS = {
  pending: { text: '待处理', type: 'warning' },
  approved: { text: '已同意', type: 'primary' },
  rejected: { text: '已拒绝', type: 'info' },
  refunded: { text: '已退款', type: 'success' }
};
const refundStatusText = (s) => REFUND_STATUS[s]?.text || s || '—';
const refundStatusType = (s) => REFUND_STATUS[s]?.type || 'info';

const PAY_METHOD_TEXT = { mock: '模拟支付', card: '卡密', alipay: '支付宝', wechat: '微信' };
const payMethodText = (m) => PAY_METHOD_TEXT[m] || m || '—';

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/orders', { params: { page: page.value, pageSize, status: activeTab.value } });
    orders.value = res.list;
    total.value = res.total;
    shipSettings.value = res.shipSettings || {};
  } finally {
    loading.value = false;
  }
}

function onTab() { page.value = 1; load(); }
function onPage(p) { page.value = p; load(); }

function shipContent(order) {
  return order.shipping_info || order.delivery?.content || '';
}
function extractUrl(text) {
  if (!text) return '';
  const m = String(text).match(/https?:\/\/[^\s，,）)]+/i);
  return m ? m[0] : '';
}
function openUrl(url) {
  if (url) window.open(url, '_blank', 'noopener');
}

function payOrder(order) {
  router.push('/pay/' + order.id);
}
function cancelOrder(order) {
  ElMessageBox.confirm('确定取消该订单？', '提示', { type: 'warning' })
    .then(async () => {
      await http.post(`/orders/${order.id}/cancel`);
      ElMessage.success('已取消');
      load();
    }).catch(() => {});
}
function confirmOrder(order) {
  ElMessageBox.confirm('确认已收到源码资料？', '确认收货', { type: 'warning' })
    .then(async () => {
      await http.post(`/orders/${order.id}/confirm`);
      ElMessage.success('已完成');
      load();
    }).catch(() => {});
}
function showShipping(order) { shippingOrder.value = order; shippingVisible.value = true; }

function openReview(order) {
  reviewForm.orderId = order.id;
  reviewForm.productId = order.items?.[0]?.product_id || null;
  reviewForm.rating = 5;
  reviewForm.content = '';
  reviewVisible.value = true;
}
async function submitReview() {
  if (!reviewForm.productId) return ElMessage.warning('未找到可评价商品');
  reviewSubmitting.value = true;
  try {
    await http.post('/reviews', { ...reviewForm });
    ElMessage.success('评价成功，感谢反馈');
    reviewVisible.value = false;
  } finally {
    reviewSubmitting.value = false;
  }
}

async function openRefunds() {
  refundsVisible.value = true;
  refundsLoading.value = true;
  try {
    const res = await http.get('/orders/refunds');
    refunds.value = res.list || [];
  } finally {
    refundsLoading.value = false;
  }
}

function openRefund(order) {
  refundForm.orderId = order.id;
  refundForm.reason = '';
  refundForm.maxAmount = Number(order.total_amount);
  refundForm.amount = Number(order.total_amount);
  refundVisible.value = true;
}

async function submitRefund() {
  if (!refundForm.reason.trim()) return ElMessage.warning('请填写退款原因');
  refundSubmitting.value = true;
  try {
    await http.post(`/orders/${refundForm.orderId}/refund`, {
      reason: refundForm.reason,
      amount: refundForm.amount
    });
    ElMessage.success('售后申请已提交');
    refundVisible.value = false;
    load();
  } finally {
    refundSubmitting.value = false;
  }
}

async function copyText(t) {
  if (!t) return;
  try { await navigator.clipboard.writeText(t); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  }
  ElMessage.success('已复制');
}

onMounted(() => {
  setSeo({
    title: '我的订单 - 毕设源码商城',
    description: '查看已购买的毕业设计 / 毕设源码订单与交付状态。',
    keywords: '我的订单,毕设源码,毕业设计'
  });
  load();
});
</script>

<style scoped>
.page-head { display: flex; align-items: center; justify-content: space-between; margin: 16px 0 0; }
.page-title { margin: 0 0 16px; }
.order-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 18px 22px; margin-bottom: 14px;
  box-shadow: var(--shadow-card);
}
.order-head { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-3); }
.order-head-left { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pay-method-tag { vertical-align: middle; }
.order-items { margin: 12px 0; }
.oi { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: var(--text-2); }
.order-remark { font-size: 13px; color: var(--text-3); background: var(--bg-alt); border-radius: 8px; padding: 8px 12px; }
.order-foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 12px; }
.order-amount { font-weight: 700; }
.ship-alert { margin: 12px 0 4px; display: flex; align-items: flex-start; gap: 10px; }
.ship-alert .el-alert { flex: 1; }
.ship-block {
  margin: 12px 0 4px; background: var(--bg-alt); border: 1px solid var(--border);
  border-left: 3px solid var(--accent); border-radius: 12px; padding: 14px 16px;
}
.ship-block-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.ship-title { font-weight: 700; color: var(--brand-700); }
.ship-ops { display: flex; gap: 8px; }
.ship-time { color: var(--text-3); font-size: 12px; }
.ship-info { white-space: pre-wrap; line-height: 1.8; color: var(--text-2); word-break: break-all; }
.pager { margin-top: 16px; justify-content: center; }
.order-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.ei-title { font-size: 15px; font-weight: 650; color: var(--text-2); margin: 0 0 4px; }
.ei-desc { font-size: 13px; color: var(--text-3); margin: 0 0 12px; }

@media (max-width: 768px) {
  .order-foot { flex-direction: column; gap: 12px; align-items: stretch; }
  .order-actions { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .order-actions .el-button { width: 100%; margin: 0; }
  .ship-alert { flex-direction: column; }
  .ship-block { padding: 12px; }
  .ship-block-head { flex-direction: column; align-items: flex-start; gap: 8px; }
  .ship-ops { width: 100%; }
  .ship-ops .el-button { flex: 1; }
}
</style>
