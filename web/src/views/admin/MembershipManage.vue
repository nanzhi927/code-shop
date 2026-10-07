<template>
  <div class="admin-page">
    <h2 class="page-title">会员管理</h2>
    <div class="admin-panel">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="username" label="用户" width="140" />
        <el-table-column prop="plan" label="套餐" width="120">
          <template #default="{ row }">{{ row.plan==='yearly'?'年卡':row.plan==='quarterly'?'季卡':'月卡' }}</template>
        </el-table-column>
        <el-table-column prop="started_at" label="开始" min-width="160" />
        <el-table-column prop="expires_at" label="到期" min-width="160" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }"><el-tag size="small" :type="row.status==='active'?'success':'info'">{{ row.status==='active'?'有效':'过期' }}</el-tag></template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import http from '../../api';
const list = ref([]); const loading = ref(false);
async function load() { loading.value = true; try { list.value = await http.get('/services/admin/memberships'); } finally { loading.value = false; } }
onMounted(load);
</script>
