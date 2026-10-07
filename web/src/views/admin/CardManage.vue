<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">卡密管理</h2>
      <div class="filters">
        <el-input-number v-model="gen.count" :min="1" :max="500" label="数量" />
        <el-input-number v-model="gen.amount" :min="1" :precision="2" label="面值" style="width: 160px" />
        <el-button type="primary" @click="generate">生成卡密</el-button>
        <el-button type="success" plain @click="exportCsv">导出 CSV</el-button>
        <el-select v-model="filterStatus" style="width: 120px" @change="load">
          <el-option label="全部" value="全部" />
          <el-option label="未使用" value="unused" />
          <el-option label="已使用" value="used" />
        </el-select>
      </div>
    </div>

    <div class="admin-panel">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="card_no" label="卡密" width="220" />
        <el-table-column prop="amount" label="面值" width="100">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'unused' ? 'success' : 'info'" size="small">{{ row.status === 'unused' ? '未使用' : '已使用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="used_order" label="使用订单" width="170" />
        <el-table-column prop="created_at" label="生成时间" width="160" />
      </el-table>

      <el-pagination
        class="pager"
        background
        layout="prev, pager, next, total"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="onPage"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../../api';

const list = ref([]);
const total = ref(0);
const pageSize = 20;
const page = ref(1);
const loading = ref(false);
const filterStatus = ref('全部');
const gen = reactive({ count: 10, amount: 99 });

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/admin/cards', {
      params: { page: page.value, pageSize, status: filterStatus.value }
    });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}
function onPage(p) { page.value = p; load(); }

async function generate() {
  const res = await http.post('/admin/cards/generate', { count: gen.count, amount: gen.amount });
  ElMessage.success(`已生成 ${res.count} 张卡密`);
  load();
}

async function exportCsv() {
  const blob = await http.get('/admin/cards/export', {
    params: { status: filterStatus.value },
    responseType: 'blob'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cards_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(load);
</script>

<style scoped></style>
