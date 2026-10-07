<template>
  <div class="page-container help-page">
    <header class="help-hero">
      <h1 class="page-title">帮助中心</h1>
      <p class="help-sub">购买、交付、运行与修改相关的常见问题，优先在这里找答案。</p>
      <el-input
        v-model="keyword"
        class="help-search"
        clearable
        placeholder="在帮助中心搜索问题"
        :prefix-icon="Search"
      />
    </header>

    <nav class="help-nav" aria-label="问题分组">
      <a
        v-for="g in visibleGroups"
        :key="g.id"
        :href="`#${g.id}`"
        class="nav-chip"
        @click.prevent="scrollTo(g.id)"
      >{{ g.title }}</a>
    </nav>

    <el-empty v-if="!visibleGroups.length" description="没有匹配的问题，试试换个关键词" />

    <section
      v-for="g in visibleGroups"
      :id="g.id"
      :key="g.id"
      class="faq-section"
    >
      <h2 class="section-title">{{ g.title }}</h2>
      <el-collapse v-model="activeNames[g.id]" class="faq-collapse">
        <el-collapse-item
          v-for="(item, idx) in g.items"
          :key="`${g.id}-${idx}`"
          :name="`${g.id}-${idx}`"
          :title="item.q"
        >
          <p class="faq-a">{{ item.a }}</p>
        </el-collapse-item>
      </el-collapse>
    </section>

    <section class="contact-block">
      <h2 class="section-title">没找到答案？联系客服</h2>
      <p v-if="settings.service_notice" class="notice">{{ settings.service_notice }}</p>
      <p class="contact-tip">付款后请添加客服微信 / QQ，发送订单号领取源码下载方式。</p>

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
          <b class="value">{{ settings.service_wechat }}</b>
        </div>
        <div v-if="settings.service_qq" class="service-row">
          <span class="label">QQ</span>
          <b class="value">{{ settings.service_qq }}</b>
        </div>
      </div>

      <router-link to="/contact" class="contact-more">前往联系我们页 →</router-link>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { Search } from '@element-plus/icons-vue';
import http from '../../api';
import { setSeo } from '../../composables/useSeo';

const keyword = ref('');
const settings = ref({});
const activeNames = reactive({});

const FAQ_GROUPS = [
  {
    id: 'buy',
    title: '购买与交付',
    items: [
      {
        q: '付款后怎么拿到源码？',
        a: '付款成功后，请添加客服微信或 QQ，把订单号发给客服。客服核对订单后，会把源码的网盘下载方式发给你。站点不会在页面上自动放出下载链接，一定要走人工交付这一步。'
      },
      {
        q: '多久能收到？',
        a: '我们是人工核对后交付，一般工作时间会尽快处理。高峰期或夜间下单可能要等更久一点，不是「秒发」。发了订单号如果迟迟没回复，可以再催一下客服，并确认订单号发对了。'
      },
      {
        q: '源码以什么形式交付？',
        a: '通常是网盘链接 + 提取码（具体网盘以客服当时提供的为准）。你下载解压后，按包里的运行说明配置环境即可。'
      },
      {
        q: '可以先看演示再买吗？',
        a: '可以。商品页一般会有运行截图；部分商品还带演示视频或说明。拿不准的话，先看商品详情标注，或直接加客服问清楚再下单。'
      },
      {
        q: '下单后还需要做什么？',
        a: '记住订单号，加客服微信 / QQ 把订单号发过去。只付款不加客服、不发订单号，我们没法把下载方式给你。'
      }
    ]
  },
  {
    id: 'source',
    title: '源码本身',
    items: [
      {
        q: '源码完整吗？包含哪些文件？',
        a: '完整源码包一般包含：源码工程、数据库脚本、运行说明、运行截图。这是标配。论文文档、PPT、演示视频则要看具体商品——有的带，有的不带。'
      },
      {
        q: '有没有论文和 PPT？',
        a: '视商品而定。下单前务必看商品页标注：只有明确写了「含论文」「含 PPT」的才会附带；没标注的默认不含。别默认「买源码就送论文」。'
      },
      {
        q: '有演示视频吗？',
        a: '部分商品有。商品页会标注是否含演示视频；没有标注的就当没有。需要讲解/答辩视频的话，也可以看看增值服务里的演示视频、答辩 PPT 相关服务。'
      },
      {
        q: '是原创吗？',
        a: '本站商品定位是学习参考用的源码资料包，用于理解项目结构、技术栈和实现思路，不是「代写」也不是商用软件授权。请按个人学习用途使用，不要二次售卖或用于违规场景。'
      },
      {
        q: '和开源页的项目有什么区别？',
        a: '开源页是精简学习版，方便看结构、跑通思路；商城商品是完整交付包（源码工程、数据库脚本、运行说明、截图等），并按标注可能含论文 / PPT / 演示视频。需要完整包请走商品页购买。'
      }
    ]
  },
  {
    id: 'env',
    title: '环境与运行',
    items: [
      {
        q: '需要装什么环境？',
        a: '按项目技术栈来，常见是 JDK、Maven、MySQL，也有 Node、Python、小程序开发工具等。具体版本以该商品「运行说明 / 运行必读」为准，不同项目要求不一样。'
      },
      {
        q: '源码跑不起来怎么办？',
        a: '先按包内「运行必读」逐步排查：JDK/Maven 版本、数据库账号、端口占用、依赖是否下全。还是不行，可以购买远程协助 / 环境搭建服务，让客服帮你对着环境排查。'
      },
      {
        q: '数据库脚本怎么导入？',
        a: '一般会提供 .sql 文件。用 Navicat、DBeaver 或命令行连上 MySQL，先建好库，再导入脚本。导入后改项目配置里的库名、账号、密码，再启动项目。细节以运行说明为准。'
      },
      {
        q: '报错看不懂怎么办？',
        a: '把完整报错日志、你的环境版本（JDK、MySQL 等）和卡在哪一步发给客服。先自行对照运行说明；需要手把手搭环境，再考虑远程协助服务。'
      }
    ]
  },
  {
    id: 'modify',
    title: '修改与二次开发',
    items: [
      {
        q: '可以改题目 / 改界面吗？',
        a: '可以。自己改当然没问题；想省时间可以购买「源码二次修改」服务，把题目、文案、界面样式等改动需求告诉客服报价处理。'
      },
      {
        q: '可以加功能模块吗？',
        a: '可以走「定制开发」服务：说清楚要加什么功能，客服评估工期和报价，确认后再开发。复杂需求建议先沟通可行性。'
      },
      {
        q: '二次修改和定制开发怎么下单？',
        a: '到「增值服务」页面选择对应服务，或直接加客服说明需求。改动范围不同，价格和时间也会不同，以沟通确认为准。'
      },
      {
        q: '有免费开题助手吗？',
        a: '有。站点提供免费开题助手，可生成开题报告初稿作参考。注册后按页面提示使用即可，具体次数与规则以开题页说明为准。'
      }
    ]
  },
  {
    id: 'after-sales',
    title: '售后与支持',
    items: [
      {
        q: '买完发现包里少了东西怎么办？',
        a: '如果交付物和商品页标注不一致，或者压缩包损坏、缺文件，把订单号发给客服，核实后会补发。'
      },
      {
        q: '按说明跑不起来，算谁的问题？',
        a: '先按包内「运行说明 / 运行必读」排查本机环境（JDK、Maven、MySQL、Node 版本、端口、依赖等）。确属交付物问题的，客服会协助处理；本机环境、网络、磁盘权限等差异需自行排查，也可选购远程协助。'
      },
      {
        q: '能帮我改到能跑起来吗？',
        a: '环境或运行问题，客服可协助排查。若要改题目、界面或加功能，属于源码二次修改 / 定制开发，需另行购买对应增值服务，按约定范围提供。'
      },
      {
        q: '服务买了还没开始用怎么办？',
        a: '联系客服说明情况，协商处理安排。远程协助、二次修改、定制开发等按购买时约定的范围提供。'
      },
      {
        q: '哪些事情你们不负责？',
        a: '代写论文及违反学术诚信的用途；对学校查重、评审、答辩结果的任何保证；无限期免费维护与免费二次开发；账号、资料、网盘链接的转卖与共享——这些都不在服务范围内。'
      }
    ]
  },
  {
    id: 'copyright',
    title: '版权与使用',
    items: [
      {
        q: '可以商用吗？',
        a: '不可以。源码仅供个人学习参考，不得用于商业项目、上线运营，也不得二次售卖。'
      },
      {
        q: '可以分享给别人吗？',
        a: '不可以。购买后请自己使用，不要把网盘链接、压缩包转发给他人或公开到群里。'
      },
      {
        q: '能用来交作业 / 做毕设参考吗？',
        a: '本站资料面向学习参考。请遵守学校对学术诚信的要求，自行理解、修改并完成你的工作，不要把资料当「代写」用途。'
      },
      {
        q: '学校查重 / 答辩相关你们负责吗？',
        a: '我们提供源码与学习资料，以及可选的演示视频、答辩 PPT 等服务；不提供代写论文，也不对学校审查结果做任何保证。请按校方规定自行准备。'
      }
    ]
  }
];

const visibleGroups = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return FAQ_GROUPS;
  return FAQ_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(
      (it) => it.q.toLowerCase().includes(kw) || it.a.toLowerCase().includes(kw)
    )
  })).filter((g) => g.items.length);
});

function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(async () => {
  setSeo({
    title: '帮助中心 - 毕设源码常见问题 / 源码跑不起来怎么办',
    description:
      '毕设源码怎么用、付款后如何领取、源码跑不起来怎么办、论文 PPT 是否包含等常见问题解答。帮助中心覆盖购买交付、环境运行与二次修改。',
    keywords: '帮助中心,常见问题,毕设源码怎么用,源码跑不起来,毕业设计源码交付,毕设FAQ'
  });
  FAQ_GROUPS.forEach((g) => {
    activeNames[g.id] = g.items.length ? [`${g.id}-0`] : [];
  });
  try {
    settings.value = await http.get('/settings/public');
  } catch {
    // 忽略
  }
});
</script>

<style scoped>
.help-page { padding-top: 16px; padding-bottom: 48px; }
.help-hero { margin-bottom: 20px; }
.page-title { margin: 0 0 8px; font-size: 26px; font-weight: 800; letter-spacing: -.3px; }
.help-sub { margin: 0 0 16px; color: var(--text-3); font-size: 14px; line-height: 1.7; }
.help-search { max-width: 480px; }
.help-nav {
  display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px;
  position: sticky; top: calc(var(--header-h, 56px) + 8px); z-index: 10;
  padding: 8px 0; background: var(--bg);
}
.nav-chip {
  display: inline-flex; align-items: center;
  padding: 6px 12px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--surface);
  color: var(--text-2); font-size: 13px; font-weight: 600;
  transition: border-color .18s, color .18s, background .18s;
}
.nav-chip:hover { color: var(--text-1); border-color: var(--ink); }
.faq-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 18px 20px 8px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-card);
  scroll-margin-top: calc(var(--header-h, 56px) + 56px);
}
.section-title {
  margin: 0 0 12px; font-size: 16px; font-weight: 700; color: var(--text-1);
}
.faq-collapse :deep(.el-collapse-item__header) {
  font-weight: 650; color: var(--text-1); font-size: 14.5px; line-height: 1.5;
  height: auto; min-height: 48px; padding: 10px 0;
}
.faq-collapse :deep(.el-collapse-item__wrap) { border-bottom-color: var(--border); }
.faq-collapse :deep(.el-collapse-item__content) { padding-bottom: 14px; }
.faq-a {
  margin: 0; color: var(--text-2); font-size: 14px; line-height: 1.75;
}
.contact-block {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 22px 24px;
  margin-top: 8px;
  box-shadow: var(--shadow-card);
}
.notice {
  color: #0f766e; font-size: 13px; margin: 0 0 12px; line-height: 1.7;
  padding: 10px 12px; background: var(--accent-soft); border-radius: 10px;
}
.contact-tip { margin: 0 0 16px; color: var(--text-3); font-size: 13.5px; line-height: 1.7; }
.qr-list { display: flex; gap: 28px; flex-wrap: wrap; margin-bottom: 16px; }
.qr-item { text-align: center; }
.qr-label { margin: 8px 0 0; font-size: 13px; font-weight: 600; color: var(--text-2); }
.service-rows { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.service-row {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  font-size: 14px; color: var(--text-2);
}
.service-row .label { min-width: 40px; color: var(--text-3); font-weight: 600; }
.service-row .value { color: var(--text-1); }
.contact-more {
  display: inline-block; margin-top: 4px;
  color: var(--accent); font-size: 13.5px; font-weight: 650;
}
@media (max-width: 768px) {
  .page-title { font-size: 22px; }
  .faq-section, .contact-block { padding: 14px 14px 6px; }
  .help-nav { top: 52px; }
  .qr-list { justify-content: center; }
}
</style>
