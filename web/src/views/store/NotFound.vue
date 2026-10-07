<template>
  <div class="nf">
    <div class="nf-code">404</div>
    <h1 class="nf-title">页面走丢了</h1>
    <p class="nf-desc">你访问的页面不存在或已被移除。</p>
    <div class="nf-actions">
      <el-button type="primary" size="large" @click="$router.push('/')">回到首页</el-button>
      <el-button size="large" @click="$router.back()">返回上一页</el-button>
    </div>
  </div>
</template>

<script setup></script>

<style scoped>
.nf { text-align: center; padding: 100px 24px; }
.nf-code { font-size: 96px; font-weight: 900; background: var(--brand-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; line-height: 1; }
.nf-title { font-size: 26px; margin: 16px 0 8px; color: var(--text-1); }
.nf-desc { color: var(--text-3); margin-bottom: 28px; }
.nf-actions { display: flex; gap: 12px; justify-content: center; }
</style>
