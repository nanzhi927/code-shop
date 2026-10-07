<template>
  <div class="cover" :style="boxStyle">
    <img
      v-if="product.cover"
      :src="coverUrl"
      :alt="product.title"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
    />
    <template v-else>
      <div class="cover-icon">{{ icon }}</div>
      <div class="cover-tech">{{ product.tech }}</div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { techColor } from '../utils/techColors';

const props = defineProps({
  product: { type: Object, required: true },
  /** 首屏图设为 true，避免 lazy 拖慢 LCP */
  eager: { type: Boolean, default: false }
});

const boxStyle = computed(() => {
  const [c1, c2] = techColor(props.product.tech);
  return { background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` };
});

const coverUrl = computed(() => props.product.cover || '');

const icon = computed(() => {
  const t = props.product.title || '码';
  return t.replace(/[《》\s]/g, '').slice(0, 2) || '码';
});
</script>

<style scoped>
.cover {
  width: 100%;
  aspect-ratio: 3 / 2;
  height: auto;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-alt);
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform .4s var(--ease-out);
}
.cover-icon {
  color: rgba(250, 250, 250, .88);
  font-size: 22px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: .08em;
  font-family: var(--font-display);
}
.cover-tech {
  color: rgba(250, 250, 250, .62);
  font-size: 11px;
  letter-spacing: .04em;
  font-weight: 500;
}
</style>
