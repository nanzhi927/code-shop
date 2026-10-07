<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">公告管理</h2>
      <el-button type="primary" @click="openCreate">新建公告</el-button>
    </div>

    <div class="admin-panel">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" width="160" />
        <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-switch
              :model-value="!!row.enabled"
              @change="(v) => toggleEnabled(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="op-btns">
              <el-button type="primary" size="small" plain @click="openEdit(row)">编辑</el-button>
              <el-button type="danger" size="small" plain @click="remove(row)">删除</el-button>
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
        :current-page="page"
        @current-change="onPage"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑公告' : '新建公告'" width="520px">
      <el-form label-width="80px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="公告标题" />
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="form.content" type="textarea" :rows="4" placeholder="公告内容" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import http from '../../api';

const list = ref([]);
const total = ref(0);
const pageSize = 20;
const page = ref(1);
const loading = ref(false);

const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref(null);
const form = reactive({ title: '', content: '', enabled: true });

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/admin/notices', { params: { page: page.value, pageSize } });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}
function onPage(p) { page.value = p; load(); }

function openCreate() {
  editingId.value = null;
  Object.assign(form, { title: '', content: '', enabled: true });
  dialogVisible.value = true;
}

function openEdit(row) {
  editingId.value = row.id;
  Object.assign(form, { title: row.title, content: row.content, enabled: !!row.enabled });
  dialogVisible.value = true;
}

async function save() {
  if (!form.title.trim() || !form.content.trim()) return ElMessage.warning('请填写标题和内容');
  saving.value = true;
  try {
    if (editingId.value) {
      await http.put(`/admin/notices/${editingId.value}`, { ...form });
      ElMessage.success('已更新');
    } else {
      await http.post('/admin/notices', { ...form });
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function toggleEnabled(row, enabled) {
  await http.put(`/admin/notices/${row.id}`, {
    title: row.title,
    content: row.content,
    enabled
  });
  row.enabled = enabled;
  ElMessage.success('已更新');
}

function remove(row) {
  ElMessageBox.confirm('确定删除该公告？', '提示', { type: 'warning' })
    .then(async () => {
      await http.delete(`/admin/notices/${row.id}`);
      ElMessage.success('已删除');
      load();
    }).catch(() => {});
}

onMounted(load);
</script>

<style scoped></style>
