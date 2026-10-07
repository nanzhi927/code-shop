<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">管理员管理</h2>
      <el-button type="primary" @click="openCreate">新建管理员</el-button>
    </div>

    <div class="admin-panel">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="username" label="用户名" width="140" />
        <el-table-column prop="nickname" label="昵称" width="120" />
        <el-table-column label="角色" width="130">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)" size="small">{{ roleText(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_disabled ? 'danger' : 'success'" size="small">{{ row.is_disabled ? '禁用' : '正常' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column label="操作" min-width="220" fixed="right">
          <template #default="{ row }">
            <el-select
              v-model="row.role"
              size="small"
              style="width: 110px; margin-right: 8px"
              :disabled="row.id === currentUserId"
              @change="(v) => changeRole(row, v)"
            >
              <el-option label="超级管理员" value="superadmin" />
              <el-option label="管理员" value="admin" />
              <el-option label="运营" value="ops" />
            </el-select>
            <el-button
              size="small"
              plain
              :type="row.is_disabled ? 'success' : 'warning'"
              :disabled="row.id === currentUserId"
              @click="toggleAdmin(row)"
            >
              {{ row.is_disabled ? '启用' : '禁用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="createVisible" title="新建管理员" width="480px">
      <el-form label-width="90px">
        <el-form-item label="用户名" required>
          <el-input v-model="form.username" placeholder="登录用户名" />
        </el-form-item>
        <el-form-item label="密码" required>
          <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="超级管理员" value="superadmin" />
            <el-option label="管理员" value="admin" />
            <el-option label="运营" value="ops" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="doCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../../api';
import { useUserStore } from '../../stores/user';

const userStore = useUserStore();
const currentUserId = computed(() => userStore.user?.id);

const list = ref([]);
const loading = ref(false);
const createVisible = ref(false);
const creating = ref(false);
const form = reactive({ username: '', password: '', role: 'admin' });

const ROLE_TEXT = { superadmin: '超级管理员', admin: '管理员', ops: '运营' };
const ROLE_TAG = { superadmin: 'danger', admin: 'primary', ops: 'warning' };

function roleText(role) { return ROLE_TEXT[role] || role; }
function roleTagType(role) { return ROLE_TAG[role] || 'info'; }

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/admin/admins');
    list.value = res.list || [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  Object.assign(form, { username: '', password: '', role: 'admin' });
  createVisible.value = true;
}

async function doCreate() {
  if (!form.username.trim()) return ElMessage.warning('请填写用户名');
  if (!form.password || form.password.length < 6) return ElMessage.warning('密码至少 6 位');
  creating.value = true;
  try {
    await http.post('/admin/admins', form);
    ElMessage.success('创建成功');
    createVisible.value = false;
    load();
  } finally {
    creating.value = false;
  }
}

async function changeRole(row, role) {
  try {
    await http.put(`/admin/admins/${row.id}`, { role });
    ElMessage.success('角色已更新');
  } catch {
    load();
  }
}

async function toggleAdmin(row) {
  const res = await http.post(`/admin/admins/${row.id}/toggle`);
  row.is_disabled = res.disabled ? 1 : 0;
  ElMessage.success(res.disabled ? '已禁用' : '已启用');
}

onMounted(load);
</script>

<style scoped></style>
