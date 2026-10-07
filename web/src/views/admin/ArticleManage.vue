<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">文章管理</h2>
      <div class="toolbar-right">
        <el-input
          v-model="query.keyword"
          clearable
          placeholder="搜索标题 / slug"
          style="width: 220px"
          @keyup.enter="onSearch"
          @clear="onSearch"
        />
        <el-select v-model="query.status" clearable placeholder="状态" style="width: 120px" @change="onSearch">
          <el-option label="草稿" :value="0" />
          <el-option label="已发布" :value="1" />
        </el-select>
        <el-button type="primary" @click="openCreate">新建文章</el-button>
      </div>
    </div>

    <div class="admin-panel">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="category" label="分类" width="110" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="views" label="浏览量" width="90" />
        <el-table-column prop="updated_at" label="更新时间" width="170" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div class="op-btns">
              <el-button type="primary" size="small" plain @click="openEdit(row)">编辑</el-button>
              <el-button type="warning" size="small" plain @click="toggle(row)">
                {{ row.status === 1 ? '下架' : '发布' }}
              </el-button>
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
        :current-page="query.page"
        @current-change="onPage"
      />
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑文章' : '新建文章'"
      width="720px"
      destroy-on-close
      top="4vh"
    >
      <el-form label-width="80px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="文章标题" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="slug">
          <el-input v-model="form.slug" placeholder="留空则按标题生成拼音；URL: /articles/{slug}" />
        </el-form-item>
        <el-form-item label="摘要">
          <el-input v-model="form.summary" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="列表与 SEO 摘要" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="分类">
              <el-input v-model="form.category" placeholder="如：选题指南 / 答辩技巧" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="标签">
              <el-input v-model="form.tags" placeholder="逗号分隔，如：SpringBoot,毕设" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="封面">
          <div class="cover-upload">
            <el-upload
              action="/api/admin/upload/cover"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="onCoverUpload"
              :on-error="onCoverError"
              accept="image/png,image/jpeg,image/webp,image/gif"
              :before-upload="beforeCoverUpload"
            >
              <el-button size="small" type="primary" plain>上传封面图</el-button>
            </el-upload>
            <el-input v-model="form.cover" placeholder="/uploads/covers/xxx.png 或图片地址" />
          </div>
          <div v-if="form.cover" class="cover-preview">
            <img :src="form.cover" alt="封面预览" />
          </div>
        </el-form-item>
        <el-form-item label="正文" required>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="14"
            placeholder="支持 Markdown 子集：标题、段落、列表、代码块、加粗、链接、图片"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            v-model="form.status"
            :active-value="1"
            :inactive-value="0"
            active-text="发布"
            inactive-text="草稿"
          />
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
import { useUserStore } from '../../stores/user';

const userStore = useUserStore();
const uploadHeaders = { Authorization: `Bearer ${userStore.token}` };

const list = ref([]);
const total = ref(0);
const pageSize = 20;
const loading = ref(false);
const query = reactive({ page: 1, keyword: '', status: '' });

const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref(null);
const form = reactive({
  title: '',
  slug: '',
  summary: '',
  category: '',
  tags: '',
  cover: '',
  content: '',
  status: 0
});

async function load() {
  loading.value = true;
  try {
    const params = { page: query.page, pageSize };
    if (query.keyword.trim()) params.keyword = query.keyword.trim();
    if (query.status === 0 || query.status === 1) params.status = query.status;
    const res = await http.get('/admin/articles', { params });
    list.value = res.list || [];
    total.value = res.total || 0;
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  query.page = 1;
  load();
}
function onPage(p) {
  query.page = p;
  load();
}

function resetForm() {
  Object.assign(form, {
    title: '',
    slug: '',
    summary: '',
    category: '',
    tags: '',
    cover: '',
    content: '',
    status: 0
  });
}

function openCreate() {
  editingId.value = null;
  resetForm();
  dialogVisible.value = true;
}

async function openEdit(row) {
  editingId.value = row.id;
  resetForm();
  dialogVisible.value = true;
  try {
    const detail = await http.get(`/admin/articles/${row.id}`);
    Object.assign(form, {
      title: detail.title || '',
      slug: detail.slug || '',
      summary: detail.summary || '',
      category: detail.category || '',
      tags: detail.tags || '',
      cover: detail.cover || '',
      content: detail.content || '',
      status: detail.status === 1 ? 1 : 0
    });
  } catch {
    Object.assign(form, {
      title: row.title || '',
      slug: row.slug || '',
      summary: row.summary || '',
      category: row.category || '',
      tags: row.tags || '',
      cover: row.cover || '',
      content: '',
      status: row.status === 1 ? 1 : 0
    });
  }
}

async function save() {
  if (!form.title.trim()) return ElMessage.warning('请填写标题');
  if (!form.content.trim()) return ElMessage.warning('请填写正文');
  saving.value = true;
  try {
    const payload = { ...form };
    if (editingId.value) {
      await http.put(`/admin/articles/${editingId.value}`, payload);
      ElMessage.success('已更新');
    } else {
      await http.post('/admin/articles', payload);
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function toggle(row) {
  await http.post(`/admin/articles/${row.id}/toggle`);
  ElMessage.success(row.status === 1 ? '已设为草稿' : '已发布');
  load();
}

function remove(row) {
  ElMessageBox.confirm(`确定删除文章「${row.title}」？删除后不可恢复。`, '提示', { type: 'warning' })
    .then(async () => {
      await http.delete(`/admin/articles/${row.id}`);
      ElMessage.success('已删除');
      load();
    })
    .catch(() => {});
}

function beforeCoverUpload(file) {
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('封面图不能超过 5MB');
    return false;
  }
  return true;
}
function onCoverUpload(res) {
  if (res?.url) form.cover = res.url;
  else ElMessage.error('上传失败');
}
function onCoverError() {
  ElMessage.error('封面上传失败');
}

onMounted(load);
</script>

<style scoped>
.toolbar-right { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.cover-upload { display: flex; gap: 10px; width: 100%; align-items: center; }
.cover-upload .el-input { flex: 1; }
.cover-preview {
  margin-top: 10px; width: 160px; aspect-ratio: 16/9;
  border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
}
.cover-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
</style>
