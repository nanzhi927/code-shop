<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">案例管理</h2>
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
        <el-button type="primary" @click="openCreate">新建案例</el-button>
      </div>
    </div>

    <div class="admin-panel">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column label="服务" width="110">
          <template #default="{ row }">{{ row.service_label }}</template>
        </el-table-column>
        <el-table-column prop="tech" label="技术栈" width="110" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="views" label="浏览" width="80" />
        <el-table-column prop="sort_weight" label="权重" width="80" />
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
      :title="editingId ? '编辑案例' : '新建案例'"
      width="780px"
      destroy-on-close
      top="3vh"
    >
      <el-form label-width="100px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="200" show-word-limit
            placeholder="写成处境+结果，如：选题表改了名字……4 天改完并能演示审核" />
        </el-form-item>
        <el-form-item label="slug">
          <el-input v-model="form.slug" placeholder="留空按标题生成；URL: /cases/{slug}" />
        </el-form-item>
        <el-form-item label="一句话结果" required>
          <el-input v-model="form.summary" type="textarea" :rows="2" maxlength="500" show-word-limit
            placeholder="列表主结论：几天内做成了什么、能演示什么" />
        </el-form-item>
        <el-form-item label="当时卡在哪">
          <el-input v-model="form.client_scene" type="textarea" :rows="3" maxlength="500" show-word-limit
            placeholder="脱敏：专业、手里有什么、卡在哪、导师/节点压力" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="服务类型">
              <el-select v-model="form.service_type" style="width:100%">
                <el-option v-for="(label, key) in serviceLabels" :key="key" :label="label" :value="key" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="技术栈">
              <el-input v-model="form.tech" placeholder="SpringBoot" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="业务域">
              <el-input v-model="form.domain" placeholder="校园教育" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="10">
            <el-form-item label="周期">
              <el-input v-model="form.duration_label" placeholder="约 4 天 / 约 1 周" maxlength="64" />
            </el-form-item>
          </el-col>
          <el-col :span="14">
            <el-form-item label="明确不接">
              <el-input v-model="form.scope_out" placeholder="如：不做小程序；不代写论文" maxlength="500" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="结果要点">
          <el-input v-model="form.result_points_text" type="textarea" :rows="3"
            placeholder="每行一条可验收结果" />
        </el-form-item>
        <el-form-item label="交付物">
          <el-input v-model="form.deliverables_text" type="textarea" :rows="3"
            placeholder="每行一件：工程包 / 运行说明 / 演示账号…" />
        </el-form-item>
        <el-form-item label="封面">
          <div class="cover-upload">
            <el-upload
              action="/api/admin/upload/cover"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="onCoverUpload"
              accept="image/png,image/jpeg,image/webp,image/gif"
            >
              <el-button size="small" type="primary" plain>上传封面</el-button>
            </el-upload>
            <el-input v-model="form.cover" placeholder="建议用真实界面截图；勿用教程插画" />
          </div>
        </el-form-item>
        <el-form-item label="界面证据">
          <el-input v-model="form.gallery_text" type="textarea" :rows="3"
            placeholder="每行：图片URL|说明。必须是脱敏后的真实界面，没有就留空" />
        </el-form-item>
        <el-form-item label="关联商品ID">
          <el-input v-model="form.related_product_ids" placeholder="逗号分隔，如 12,34" />
        </el-form-item>
        <el-form-item label="关联服务">
          <el-select v-model="form.related_service_slugs" multiple style="width:100%" placeholder="可选">
            <el-option label="定制 custom" value="custom" />
            <el-option label="代跑 deploy" value="deploy" />
            <el-option label="答辩 defense" value="defense" />
          </el-select>
        </el-form-item>
        <el-form-item label="怎么做的">
          <el-input v-model="form.content_md" type="textarea" :rows="10"
            placeholder="Markdown。建议用 ## 怎么做的 / ## 验收怎么对" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="排序权重">
              <el-input-number v-model="form.sort_weight" :min="0" :max="9999" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio :value="0">草稿</el-radio>
                <el-radio :value="1">发布</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import http from '../../api';

const list = ref([]);
const total = ref(0);
const pageSize = 20;
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref(null);
const serviceLabels = ref({
  custom: '定制开发',
  modify: '二次修改',
  deploy: '代跑部署',
  defense: '答辩加购',
  mixed: '组合服务'
});

const query = reactive({ page: 1, keyword: '', status: '' });
const form = reactive({
  title: '',
  slug: '',
  summary: '',
  client_scene: '',
  service_type: 'custom',
  tech: '',
  domain: '',
  duration_label: '',
  scope_out: '',
  result_points_text: '',
  deliverables_text: '',
  cover: '',
  gallery_text: '',
  related_product_ids: '',
  related_service_slugs: [],
  content_md: '',
  sort_weight: 50,
  status: 0
});

const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`
}));

function onCoverUpload(res) {
  const url = res?.url || res?.path || '';
  if (url) form.cover = url;
  else ElMessage.error('上传失败');
}

function resetForm() {
  Object.assign(form, {
    title: '', slug: '', summary: '', client_scene: '',
    service_type: 'custom', tech: '', domain: '',
    duration_label: '', scope_out: '',
    result_points_text: '', deliverables_text: '', cover: '', gallery_text: '',
    related_product_ids: '', related_service_slugs: [],
    content_md: '', sort_weight: 50, status: 0
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
  const detail = await http.get(`/admin/cases/${row.id}`);
  form.title = detail.title || '';
  form.slug = detail.slug || '';
  form.summary = detail.summary || '';
  form.client_scene = detail.client_scene || '';
  form.service_type = detail.service_type || 'custom';
  form.tech = detail.tech || '';
  form.domain = detail.domain || '';
  form.duration_label = detail.duration_label || '';
  form.scope_out = detail.scope_out || '';
  form.result_points_text = (detail.result_points || []).join('\n');
  form.deliverables_text = (detail.deliverables || []).join('\n');
  form.cover = detail.cover || '';
  form.gallery_text = (detail.gallery || [])
    .map((g) => (g.caption ? `${g.url}|${g.caption}` : g.url))
    .join('\n');
  form.related_product_ids = (detail.related_product_ids || []).join(',');
  form.related_service_slugs = detail.related_service_slugs || [];
  form.content_md = detail.content_md || '';
  form.sort_weight = detail.sort_weight || 0;
  form.status = detail.status === 1 ? 1 : 0;
  dialogVisible.value = true;
}

function buildPayload() {
  const result_points = form.result_points_text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const deliverables = form.deliverables_text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const gallery = form.gallery_text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const [url, ...rest] = line.split('|');
      return { url: url.trim(), caption: rest.join('|').trim() };
    });
  return {
    title: form.title,
    slug: form.slug,
    summary: form.summary,
    client_scene: form.client_scene,
    service_type: form.service_type,
    tech: form.tech,
    domain: form.domain,
    duration_label: form.duration_label,
    scope_out: form.scope_out,
    result_points,
    deliverables,
    cover: form.cover,
    gallery,
    related_product_ids: form.related_product_ids,
    related_service_slugs: form.related_service_slugs,
    content_md: form.content_md,
    sort_weight: form.sort_weight,
    status: form.status
  };
}

async function save() {
  if (!form.title.trim()) return ElMessage.warning('请填写标题');
  if (!form.summary.trim()) return ElMessage.warning('请填写一句话结果');
  saving.value = true;
  try {
    const payload = buildPayload();
    if (editingId.value) {
      await http.put(`/admin/cases/${editingId.value}`, payload);
      ElMessage.success('已更新');
    } else {
      await http.post('/admin/cases', payload);
      ElMessage.success('已创建');
    }
    dialogVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function toggle(row) {
  await http.post(`/admin/cases/${row.id}/toggle`);
  ElMessage.success(row.status === 1 ? '已下架' : '已发布');
  load();
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除「${row.title}」？`, '删除确认', { type: 'warning' });
  await http.delete(`/admin/cases/${row.id}`);
  ElMessage.success('已删除');
  load();
}

function onSearch() {
  query.page = 1;
  load();
}
function onPage(p) {
  query.page = p;
  load();
}

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/admin/cases', {
      params: {
        page: query.page,
        pageSize,
        keyword: query.keyword || undefined,
        status: query.status === '' || query.status == null ? undefined : query.status
      }
    });
    list.value = res.list || [];
    total.value = res.total || 0;
    if (res.service_labels) serviceLabels.value = res.service_labels;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.toolbar {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px; flex-wrap: wrap; margin-bottom: 16px;
}
.toolbar-right { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.pager { margin-top: 16px; justify-content: flex-end; }
.cover-upload { display: flex; gap: 10px; width: 100%; align-items: center; }
.cover-upload .el-input { flex: 1; }
</style>
