<template>
  <div class="page-container doc-page">
    <h1 class="page-title">隐私政策</h1>
    <p class="lead">
      我们重视你的个人信息保护。本政策说明本站如何收集、使用与保护相关信息，并参考《中华人民共和国个人信息保护法》的基本要求进行说明。
    </p>

    <section class="doc-card">
      <h2>1. 我们收集哪些信息</h2>
      <ul>
        <li><strong>账号信息</strong>：注册与登录时使用的手机号，以及你设置的昵称等账号资料。</li>
        <li><strong>订单信息</strong>：你下单购买的商品、金额、订单状态、支付相关记录等，用于完成交易与售后沟通。</li>
        <li>
          <strong>访问日志</strong>：为了解流量来源与页面访问情况，我们会记录访问来源（source）、访问路径（path）、来源页（referrer）。
          <strong>不收集</strong> IP 地址与 User-Agent（浏览器标识）等信息。
        </li>
        <li>你主动通过客服渠道提供的沟通内容（如订单号、运行报错截图），仅用于处理你的咨询与交付。</li>
      </ul>
    </section>

    <section class="doc-card">
      <h2>2. 收集目的与使用方式</h2>
      <ul>
        <li>创建与维护账号，完成登录与身份识别。</li>
        <li>处理订单、支付核对与源码交付。</li>
        <li>提供客服支持、增值服务（如定制、开题助手）相关沟通。</li>
        <li>统计站点访问情况、改进商品与页面体验（基于访问来源与路径等汇总信息）。</li>
        <li>保障站点安全，识别异常或滥用行为。</li>
      </ul>
      <p>我们不会将你的个人信息用于与上述目的无关的用途。</p>
    </section>

    <section class="doc-card">
      <h2>3. 信息存储与保护措施</h2>
      <ul>
        <li>业务数据保存在我们管理的服务器与数据库中，并采取合理的访问控制与安全措施。</li>
        <li>登录凭证等敏感信息按行业常见方式保护，避免明文不当存储。</li>
        <li>仅授权人员在处理订单、客服与运维所必需的范围内访问相关数据。</li>
        <li>因互联网环境并非绝对安全，我们会持续改进防护，但无法保证百分之百不受攻击；发现安全事件时将依法采取处置措施。</li>
      </ul>
    </section>

    <section class="doc-card">
      <h2>4. 信息共享</h2>
      <ul>
        <li>我们<strong>不会向第三方出售</strong>你的个人信息。</li>
        <li>
          为实现必要功能，可能与支付、短信等服务商共享完成交易所必需的最少信息
          （例如支付核对、验证码发送），该等第三方仅能在提供服务所需范围内处理。
        </li>
        <li>根据法律法规、行政或司法要求，我们可能依法披露相关信息。</li>
      </ul>
    </section>

    <section class="doc-card">
      <h2>5. 用户权利</h2>
      <p>在适用法律范围内，你有权：</p>
      <ul>
        <li>查询、更正你的账号资料（如昵称等）。</li>
        <li>了解与你相关的订单信息（通过「我的订单」等页面查看）。</li>
        <li>申请删除账号及相关个人信息（法律法规要求保留的除外）。</li>
      </ul>
      <p>
        行使上述权利请通过
        <router-link to="/contact">联系我们</router-link>
        中的客服微信 / QQ 提出，并配合完成身份核验。我们将在合理期限内处理。
      </p>
    </section>

    <section class="doc-card">
      <h2>6. Cookie / 本地存储的使用</h2>
      <ul>
        <li>我们使用浏览器 <strong>localStorage</strong> 保存登录状态（如 token、用户信息），以便你保持登录。</li>
        <li>
          <strong>购物车</strong>商品列表保存在你浏览器的 localStorage 中，便于刷新页面后仍能看到已选商品；
          该数据主要存于本地，卸载浏览器数据或清空站点存储会丢失本地购物车。
        </li>
        <li>可能使用 Cookie 或同类技术维持会话、记住偏好（如主题），用于站点正常运行与体验优化。</li>
        <li>你可在浏览器设置中清除 Cookie 与本地存储；清除后可能需要重新登录，购物车本地数据也可能被清空。</li>
      </ul>
    </section>

    <section class="doc-card">
      <h2>7. 政策更新与联系方式</h2>
      <p>
        我们可能适时更新本隐私政策，更新版本将在本页面发布。若变更涉及重大权利义务调整，我们会通过站点合理方式提示。
      </p>
      <p>
        如对本政策有疑问，请前往
        <router-link to="/contact">联系我们</router-link>
        ，通过客服渠道与我们沟通。
      </p>
    </section>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { setSeo } from '../../composables/useSeo';

onMounted(() => {
  setSeo({
    title: '隐私政策 - 毕设源码商城个人信息保护说明',
    description:
      '毕设源码商城隐私政策：说明手机号与订单信息收集、访问日志（来源/路径/来源页）、购物车 localStorage 存储，以及用户权利与联系方式。',
    keywords: '隐私政策,个人信息保护,毕设源码商城,购物车本地存储'
  });
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
.doc-card p:last-child, .doc-card li:last-child { margin-bottom: 0; }
.doc-card ul { margin: 0; padding-left: 1.2em; }
.doc-card a { color: var(--accent); font-weight: 650; }
@media (max-width: 768px) {
  .page-title { font-size: 22px; }
  .doc-card { padding: 16px; }
}
</style>
