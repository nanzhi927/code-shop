<template>
  <div class="page-container checkout-page" v-loading="submitting">
    <h2 class="page-title">确认订单</h2>

    <template v-if="cartStore.items.length">
      <div class="checkout-card">
        <h3>订单商品</h3>
        <div v-for="item in cartStore.items" :key="item.id" class="order-item">
          <span class="oi-title">{{ item.title }}</span>
          <span class="oi-price">¥{{ item.price }}</span>
        </div>
        <div class="total-line">
          合计：<span class="total-price">¥{{ cartStore.totalAmount }}</span>
        </div>

        <div class="remark-block">
          <div class="remark-label">订单留言（选填）</div>
          <el-input
            v-model="remark"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
            placeholder="可留空"
          />
        </div>
      </div>

      <div class="submit-bar">
        <StoreButton variant="outline" @click="$router.back()">返回</StoreButton>
        <StoreButton variant="solid" :loading="submitting" @click="submit">提交订单</StoreButton>
      </div>
    </template>

    <div v-else class="empty-illus">
      <div class="ei-icon">空</div>
      <p class="ei-title">暂无待结算商品</p>
      <p class="ei-desc">商品已下架或购物车为空</p>
      <StoreButton variant="solid" to="/products">去逛逛</StoreButton>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import http from '../../api';
import { useCartStore } from '../../stores/cart';
import StoreButton from '../../components/store/StoreButton.vue';
import { validateCartItems } from '../../utils/validateCart';
import { setSeo } from '../../composables/useSeo';

const router = useRouter();
const cartStore = useCartStore();
const remark = ref('');
const submitting = ref(false);

async function submit() {
  if (submitting.value) return;
  if (!cartStore.items.length) {
    ElMessage.warning('购物车为空');
    return;
  }
  submitting.value = true;
  try {
    const res = await http.post('/orders', {
      productIds: cartStore.items.map((i) => i.id),
      remark: remark.value,
      referrerCode: localStorage.getItem('refCode') || '',
      userCouponId: null
    });
    cartStore.clear();
    ElMessage.success('订单已创建，请完成支付');
    router.push('/pay/' + res.orderId);
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  setSeo({
    title: '确认订单 - 毕设源码商城',
    description: '确认毕业设计 / 毕设源码订单信息并完成支付。',
    keywords: '确认订单,毕设源码,毕业设计'
  });
  await validateCartItems(cartStore);
});
</script>

<style scoped>
.checkout-page { padding-bottom: 40px; }
.page-title { margin: 16px 0 20px; }
.checkout-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 24px; margin-bottom: 16px;
}
.checkout-card h3 {
  font-size: 15px; font-weight: 600; margin: 0 0 14px; color: var(--text-1);
  font-family: var(--font-display);
}
.order-item {
  display: flex; justify-content: space-between; gap: 16px;
  padding: 12px 0; color: var(--text-2); font-size: 14px;
  border-bottom: 1px solid var(--border);
}
.order-item:last-of-type { border-bottom: 0; }
.oi-title { flex: 1; min-width: 0; }
.oi-price {
  flex-shrink: 0; font-family: var(--font-num); font-variant-numeric: tabular-nums;
  color: var(--text-1); font-weight: 500;
}
.total-line {
  text-align: right; padding-top: 14px; border-top: 1px solid var(--border); margin-top: 4px;
  font-size: 14px; color: var(--text-2);
}
.total-price {
  color: var(--price); font-size: 22px; font-weight: 650;
  font-family: var(--font-num); font-variant-numeric: tabular-nums;
}
.remark-block { margin-top: 20px; }
.remark-label { font-size: 13px; color: var(--text-2); margin-bottom: 8px; font-weight: 500; }
.submit-bar {
  display: flex; justify-content: flex-end; gap: 12px; padding-bottom: 24px;
}

@media (max-width: 768px) {
  .page-title { margin: 12px 0 14px; }
  .checkout-card { padding: 16px; }
  .submit-bar {
    flex-direction: column; align-items: stretch; gap: 8px;
    padding-bottom: calc(24px + var(--mobile-nav-h, 56px) + env(safe-area-inset-bottom));
  }
  .submit-bar :deep(.store-btn) { width: 100%; }
}
</style>
