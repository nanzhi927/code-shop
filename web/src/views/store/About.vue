<template>
  <div class="page-container doc-page">
    <h1 class="page-title">关于我们</h1>
    <p class="lead">面向计算机相关专业学生的源码学习资料平台，帮你更快上手毕业设计与课程设计项目。</p>

    <section class="doc-card">
      <h2>站点定位</h2>
      <p>
        本站主要提供<strong>完整源码包</strong>与配套学习资料，方便你理解项目结构、技术栈与实现思路。
        商品面向个人学习参考，不是代写服务，也不是商用软件商店。
      </p>
    </section>

    <section class="doc-card">
      <h2>商品来源与质检</h2>
      <p>
        每个上架商品我们都会核对：能否按说明运行、包内包含哪些材料。
        商品页会如实标注是否含论文、PPT、演示视频——标了才有，没标默认不含。
      </p>
      <ul>
        <li>完整源码包通常含：源码工程、数据库脚本、运行说明、运行截图</li>
        <li>论文文档、答辩 PPT、演示视频：视商品而定，以下单前商品页标注为准</li>
      </ul>
    </section>

    <section class="doc-card">
      <h2>我们提供什么 / 不提供什么</h2>
      <p>我们<strong>只提供源码与学习资料</strong>，以及可选的增值服务。不提供代写论文等违规服务。</p>
      <div class="svc-list">
        <div class="svc-item">远程协助 / 环境搭建</div>
        <div class="svc-item">演示视频 / 答辩 PPT</div>
        <div class="svc-item">源码二次修改</div>
        <div class="svc-item">定制开发</div>
        <div class="svc-item">免费开题助手</div>
      </div>
      <p class="more">
        了解详情请前往
        <router-link to="/services">增值服务</router-link>
        ，或查看
        <router-link to="/help">帮助中心</router-link>。
      </p>
    </section>

    <section class="doc-card">
      <h2>交付方式</h2>
      <p>
        付款后请添加客服微信 / QQ，发送订单号。客服核对后通过网盘等方式提供源码下载。
        具体联系方式见下方或
        <router-link to="/contact">联系我们</router-link>页。
      </p>
    </section>

    <section class="doc-card">
      <h2>开源说明</h2>
      <p>
        站点相关说明与互链仓库见
        <a href="https://gitee.com/nanzhiyu/code-shop" target="_blank" rel="noopener">Gitee · code-shop</a>。
      </p>
    </section>

    <section class="doc-card">
      <h2>联系方式</h2>
      <p v-if="settings.service_notice" class="notice">{{ settings.service_notice }}</p>
      <div v-if="settings.service_wechat_qr || settings.service_qq_qr" class="qr-list">
        <div v-if="settings.service_wechat_qr" class="qr-item">
          <el-image :src="settings.service_wechat_qr" style="width: 160px; height: 160px" fit="contain" lazy />
          <p class="qr-label">微信扫码添加</p>
        </div>
        <div v-if="settings.service_qq_qr" class="qr-item">
          <el-image :src="settings.service_qq_qr" style="width: 160px; height: 160px" fit="contain" lazy />
          <p class="qr-label">QQ 扫码添加</p>
        </div>
      </div>
      <div class="service-rows">
        <div v-if="settings.service_wechat" class="service-row">
          <span class="label">微信</span>
          <b>{{ settings.service_wechat }}</b>
        </div>
        <div v-if="settings.service_qq" class="service-row">
          <span class="label">QQ</span>
          <b>{{ settings.service_qq }}</b>
        </div>
        <el-empty
          v-if="!hasContact"
          description="客服信息配置中"
          :image-size="64"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import http from '../../api';
import { setSeo } from '../../composables/useSeo';

const settings = ref({});
const hasContact = computed(() => !!(
  settings.value.service_wechat
  || settings.value.service_qq
  || settings.value.service_wechat_qr
  || settings.value.service_qq_qr
  || settings.value.service_notice
));

onMounted(async () => {
  setSeo({
    title: '关于我们 - 毕设源码学习资料平台',
    description:
      '毕设源码商城面向计算机相关专业学生，提供毕业设计 / 课程设计完整源码包与学习资料，如实标注论文 PPT 与演示视频，并提供远程协助、二次修改等服务。',
    keywords: '关于我们,毕设源码平台,毕业设计源码,课程设计学习资料'
  });
  try {
    settings.value = await http.get('/settings/public');
  } catch {
    // 忽略
  }
});
</script>

<style scoped>
.doc-page { padding-top: 16px; padding-bottom: 48px; max-width: 860px; }
.page-title { margin: 0 0 10px; font-size: 26px; font-weight: 800; letter-spacing: -.3px; }
.lead { margin: 0 0 24px; color: var(--text-3); font-size: 14.5px; line-height: 1.75; }
.doc-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 20px 22px;
  margin-bottom: 14px;
  box-shadow: var(--shadow-card);
}
.doc-card h2 {
  margin: 0 0 12px; font-size: 16px; font-weight: 700; color: var(--text-1);
}
.doc-card p, .doc-card li {
  margin: 0 0 10px; color: var(--text-2); font-size: 14px; line-height: 1.75;
}
.doc-card ul { margin: 0; padding-left: 1.2em; }
.doc-card li { margin-bottom: 6px; }
.svc-list {
  display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 14px;
}
.svc-item {
  padding: 6px 12px; border-radius: 8px;
  background: var(--bg-alt); border: 1px solid var(--border);
  font-size: 13px; font-weight: 600; color: var(--text-2);
}
.more { margin-top: 4px !important; }
.more a { color: var(--accent); font-weight: 650; }
.notice {
  color: #0f766e; font-size: 13px; margin: 0 0 14px; line-height: 1.7;
  padding: 10px 12px; background: var(--accent-soft); border-radius: 10px;
}
.qr-list { display: flex; gap: 28px; flex-wrap: wrap; margin-bottom: 14px; }
.qr-item { text-align: center; }
.qr-label { margin: 8px 0 0; font-size: 13px; font-weight: 600; color: var(--text-2); }
.service-rows { display: flex; flex-direction: column; gap: 10px; }
.service-row {
  display: flex; align-items: center; gap: 12px; font-size: 14px; color: var(--text-1);
}
.service-row .label { min-width: 40px; color: var(--text-3); font-weight: 600; }
@media (max-width: 768px) {
  .page-title { font-size: 22px; }
  .doc-card { padding: 16px; }
  .qr-list { justify-content: center; }
}
</style>
