<template>
  <div class="admin-page">
    <!-- 统计卡片 -->
    <div class="stat-row" v-loading="statsLoading">
      <div class="stat-card">
        <div class="stat-icon total"><el-icon :size="20"><Goods /></el-icon></div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.total ?? 0 }}</div>
          <div class="stat-label">商品总数</div>
        </div>
      </div>
      <div v-for="item in statusCards" :key="item.run_status" class="stat-card">
        <div class="stat-icon" :class="'s' + item.run_status"><el-icon :size="20"><CircleCheck /></el-icon></div>
        <div class="stat-body">
          <div class="stat-num" :style="{ color: statusColor(item.run_status) }">{{ item.cnt }}</div>
          <div class="stat-label">{{ RUN_STATUS[item.run_status]?.label }}</div>
          <div class="stat-sub">在售 {{ item.on_sale }}</div>
        </div>
      </div>
    </div>

    <div class="toolbar" style="margin-top: 16px">
      <h2 class="page-title">质检中心</h2>
      <div class="filters">
        <el-select v-model="query.run_status" style="width: 140px" @change="onSearch">
          <el-option label="全部状态" value="" />
          <el-option v-for="(v, k) in RUN_STATUS" :key="k" :label="v.label" :value="Number(k)" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="搜索标题/编号" clearable style="width: 220px" @keyup.enter="onSearch" />
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button type="success" plain :disabled="!selectedIds.length" @click="batch('qa', 1)">批量通过</el-button>
        <el-button type="primary" plain :disabled="!selectedIds.length" @click="batch('onsale')">批量上架</el-button>
      </div>
    </div>

    <div class="admin-panel">
    <el-table :data="list" v-loading="loading" @selection-change="onSelectionChange">
      <el-table-column type="selection" width="50" />
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
      <el-table-column prop="tech" label="技术栈" width="110" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">{{ row.type === 'folder' ? '文件夹' : '压缩包' }}</template>
      </el-table-column>
      <el-table-column label="大小" width="90">
        <template #default="{ row }">
          {{ row.size_mb >= 1024 ? (row.size_mb / 1024).toFixed(1) + ' GB' : row.size_mb + ' MB' }}
        </template>
      </el-table-column>
      <el-table-column prop="price" label="价格" width="80">
        <template #default="{ row }">¥{{ row.price }}</template>
      </el-table-column>
      <el-table-column label="在售" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'info'" size="small">{{ row.status ? '在售' : '下架' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="质检状态" width="120">
        <template #default="{ row }">
          <el-tag :type="runStatusType(row.run_status)" size="small">{{ runStatusText(row.run_status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="质检备注" min-width="170">
        <template #default="{ row }">
          <div v-if="editingNoteId === row.id" class="note-edit">
            <el-input v-model="noteDraft" type="textarea" :rows="2" size="small" />
            <div class="note-actions">
              <el-button size="small" type="primary" @click="saveNote(row)">保存</el-button>
              <el-button size="small" @click="cancelNote">取消</el-button>
            </div>
          </div>
          <div v-else class="note-view">
            <span class="note-text" :title="row.qa_note">{{ row.qa_note || '—' }}</span>
            <el-button size="small" type="primary" plain @click="startEditNote(row)">编辑</el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="file_count" label="文件数" width="80" />
      <el-table-column prop="verified_at" label="验证时间" width="160" show-overflow-tooltip />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <div class="op-btns">
            <el-button type="success" size="small" @click="qaPass(row)">通过</el-button>
            <el-button type="warning" size="small" plain @click="qaFail(row)">有问题</el-button>
            <el-button size="small" plain :type="row.status ? 'warning' : 'success'" @click="toggle(row)">
              {{ row.status ? '下架' : '上架' }}
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
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Goods, CircleCheck } from '@element-plus/icons-vue';
import http from '../../api';
import { RUN_STATUS, runStatusText, runStatusType } from '../../utils/runStatus';

const list = ref([]);
const total = ref(0);
const pageSize = 20;
const loading = ref(false);
const statsLoading = ref(false);
const stats = ref({});
const query = reactive({ page: 1, run_status: '', keyword: '' });
const selectedIds = ref([]);

const editingNoteId = ref(null);
const noteDraft = ref('');

// byStatus 补齐 4 种状态，缺省显示 0
const statusCards = computed(() => {
  const by = stats.value.byStatus || [];
  return Object.keys(RUN_STATUS).map((k) => {
    const item = by.find((b) => Number(b.run_status) === Number(k)) || {};
    return {
      run_status: Number(k),
      cnt: item.cnt || 0,
      on_sale: item.on_sale || 0
    };
  });
});

const STATUS_COLORS = { 0: '#909399', 1: '#67c23a', 2: '#e6a23c', 3: '#f56c6c' };
function statusColor(s) {
  return STATUS_COLORS[s] || '#909399';
}

async function loadStats() {
  statsLoading.value = true;
  try {
    stats.value = await http.get('/admin/stats/qa');
  } finally {
    statsLoading.value = false;
  }
}

async function load() {
  loading.value = true;
  try {
    const params = { page: query.page, pageSize };
    if (query.run_status !== '') params.run_status = query.run_status;
    if (query.keyword) params.keyword = query.keyword;
    const res = await http.get('/admin/qa/products', { params });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function onSearch() { query.page = 1; load(); }
function onPage(p) { query.page = p; load(); }

function onSelectionChange(rows) {
  selectedIds.value = rows.map((r) => r.id);
}

async function qaPass(row) {
  await http.post(`/admin/products/${row.id}/qa`, { run_status: 1, qa_note: row.qa_note || '' });
  ElMessage.success('已标记为「已验证可运行」');
  load();
  loadStats();
}

async function qaFail(row) {
  await http.post(`/admin/products/${row.id}/qa`, { run_status: 2, qa_note: row.qa_note || '' });
  ElMessage.success('已标记为「有问题」');
  load();
  loadStats();
}

async function toggle(row) {
  await http.post(`/admin/products/${row.id}/toggle`);
  ElMessage.success(row.status ? '已下架' : '已上架');
  load();
  loadStats();
}

function startEditNote(row) {
  editingNoteId.value = row.id;
  noteDraft.value = row.qa_note || '';
}

function cancelNote() {
  editingNoteId.value = null;
  noteDraft.value = '';
}

async function saveNote(row) {
  await http.post(`/admin/products/${row.id}/qa`, {
    run_status: row.run_status ?? 0,
    qa_note: noteDraft.value
  });
  ElMessage.success('备注已保存');
  editingNoteId.value = null;
  load();
}

async function batch(action, run_status) {
  if (!selectedIds.value.length) return ElMessage.warning('请先选择商品');
  await http.post('/admin/products/batch', { ids: selectedIds.value, action, run_status });
  ElMessage.success('批量操作成功');
  load();
  loadStats();
}

onMounted(() => { load(); loadStats(); });
</script>

<style scoped>
.stat-card { display: flex; align-items: center; gap: 14px; text-align: left; }
.stat-icon {
  width: 42px; height: 42px; border-radius: 10px; display: grid; place-items: center;
  color: #fff; flex-shrink: 0; background: var(--brand-grad);
}
.stat-icon.total { background: linear-gradient(135deg, var(--brand-500), var(--brand-600)); }
.stat-icon.s0 { background: linear-gradient(135deg, #94a3b8, #64748b); }
.stat-icon.s1 { background: linear-gradient(135deg, #34d399, #10b981); }
.stat-icon.s2 { background: linear-gradient(135deg, #fbbf24, #f59e0b); }
.stat-icon.s3 { background: linear-gradient(135deg, #fb7185, #ef4444); }
.stat-num { font-size: 22px; font-weight: 750; color: var(--text-1); line-height: 1.2; }
.stat-label { margin-top: 2px; color: var(--text-2); font-size: 13px; font-weight: 550; }
.stat-sub { margin-top: 2px; color: var(--text-3); font-size: 12px; }
.note-view { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.note-text {
  flex: 1; font-size: 13px; color: var(--text-2); white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis;
}
.note-edit { display: flex; flex-direction: column; gap: 6px; }
.note-actions { display: flex; gap: 6px; }
.op-btns {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.op-btns .el-button + .el-button { margin-left: 0; }
</style>
