<template>
  <div class="page-container landing" :class="{ 'landing--rich': isRich, 'landing--sticky': isRich }">
    <!-- 骨架 -->
    <div v-if="loading" class="sk" aria-hidden="true">
      <div class="sk-badge sk-block" />
      <div class="sk-title sk-block" />
      <div class="sk-sub sk-block" />
      <div class="sk-grid">
        <div v-for="i in 4" :key="i" class="sk-card sk-block" />
      </div>
    </div>

    <template v-else-if="page">
      <!-- 富布局：定制等带 services/steps 的页 -->
      <template v-if="isRich">
        <section class="hero fade-in">
          <span v-if="page.badge" class="badge">{{ page.badge }}</span>
          <h1 class="title">{{ page.title }}</h1>
          <p class="sub">{{ page.subtitle }}</p>
          <div class="hero-cta">
            <StoreButton variant="solid" @click="goCta">{{ page.ctaText || '提交需求' }}</StoreButton>
            <StoreButton variant="outline" @click="openContact">咨询客服</StoreButton>
          </div>
          <ul v-if="page.highlights?.length" class="hero-tags">
            <li v-for="(h, i) in page.highlights" :key="i">{{ h }}</li>
          </ul>
        </section>

        <section v-if="page.services?.length" class="block">
          <h2 class="block-title">能帮你做什么</h2>
          <p class="block-sub">按场景选类型，提交时写清范围即可评估</p>
          <div class="svc-grid">
            <article v-for="(s, i) in page.services" :key="i" class="svc-item tap">
              <div class="svc-ico">{{ String(i + 1).padStart(2, '0') }}</div>
              <h3>{{ s.title }}</h3>
              <p>{{ s.desc }}</p>
            </article>
          </div>
        </section>

        <section v-if="page.steps?.length" class="block">
          <h2 class="block-title">合作流程</h2>
          <p class="block-sub">提需求 → 报价 → 开发 → 验收，节点可追踪</p>
          <ol class="steps">
            <li v-for="(st, i) in page.steps" :key="i" class="step">
              <span class="step-num">{{ i + 1 }}</span>
              <div class="step-body">
                <strong>{{ st.title }}</strong>
                <span>{{ st.desc }}</span>
              </div>
            </li>
          </ol>
        </section>

        <section v-if="page.pricing?.length" class="block">
          <h2 class="block-title">报价参考</h2>
          <p class="block-sub">以下为常见区间，正式报价以工单评估为准</p>
          <div class="price-list">
            <div v-for="(p, i) in page.pricing" :key="i" class="price-row tap">
              <div class="price-main">
                <strong>{{ p.name }}</strong>
                <span class="price-range">{{ p.range }}</span>
              </div>
              <p>{{ p.note }}</p>
            </div>
          </div>
        </section>

        <section v-if="cases.length" class="block">
          <h2 class="block-title">可二次开发的源码参考</h2>
          <p class="block-sub">站内热销项目，定制常以这类源码为底座</p>
          <div class="case-scroll">
            <a
              v-for="c in cases"
              :key="c.id"
              class="case-card tap"
              href="#"
              @click.prevent="$router.push(`/products/${c.id}`)"
            >
              <ProductCover :product="c" />
              <h3 class="case-title">{{ c.title }}</h3>
              <div class="case-meta">
                <span v-if="c.tech" class="tech-tag">{{ c.tech }}</span>
                <span v-if="c.sales" class="case-sales">销量 {{ c.sales }}</span>
              </div>
            </a>
          </div>
        </section>

        <section v-if="bodyParas.length" class="block body-block">
          <h2 class="block-title">服务说明</h2>
          <div class="body">
            <p v-for="(para, i) in bodyParas" :key="i">{{ para }}</p>
          </div>
        </section>

        <section v-if="page.faqs?.length" class="block">
          <h2 class="block-title">常见问题</h2>
          <el-collapse class="faq">
            <el-collapse-item v-for="(f, i) in page.faqs" :key="i" :title="f.q" :name="i">
              <p>{{ f.a }}</p>
            </el-collapse-item>
          </el-collapse>
        </section>

        <section class="block cta-block">
          <div class="cta-panel">
            <h2>准备好了？提交需求拿报价</h2>
            <p>{{ page.contactTip || '工作日 1 日内回复评估结果' }}</p>
            <div class="cta-row">
              <StoreButton variant="solid" @click="goCta">{{ page.ctaText || '提交定制需求' }}</StoreButton>
              <StoreButton variant="outline" to="/services">返回服务列表</StoreButton>
            </div>
          </div>
        </section>

        <!-- 移动端粘性 CTA -->
        <div class="sticky-cta" aria-label="快捷操作">
          <StoreButton variant="solid" block @click="goCta">{{ page.ctaText || '提交定制需求' }}</StoreButton>
        </div>
      </template>

      <!-- 通用简洁布局 -->
      <template v-else>
        <div class="hero simple-hero fade-in">
          <span v-if="page.badge" class="badge">{{ page.badge }}</span>
          <h1 class="title">{{ page.title }}</h1>
          <p class="sub">{{ page.subtitle }}</p>
        </div>
        <ul v-if="page.highlights?.length" class="highlights">
          <li v-for="(h, i) in page.highlights" :key="i">{{ h }}</li>
        </ul>
        <div class="body">
          <p v-for="(para, i) in bodyParas" :key="i">{{ para }}</p>
        </div>
        <div class="cta-row">
          <StoreButton variant="solid" @click="goCta">{{ page.ctaText || '了解更多' }}</StoreButton>
          <StoreButton variant="outline" to="/services">返回服务列表</StoreButton>
        </div>
        <p v-if="page.contactTip" class="tip">{{ page.contactTip }}</p>
      </template>
    </template>

    <el-empty v-else description="页面不存在或已下线" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import http from '../../api';
import ProductCover from '../../components/ProductCover.vue';
import StoreButton from '../../components/store/StoreButton.vue';
import { useContact } from '../../composables/useContact';
import { setSeo } from '../../composables/useSeo';

const route = useRoute();
const router = useRouter();
const { openContact } = useContact();
const loading = ref(true);
const page = ref(null);
const cases = ref([]);

const bodyParas = computed(() =>
  String(page.value?.body || '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
);

const isRich = computed(() =>
  !!(page.value?.services?.length || page.value?.steps?.length || page.value?.pricing?.length)
);

function goCta() {
  const to = page.value?.ctaTo || '/services';
  if (/^https?:\/\//i.test(to)) window.open(to, '_blank', 'noopener');
  else router.push(to);
}

async function loadCases() {
  try {
    const res = await http.get('/products', { params: { page: 1, pageSize: 6, sort: 'sales' } });
    cases.value = Array.isArray(res.list) ? res.list.slice(0, 6) : [];
  } catch {
    cases.value = [];
  }
}

async function load() {
  loading.value = true;
  page.value = null;
  cases.value = [];
  try {
    page.value = await http.get(`/services/pages/${route.params.slug}`);
    if (page.value?.title) {
      setSeo({
        title: `${page.value.title} - 毕设源码商城`,
        description: page.value.summary || page.value.description || `${page.value.title}，服务毕业设计与课程设计。`,
        keywords: `${page.value.title},毕业设计,毕设,课程设计,增值服务`
      });
    }
    if (route.params.slug === 'custom' || page.value?.services?.length) {
      loadCases();
    }
  } catch {
    page.value = null;
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.slug, load);
onMounted(load);
</script>

<style scoped>
.landing { padding: 28px 0 64px; max-width: 720px; }
.landing--rich { max-width: 880px; }
.landing--sticky { padding-bottom: 96px; }

.fade-in { animation: fadeIn .4s var(--ease) both; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* 骨架 */
.sk { padding-top: 8px; }
.sk-block {
  background: linear-gradient(90deg, var(--sk-1) 25%, var(--sk-2) 50%, var(--sk-1) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
  border-radius: 10px;
}
.sk-badge { width: 140px; height: 24px; margin-bottom: 14px; }
.sk-title { width: 70%; height: 36px; margin-bottom: 12px; }
.sk-sub { width: 90%; height: 18px; margin-bottom: 28px; }
.sk-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.sk-card { height: 110px; }

.hero { margin-bottom: 36px; }
.badge {
  display: inline-block; font-size: 12px; font-weight: 650; color: #0f766e;
  background: var(--accent-soft); padding: 4px 10px; border-radius: 999px; margin-bottom: 14px;
}
.title { font-size: 32px; font-weight: 800; margin: 0 0 10px; letter-spacing: -.4px; color: var(--ink); line-height: 1.25; }
.sub { margin: 0 0 20px; font-size: 16px; color: var(--text-3); line-height: 1.7; }
.hero-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
.hero-tags {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-wrap: wrap; gap: 8px;
}
.hero-tags li {
  font-size: 12.5px; font-weight: 550; color: var(--text-2);
  background: var(--bg-alt); border: 1px solid var(--border);
  padding: 6px 12px; border-radius: 999px;
}

.block { margin-bottom: 40px; }
.block-title {
  font-family: var(--font-display);
  font-size: 20px; font-weight: 600; margin: 0 0 6px; letter-spacing: -.02em;
}
.block-sub { margin: 0 0 16px; font-size: 13.5px; color: var(--text-3); }

.svc-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;
}
.svc-item {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 18px 16px; display: flex; flex-direction: column; gap: 6px;
  transition: border-color .2s var(--ease), transform .2s var(--ease);
}
.svc-item:active { transform: scale(.98); }
.svc-ico {
  font-family: var(--font-num); font-size: 12px; font-weight: 600;
  color: var(--text-4); letter-spacing: .06em; margin-bottom: 4px;
}
.svc-item h3 { margin: 0; font-size: 15.5px; font-weight: 700; }
.svc-item p { margin: 0; font-size: 13px; color: var(--text-3); line-height: 1.65; }

.steps {
  list-style: none; padding: 0; margin: 0;
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px;
}
.step {
  position: relative; background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 14px 12px 16px; display: flex; flex-direction: column; gap: 8px;
}
.step-num {
  width: 26px; height: 26px; border-radius: 50%;
  background: var(--ink); color: #fff; font-size: 12px; font-weight: 700;
  display: grid; place-items: center;
}
.step-body { display: flex; flex-direction: column; gap: 4px; }
.step-body strong { font-size: 14px; font-weight: 700; }
.step-body span { font-size: 12.5px; color: var(--text-3); line-height: 1.5; }

.price-list { display: flex; flex-direction: column; gap: 10px; }
.price-row {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 16px 18px; transition: border-color .2s;
}
.price-main {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 6px;
}
.price-main strong { font-size: 15px; }
.price-range { font-size: 18px; font-weight: 800; color: var(--ink); letter-spacing: -.3px; white-space: nowrap; }
.price-row p { margin: 0; font-size: 13px; color: var(--text-3); line-height: 1.6; }

.case-scroll {
  display: flex; gap: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch;
  scrollbar-width: none; padding-bottom: 4px; margin-inline: -2px; padding-inline: 2px;
}
.case-scroll::-webkit-scrollbar { display: none; }
.case-card {
  flex: 0 0 168px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 10px; display: flex; flex-direction: column; gap: 8px;
  transition: border-color .2s, transform .2s;
}
.case-card:active { transform: scale(.98); }
.case-title {
  margin: 0; font-size: 13px; font-weight: 650; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  min-height: 36px;
}
.case-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.case-sales { font-size: 11px; color: var(--text-4); }

.body-block .body p { margin: 0 0 12px; font-size: 15px; color: var(--text-2); line-height: 1.85; }
.body-block .body p:last-child { margin-bottom: 0; }

.faq :deep(.el-collapse-item__header) {
  font-weight: 650; font-size: 14.5px; color: var(--text-1); height: auto; line-height: 1.5; padding: 14px 0;
}
.faq :deep(.el-collapse-item__wrap) { border-bottom-color: var(--border); }
.faq :deep(.el-collapse-item__content) { padding-bottom: 14px; }
.faq p { margin: 0; font-size: 14px; color: var(--text-3); line-height: 1.75; }

.cta-panel {
  background: linear-gradient(145deg, #0a0a0b 0%, #1c1c1f 55%, #0f766e 160%);
  color: #fafafa; border-radius: 18px; padding: 28px 24px; text-align: center;
}
.cta-panel h2 { margin: 0 0 8px; font-size: 20px; font-weight: 750; letter-spacing: -.2px; }
.cta-panel p { margin: 0 0 18px; font-size: 13.5px; color: rgba(255,255,255,.72); line-height: 1.6; }
.cta-panel .cta-row { justify-content: center; }
.cta-panel :deep(.el-button--default) {
  --el-button-bg-color: transparent;
  --el-button-text-color: #fafafa;
  --el-button-border-color: rgba(255,255,255,.28);
}

.cta-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.cta-main { min-width: 148px; }
.tip { margin: 0; font-size: 13px; color: var(--text-3); line-height: 1.6; }

.highlights {
  list-style: none; padding: 0; margin: 0 0 28px; display: grid; gap: 10px;
}
.highlights li {
  position: relative; padding: 12px 16px 12px 40px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  font-size: 14.5px; color: var(--text-2); font-weight: 550;
}
.highlights li::before {
  content: ''; position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
  width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
}
.body { margin-bottom: 28px; }
.body p { margin: 0 0 14px; font-size: 15px; color: var(--text-2); line-height: 1.85; }

.sticky-cta {
  display: none;
  position: fixed; left: 0; right: 0; z-index: 40;
  bottom: calc(var(--mobile-nav-h, 56px) + env(safe-area-inset-bottom));
  padding: 10px 14px;
  background: linear-gradient(180deg, transparent, var(--bg) 28%);
  pointer-events: none;
}
.sticky-cta :deep(.store-btn) {
  pointer-events: auto; width: 100%; box-shadow: var(--shadow-sm);
}

@media (hover: hover) and (pointer: fine) {
  .svc-item:hover, .price-row:hover, .case-card:hover { border-color: var(--ink); }
}

@media (max-width: 900px) {
  .steps { grid-template-columns: 1fr; gap: 8px; }
  .step { flex-direction: row; align-items: flex-start; gap: 12px; padding: 14px 14px; }
  .step-body { padding-top: 2px; }
}

@media (max-width: 768px) {
  .landing { padding: 16px 0 48px; }
  .landing--sticky { padding-bottom: calc(88px + var(--mobile-nav-h, 56px)); }
  .title { font-size: 24px; }
  .sub { font-size: 14px; margin-bottom: 16px; }
  .hero { margin-bottom: 28px; }
  .hero-cta { flex-direction: column; }
  .hero-cta :deep(.store-btn) { width: 100%; }
  .block { margin-bottom: 32px; }
  .block-title { font-size: 17px; }
  .svc-grid { grid-template-columns: 1fr; gap: 10px; }
  .svc-item { padding: 16px 14px; }
  .price-main { flex-direction: column; align-items: flex-start; gap: 4px; }
  .price-range { font-size: 17px; }
  .case-card { flex-basis: 148px; }
  .cta-panel { padding: 22px 16px; text-align: left; }
  .cta-panel h2 { font-size: 17px; }
  .cta-row { flex-direction: column; }
  .cta-row :deep(.store-btn) { width: 100%; }
  .sticky-cta { display: block; }
  .sk-grid { grid-template-columns: 1fr; }
  .highlights li { padding: 10px 12px 10px 36px; font-size: 13.5px; }
}
</style>
