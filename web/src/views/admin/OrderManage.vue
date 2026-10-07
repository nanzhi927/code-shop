<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">订单管理</h2>
      <div class="filters">
        <el-input v-model="query.orderNo" placeholder="订单号" clearable style="width: 200px" @keyup.enter="onSearch" />
        <el-select v-model="query.status" style="width: 140px" @change="onSearch">
          <el-option label="全部状态" value="全部" />
          <el-option label="待支付" value="pending" />
          <el-option label="已支付" value="paid" />
          <el-option label="已发货" value="shipped" />
          <el-option label="已完成" value="completed" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button type="success" :disabled="!selectedIds.length" @click="openBatchShip">批量发货</el-button>
        <el-button type="success" plain @click="exportCsv">导出 CSV</el-button>
      </div>
    </div>

    <div class="admin-panel">
    <el-table ref="tableRef" :data="list" v-loading="loading" @selection-change="onSelectionChange">
      <el-table-column type="selection" width="48" :selectable="canSelect" />
      <el-table-column prop="order_no" label="订单号" width="170" />
      <el-table-column prop="username" label="买家" width="100" />
      <el-table-column label="商品" min-width="220">
        <template #default="{ row }">
          <div v-for="it in row.items" :key="it.id" class="oi">{{ it.product_title }} ×1</div>
        </template>
      </el-table-column>
      <el-table-column prop="total_amount" label="金额" width="90">
        <template #default="{ row }">¥{{ row.total_amount }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="下单时间" width="160" />
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <div class="op-btns">
            <el-button v-if="row.status === 'paid'" type="primary" size="small" @click="openShip(row)">发货</el-button>
            <el-button v-if="row.status === 'shipped'" type="primary" size="small" plain @click="openShip(row)">修改发货</el-button>
            <el-button size="small" plain @click="viewDetail(row)">详情</el-button>
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
    <el-dialog v-model="batchShipVisible" title="批量发货" width="520px">
      <el-form label-position="top">
        <el-form-item label="发货方式">
          <el-select v-model="batchShipMethod" style="width: 100%">
            <el-option label="QQ" value="qq" />
            <el-option label="微信" value="wechat" />
            <el-option label="网盘" value="pan" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="发货信息（网盘链接 / 客服QQ / 备注）">
          <el-input v-model="batchShipInfo" type="textarea" :rows="5" placeholder="批量发货将使用相同的发货信息" />
        </el-form-item>
        <p class="batch-tip">已选 {{ selectedIds.length }} 单（仅已支付订单可选）</p>
      </el-form>
      <template #footer>
        <el-button @click="batchShipVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchShipping" @click="doBatchShip">确认发货</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="shipVisible" title="手动发货" width="520px">
      <el-form label-position="top">
        <el-form-item label="发货方式">
          <el-select v-model="shipMethod" style="width: 100%">
            <el-option label="QQ" value="qq" />
            <el-option label="微信" value="wechat" />
            <el-option label="网盘" value="pan" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="发货信息（网盘链接 / 客服QQ / 备注）">
          <el-input v-model="shipInfo" type="textarea" :rows="5" placeholder="例如：百度网盘链接: https://pan.baidu.com/... 提取码: abcd  \n解压密码: 123456" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shipVisible = false">取消</el-button>
        <el-button type="primary" @click="doShip">确认发货</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="订单详情" width="560px">
      <template v-if="detailOrder">
        <p><b>订单号：</b>{{ detailOrder.order_no }}</p>
        <p><b>买家：</b>{{ detailOrder.username }}</p>
        <p><b>金额：</b>¥{{ detailOrder.total_amount }}</p>
        <p><b>状态：</b>{{ statusText(detailOrder.status) }}</p>
        <p><b>支付方式：</b>{{ detailOrder.pay_method || '—' }}</p>
        <p><b>下单时间：</b>{{ detailOrder.created_at }}</p>
        <p v-if="detailOrder.items?.length"><b>商品：</b></p>
        <div v-if="detailOrder.items?.length" class="oi-list">
          <div v-for="it in detailOrder.items" :key="it.id" class="oi">{{ it.product_title }} ×{{ it.quantity || 1 }} <span>¥{{ it.price }}</span></div>
        </div>
        <p v-if="detailOrder.shipping_info"><b>发货信息：</b></p>
        <p v-if="detailOrder.shipping_info" class="ship">{{ detailOrder.shipping_info }}</p>
        <p v-if="detailOrder.deliveries?.length"><b>发货记录：</b></p>
        <div v-for="d in detailOrder.deliveries" :key="d.id || d.created_at" class="delivery">
          <p class="ship">{{ d.content }}</p>
          <p class="delivery-meta">{{ d.created_at }}<span v-if="d.method"> · {{ METHOD_TEXT[d.method] || d.method }}</span></p>
        </div>
        <p v-if="!detailOrder.items?.length && !detailOrder.deliveries?.length && !detailOrder.shipping_info" class="empty-tip">暂无更多信息</p>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../../api';
import { statusText, statusType } from '../../utils/orderStatus';

const list = ref([]);
const total = ref(0);
const pageSize = 20;
const loading = ref(false);
const query = reactive({ page: 1, orderNo: '', status: '全部' });

const shipVisible = ref(false);
const shipOrder = ref(null);
const shipInfo = ref('');
const shipMethod = ref('pan');

const tableRef = ref(null);
const selectedIds = ref([]);
const batchShipVisible = ref(false);
const batchShipInfo = ref('');
const batchShipMethod = ref('pan');
const batchShipping = ref(false);

const detailVisible = ref(false);
const detailOrder = ref(null);

const METHOD_TEXT = { qq: 'QQ', wechat: '微信', pan: '网盘', other: '其他' };

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/admin/orders', { params: { ...query, pageSize } });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}
function onSearch() { query.page = 1; load(); }
function onPage(p) { query.page = p; load(); }

function canSelect(row) {
  return row.status === 'paid';
}

function onSelectionChange(rows) {
  selectedIds.value = rows.map((r) => r.id);
}

function openBatchShip() {
  if (!selectedIds.value.length) return ElMessage.warning('请选择已支付订单');
  batchShipInfo.value = '';
  batchShipMethod.value = 'pan';
  batchShipVisible.value = true;
}

async function doBatchShip() {
  if (!batchShipInfo.value) return ElMessage.warning('请填写发货信息');
  batchShipping.value = true;
  try {
    const res = await http.post('/admin/orders/batch-ship', {
      orderIds: selectedIds.value,
      shipping_info: batchShipInfo.value,
      method: batchShipMethod.value
    });
    ElMessage.success(`已发货 ${res.shipped || 0} 单`);
    batchShipVisible.value = false;
    selectedIds.value = [];
    tableRef.value?.clearSelection();
    load();
  } finally {
    batchShipping.value = false;
  }
}

function openShip(row) {
  shipOrder.value = row;
  shipInfo.value = row.shipping_info || '';
  shipMethod.value = 'pan';
  shipVisible.value = true;
}

async function doShip() {
  if (!shipInfo.value) return ElMessage.warning('请填写发货信息');
  const id = shipOrder.value.id;
  const payload = { shipping_info: shipInfo.value, method: shipMethod.value };
  if (shipOrder.value.status === 'paid') {
    await http.post(`/admin/orders/${id}/ship`, payload);
  } else {
    await http.post(`/admin/orders/${id}/reship`, payload);
  }
  ElMessage.success('发货成功');
  shipVisible.value = false;
  load();
}

async function viewDetail(row) {
  detailVisible.value = true;
  try {
    detailOrder.value = await http.get(`/admin/orders/${row.id}`);
  } catch {
    detailOrder.value = row;
  }
}

async function exportCsv() {
  const blob = await http.get('/admin/orders/export', {
    params: { status: query.status, orderNo: query.orderNo },
    responseType: 'blob'
  });
  downloadBlob(blob, `orders_${Date.now()}.csv`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(load);
</script>

<style scoped>
.oi { font-size: 13px; color: var(--text-2); }
.oi-list { padding-left: 14px; margin-bottom: 8px; }
.ship { white-space: pre-wrap; color: var(--text-2); line-height: 1.8; background: var(--bg-alt); padding: 10px; border-radius: 8px; }
.delivery { margin-bottom: 8px; }
.delivery-meta { font-size: 12px; color: var(--text-3); margin-top: 4px; }
.empty-tip { color: var(--text-3); }
.batch-tip { font-size: 13px; color: var(--text-3); margin: 0; }
</style>
