<template>
  <div class="page-container">
    <div class="page-head">
      <h2 class="page-title">消息中心</h2>
      <el-button v-if="list.length" size="small" :loading="markingAll" @click="markAllRead">全部已读</el-button>
    </div>

    <div v-loading="loading">
      <div v-if="list.length">
        <div
          v-for="item in list"
          :key="item.id"
          class="msg-card"
          :class="{ unread: !item.is_read }"
          @click="onClick(item)"
        >
          <div class="msg-head">
            <div class="msg-title-row">
              <span v-if="!item.is_read" class="unread-dot" />
              <span class="msg-title" :class="{ bold: !item.is_read }">{{ item.title }}</span>
            </div>
            <el-tag size="small" :type="typeTag(item.type)">{{ typeText(item.type) }}</el-tag>
          </div>
          <p class="msg-content">{{ item.content }}</p>
          <p class="msg-time">{{ item.created_at }}</p>
        </div>
      </div>
      <el-empty v-else-if="!loading" description="暂无消息">
        <template #image>
          <div class="empty-illus" style="padding: 12px 0 0"><div class="ei-icon">空</div></div>
        </template>
      </el-empty>
    </div>

    <el-pagination
      v-if="total > pageSize"
      class="pager"
      background
      layout="prev, pager, next, total"
      :total="total"
      :page-size="pageSize"
      :current-page="page"
      @current-change="onPage"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import http from '../../api';
import { setSeo } from '../../composables/useSeo';

const TYPE_MAP = {
  order: '订单',
  custom: '定制',
  refund: '退款',
  system: '系统'
};

const list = ref([]);
const loading = ref(false);
const markingAll = ref(false);
const page = ref(1);
const pageSize = 10;
const total = ref(0);
const unread = ref(0);

function typeText(type) {
  return TYPE_MAP[type] || type;
}

function typeTag(type) {
  const map = { order: 'primary', custom: 'warning', refund: 'danger', system: 'info' };
  return map[type] || 'info';
}

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/notifications', { params: { page: page.value, pageSize } });
    list.value = res.list || [];
    total.value = res.total || 0;
    unread.value = res.unread || 0;
  } finally {
    loading.value = false;
  }
}

function onPage(p) {
  page.value = p;
  load();
}

async function onClick(item) {
  if (item.is_read) return;
  try {
    await http.post('/notifications/read', { ids: [item.id] });
    item.is_read = 1;
    if (unread.value > 0) unread.value--;
  } catch {}
}

async function markAllRead() {
  markingAll.value = true;
  try {
    await http.post('/notifications/read', {});
    list.value.forEach((item) => { item.is_read = 1; });
    unread.value = 0;
  } finally {
    markingAll.value = false;
  }
}

onMounted(() => {
  setSeo({
    title: '消息中心 - 毕设源码商城',
    description: '查看订单与客服相关消息通知。',
    keywords: '消息中心,毕设源码商城'
  });
  load();
});
</script>

<style scoped>
.page-head { display: flex; align-items: center; justify-content: space-between; margin: 16px 0 0; }
.page-title { margin: 0 0 16px; }
.msg-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 18px 22px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: border-color .2s, transform .2s var(--ease);
}
.msg-card:hover { border-color: var(--ink); transform: translateY(-1px); }
.msg-card.unread { border-left: 3px solid var(--accent); }
.msg-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.msg-title-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.unread-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent); flex-shrink: 0;
}
.msg-title { font-size: 15px; color: var(--text-1); }
.msg-title.bold { font-weight: 700; }
.msg-content { margin: 10px 0 6px; font-size: 14px; color: var(--text-2); line-height: 1.6; }
.msg-time { margin: 0; font-size: 12px; color: var(--text-3); }
.pager { margin-top: 16px; justify-content: center; }

@media (max-width: 768px) {
  .msg-card { padding: 14px 16px; }
  .msg-head { flex-direction: column; align-items: flex-start; gap: 6px; }
  .msg-title { font-size: 14.5px; }
}
</style>
