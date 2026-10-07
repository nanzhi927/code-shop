<template>
  <router-link
    :to="`/products/${product.id}`"
    class="product-card"
    :class="{ 'hot-card': rank != null }"
  >
    <div v-if="rank != null" class="rank-badge" :class="rankClass">{{ rank }}</div>
    <div class="cover-wrap">
      <ProductCover :product="product" :eager="eager" />
      <slot name="badges" />
    </div>
    <div class="card-top">
      <span class="tech-tag">{{ product.tech }}</span>
      <template v-if="showMaterials">
        <span v-if="product.has_paper" class="mat-tag mat-paper">含论文</span>
        <span v-if="product.has_db" class="mat-tag mat-db">含数据库</span>
        <span v-if="product.has_ppt" class="mat-tag mat-ppt">含PPT</span>
      </template>
    </div>
    <h3 v-if="titleHtml" class="card-title" v-html="titleHtml" />
    <h3 v-else class="card-title">{{ product.title }}</h3>
    <div v-if="metaLine.length" class="card-meta">
      <span v-for="item in metaLine" :key="item">{{ item }}</span>
    </div>
    <div class="card-bottom">
      <span class="price">¥{{ product.price }}</span>
      <span v-if="showOrig" class="orig-price">¥{{ product.original_price }}</span>
    </div>
  </router-link>
</template>

<script setup>
import { computed } from 'vue';
import ProductCover from '../ProductCover.vue';

const props = defineProps({
  product: { type: Object, required: true },
  rank: { type: Number, default: null },
  eager: { type: Boolean, default: false },
  showMaterials: { type: Boolean, default: false },
  showMeta: { type: Boolean, default: false },
  titleHtml: { type: String, default: '' }
});

const rankClass = computed(() => {
  if (props.rank === 1) return 'rank-gold';
  if (props.rank === 2) return 'rank-silver';
  if (props.rank === 3) return 'rank-bronze';
  return 'rank-plain';
});

const showOrig = computed(() =>
  Number(props.product.original_price) > Number(props.product.price)
);

const metaLine = computed(() => {
  if (!props.showMeta) return [];
  const p = props.product;
  const items = [];
  if (p.size_mb != null) {
    items.push(Number(p.size_mb) >= 1024
      ? `${(p.size_mb / 1024).toFixed(1)} GB`
      : `${p.size_mb} MB`);
  }
  if (p.sales) items.push(`销量 ${p.sales}`);
  if (p.views) items.push(`浏览 ${p.views}`);
  return items;
});
</script>

<style scoped>
.hot-card { position: relative; }
.cover-wrap { position: relative; }
.rank-badge {
  position: absolute; top: 18px; left: 18px; z-index: 2;
  width: 22px; height: 22px; border-radius: 6px;
  display: grid; place-items: center; font-size: 11px; font-weight: 700; color: #fff;
  font-family: var(--font-num);
}
.rank-gold { background: #0a0a0b; }
.rank-silver { background: #52525b; }
.rank-bronze { background: #78716c; }
.rank-plain { background: var(--text-3); }
.card-top { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
</style>
