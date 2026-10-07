<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">用户管理</h2>
      <div class="filters">
        <el-input v-model="query.keyword" placeholder="搜索手机号/昵称" clearable style="width: 220px" @keyup.enter="onSearch" />
        <el-button type="primary" @click="onSearch">查询</el-button>
      </div>
    </div>

    <div class="admin-panel">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="username" label="手机号/账号" min-width="140" />
        <el-table-column prop="nickname" label="昵称" min-width="120" />
        <el-table-column prop="proposal_credits" label="开题余次" width="90" />
        <el-table-column prop="order_count" label="订单数" width="90" />
        <el-table-column prop="created_at" label="注册时间" width="170" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_disabled ? 'danger' : 'success'" size="small">{{ row.is_disabled ? '已禁用' : '正常' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <div class="op-btns">
              <el-button type="primary" size="small" plain @click="resetPwd(row)">重置密码</el-button>
              <el-button :type="row.is_disabled ? 'success' : 'warning'" size="small" plain @click="toggle(row)">
                {{ row.is_disabled ? '启用' : '禁用' }}
              </el-button>
            </div>
          </template>
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
import { ElMessage, ElMessageBox } from 'element-plus';
import http from '../../api';

const list = ref([]);
const total = ref(0);
const pageSize = 20;
const loading = ref(false);
const query = reactive({ page: 1, keyword: '' });

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/admin/users', { params: { ...query, pageSize } });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}
function onSearch() { query.page = 1; load(); }
function onPage(p) { query.page = p; load(); }

function resetPwd(row) {
  ElMessageBox.prompt(`为「${row.username}」重置密码，输入新密码（至少 6 位）`, '重置密码', {
    inputValue: '123456',
    inputPattern: /^.{6,}$/,
    inputErrorMessage: '密码至少 6 位'
  }).then(async ({ value }) => {
    await http.post(`/admin/users/${row.id}/reset-password`, { password: value });
    ElMessage.success(`已重置，新密码：${value}`);
  }).catch(() => {});
}

function toggle(row) {
  ElMessageBox.confirm(`确定${row.is_disabled ? '启用' : '禁用'}用户「${row.username}」？`, '提示', { type: 'warning' })
    .then(async () => {
      await http.post(`/admin/users/${row.id}/toggle`);
      ElMessage.success(row.is_disabled ? '已启用' : '已禁用');
      load();
    })
    .catch(() => {});
}

onMounted(load);
</script>

<style scoped></style>
