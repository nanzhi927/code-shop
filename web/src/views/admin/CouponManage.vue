<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">优惠券管理</h2>
      <div class="toolbar-actions">
        <el-button :loading="genTestLoading" @click="genTestCoupons">一键生成测试券</el-button>
        <el-button type="primary" @click="openCreate">生成优惠券</el-button>
      </div>
    </div>

    <div class="admin-panel">
    <el-table :data="list" v-loading="loading">
      <el-table-column prop="code" label="券码" width="140" />
      <el-table-column prop="name" label="名称" width="120" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">{{ row.type === 'full' ? '满减' : '折扣' }}</template>
      </el-table-column>
      <el-table-column label="面额" width="90">
        <template #default="{ row }">
          {{ row.type === 'full' ? `¥${row.amount}` : `${row.amount * 10}折` }}
        </template>
      </el-table-column>
      <el-table-column label="门槛" width="90">
        <template #default="{ row }">{{ row.threshold > 0 ? `¥${row.threshold}` : '无' }}</template>
      </el-table-column>
      <el-table-column label="库存" width="80">
        <template #default="{ row }">{{ row.stock === -1 ? '不限' : row.stock }}</template>
      </el-table-column>
      <el-table-column prop="per_user" label="每人限领" width="90" />
      <el-table-column label="适用范围" width="140">
        <template #default="{ row }">
          <div v-if="row.scope_tech || row.scope_category" class="scope-text">
            <span v-if="row.scope_tech">栈:{{ row.scope_tech }}</span>
            <span v-if="row.scope_category">类:{{ row.scope_category }}</span>
          </div>
          <span v-else class="scope-text muted">不限</span>
        </template>
      </el-table-column>
      <el-table-column prop="claimed_count" label="已领" width="70" />
      <el-table-column prop="used_count" label="已用" width="70" />
      <el-table-column prop="expires_at" label="有效期" width="160">
        <template #default="{ row }">{{ row.expires_at || '—' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-switch
            :model-value="!!row.enabled"
            @change="(v) => toggleEnabled(row, v)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="生成时间" width="160">
        <template #default="{ row }">{{ row.created_at || '—' }}</template>
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

    <el-dialog v-model="createVisible" title="生成优惠券" width="520px">
      <el-form label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如 新用户满减券" />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="满减" value="full" />
            <el-option label="折扣" value="discount" />
          </el-select>
        </el-form-item>
        <el-form-item :label="form.type === 'full' ? '减免金额' : '折扣值'" required>
          <el-input-number
            v-model="form.amount"
            :min="form.type === 'discount' ? 0.01 : 1"
            :max="form.type === 'discount' ? 1 : undefined"
            :precision="form.type === 'discount' ? 2 : 2"
            :step="form.type === 'discount' ? 0.05 : 1"
            style="width: 100%"
          />
          <div v-if="form.type === 'discount'" class="form-tip">0-1 之间，如 0.9 表示 9 折</div>
        </el-form-item>
        <el-form-item label="满减门槛">
          <el-input-number v-model="form.threshold" :min="0" :precision="2" style="width: 100%" />
          <div class="form-tip">0 表示无门槛</div>
        </el-form-item>
        <el-form-item label="库存">
          <el-input-number v-model="form.stock" :min="-1" style="width: 100%" />
          <div class="form-tip">-1 表示不限</div>
        </el-form-item>
        <el-form-item label="每人限领">
          <el-input-number v-model="form.per_user" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="有效期">
          <el-date-picker
            v-model="form.expires_at"
            type="datetime"
            placeholder="可选"
            style="width: 100%"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="生成数量">
          <el-input-number v-model="form.count" :min="1" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="适用技术栈">
          <el-input v-model="form.scope_tech" placeholder="留空不限" />
        </el-form-item>
        <el-form-item label="适用分类">
          <el-input v-model="form.scope_category" placeholder="留空不限" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="doCreate">生成</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="codesVisible" title="生成成功" width="480px">
      <el-alert type="success" :closable="false" title="优惠券已生成，请妥善保存券码" />
      <pre class="codes-block">{{ generatedCodes.join('\n') }}</pre>
      <template #footer>
        <el-button @click="codesVisible = false">关闭</el-button>
        <el-button type="primary" @click="copyCodes">复制券码</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../../api';

const list = ref([]);
const total = ref(0);
const pageSize = 20;
const page = ref(1);
const loading = ref(false);

const createVisible = ref(false);
const creating = ref(false);
const codesVisible = ref(false);
const generatedCodes = ref([]);
const genTestLoading = ref(false);

const form = reactive({
  name: '',
  type: 'full',
  amount: 10,
  threshold: 0,
  stock: -1,
  per_user: 1,
  expires_at: '',
  count: 1,
  scope_tech: '',
  scope_category: ''
});

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/admin/coupons', { params: { page: page.value, pageSize } });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}
function onPage(p) { page.value = p; load(); }

function openCreate() {
  Object.assign(form, {
    name: '',
    type: 'full',
    amount: 10,
    threshold: 0,
    stock: -1,
    per_user: 1,
    expires_at: '',
    count: 1,
    scope_tech: '',
    scope_category: ''
  });
  createVisible.value = true;
}

async function doCreate() {
  if (!form.name.trim()) return ElMessage.warning('请填写名称');
  creating.value = true;
  try {
    const payload = { ...form };
    if (!payload.expires_at) delete payload.expires_at;
    const res = await http.post('/admin/coupons', payload);
    createVisible.value = false;
    generatedCodes.value = res.codes || [];
    codesVisible.value = true;
    load();
  } finally {
    creating.value = false;
  }
}

async function toggleEnabled(row, enabled) {
  await http.put(`/admin/coupons/${row.id}`, { enabled });
  row.enabled = enabled;
  ElMessage.success('已更新');
}

async function genTestCoupons() {
  genTestLoading.value = true;
  try {
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    const expiresAt = expires.toISOString().slice(0, 19).replace('T', ' ');
    const specs = [
      { name: '测试满50减10', type: 'full', amount: 10, threshold: 50, stock: 100, per_user: 1, expires_at: expiresAt, count: 1 },
      { name: '测试满100减20', type: 'full', amount: 20, threshold: 100, stock: 100, per_user: 1, expires_at: expiresAt, count: 1 },
      { name: '测试9折券', type: 'discount', amount: 0.9, threshold: 0, stock: 100, per_user: 1, expires_at: expiresAt, count: 1 },
      { name: '测试满30减5', type: 'full', amount: 5, threshold: 30, stock: 100, per_user: 1, expires_at: expiresAt, count: 1 },
      { name: '测试85折券', type: 'discount', amount: 0.85, threshold: 50, stock: 100, per_user: 1, expires_at: expiresAt, count: 1 }
    ];
    const codes = [];
    for (const s of specs) {
      const res = await http.post('/admin/coupons', s);
      codes.push(...(res.codes || []));
    }
    generatedCodes.value = codes;
    codesVisible.value = true;
    ElMessage.success('已生成 5 张测试券（有效期 7 天）');
    load();
  } finally {
    genTestLoading.value = false;
  }
}

async function copyCodes() {
  const text = generatedCodes.value.join('\n');
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  }
  ElMessage.success('已复制');
}

onMounted(load);
</script>

<style scoped>
.form-tip { font-size: 12px; color: var(--text-3); margin-top: 4px; }
.codes-block {
  margin-top: 14px; background: var(--bg-alt); border-radius: 8px; padding: 12px;
  font-size: 13px; line-height: 1.8; max-height: 240px; overflow: auto;
}
.scope-text { font-size: 12px; color: var(--text-2); line-height: 1.5; display: flex; flex-direction: column; }
.scope-text.muted { color: var(--text-3); }
</style>
