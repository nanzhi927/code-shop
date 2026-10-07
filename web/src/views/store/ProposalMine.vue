<template>
  <div class="page-container mine-page">
    <div class="head">
      <h1 class="page-title">我的开题</h1>
      <el-button type="primary" @click="$router.push('/services/proposal')">新建开题</el-button>
    </div>

    <div v-loading="loading">
      <div v-if="list.length" class="list">
        <div v-for="item in list" :key="item.id" class="card" @click="open(item)">
          <div class="top">
            <span class="no">{{ item.session_no }}</span>
            <el-tag size="small" :type="statusType(item.status)">{{ statusText(item.status) }}</el-tag>
          </div>
          <h3>{{ item.title || '未命名开题' }}</h3>
          <div class="meta">
            <span>{{ modeText(item.mode) }}</span>
            <span>{{ item.updated_at || item.created_at }}</span>
          </div>
        </div>
      </div>
      <el-empty v-else-if="!loading" description="还没有开题记录">
        <el-button type="primary" @click="$router.push('/services/proposal')">去开题</el-button>
      </el-empty>
    </div>

    <el-drawer v-model="detailVisible" :title="detail?.profile?.title || '开题详情'" size="560px" direction="rtl">
      <div v-if="detail" class="detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="编号">{{ detail.session_no }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusText(detail.status) }}</el-descriptions-item>
          <el-descriptions-item label="模式">{{ modeText(detail.mode) }}</el-descriptions-item>
          <el-descriptions-item label="技术栈">{{ detail.profile?.tech || '—' }}</el-descriptions-item>
        </el-descriptions>
        <div class="detail-actions">
          <el-button type="primary" @click="goWizard">继续编辑 / 重新生成</el-button>
          <el-button v-if="detail.content_md" @click="copy">复制正文</el-button>
          <el-button v-if="detail.content_md" @click="exportDocx">导出 Word</el-button>
        </div>
        <article v-if="detail.content_md" class="preview">{{ detail.content_md }}</article>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import http from '../../api';
import { setSeo } from '../../composables/useSeo';

const router = useRouter();
const loading = ref(false);
const list = ref([]);
const detailVisible = ref(false);
const detail = ref(null);

const ST = { draft: '草稿', ready: '待生成', generating: '生成中', done: '已完成', failed: '失败' };
const STT = { draft: 'info', ready: 'warning', generating: 'primary', done: 'success', failed: 'danger' };
function statusText(s) { return ST[s] || s; }
function statusType(s) { return STT[s] || 'info'; }
function modeText(m) {
  return ({ qa: '问答', template: '模板', hybrid: '问答+模板' })[m] || m || '问答';
}

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/proposal/mine');
    list.value = res.list || [];
  } finally {
    loading.value = false;
  }
}

async function open(item) {
  detail.value = (await http.get(`/proposal/sessions/${item.id}`)).session;
  detailVisible.value = true;
}

function goWizard() {
  router.push('/services/proposal');
}

async function copy() {
  const t = detail.value?.content_md || '';
  if (!t) return;
  await navigator.clipboard.writeText(t);
  ElMessage.success('已复制');
}

async function exportDocx() {
  if (!detail.value?.id) return;
  const token = localStorage.getItem('token') || '';
  const res = await fetch(`/api/proposal/sessions/${detail.value.id}/export.docx`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) return ElMessage.error('导出失败');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(detail.value.profile?.title || '开题报告').slice(0, 40)}.docx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

onMounted(() => {
  setSeo({
    title: '我的开题 - 毕设源码商城',
    description: '查看已生成的毕业设计 / 毕设开题报告记录。',
    keywords: '我的开题,毕业设计,毕设开题'
  });
  load();
});
</script>

<style scoped>
.mine-page { padding: 16px 0 56px; max-width: 880px; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 22px; }
.list { display: flex; flex-direction: column; gap: 10px; }
.card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 14px 16px; cursor: pointer; transition: border-color .2s;
}
.card:hover { border-color: var(--ink); }
.top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.no { font-size: 12px; color: var(--text-4); font-weight: 600; }
.card h3 { margin: 0 0 8px; font-size: 15.5px; }
.meta { display: flex; gap: 14px; font-size: 12.5px; color: var(--text-3); }
.detail-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
.preview {
  white-space: pre-wrap; font-size: 13.5px; line-height: 1.7; color: var(--text-2);
  background: var(--bg-alt); border: 1px solid var(--border); border-radius: 12px; padding: 12px;
  max-height: 55vh; overflow: auto;
}
</style>
