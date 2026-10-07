<template>
  <div class="page-container">
    <h2 class="page-title">分销返佣</h2>

    <div class="stats">
      <div class="stat"><b>{{ info.code || '—' }}</b><span>我的推广码</span></div>
      <div class="stat"><b>{{ info.invitedCount || 0 }}</b><span>邀请人数</span></div>
      <div class="stat"><b>¥{{ info.totalCommission || 0 }}</b><span>累计返佣</span></div>
      <div class="stat"><b>¥{{ info.settled || 0 }}</b><span>已结算</span></div>
    </div>

    <el-card class="link-card">
      <template #header>我的推广链接</template>
      <div class="link-row">
        <el-input :model-value="info.link" readonly />
        <el-button type="primary" @click="copy(info.link)">复制链接</el-button>
        <el-button @click="copy(info.code)">复制推广码</el-button>
      </div>
      <p class="tip">分享链接给同学/朋友，TA 下单后你自动获得订单金额 10% 返佣。</p>
    </el-card>

    <h3 class="sub-title">返佣记录</h3>
    <el-table :data="commissions" border stripe>
      <el-table-column prop="order_no" label="订单号" min-width="150" />
      <el-table-column prop="buyer" label="买家" width="120" />
      <el-table-column label="返佣" width="100"><template #default="{ row }">¥{{ row.amount }}</template></el-table-column>
      <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag size="small" :type="row.status==='settled'?'success':'info'">{{ row.status==='settled'?'已结算':'待结算' }}</el-tag></template></el-table-column>
      <el-table-column label="时间" min-width="160"><template #default="{ row }">{{ row.created_at }}</template></el-table-column>
    </el-table>
    <el-empty v-if="!commissions.length" description="暂无返佣记录">
      <template #image>
        <div class="empty-illus" style="padding: 12px 0 0"><div class="ei-icon">🎁</div></div>
      </template>
      <template #description>
        <p style="margin:0;color:var(--text-3);font-size:13px">暂无返佣记录，快去分享吧</p>
      </template>
    </el-empty>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../../api';

const info = ref({});
const commissions = ref([]);

async function load() {
  info.value = await http.get('/services/referral');
  commissions.value = await http.get('/services/referral/commissions');
}
async function copy(t) {
  if (!t) return;
  try { await navigator.clipboard.writeText(t); } catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
  ElMessage.success('已复制');
}
onMounted(load);
</script>

<style scoped>
.page-title { margin: 16px 0; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
.stat {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 18px; text-align: center; box-shadow: var(--shadow-card);
}
.stat b { font-size: 22px; font-weight: 750; color: var(--ink); display: block; word-break: break-all; }
.stat span { font-size: 13px; color: var(--text-3); }
.link-card { margin-bottom: 20px; }
.link-row { display: flex; gap: 10px; flex-wrap: wrap; }
.tip { color: var(--text-3); font-size: 13px; margin: 12px 0 0; }
.sub-title { font-size: 16px; font-weight: 700; margin: 22px 0 12px; }
</style>
