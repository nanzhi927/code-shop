<template>
  <div class="page-container fav-page">
    <h2 class="page-title">我的收藏</h2>

    <div class="product-grid" v-loading="loading">
      <div v-for="p in list" :key="p.product_id" class="fav-card-wrap">
        <ProductCard :product="cardProduct(p)" />
        <button type="button" class="unfav" @click="unfav(p)">取消收藏</button>
      </div>
    </div>
    <div v-if="!loading && !list.length" class="empty-illus">
      <div class="ei-icon">空</div>
      <p class="ei-title">还没有收藏的商品</p>
      <p class="ei-desc">看到心仪源码就点个收藏吧</p>
      <StoreButton variant="solid" to="/products">去逛逛</StoreButton>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../../api';
import ProductCard from '../../components/store/ProductCard.vue';
import StoreButton from '../../components/store/StoreButton.vue';
import { setSeo } from '../../composables/useSeo';

const list = ref([]);
const loading = ref(false);

function cardProduct(p) {
  return {
    ...p,
    id: p.product_id || p.id
  };
}

async function load() {
  loading.value = true;
  try {
    list.value = await http.get('/favorites');
  } finally {
    loading.value = false;
  }
}

async function unfav(p) {
  await http.delete(`/favorites/${p.product_id}`);
  ElMessage.success('已取消收藏');
  load();
}

onMounted(() => {
  setSeo({
    title: '我的收藏 - 毕设源码商城',
    description: '收藏感兴趣的毕业设计 / 毕设 / 课程设计源码，方便下次选购。',
    keywords: '我的收藏,毕设源码,毕业设计'
  });
  load();
});
</script>

<style scoped>
.fav-page { padding-top: 16px; padding-bottom: 40px; }
.fav-card-wrap { display: flex; flex-direction: column; gap: 8px; }
.unfav {
  appearance: none; background: none; border: 0; cursor: pointer;
  font-family: inherit; font-size: 12.5px; color: var(--text-3);
  align-self: flex-start; padding: 0 4px;
}
.unfav:hover { color: var(--text-1); }
</style>
