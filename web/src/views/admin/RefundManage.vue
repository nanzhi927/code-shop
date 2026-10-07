<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">售后管理</h2>
      <div class="filters">
        <el-select v-model="filterStatus" style="width: 140px" @change="onFilter">
          <el-option label="全部" value="" />
          <el-option label="待处理" value="pending" />
          <el-option label="已同意" value="approved" />
          <el-option label="已拒绝" value="rejected" />
          <el-option label="已退款" value="refunded" />
        </el-select>
      </div>
    </div>

    <div class="admin-panel">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="order_no" label="订单号" width="170" />
        <el-table-column prop="username" label="用户" width="100" />
        <el-table-column prop="reason" label="原因" min-width="140" show-overflow-tooltip />
        <el-table-column prop="amount" label="金额" width="90">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="admin_note" label="管理员备注" min-width="120" show-overflow-tooltip />
        <el-table-column prop="created_at" label="申请时间" width="160" />
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <div v-if="row.status === 'pending'" class="op-btns">
              <el-button type="primary" size="small" @click="openAction(row, 'approve')">同意</el-button>
              <el-button type="success" size="small" plain @click="openAction(row, 'refund')">直接退款</el-button>
              <el-button type="danger" size="small" plain @click="openAction(row, 'reject')">拒绝</el-button>
            </div>
            <span v-else class="handled">{{ row.handled_at || '—' }}</span>
          </template>
        </el-table-column>
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

    <el-dialog v-model="actionVisible" :title="actionTitle" width="440px">
      <el-form label-width="80px">
        <el-form-item label="备注">
          <el-input v-model="actionNote" size="small" placeholder="可选管理员备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="actionVisible = false">取消</el-button>
        <el-button type="primary" :loading="actionLoading" @click="doAction">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../../api';

const list = ref([]);
const total = ref(0);
const pageSize = 20;
const page = ref(1);
const loading = ref(false);
const filterStatus = ref('');

const actionVisible = ref(false);
const actionLoading = ref(false);
const actionRow = ref(null);
const actionType = ref('');
const actionNote = ref('');

const STATUS = {
  pending: { text: '待处理', type: 'warning' },
  approved: { text: '已同意', type: 'primary' },
  rejected: { text: '已拒绝', type: 'info' },
  refunded: { text: '已退款', type: 'success' }
};
const statusText = (s) => STATUS[s]?.text || s || '—';
const statusType = (s) => STATUS[s]?.type || 'info';

const ACTION_TITLE = { approve: '同意售后', refund: '直接退款', reject: '拒绝售后' };
const actionTitle = computed(() => ACTION_TITLE[actionType.value] || '处理售后');

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/admin/refunds', {
      params: { page: page.value, pageSize, status: filterStatus.value }
    });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}
function onPage(p) { page.value = p; load(); }
function onFilter() { page.value = 1; load(); }

function openAction(row, action) {
  actionRow.value = row;
  actionType.value = action;
  actionNote.value = row.admin_note || '';
  actionVisible.value = true;
}

async function doAction() {
  actionLoading.value = true;
  try {
    await http.post(`/admin/refunds/${actionRow.value.id}`, {
      action: actionType.value,
      admin_note: actionNote.value
    });
    ElMessage.success('操作成功');
    actionVisible.value = false;
    load();
  } finally {
    actionLoading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.handled { font-size: 13px; color: var(--text-3); }
</style>
