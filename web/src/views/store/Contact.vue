<template>
  <div class="page-container contact-page">
    <h2 class="page-title">联系我们</h2>

    <section class="contact-card">
      <h3 class="card-title">客服方式</h3>
      <p v-if="settings.service_notice" class="notice">{{ settings.service_notice }}</p>

      <div v-if="settings.service_wechat_qr || settings.service_qq_qr" class="qr-list contact-qr">
        <div v-if="settings.service_wechat_qr" class="qr-item">
          <el-image :src="settings.service_wechat_qr" style="width: 200px; height: 200px" fit="contain" lazy />
          <p class="qr-label">微信扫码添加</p>
        </div>
        <div v-if="settings.service_qq_qr" class="qr-item">
          <el-image :src="settings.service_qq_qr" style="width: 200px; height: 200px" fit="contain" lazy />
          <p class="qr-label">QQ 扫码添加</p>
        </div>
      </div>

      <div class="service-rows">
        <div v-if="settings.service_wechat" class="service-row">
          <span class="label">微信</span>
          <b class="value">{{ settings.service_wechat }}</b>
          <el-button size="small" type="primary" plain @click="copyText(settings.service_wechat)">复制</el-button>
        </div>
        <div v-if="settings.service_qq" class="service-row">
          <span class="label">QQ</span>
          <b class="value">{{ settings.service_qq }}</b>
          <el-button size="small" type="primary" plain @click="copyText(settings.service_qq)">复制</el-button>
          <el-button size="small" @click="openQq">打开会话</el-button>
        </div>
        <el-empty
          v-if="!hasContact"
          description="客服信息配置中"
          :image-size="80"
        />
      </div>
    </section>

    <section class="contact-card">
      <h3 class="card-title">购买与发货流程</h3>
      <ol class="steps">
        <li><span class="step-num">1</span>选购下单</li>
        <li><span class="step-num">2</span>支付（扫码 / 卡密）</li>
        <li><span class="step-num">3</span>添加客服发送订单号</li>
        <li><span class="step-num">4</span>人工核对发货</li>
      </ol>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../../api';
import { setSeo } from '../../composables/useSeo';

const settings = ref({});
const hasContact = computed(() => !!(
  settings.value.service_wechat || settings.value.service_qq
  || settings.value.service_wechat_qr || settings.value.service_qq_qr
  || settings.value.service_notice
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
  const qq = String(settings.value.service_qq || '').replace(/\D/g, '');
  if (!qq) return;
  window.open(`https://wpa.qq.com/msgrd?v=3&uin=${qq}&site=qq&menu=yes`, '_blank', 'noopener');
}

onMounted(async () => {
  setSeo({
    title: '联系我们 - 毕设源码 / 毕业设计咨询',
    description: '微信 / QQ 联系客服，咨询毕业设计、毕设、课程设计完整版源码与交付问题。',
    keywords: '联系我们,毕设源码客服,毕业设计咨询'
  });
  try {
    settings.value = await http.get('/settings/public');
  } catch {
    // 忽略设置加载失败
  }
});
</script>

<style scoped>
.contact-page { padding-top: 16px; padding-bottom: 40px; }
.page-title { margin: 0 0 20px; }
.contact-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 22px 24px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-card);
}
.card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  margin: 0 0 16px;
}
.service-rows { display: flex; flex-direction: column; gap: 14px; }
.service-row {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  font-size: 14px; color: var(--text-2);
}
.service-row .label {
  min-width: 48px; color: var(--text-3); font-weight: 600;
}
.service-row .value { color: var(--text-1); }
.notice {
  color: #0f766e; font-size: 13px; margin: 0 0 16px; line-height: 1.7;
  padding: 10px 12px; background: var(--accent-soft); border-radius: 10px;
}
.contact-qr { margin-bottom: 18px; }
.qr-list {
  display: flex; gap: 32px; flex-wrap: wrap; justify-content: flex-start;
}
.qr-item { text-align: center; }
.qr-label { margin: 8px 0 0; font-size: 14px; font-weight: 600; color: var(--text-2); }
.steps {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 14px;
}
.steps li {
  display: flex; align-items: center; gap: 12px;
  font-size: 15px; color: var(--text-2); font-weight: 600;
}
.step-num {
  width: 28px; height: 28px; border-radius: 8px;
  display: grid; place-items: center;
  background: var(--brand-grad); color: #fff;
  font-size: 13px; font-weight: 700; flex-shrink: 0;
}

@media (max-width: 768px) {
  .contact-card { padding: 16px; }
  .qr-list { flex-direction: column; align-items: center; gap: 20px; }
  .service-row {
    flex-wrap: wrap; gap: 8px;
  }
  .service-row .value { word-break: break-all; }
}
</style>
