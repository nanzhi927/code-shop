<template>
  <el-dialog
    :model-value="visible"
    title="联系客服"
    width="480px"
    class="contact-dialog mobile-dialog"
    append-to-body
    destroy-on-close
    @close="closeContact"
  >
    <p v-if="s.service_notice" class="notice">{{ s.service_notice }}</p>

    <div v-if="hasQr" class="qr-grid">
      <div v-if="s.service_wechat_qr" class="qr-card">
        <el-image :src="s.service_wechat_qr" fit="contain" class="qr-img" lazy>
          <template #error><div class="qr-fallback">二维码加载失败</div></template>
        </el-image>
        <strong>微信扫码添加</strong>
      </div>
      <div v-if="s.service_qq_qr" class="qr-card">
        <el-image :src="s.service_qq_qr" fit="contain" class="qr-img" lazy>
          <template #error><div class="qr-fallback">二维码加载失败</div></template>
        </el-image>
        <strong>QQ 扫码添加</strong>
      </div>
    </div>

    <div class="rows">
      <div v-if="s.service_wechat" class="row">
        <div class="row-ico wechat">微</div>
        <div class="row-body">
          <span class="label">微信号</span>
          <b class="value">{{ s.service_wechat }}</b>
        </div>
        <el-button size="small" type="primary" plain @click="copyText(s.service_wechat)">复制</el-button>
      </div>
      <div v-if="s.service_qq" class="row">
        <div class="row-ico qq">Q</div>
        <div class="row-body">
          <span class="label">QQ</span>
          <b class="value">{{ s.service_qq }}</b>
        </div>
        <div class="row-actions">
          <el-button size="small" type="primary" plain @click="copyText(s.service_qq)">复制</el-button>
          <el-button size="small" @click="openQq">打开会话</el-button>
        </div>
      </div>
    </div>

    <el-empty
      v-if="!hasAny"
      description="客服信息配置中，请稍后再试"
      :image-size="72"
    />

    <template #footer>
      <el-button @click="closeContact">关闭</el-button>
      <el-button type="primary" @click="goFull">查看完整联系页</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useContact } from '../composables/useContact';

const router = useRouter();
const { visible, settings, closeContact } = useContact();
const s = computed(() => settings.value || {});

const hasQr = computed(() => !!(s.value.service_wechat_qr || s.value.service_qq_qr));
const hasAny = computed(() => !!(
  s.value.service_wechat || s.value.service_qq
  || s.value.service_wechat_qr || s.value.service_qq_qr
  || s.value.service_notice
));

async function copyText(t) {
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  ElMessage.success('已复制');
}

function openQq() {
  const qq = String(s.value.service_qq || '').replace(/\D/g, '');
  if (!qq) return;
  window.open(`https://wpa.qq.com/msgrd?v=3&uin=${qq}&site=qq&menu=yes`, '_blank', 'noopener');
}

function goFull() {
  closeContact();
  router.push('/contact');
}
</script>

<style scoped>
.notice {
  margin: 0 0 16px; padding: 10px 12px;
  background: var(--accent-soft); color: #0f766e;
  border-radius: 10px; font-size: 13px; line-height: 1.65;
}
.qr-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px; margin-bottom: 16px;
}
.qr-card {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 12px; background: var(--bg-alt); border: 1px solid var(--border);
  border-radius: 14px; text-align: center;
}
.qr-card strong { font-size: 13px; font-weight: 650; color: var(--text-2); }
.qr-img { width: 148px; height: 148px; border-radius: 8px; background: #fff; }
.qr-fallback {
  width: 148px; height: 148px; display: grid; place-items: center;
  font-size: 12px; color: var(--text-4); background: var(--surface);
}
.rows { display: flex; flex-direction: column; gap: 10px; }
.row {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 12px 14px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px;
}
.row-ico {
  width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center;
  color: #fff; font-size: 14px; font-weight: 800; flex-shrink: 0;
}
.row-ico.wechat { background: #07c160; }
.row-ico.qq { background: #12b7f5; }
.row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.label { font-size: 12px; color: var(--text-3); font-weight: 600; }
.value { font-size: 15px; color: var(--text-1); word-break: break-all; }
.row-actions { display: flex; gap: 6px; flex-wrap: wrap; }

@media (max-width: 480px) {
  .qr-img, .qr-fallback { width: 132px; height: 132px; }
  .row { padding: 12px; }
  .row-actions { width: 100%; }
  .row-actions .el-button { flex: 1; }
}
</style>
