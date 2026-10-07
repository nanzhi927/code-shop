<template>
  <div class="page-container cart-page">
    <h2 class="page-title">购物车</h2>
    <div v-if="cartStore.items.length" class="cart-list">
      <div v-for="item in cartStore.items" :key="item.id" class="cart-item">
        <router-link :to="`/products/${item.id}`" class="item-cover">
          <img v-if="item.cover" :src="item.cover" :alt="item.title" loading="lazy" />
          <span v-else class="cover-fallback">{{ (item.title || '码').slice(0, 1) }}</span>
        </router-link>
        <div class="item-info">
          <router-link :to="`/products/${item.id}`" class="item-title">{{ item.title }}</router-link>
          <span v-if="item.tech" class="tech-tag">{{ item.tech }}</span>
        </div>
        <div class="item-price">¥{{ item.price }}</div>
        <button type="button" class="item-remove" @click="cartStore.remove(item.id)">移除</button>
      </div>
      <div class="cart-footer">
        <span class="cart-sum">
          共 {{ cartStore.totalCount }} 件，合计
          <span class="total-price">¥{{ cartStore.totalAmount }}</span>
        </span>
        <div class="footer-btns">
          <StoreButton variant="outline" @click="cartStore.clear()">清空</StoreButton>
          <StoreButton variant="solid" @click="goCheckout">去结算</StoreButton>
        </div>
      </div>
    </div>
    <div v-else class="empty-illus">
      <div class="ei-icon">空</div>
      <p class="ei-title">购物车空空如也</p>
      <p class="ei-desc">商品已下架或还没挑选，去逛逛吧</p>
      <StoreButton variant="solid" to="/products">去逛逛</StoreButton>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCartStore } from '../../stores/cart';
import { useUserStore } from '../../stores/user';
import { ElMessage } from 'element-plus';
import StoreButton from '../../components/store/StoreButton.vue';
import { validateCartItems } from '../../utils/validateCart';
import { setSeo } from '../../composables/useSeo';

const router = useRouter();
const cartStore = useCartStore();
const userStore = useUserStore();

function goCheckout() {
  if (!userStore.isLogin) {
    ElMessage.warning('请先登录');
    router.push('/login');
    return;
  }
  router.push('/checkout');
}

onMounted(() => {
  setSeo({
    title: '购物车 - 毕设源码商城',
    description: '查看已选毕业设计 / 毕设源码，结算后获取完整源码与资料。',
    keywords: '购物车,毕设源码,毕业设计'
  });
  validateCartItems(cartStore);
});
</script>

<style scoped>
.cart-page { padding-top: 16px; padding-bottom: 40px; }
.cart-list {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 8px 22px;
}
.cart-item {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 0; border-bottom: 1px solid var(--border);
}
.cart-item:last-of-type { border-bottom: none; }
.item-cover {
  width: 64px; height: 48px; border-radius: 8px; overflow: hidden;
  background: var(--bg-alt); border: 1px solid var(--border); flex-shrink: 0;
  display: grid; place-items: center;
}
.item-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-fallback {
  font-size: 14px; font-weight: 650; color: var(--text-3);
  font-family: var(--font-display);
}
.item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.item-title {
  font-size: 14.5px; color: var(--text-1); font-weight: 600;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.item-title:hover { color: var(--accent); }
.item-price {
  color: var(--price); font-weight: 650; font-size: 16px; flex-shrink: 0;
  font-family: var(--font-num); font-variant-numeric: tabular-nums;
}
.item-remove {
  appearance: none; background: none; border: 0; cursor: pointer;
  font-family: inherit; font-size: 13px; color: var(--text-3); flex-shrink: 0;
}
.item-remove:hover { color: var(--text-1); }
.cart-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 0; border-top: 1px solid var(--border); gap: 12px; flex-wrap: wrap;
}
.cart-sum { font-size: 14px; color: var(--text-2); }
.total-price {
  color: var(--price); font-size: 22px; font-weight: 650; margin-left: 4px;
  font-family: var(--font-num); font-variant-numeric: tabular-nums;
}
.footer-btns { display: flex; gap: 10px; }

@media (max-width: 768px) {
  .cart-page { padding-top: 12px; padding-bottom: 24px; }
  .cart-list { padding: 4px 14px; }
  .cart-item { flex-wrap: wrap; }
  .item-info { flex: 1 1 calc(100% - 90px); }
  .item-price { margin-left: auto; }
  .item-remove { margin-left: auto; }
  .cart-footer { flex-direction: column; align-items: stretch; }
  .footer-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .footer-btns :deep(.store-btn) { width: 100%; }
}
</style>
