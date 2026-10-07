<template>
  <div class="admin-page">
    <h2 class="page-title">分销管理</h2>
    <el-alert type="success" show-icon :closable="false" class="mb">
      <template #title>累计已结算返佣 ¥{{ total }}</template>
    </el-alert>
    <div class="admin-panel">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="username" label="推广员" width="140" />
        <el-table-column prop="ref_code" label="推广码" width="120" />
        <el-table-column prop="comm_cnt" label="成单数" width="100" />
        <el-table-column label="累计返佣" width="120"><template #default="{ row }">¥{{ row.comm_amt }}</template></el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import http from '../../api';
const list = ref([]); const loading = ref(false); const total = ref(0);
async function load() { loading.value = true; try { const r = await http.get('/services/admin/referrals'); list.value = r.list; total.value = r.totalSettled; } finally { loading.value = false; } }
onMounted(load);
</script>
<style scoped>
.mb { margin-bottom: 16px; max-width: 360px; border-radius: 10px; }
</style>
