<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">商品管理</h2>
      <div class="filters">
        <el-input v-model="query.keyword" placeholder="搜索标题/编号" clearable style="width: 220px" @keyup.enter="onSearch" />
        <el-select v-model="query.tech" style="width: 150px" @change="onSearch">
          <el-option label="全部技术栈" value="全部" />
          <el-option v-for="t in techs" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="query.status" style="width: 120px" @change="onSearch">
          <el-option label="全部状态" value="" />
          <el-option label="上架" value="1" />
          <el-option label="下架" value="0" />
        </el-select>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="openEdit(null)">新建商品</el-button>
        <el-button type="success" plain :disabled="!selectedIds.length" @click="batch('onsale')">批量上架</el-button>
        <el-button type="warning" plain :disabled="!selectedIds.length" @click="batch('offsale')">批量下架</el-button>
        <el-button type="primary" plain :disabled="!selectedIds.length" @click="batch('qa', 1)">批量标记已验证</el-button>
        <el-button type="info" plain :loading="fillingCovers" @click="fillMissingCovers">
          补全缺失封面{{ coverMissing ? `（${coverMissing}）` : '' }}
        </el-button>
      </div>
    </div>

    <div class="admin-panel">
    <el-table :data="list" v-loading="loading" @selection-change="onSelectionChange">
      <el-table-column type="selection" width="50" />
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column label="封面" width="90">
        <template #default="{ row }">
          <el-image v-if="row.cover" :src="row.cover" fit="cover" style="width: 56px; height: 40px; border-radius: 4px" />
          <span v-else class="no-cover">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="product_no" label="编号" width="100" />
      <el-table-column prop="title" label="标题" min-width="240" show-overflow-tooltip />
      <el-table-column prop="tech" label="技术栈" width="110" />
      <el-table-column prop="category" label="分类" width="110" show-overflow-tooltip />
      <el-table-column prop="type" label="类型" width="80" />
      <el-table-column prop="size_mb" label="大小" width="90">
        <template #default="{ row }">
          {{ row.size_mb >= 1024 ? (row.size_mb / 1024).toFixed(1) + ' GB' : row.size_mb + ' MB' }}
        </template>
      </el-table-column>
      <el-table-column label="材料" width="140">
        <template #default="{ row }">
          <span v-if="row.has_paper">论文 </span>
          <span v-if="row.has_ppt">PPT </span>
          <span v-if="row.has_db">DB </span>
          <span v-if="row.has_video">视频</span>
          <span v-if="!row.has_paper && !row.has_ppt && !row.has_db && !row.has_video">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="price" label="价格" width="90">
        <template #default="{ row }">¥{{ row.price }}</template>
      </el-table-column>
      <el-table-column prop="sales" label="销量" width="72" sortable />
      <el-table-column prop="views" label="浏览" width="72" />
      <el-table-column prop="sort_weight" label="排序" width="68" sortable />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'info'">{{ row.status ? '上架' : '下架' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="质检状态" width="120">
        <template #default="{ row }">
          <el-tag :type="runStatusType(row.run_status)">{{ runStatusText(row.run_status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="qa_note" label="质检备注" min-width="140" show-overflow-tooltip />
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <div class="op-btns">
            <el-button type="primary" size="small" plain @click="openEdit(row)">编辑</el-button>
            <el-button size="small" plain :type="row.status ? 'warning' : 'success'" @click="toggle(row)">{{ row.status ? '下架' : '上架' }}</el-button>
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

    <el-dialog v-model="editVisible" :title="editing ? '编辑商品' : '新建商品'" width="640px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="商品标题" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="编号"><el-input v-model="form.product_no" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分类">
              <el-input v-model="form.category" placeholder="如 课程设计 / 毕业设计" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="技术栈">
              <el-select v-model="form.tech" style="width: 100%">
                <el-option label="SpringBoot" value="SpringBoot" />
                <el-option label="SSM" value="SSM" />
                <el-option label="JSP+Servlet" value="JSP+Servlet" />
                <el-option label="Vue" value="Vue" />
                <el-option label="其他" value="其他" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="质检状态">
              <el-select v-model="form.run_status" style="width: 100%">
                <el-option v-for="(v, k) in RUN_STATUS" :key="k" :label="v.label" :value="Number(k)" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="价格"><el-input-number v-model="form.price" :min="0" :precision="2" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="原价"><el-input-number v-model="form.original_price" :min="0" :precision="2" style="width:100%" /></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="大小(MB)"><el-input-number v-model="form.size_mb" :min="0" style="width: 200px" /></el-form-item>
        <el-form-item label="包含材料">
          <el-checkbox v-model="form.has_paper">论文</el-checkbox>
          <el-checkbox v-model="form.has_ppt">PPT</el-checkbox>
          <el-checkbox v-model="form.has_db">数据库</el-checkbox>
          <el-checkbox v-model="form.has_video">交付含视频教程</el-checkbox>
        </el-form-item>
        <el-divider content-position="left">演示与介绍视频（前台展示，可选）</el-divider>
        <el-form-item label="在线演示">
          <el-input v-model="form.demo_url" placeholder="https:// 演示站点地址，用户点击新窗口打开体验" />
          <div class="field-tip">填写后详情页与列表会出现「在线演示」入口</div>
        </el-form-item>
        <el-form-item label="介绍视频">
          <div class="cover-upload">
            <el-upload
              action="/api/admin/upload/video"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="onVideoUpload"
              :on-error="onVideoError"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              :before-upload="beforeVideoUpload"
            >
              <el-button size="small" type="primary" plain>上传本地视频</el-button>
            </el-upload>
            <el-input v-model="form.video_url" placeholder="或填 B 站 / YouTube / 直链 mp4 地址" />
          </div>
          <div class="field-tip">支持上传 mp4（≤200MB），或粘贴外链；与上方「交付含视频教程」无关</div>
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="质检备注">
          <el-input v-model="form.qa_note" type="textarea" :rows="2" placeholder="如：已验证可运行 / 存在 XX 问题" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="类型">
              <el-select v-model="form.type" style="width: 100%">
                <el-option label="文件夹" value="folder" />
                <el-option label="压缩包" value="archive" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序权重"><el-input-number v-model="form.sort_weight" :min="0" style="width: 100%" /></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="关键词">
          <el-input v-model="form.keywords" placeholder="用于搜索，逗号分隔，如：图书管理,SpringBoot,毕业设计" />
        </el-form-item>
        <el-form-item label="封面图">
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
            <el-input v-model="form.cover" placeholder="/uploads/covers/xxx.png 或 http(s):// 图片地址" />
          </div>
          <div v-if="form.cover" class="cover-preview">
            <img :src="form.cover" alt="封面预览" />
          </div>
        </el-form-item>
        <el-divider content-position="left">自动发货（买家付款后自动发货）</el-divider>
        <el-row :gutter="12">
          <el-col :span="16">
            <el-form-item label="网盘链接">
              <el-input v-model="form.pan_link" placeholder="如 https://pan.baidu.com/s/xxxx" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="提取码"><el-input v-model="form.pan_code" placeholder="如 abcd" /></el-form-item>
          </el-col>
        </el-row>
        <el-divider content-position="left">SEO（公网收录用，留空则用标题）</el-divider>
        <el-form-item label="页面标题">
          <el-input v-model="form.meta_title" placeholder="浏览器标题 / 搜索结果标题（可选）" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="关键词">
              <el-input v-model="form.meta_keywords" placeholder="meta keywords，逗号分隔" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="描述">
              <el-input v-model="form.meta_description" placeholder="meta description 摘要" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="源码路径">
          <el-input v-model="form.source_path" placeholder="D:\...（后台可见，买家不可见）" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="上架" inactive-text="下架" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import http from '../../api';
import { useUserStore } from '../../stores/user';
import { RUN_STATUS, runStatusText, runStatusType } from '../../utils/runStatus';

const userStore = useUserStore();
const uploadHeaders = { Authorization: `Bearer ${userStore.token}` };
const list = ref([]);
const total = ref(0);
const pageSize = 20;
const loading = ref(false);
const techs = ref([]);
const query = reactive({ page: 1, keyword: '', tech: '全部', status: '' });
const selectedIds = ref([]);
const fillingCovers = ref(false);
const coverMissing = ref(0);

const editVisible = ref(false);
const editing = ref(null);
const form = reactive({
  title: '', product_no: '', category: '', tech: 'SpringBoot', price: 99, original_price: 199,
  size_mb: 0, has_paper: false, has_ppt: false, has_db: false, has_video: false,
  description: '', qa_note: '', run_status: 0, cover: '', source_path: '', status: 1,
  type: 'folder', demo_url: '', video_url: '', sort_weight: 0, keywords: '',
  pan_link: '', pan_code: '', meta_title: '', meta_keywords: '', meta_description: ''
});

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/admin/products', { params: { ...query, pageSize } });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

async function loadTechs() {
  const t = await http.get('/products/techs');
  techs.value = t.map((x) => x.tech);
}

function onSearch() { query.page = 1; load(); }
function onPage(p) { query.page = p; load(); }

function beforeCoverUpload(file) {
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 5MB');
    return false;
  }
  return true;
}
function onCoverUpload(res) {
  if (res.url) {
    form.cover = res.url;
    ElMessage.success('封面上传成功');
  }
}
function onCoverError() {
  ElMessage.error('封面上传失败，请重试');
}
function beforeVideoUpload(file) {
  if (file.size > 200 * 1024 * 1024) {
    ElMessage.warning('视频不能超过 200MB');
    return false;
  }
  return true;
}
function onVideoUpload(res) {
  if (res.url) {
    form.video_url = res.url;
    ElMessage.success('视频上传成功');
  }
}
function onVideoError() {
  ElMessage.error('视频上传失败，请重试或改用外链');
}

function openEdit(row) {
  editing.value = row;
  if (row) {
    Object.assign(form, {
      title: row.title, product_no: row.product_no, category: row.category || '', tech: row.tech,
      price: Number(row.price), original_price: Number(row.original_price),
      size_mb: row.size_mb, has_paper: !!row.has_paper, has_ppt: !!row.has_ppt,
      has_db: !!row.has_db, has_video: !!row.has_video,
      description: row.description || '', qa_note: row.qa_note || '', run_status: row.run_status ?? 0,
      cover: row.cover || '', source_path: row.source_path || '', status: row.status,
      type: row.type || 'folder', demo_url: row.demo_url || '', video_url: row.video_url || '',
      sort_weight: row.sort_weight || 0, keywords: row.keywords || '',
      pan_link: row.pan_link || '', pan_code: row.pan_code || '',
      meta_title: row.meta_title || '', meta_keywords: row.meta_keywords || '', meta_description: row.meta_description || ''
    });
  } else {
    Object.assign(form, {
      title: '', product_no: '', category: '', tech: 'SpringBoot', price: 99, original_price: 199,
      size_mb: 0, has_paper: false, has_ppt: false, has_db: false, has_video: false,
      description: '', qa_note: '', run_status: 0,
      cover: '', source_path: '', status: 1,
      type: 'folder', demo_url: '', video_url: '', sort_weight: 0, keywords: '',
      pan_link: '', pan_code: '', meta_title: '', meta_keywords: '', meta_description: ''
    });
  }
  editVisible.value = true;
}

async function save() {
  if (!form.title) return ElMessage.warning('请填写标题');
  const payload = { ...form };
  if (editing.value) {
    await http.put(`/admin/products/${editing.value.id}`, payload);
  } else {
    await http.post('/admin/products', payload);
  }
  ElMessage.success('保存成功');
  editVisible.value = false;
  load();
}

async function toggle(row) {
  await http.post(`/admin/products/${row.id}/toggle`);
  ElMessage.success(row.status ? '已下架' : '已上架');
  load();
}

function onSelectionChange(rows) {
  selectedIds.value = rows.map((r) => r.id);
}

async function batch(action, run_status) {
  if (!selectedIds.value.length) return ElMessage.warning('请先选择商品');
  await http.post('/admin/products/batch', { ids: selectedIds.value, action, run_status });
  ElMessage.success('批量操作成功');
  load();
}

async function loadCoverStats() {
  try {
    const res = await http.get('/admin/products/cover-stats');
    coverMissing.value = res.missing || 0;
  } catch {
    coverMissing.value = 0;
  }
}

async function fillMissingCovers() {
  await ElMessageBox.confirm(
    coverMissing.value
      ? `将为约 ${coverMissing.value} 个无封面商品补图：优先用项目截图，没有则生成占位封面。可能需要一两分钟。`
      : '将扫描并补全缺失封面（含文件丢失）。可能需要一两分钟。',
    '补全缺失封面',
    { type: 'info', confirmButtonText: '开始补全' }
  );
  fillingCovers.value = true;
  try {
    const res = await http.post('/admin/products/fill-covers', { limit: 2000 });
    ElMessage.success(
      `完成：截图 ${res.fromShot || 0}，占位 ${res.placeholder || 0}${res.fail ? `，失败 ${res.fail}` : ''}`
    );
    await Promise.all([load(), loadCoverStats()]);
  } finally {
    fillingCovers.value = false;
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除「${row.title}」？`, '删除确认', { type: 'warning' });
  await http.delete(`/admin/products/${row.id}`);
  ElMessage.success('已删除');
  load();
}

onMounted(() => { load(); loadTechs(); loadCoverStats(); });
</script>

<style scoped>
.cover-upload { display: flex; gap: 8px; width: 100%; }
.cover-upload .el-input { flex: 1; }
.field-tip { margin-top: 6px; font-size: 12px; color: var(--text-3); line-height: 1.5; }
.cover-preview { margin-top: 8px; }
.cover-preview img { width: 120px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); }
.no-cover { color: var(--text-4); font-size: 12px; }
</style>
