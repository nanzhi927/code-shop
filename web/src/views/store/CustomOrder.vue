<template>
  <div class="page-container">
    <div class="head">
      <h2 class="page-title">定制开发工单</h2>
      <el-button type="primary" @click="openCreate">提交新需求</el-button>
    </div>

    <div v-loading="loading">
      <div v-if="list.length" class="co-list">
        <div v-for="o in list" :key="o.id" class="co-card hover-lift" @click="openDetail(o)">
          <div class="co-top">
            <span class="co-no">{{ o.order_no }}</span>
            <el-tag :type="statusType(o.status)">{{ statusText(o.status) }}</el-tag>
          </div>
          <h3 class="co-title">{{ o.title }}</h3>
          <div class="co-meta">
            <span v-if="o.tech">{{ o.tech }}</span>
            <span v-if="o.budget">预算 ¥{{ o.budget }}</span>
            <span v-if="o.deadline">期望 {{ o.deadline }}</span>
            <span v-if="o.quote_price">报价 ¥{{ o.quote_price }}</span>
          </div>
        </div>
      </div>
      <el-empty v-else-if="!loading" description="暂无工单">
        <template #image>
          <div class="empty-illus" style="padding: 12px 0 0"><div class="ei-icon">🛠</div></div>
        </template>
        <template #description>
          <p style="margin:0 0 4px;font-weight:650;color:var(--text-2)">暂无工单</p>
          <p style="margin:0;color:var(--text-3);font-size:13px">点击右上角提交需求</p>
        </template>
      </el-empty>
    </div>

    <el-dialog v-model="createVisible" title="提交定制需求" width="560px" class="mobile-dialog">
      <el-form :model="form" label-width="90px" label-position="top">
        <el-form-item label="需求标题" required><el-input v-model="form.title" placeholder="如：基于 SpringBoot 的 XX 系统" /></el-form-item>
        <el-form-item label="技术栈"><el-input v-model="form.tech" placeholder="如 SpringBoot+Vue / SSM" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="预算"><el-input-number v-model="form.budget" :min="0" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="期望交付"><el-input v-model="form.deadline" placeholder="如 7 天内" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="需求描述" required><el-input v-model="form.description" type="textarea" :rows="4" placeholder="功能模块、技术要求、参考项目等" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreate">提交</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" :title="detail?.title || '工单详情'" size="520px" direction="rtl">
      <div v-if="detail" class="detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="工单号">{{ detail.order_no }}</el-descriptions-item>
          <el-descriptions-item label="状态"><el-tag :type="statusType(detail.status)">{{ statusText(detail.status) }}</el-tag></el-descriptions-item>
          <el-descriptions-item label="技术栈">{{ detail.tech || '—' }}</el-descriptions-item>
          <el-descriptions-item label="预算">¥{{ detail.budget || 0 }}</el-descriptions-item>
          <el-descriptions-item label="报价">¥{{ detail.quote_price || 0 }}</el-descriptions-item>
          <el-descriptions-item label="期望交付">{{ detail.deadline || '—' }}</el-descriptions-item>
        </el-descriptions>
        <div class="msgs">
          <div v-for="m in detail.messages" :key="m.id" class="msg" :class="m.from_role">
            <div class="msg-role">{{ m.from_role === 'admin' ? '客服' : '我' }}</div>
            <div class="msg-bubble">{{ m.content }}</div>
            <div class="msg-time">{{ m.created_at }}</div>
          </div>
        </div>
        <div v-if="detail.status === 'quoted'" class="accept-bar">
          <el-button type="primary" @click="acceptQuote">接受报价</el-button>
        </div>
        <div class="reply">
          <el-input v-model="reply" type="textarea" :rows="2" placeholder="补充说明 / 追问" />
          <el-button type="primary" @click="sendReply">发送</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import http from '../../api';
import { setSeo } from '../../composables/useSeo';

const route = useRoute();
const list = ref([]);
const loading = ref(false);
const createVisible = ref(false);
const submitting = ref(false);
const form = reactive({ title: '', tech: '', budget: 0, deadline: '', description: '' });
const detailVisible = ref(false);
const detail = ref(null);
const reply = ref('');

const ST = { pending_quote:'待报价', quoted:'已报价', accepted:'已接受', in_progress:'开发中', delivered:'已交付', completed:'已完成', cancelled:'已取消' };
const STT = { pending_quote:'info', quoted:'warning', accepted:'primary', in_progress:'primary', delivered:'success', completed:'success', cancelled:'danger' };
function statusText(s){ return ST[s]||s; }
function statusType(s){ return STT[s]||'info'; }

async function load() {
  loading.value = true;
  try { list.value = await http.get('/services/custom/mine'); } finally { loading.value = false; }
}
function openCreate(pref = null) {
  Object.assign(form, {
    title: pref?.title || '',
    tech: pref?.tech || '',
    budget: 0,
    deadline: '',
    description: pref?.description || ''
  });
  createVisible.value = true;
}
async function submitCreate() {
  if (!form.title || !form.description) return ElMessage.warning('请填写标题与描述');
  submitting.value = true;
  try { await http.post('/services/custom', form); ElMessage.success('已提交，客服将尽快报价'); createVisible.value = false; load(); } finally { submitting.value = false; }
}
async function openDetail(o) {
  detail.value = await http.get(`/services/custom/${o.id}`);
  reply.value = '';
  detailVisible.value = true;
}
async function acceptQuote() {
  await http.post(`/services/custom/${detail.value.id}/accept`);
  ElMessage.success('已接受报价，进入开发');
  detail.value = await http.get(`/services/custom/${detail.value.id}`);
  load();
}
async function sendReply() {
  if (!reply.value.trim()) return;
  await http.post(`/services/custom/${detail.value.id}/message`, { content: reply.value });
  reply.value = '';
  detail.value = await http.get(`/services/custom/${detail.value.id}`);
}
onMounted(() => {
  setSeo({
    title: '定制开发 - 毕业设计 / 课程设计定制',
    description: '提交毕业设计、毕设、课程设计定制需求，按技术栈与功能点一对一定制开发。',
    keywords: '定制开发,毕业设计定制,毕设定制,课程设计'
  });
  load();
  const q = route.query || {};
  if (q.title || q.description || q.tech) {
    openCreate({
      title: String(q.title || ''),
      tech: String(q.tech || ''),
      description: String(q.description || '')
    });
  }
});
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin: 16px 0; gap: 12px; flex-wrap: wrap; }
.page-title { margin: 0; }
.co-list { display: flex; flex-direction: column; gap: 12px; }
.co-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 16px 20px; cursor: pointer; box-shadow: var(--shadow-card);
}
.co-top { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-3); }
.co-title { font-size: 15px; margin: 8px 0; font-weight: 700; }
.co-meta { font-size: 13px; color: var(--text-3); display: flex; gap: 14px; flex-wrap: wrap; }
.detail { padding: 0 4px; }
.msgs { margin: 16px 0; display: flex; flex-direction: column; gap: 12px; }
.msg { display: flex; flex-direction: column; }
.msg.user { align-items: flex-end; }
.msg.admin { align-items: flex-start; }
.msg-role { font-size: 11px; color: var(--text-3); margin-bottom: 2px; }
.msg-bubble { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.6; word-break: break-all; }
.msg.user .msg-bubble { background: var(--brand-grad); color: #fff; }
.msg.admin .msg-bubble { background: var(--bg-alt); border: 1px solid var(--border); }
.msg-time { font-size: 11px; color: var(--text-4); margin-top: 2px; }
.accept-bar { margin: 8px 0 16px; }
.reply { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }

@media (max-width: 768px) {
  .head { margin: 12px 0; }
  .head .el-button { width: 100%; }
  .co-card { padding: 14px; }
  .msg-bubble { max-width: 92%; }
}
</style>
