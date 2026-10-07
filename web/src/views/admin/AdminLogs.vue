<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">操作日志</h2>
      <div class="filters">
        <el-select v-model="query.action" placeholder="操作类型" clearable style="width: 180px" @change="onSearch">
          <el-option v-for="a in actions" :key="a" :label="a" :value="a" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="搜索目标/详情/操作人" clearable style="width: 240px" @keyup.enter="onSearch" />
        <el-button type="primary" @click="onSearch">查询</el-button>
      </div>
    </div>

    <div class="admin-panel">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="admin_name" label="操作人" width="120" />
        <el-table-column prop="action" label="操作" width="160">
          <template #default="{ row }">
            <el-tag size="small">{{ row.action }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="target" label="目标" min-width="180" show-overflow-tooltip />
        <el-table-column prop="detail" label="详情" min-width="240" show-overflow-tooltip />
        <el-table-column prop="ip" label="IP" width="130" />
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ fmt(row.created_at) }}</template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pager"
        background
        layout="prev, pager, next, total"
        :total="total"
        :page-size="pageSize"
        :current-page="query.page"
        @current-change="onPage"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import http from '../../api';

const list = ref([]);
const total = ref(0);
const actions = ref([]);
const pageSize = 20;
const loading = ref(false);
const query = reactive({ page: 1, action: '', keyword: '' });

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/admin/logs', { params: { ...query, pageSize } });
    list.value = res.list;
    total.value = res.total;
    actions.value = res.actions || [];
  } finally {
    loading.value = false;
  }
}
function onSearch() { query.page = 1; load(); }
function onPage(p) { query.page = p; load(); }
function fmt(t) { return t ? String(t).slice(0, 19).replace('T', ' ') : '-'; }

onMounted(load);
</script>

<style scoped></style>
