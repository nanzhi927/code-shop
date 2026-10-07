<template>
  <router-view />
  <el-button
    v-show="showTop"
    class="back-top"
    circle
    type="primary"
    @click="scrollTop"
  >
    <el-icon><Top /></el-icon>
  </el-button>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const showTop = ref(false);

function onScroll() {
  showTop.value = window.scrollY > 600;
}

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
});
</script>

<style>
.back-top {
  position: fixed;
  right: 28px;
  /* 避开右下角客服浮钮，避免滑过一段后两钮叠在一起 */
  bottom: 92px;
  z-index: 999;
  box-shadow: var(--glow-brand);
  --el-button-bg-color: var(--ink);
  --el-button-border-color: var(--ink);
  --el-button-hover-bg-color: #27272a;
  --el-button-hover-border-color: #27272a;
}
@media (max-width: 768px) {
  .back-top {
    right: 14px;
    bottom: calc(var(--mobile-nav-h, 56px) + env(safe-area-inset-bottom) + 68px);
  }
}
</style>
