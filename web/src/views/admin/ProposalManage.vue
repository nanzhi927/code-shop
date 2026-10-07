<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">开题管理</h2>
      <div class="usage">
        <span v-for="u in todayUsage" :key="u.subject_type">
          今日{{ u.subject_type === 'user' ? '登录用户' : '游客' }}：{{ u.cnt }} 次
        </span>
      </div>
    </div>

    <div class="cost-row" v-if="costToday || costAll">
      <div class="cost-card">
        <b>今日会话</b>
        <span>{{ costToday?.sessions || 0 }}</span>
      </div>
      <div class="cost-card">
        <b>今日完成</b>
        <span>{{ costToday?.done_cnt || 0 }}</span>
      </div>
      <div class="cost-card">
        <b>今日 Token</b>
        <span>{{ (costToday?.tokens_in || 0) + (costToday?.tokens_out || 0) }}</span>
      </div>
      <div class="cost-card">
        <b>累计 Token</b>
        <span>{{ (costAll?.tokens_in || 0) + (costAll?.tokens_out || 0) }}</span>
      </div>
    </div>

    <div class="admin-panel" v-loading="loading">
      <div class="filters">
        <el-select v-model="status" clearable placeholder="状态" style="width:140px" @change="load">
          <el-option label="待生成" value="ready" />
          <el-option label="生成中" value="generating" />
          <el-option label="已完成" value="done" />
          <el-option label="失败" value="failed" />
        </el-select>
        <el-button @click="load">刷新</el-button>
      </div>

      <el-table :data="list" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="session_no" label="编号" width="140" />
        <el-table-column prop="title" label="题目" min-width="200" show-overflow-tooltip />
        <el-table-column prop="user_id" label="用户" width="80" />
        <el-table-column prop="mode" label="模式" width="90" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column label="Token" width="120">
          <template #default="{ row }">{{ row.tokens_in || 0 }} / {{ row.tokens_out || 0 }}</template>
        </el-table-column>
        <el-table-column prop="provider" label="模型" width="110" />
        <el-table-column prop="created_at" label="创建时间" width="170" />
      </el-table>

      <div class="pager">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          v-model:current-page="page"
          @current-change="load"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import http from '../../api';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const status = ref('');
const todayUsage = ref([]);
const costToday = ref(null);
const costAll = ref(null);

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/proposal/admin/sessions', {
      params: { page: page.value, pageSize, status: status.value || undefined }
    });
    list.value = res.list || [];
    total.value = res.total || 0;
    todayUsage.value = res.todayUsage || [];
    costToday.value = res.costToday || null;
    costAll.value = res.costAll || null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.page-title { margin: 0; }
.usage { display: flex; gap: 14px; font-size: 13px; color: var(--text-3); }
.cost-row {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px;
}
.cost-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;
}
.cost-card b { font-size: 12px; color: var(--text-3); font-weight: 600; }
.cost-card span { font-size: 20px; font-weight: 800; color: var(--ink); }
.filters { display: flex; gap: 10px; margin-bottom: 12px; }
.pager { display: flex; justify-content: flex-end; margin-top: 14px; }
@media (max-width: 900px) {
  .cost-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
