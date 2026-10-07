<template>
  <div class="page-container">
    <h2 class="page-title">领券中心</h2>

    <el-tabs v-model="activeTab" @tab-change="onTab">
      <el-tab-pane label="可领取" name="available" />
      <el-tab-pane label="我的优惠券" name="mine" />
    </el-tabs>

    <div v-loading="loading">
      <template v-if="activeTab === 'available'">
        <p v-if="!userStore.isLogin" class="login-tip">
          可先浏览优惠券，领取需
          <router-link :to="{ path: '/login', query: { redirect: '/coupons' } }">登录</router-link>
        </p>
        <div v-if="availableList.length" class="coupon-grid">
          <div v-for="c in availableList" :key="c.id" class="coupon-card">
            <div class="coupon-head">
              <span class="coupon-name">{{ c.name }}</span>
              <span class="coupon-code">{{ c.code }}</span>
            </div>
            <div class="coupon-value">
              <template v-if="c.type === 'full'">满{{ c.threshold }}减{{ c.amount }}</template>
              <template v-else>{{ c.amount * 10 }}折</template>
            </div>
            <div class="coupon-meta">
              <span v-if="c.threshold > 0">门槛 ¥{{ c.threshold }}</span>
              <span v-else>无门槛</span>
              <span>已领 {{ c.claimedCount ?? c.claimed_count ?? 0 }} 份</span>
              <span>每人限领 {{ c.per_user }} 张</span>
            </div>
            <div v-if="c.expires_at" class="coupon-expire">有效期至 {{ c.expires_at }}</div>
            <el-button
              type="primary"
              size="small"
              :disabled="userStore.isLogin && isClaimed(c)"
              :loading="claimingId === c.id"
              @click="claim(c)"
            >
              {{ userStore.isLogin && isClaimed(c) ? '已领取' : '领取' }}
            </el-button>
          </div>
        </div>
        <el-empty v-else-if="!loading" description="暂无可领取的优惠券">
          <template #image>
            <div class="empty-illus" style="padding: 12px 0 0"><div class="ei-icon">🎫</div></div>
          </template>
        </el-empty>
      </template>

      <template v-else>
        <p v-if="!userStore.isLogin" class="login-tip">
          请先 <router-link :to="{ path: '/login', query: { redirect: '/coupons' } }">登录</router-link> 查看我的优惠券
        </p>
        <div v-else-if="mineList.length" class="mine-list">
          <div v-for="c in mineList" :key="c.id" class="mine-item">
            <div class="mine-left">
              <span class="mine-name">{{ c.name }}</span>
              <span class="mine-code">{{ c.code }}</span>
              <span class="mine-type">
                <template v-if="c.type === 'full'">满{{ c.threshold }}减{{ c.amount }}</template>
                <template v-else>{{ c.amount * 10 }}折</template>
              </span>
            </div>
            <div class="mine-right">
              <el-tag :type="mineStatusType(c.status)">{{ mineStatusText(c.status) }}</el-tag>
              <span v-if="c.expires_at" class="mine-expire">有效期至 {{ c.expires_at }}</span>
            </div>
          </div>
        </div>
        <el-empty v-else-if="!loading && userStore.isLogin" description="暂无优惠券">
          <template #image>
            <div class="empty-illus" style="padding: 12px 0 0"><div class="ei-icon">🎟</div></div>
          </template>
        </el-empty>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import http from '../../api';
import { useUserStore } from '../../stores/user';
import { setSeo } from '../../composables/useSeo';

const router = useRouter();
const userStore = useUserStore();
const activeTab = ref('available');
const loading = ref(false);
const availableList = ref([]);
const mineList = ref([]);
const claimingId = ref(null);

const MINE_STATUS = {
  unused: { text: '未使用', type: 'success' },
  used: { text: '已使用', type: 'info' },
  expired: { text: '已过期', type: 'danger' }
};
const mineStatusText = (s) => MINE_STATUS[s]?.text || s || '—';
const mineStatusType = (s) => MINE_STATUS[s]?.type || 'info';

function isClaimed(c) {
  const count = c.claimedCount ?? c.claimed_count ?? 0;
  return count >= c.per_user;
}

async function loadAvailable() {
  loading.value = true;
  try {
    const res = await http.get('/coupons/available');
    availableList.value = res.list || [];
  } finally {
    loading.value = false;
  }
}

async function loadMine() {
  if (!userStore.isLogin) {
    mineList.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await http.get('/coupons/mine');
    mineList.value = res.list || [];
  } catch {
    mineList.value = [];
  } finally {
    loading.value = false;
  }
}

function onTab() {
  if (activeTab.value === 'available') loadAvailable();
  else loadMine();
}

async function claim(c) {
  if (!userStore.isLogin) {
    ElMessage.warning('请先登录后再领取');
    router.push({ path: '/login', query: { redirect: '/coupons' } });
    return;
  }
  claimingId.value = c.id;
  try {
    await http.post(`/coupons/${c.id}/claim`);
    ElMessage.success('领取成功');
    loadAvailable();
  } finally {
    claimingId.value = null;
  }
}

onMounted(() => {
  setSeo({
    title: '领券中心 - 毕设源码商城',
    description: '领取毕业设计 / 毕设源码优惠券，购买完整版更优惠。',
    keywords: '优惠券,领券中心,毕设源码'
  });
  loadAvailable();
});
</script>

<style scoped>
.page-title { margin: 16px 0 16px; }
.login-tip { font-size: 14px; color: var(--text-2); margin-bottom: 16px; }
.login-tip a { color: var(--accent); }
.coupon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.coupon-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 18px 20px; box-shadow: var(--shadow-card);
  position: relative; overflow: hidden;
}
.coupon-card::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
  background: var(--brand-grad);
}
.coupon-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.coupon-name { font-weight: 700; font-size: 15px; }
.coupon-code { font-size: 12px; color: var(--text-3); }
.coupon-value { font-size: 24px; font-weight: 800; color: var(--price); margin-bottom: 10px; }
.coupon-meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--text-2); margin-bottom: 8px; }
.coupon-expire { font-size: 12px; color: var(--text-3); margin-bottom: 12px; }
.mine-list { display: flex; flex-direction: column; gap: 12px; }
.mine-item {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 16px 20px; box-shadow: var(--shadow-card);
}
.mine-left { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.mine-name { font-weight: 700; }
.mine-code { font-size: 13px; color: var(--text-3); }
.mine-type { color: var(--price); font-weight: 600; }
.mine-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.mine-expire { font-size: 12px; color: var(--text-3); }
</style>
