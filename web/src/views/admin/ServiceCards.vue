<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">服务卡片</h2>
      <div class="toolbar-actions">
        <el-button @click="addCard">新增卡片</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存全部</el-button>
      </div>
    </div>

    <div class="admin-panel" v-loading="loading">
      <p class="hint">前台「服务」页按排序展示启用中的卡片。链接建议填模拟页路径（如 /services/p/deploy）。会员 / 分销已下线。</p>
      <el-table :data="list" row-key="id">
        <el-table-column label="排序" width="90">
          <template #default="{ row }">
            <el-input-number v-model="row.sort" :min="0" :max="999" controls-position="right" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="图标" width="90">
          <template #default="{ row }">
            <el-input v-model="row.icon" maxlength="4" />
          </template>
        </el-table-column>
        <el-table-column label="标题" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.title" maxlength="64" />
          </template>
        </el-table-column>
        <el-table-column label="简介" min-width="220">
          <template #default="{ row }">
            <el-input v-model="row.desc" maxlength="200" />
          </template>
        </el-table-column>
        <el-table-column label="背景渐变" min-width="200">
          <template #default="{ row }">
            <el-input v-model="row.bg" placeholder="linear-gradient(...)" />
          </template>
        </el-table-column>
        <el-table-column label="跳转链接" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.to" placeholder="/services/custom" />
          </template>
        </el-table-column>
        <el-table-column label="启用" width="80" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" />
          </template>
        </el-table-column>
        <el-table-column label="预览" width="70" align="center">
          <template #default="{ row }">
            <div class="preview-ico" :style="{ background: row.bg }">{{ row.icon || '📦' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ $index }">
            <el-button type="danger" size="small" plain @click="remove($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import http from '../../api';

const list = ref([]);
const loading = ref(false);
const saving = ref(false);

function uid() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/services/admin/cards');
    list.value = (res.list || []).map((c) => ({ ...c, enabled: !!c.enabled }));
  } finally {
    loading.value = false;
  }
}

function addCard() {
  list.value.push({
    id: uid(),
    icon: '📦',
    title: '新服务',
    desc: '',
    bg: 'linear-gradient(135deg,#0a0a0b,#27272a)',
    to: '/services/p/custom',
    enabled: true,
    sort: list.value.length
  });
}

async function remove(index) {
  await ElMessageBox.confirm('确定删除该卡片？', '提示', { type: 'warning' });
  list.value.splice(index, 1);
}

async function save() {
  for (const c of list.value) {
    if (!String(c.title || '').trim()) return ElMessage.warning('请填写卡片标题');
  }
  saving.value = true;
  try {
    const res = await http.put('/services/admin/cards', { list: list.value });
    list.value = (res.list || []).map((c) => ({ ...c, enabled: !!c.enabled }));
    ElMessage.success('已保存');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.toolbar-actions { display: flex; gap: 8px; }
.hint { margin: 0 0 14px; font-size: 13px; color: var(--text-3); }
.preview-ico {
  width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center;
  color: #fff; font-size: 16px; margin: 0 auto;
}
</style>
