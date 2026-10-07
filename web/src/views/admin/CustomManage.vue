<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">定制工单管理</h2>
      <el-select v-model="status" placeholder="状态" clearable @change="load" style="width:140px">
        <el-option label="全部" value="全部" />
        <el-option v-for="s in statuses" :key="s" :label="s" :value="s" />
      </el-select>
    </div>

    <el-collapse v-model="tplCollapse" class="tpl-collapse admin-panel">
      <el-collapse-item title="报价模板" name="templates">
        <div v-if="templates.length" class="tpl-list">
          <div v-for="(t, i) in templates" :key="i" class="tpl-item">
            <span class="tpl-name">{{ t.name }}</span>
            <span class="tpl-meta">{{ t.tech || '—' }} · ¥{{ t.price }} · {{ t.deadline || '—' }}</span>
            <span v-if="t.note" class="tpl-note">{{ t.note }}</span>
            <el-button size="small" type="danger" plain @click="removeTemplate(i)">删除</el-button>
          </div>
        </div>
        <el-empty v-else description="暂无模板" :image-size="60" />
        <div class="tpl-form">
          <el-input v-model="tplForm.name" placeholder="模板名称" style="width:120px" />
          <el-input v-model="tplForm.tech" placeholder="技术栈" style="width:100px" />
          <el-input-number v-model="tplForm.price" :min="0" placeholder="报价" style="width:110px" />
          <el-input v-model="tplForm.deadline" placeholder="交付周期" style="width:100px" />
          <el-input v-model="tplForm.note" placeholder="备注" style="width:140px" />
          <el-button type="primary" size="small" @click="addTemplate">添加模板</el-button>
        </div>
      </el-collapse-item>
    </el-collapse>

    <div class="admin-panel">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="order_no" label="工单号" width="160" />
        <el-table-column prop="username" label="客户" width="110" />
        <el-table-column prop="title" label="需求" min-width="200" show-overflow-tooltip />
        <el-table-column prop="tech" label="技术栈" width="120" />
        <el-table-column label="预算" width="80"><template #default="{ row }">¥{{ row.budget }}</template></el-table-column>
        <el-table-column label="报价" width="80"><template #default="{ row }">¥{{ row.quote_price }}</template></el-table-column>
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag size="small">{{ row.status }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="open(row)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-drawer v-model="visible" title="工单处理" size="540px" direction="rtl">
      <div v-if="d" class="d">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="工单号">{{ d.order_no }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ d.username }}</el-descriptions-item>
          <el-descriptions-item label="需求">{{ d.title }}</el-descriptions-item>
          <el-descriptions-item label="描述">{{ d.description }}</el-descriptions-item>
          <el-descriptions-item label="技术栈">{{ d.tech }}</el-descriptions-item>
          <el-descriptions-item label="预算">¥{{ d.budget }}</el-descriptions-item>
          <el-descriptions-item label="期望">{{ d.deadline }}</el-descriptions-item>
        </el-descriptions>

        <h4 class="blk">报价与状态</h4>
        <div class="quote-row">
          <el-select v-if="templates.length" v-model="selectedTpl" placeholder="从模板带入" clearable style="width:160px" @change="applyTemplate">
            <el-option v-for="(t, i) in templates" :key="i" :label="t.name" :value="i" />
          </el-select>
          <el-input-number v-model="quote.price" :min="0" placeholder="报价" style="width:140px" />
          <el-input v-model="quote.deadline" placeholder="交付周期" style="width:140px" />
          <el-button type="primary" @click="sendQuote">发送报价</el-button>
        </div>
        <div class="quote-row">
          <el-input v-model="quote.note" placeholder="备注（可选）" style="flex:1" />
        </div>
        <div class="quote-row">
          <el-select v-model="quote.status" style="width:180px">
            <el-option v-for="s in statuses" :key="s" :label="s" :value="s" />
          </el-select>
          <el-button @click="setStatus">更新状态</el-button>
        </div>

        <h4 class="blk">沟通记录</h4>
        <div class="msgs">
          <div v-for="m in d.messages" :key="m.id" class="msg" :class="m.from_role">
            <div class="bubble">{{ m.content }}</div>
            <div class="t">{{ m.from_role === 'admin' ? '客服' : '客户' }} · {{ m.created_at }}</div>
          </div>
        </div>
        <div class="reply">
          <el-input v-model="reply" type="textarea" :rows="2" placeholder="回复客户" />
          <el-button type="primary" @click="sendReply">发送</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../../api';

const list = ref([]);
const loading = ref(false);
const status = ref('全部');
const statuses = ['pending_quote','quoted','accepted','in_progress','delivered','completed','cancelled'];
const visible = ref(false);
const d = ref(null);
const quote = reactive({ price: 0, deadline: '', status: '', note: '' });
const reply = ref('');

const tplCollapse = ref(['templates']);
const templates = ref([]);
const tplForm = reactive({ name: '', tech: '', price: 0, deadline: '', note: '' });
const selectedTpl = ref(null);

async function loadTemplates() {
  try {
    const res = await http.get('/services/admin/custom/templates');
    templates.value = res.list || [];
  } catch { templates.value = []; }
}

async function addTemplate() {
  if (!tplForm.name.trim()) return ElMessage.warning('请填写模板名称');
  await http.post('/services/admin/custom/templates', { ...tplForm });
  ElMessage.success('模板已添加');
  Object.assign(tplForm, { name: '', tech: '', price: 0, deadline: '', note: '' });
  loadTemplates();
}

async function removeTemplate(index) {
  await http.delete('/services/admin/custom/templates', { params: { index } });
  ElMessage.success('已删除');
  loadTemplates();
}

function applyTemplate(idx) {
  if (idx == null || idx === '') return;
  const t = templates.value[idx];
  if (!t) return;
  quote.price = t.price || 0;
  quote.deadline = t.deadline || '';
  quote.note = t.note || '';
}

async function load() {
  loading.value = true;
  try { const res = await http.get('/services/admin/custom', { params: { status: status.value } }); list.value = res.list; } finally { loading.value = false; }
}
async function open(row) {
  d.value = await http.get(`/services/admin/custom/${row.id}`);
  quote.price = d.value.quote_price || 0; quote.deadline = d.value.deadline || ''; quote.status = d.value.status;
  quote.note = '';
  selectedTpl.value = null;
  reply.value = '';
  visible.value = true;
}
async function sendQuote() {
  await http.post(`/services/admin/custom/${d.value.id}/quote`, { quote_price: quote.price, deadline: quote.deadline });
  if (quote.note.trim()) {
    await http.post(`/services/admin/custom/${d.value.id}/message`, { content: quote.note });
  }
  ElMessage.success('已报价'); reload();
}
async function setStatus() {
  await http.post(`/services/admin/custom/${d.value.id}/status`, { status: quote.status });
  ElMessage.success('状态已更新'); reload();
}
async function sendReply() {
  if (!reply.value.trim()) return;
  await http.post(`/services/admin/custom/${d.value.id}/message`, { content: reply.value });
  reply.value = ''; reload();
}
async function reload() { d.value = await http.get(`/services/admin/custom/${d.value.id}`); load(); }
onMounted(() => { load(); loadTemplates(); });
</script>

<style scoped>
.tpl-collapse { margin-bottom: 16px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); }
.tpl-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.tpl-item { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 13px; padding: 8px 12px; background: var(--bg-alt); border-radius: 6px; }
.tpl-name { font-weight: 700; color: var(--text-1); }
.tpl-meta { color: var(--text-3); }
.tpl-note { color: var(--text-2); flex: 1; }
.tpl-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.d { padding: 0 4px; }
.blk { margin: 18px 0 10px; font-size: 15px; }
.quote-row { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.msgs { display: flex; flex-direction: column; gap: 10px; max-height: 220px; overflow: auto; }
.msg.user { align-items: flex-end; }
.bubble { max-width: 80%; padding: 8px 12px; border-radius: 10px; font-size: 13px; word-break: break-all; }
.msg.admin .bubble { background: var(--bg-alt); border: 1px solid var(--border); }
.msg.user .bubble { background: var(--brand-grad); color: #fff; }
.t { font-size: 11px; color: var(--text-4); }
.reply { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
</style>
