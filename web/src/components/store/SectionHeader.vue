<template>
  <div class="section-head">
    <h2 class="section-title">{{ title }}</h2>
    <router-link v-if="moreTo" class="section-more" :to="moreTo">{{ moreText }}</router-link>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  moreTo: { type: [String, Object], default: '' },
  moreText: { type: String, default: '查看全部 →' }
});
</script>
