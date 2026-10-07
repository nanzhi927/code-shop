<template>
  <div>
    <section class="hero">
      <div class="hero-visual" aria-hidden="true">
        <img v-if="heroCover" :src="heroCover" alt="" fetchpriority="high" />
        <div class="hero-mask" />
      </div>
      <div class="page-container hero-inner">
        <p class="hero-brand fade-up">{{ heroBrand }}</p>
        <h1 class="hero-title fade-up stagger-1">{{ heroTitle }}</h1>
        <p class="hero-sub fade-up stagger-2">{{ heroSub }}</p>
        <div class="hero-cta fade-up stagger-3">
          <router-link to="/products" class="btn-ink">浏览全部</router-link>
          <button type="button" class="btn-ghost" @click="goSpring">按 SpringBoot 看</button>
        </div>
      </div>
    </section>

    <div class="trust-strip">
      <div class="page-container trust-inner">
        {{ trustLine }}
      </div>
    </div>

    <section v-if="topCategories.length" class="page-container section">
      <SectionHeader title="按分类逛" more-to="/products" />
      <div class="category-chips">
        <button
          v-for="c in topCategories"
          :key="c.name"
          type="button"
          class="category-chip"
          @click="goCategory(c.name)"
        >
          <span class="chip-name">{{ c.name }}</span>
          <span class="chip-cnt">{{ c.cnt }}</span>
        </button>
      </div>
    </section>

    <section v-if="techs.length" class="page-container section">
      <SectionHeader title="按技术栈挑选" more-to="/products" />
      <div class="tech-chips" aria-label="技术栈">
        <FilterChip
          v-for="t in techs"
          :key="t.tech"
          :count="t.cnt"
          @click="goTech(t.tech)"
        >{{ t.tech }}</FilterChip>
      </div>
    </section>

    <section v-if="hotProducts.length" class="page-container section">
      <SectionHeader title="热销精选" :more-to="{ path: '/products', query: { sort: 'hot' } }" />
      <div class="hot-grid">
        <ProductCard
          v-for="(p, i) in hotProducts"
          :key="p.id"
          :product="p"
          :rank="i + 1"
          :eager="i < 4"
          show-meta
          v-reveal="{ value: (i % 8) * 40 }"
        />
      </div>
    </section>

    <section v-if="cases.length" class="page-container section">
      <SectionHeader title="近期交付" more-to="/cases" more-text="全部案例 →" />
      <div class="case-home-list">
        <router-link
          v-for="(c, i) in cases"
          :key="c.id"
          class="case-home-story"
          :to="`/cases/${c.slug}`"
          v-reveal="{ value: (i % 4) * 40 }"
        >
          <div class="chs-meta">
            <span class="chs-tag">{{ c.service_label || '案例' }}</span>
            <span v-if="c.duration_label" class="chs-dur">{{ c.duration_label }}</span>
          </div>
          <strong class="chs-title">{{ c.title }}</strong>
          <span class="chs-sum">{{ c.summary }}</span>
        </router-link>
      </div>
    </section>

    <section v-if="articles.length" class="page-container section">
      <SectionHeader title="毕设教程" more-to="/articles" more-text="全部教程 →" />
      <div class="article-home-grid">
        <router-link
          v-for="(a, i) in articles"
          :key="a.id"
          class="article-home-card"
          :to="`/articles/${a.slug}`"
          v-reveal="{ value: (i % 5) * 40 }"
        >
          <span v-if="a.category" class="ah-cat">{{ a.category }}</span>
          <strong class="ah-title">{{ a.title }}</strong>
          <span class="ah-sum">{{ a.summary }}</span>
        </router-link>
      </div>
      <div class="guide-cta">
        <router-link to="/services/proposal" class="guide-btn primary">免费开题助手</router-link>
        <router-link to="/articles" class="guide-btn">看全部教程</router-link>
      </div>
    </section>

    <section class="page-container section" v-loading="loading">
      <div class="prod-head">
        <h2 class="section-title">最新上架</h2>
        <div class="sort-tabs" role="tablist">
          <button
            v-for="s in sortOptions"
            :key="s.value"
            type="button"
            role="tab"
            :class="{ active: sort === s.value }"
            :aria-selected="sort === s.value"
            @click="changeSort(s.value)"
          >{{ s.label }}</button>
        </div>
      </div>
      <div class="product-grid">
        <ProductCard
          v-for="(p, i) in products"
          :key="p.id"
          :product="p"
          :eager="i < 4"
          show-materials
          show-meta
          v-reveal="{ value: (i % 8) * 40 }"
        />
      </div>
      <div v-if="!products.length && !loading" class="empty-illus">
        <div class="ei-icon">空</div>
        <p class="ei-title">暂无商品</p>
        <p class="ei-desc">稍后再来看看</p>
      </div>
    </section>

    <section class="page-container section">
      <SectionHeader title="购买流程" />
      <div class="steps-grid">
        <div v-for="(step, i) in purchaseSteps" :key="i" class="step-item" v-reveal="{ value: i * 50 }">
          <div class="step-num">{{ step.num }}</div>
          <h4 class="step-title">{{ step.title }}</h4>
          <p class="step-desc">{{ step.desc }}</p>
        </div>
      </div>
    </section>

    <section class="page-container section trust">
      <SectionHeader title="为什么选择我们" />
      <div class="trust-grid">
        <div class="trust-item" v-for="(it, i) in trusts" :key="i" v-reveal="{ value: i * 50 }">
          <div class="trust-mark">{{ it.mark }}</div>
          <div>
            <h4>{{ it.title }}</h4>
            <p>{{ it.desc }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import http from '../../api';
import SectionHeader from '../../components/store/SectionHeader.vue';
import ProductCard from '../../components/store/ProductCard.vue';
import FilterChip from '../../components/store/FilterChip.vue';
import {
  setSeo, setJsonLd, removeJsonLd, siteOrigin, SITE_NAME, SITE_DESCRIPTION
} from '../../composables/useSeo';

const router = useRouter();
const products = ref([]);
const techs = ref([]);
const categories = ref([]);
const hotProducts = ref([]);
const articles = ref([]);
const cases = ref([]);
const settings = ref({});
const loading = ref(false);
const sort = ref('latest');
const totalProducts = ref(0);

const sortOptions = [
  { value: 'latest', label: '最新上架' },
  { value: 'sales', label: '销量优先' },
  { value: 'hot', label: '热销' },
  { value: 'price_asc', label: '价格升序' }
];

const heroBrand = computed(() => settings.value.site_name || '源码商城');
const heroTitle = computed(() =>
  settings.value.banner_title || settings.value.banner_text || '精选可运行的实训项目'
);
const heroSub = computed(() =>
  settings.value.banner_sub || '按技术栈挑选，对照演示，独立完成你的部分'
);

const heroCover = computed(() => {
  const fromHot = hotProducts.value.find((p) => p.cover)?.cover;
  const fromLatest = products.value.find((p) => p.cover)?.cover;
  return fromHot || fromLatest || '';
});

const trustLine = computed(() => {
  const n = totalProducts.value || 0;
  const t = techs.value.length || 0;
  return `${n}+ 套精选 · ${t} 种技术栈 · 人工核对交付`;
});

const topCategories = computed(() =>
  [...categories.value].sort((a, b) => b.cnt - a.cnt).slice(0, 14)
);

const purchaseSteps = [
  { num: '01', title: '选购下单', desc: '按分类或技术栈挑选，对照演示后加入订单' },
  { num: '02', title: '在线支付', desc: '支持多种支付方式，也可使用卡密兑换' },
  { num: '03', title: '交付领取', desc: '支付成功后自动发送下载链接，或客服一对一交付' },
  { num: '04', title: '对照运行', desc: '按运行说明部署，遇到问题随时联系售后' }
];

const trusts = [
  { mark: '01', title: '材料如实标注', desc: '论文、PPT、演示视频是否包含，商品页写明，标了才有' },
  { mark: '02', title: '交付内容清晰', desc: '源码工程、数据库脚本、运行说明按包交付' },
  { mark: '03', title: '上架前核对', desc: '上架前核对包内材料，标注所需运行环境与注意事项' },
  { mark: '04', title: '客服对接', desc: '付款后加客服发订单号；交付物问题协助处理' }
];

async function loadHot() {
  try {
    const res = await http.get('/products/hot');
    hotProducts.value = Array.isArray(res) ? res.slice(0, 8) : [];
  } catch {
    hotProducts.value = [];
  }
}

async function loadArticles() {
  try {
    const res = await http.get('/articles', { params: { page: 1, pageSize: 8 } });
    articles.value = res.list || [];
  } catch {
    articles.value = [];
  }
}

async function loadCases() {
  try {
    const res = await http.get('/cases', { params: { page: 1, pageSize: 4 } });
    cases.value = res.list || [];
  } catch {
    cases.value = [];
  }
}

async function load() {
  loading.value = true;
  try {
    const [listRes, totalRes, techRes, settingsRes, catRes] = await Promise.all([
      http.get('/products', { params: { page: 1, pageSize: 12, sort: sort.value } }),
      http.get('/products', { params: { page: 1, pageSize: 1 } }),
      http.get('/products/techs'),
      http.get('/settings/public'),
      http.get('/products/categories')
    ]);
    products.value = listRes.list;
    totalProducts.value = totalRes.total ?? listRes.total ?? 0;
    techs.value = techRes;
    settings.value = settingsRes;
    categories.value = catRes;
    const desc =
      settingsRes.site_meta_description ||
      '毕设 / 课程设计源码：SpringBoot / SSM / JSP / 小程序等主流技术栈，含源码工程、数据库脚本与运行说明；论文与 PPT 以商品页标注为准。';
    setSeo({
      title: '毕设源码商城 - 毕业设计 / 课程设计 Java 源码一站购',
      description: desc,
      keywords:
        '毕业设计,毕设,课程设计,毕设源码,Java源码,SpringBoot源码,SSM源码,论文答辩'
    });
    const origin = siteOrigin();
    setJsonLd('home-website', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: origin,
      description: desc
    });
    setJsonLd('home-org', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: origin,
      description: SITE_DESCRIPTION
    });
  } finally {
    loading.value = false;
  }
}

function changeSort(value) {
  if (sort.value === value) return;
  sort.value = value;
  load();
}

function goTech(tech) { router.push({ path: '/products', query: { tech } }); }
function goCategory(name) { router.push({ path: '/products', query: { category: name } }); }
function goSpring() {
  const hit = techs.value.find((t) => /spring.?boot/i.test(t.tech || ''));
  goTech(hit?.tech || 'SpringBoot');
}

onMounted(() => {
  load();
  loadHot();
  loadArticles();
  loadCases();
});
onBeforeUnmount(() => {
  removeJsonLd('home-website');
  removeJsonLd('home-org');
});
</script>

<style scoped>
.hero {
  position: relative;
  overflow: hidden;
  color: #fff;
  min-height: 72vh;
  display: flex;
  align-items: flex-end;
  padding: 0;
  background: #0a0a0b;
}
.hero-visual {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.hero-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: saturate(.78) contrast(1.05);
}
.hero-mask {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(10, 10, 11, .28) 0%, rgba(10, 10, 11, .55) 42%, rgba(10, 10, 11, .88) 100%),
    linear-gradient(90deg, rgba(10, 10, 11, .45) 0%, transparent 55%);
}
.hero-inner {
  position: relative;
  z-index: 1;
  text-align: left;
  max-width: var(--container);
  padding-top: 96px;
  padding-bottom: 56px;
}
.hero-brand {
  margin: 0 0 16px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: .18em;
  text-transform: none;
  color: rgba(250, 250, 250, .72);
}
.hero-title {
  font-family: var(--font-display);
  font-size: clamp(32px, 5.2vw, 52px);
  font-weight: 700;
  line-height: 1.12;
  margin: 0 0 16px;
  letter-spacing: -.035em;
  color: #fff;
  max-width: 16em;
}
.hero-sub {
  font-size: 15px;
  color: rgba(228, 228, 231, .78);
  margin: 0 0 32px;
  line-height: 1.7;
  max-width: 28em;
}
.hero-cta { display: flex; flex-wrap: wrap; gap: 12px; }

.trust-strip {
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.trust-inner {
  padding-top: 14px;
  padding-bottom: 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-3);
  letter-spacing: .02em;
}

.section { margin-top: 56px; }
.prod-head {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 12px; margin-bottom: 20px;
}
.prod-head .section-title { margin-bottom: 0; }

.sort-tabs {
  display: flex; gap: 0; flex-wrap: wrap;
  border-bottom: 1px solid var(--border);
}
.sort-tabs button {
  appearance: none; background: none; border: 0; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 500;
  color: var(--text-3); padding: 8px 14px 10px;
  position: relative; transition: color .18s;
}
.sort-tabs button:hover { color: var(--text-1); }
.sort-tabs button.active { color: var(--text-1); font-weight: 600; }
.sort-tabs button.active::after {
  content: ""; position: absolute; left: 14px; right: 14px; bottom: -1px;
  height: 1.5px; background: var(--ink);
}

.category-chips {
  display: flex; flex-wrap: wrap; gap: 8px;
}
.category-chip {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 8px;
  background: transparent; border: 1px solid var(--border);
  cursor: pointer; font-family: inherit;
  transition: border-color .18s, background .18s;
}
.category-chip:hover { border-color: var(--ink); background: var(--bg-alt); }
.chip-name { font-size: 13.5px; font-weight: 500; color: var(--text-1); }
.chip-cnt { font-size: 12px; color: var(--text-4); font-variant-numeric: tabular-nums; font-family: var(--font-num); }

.tech-chips {
  display: flex; flex-wrap: wrap; gap: 8px;
}

.hot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }

.article-home-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px;
}
.case-home-list {
  display: flex; flex-direction: column; gap: 10px; max-width: 760px;
}
.case-home-story {
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px 18px;
  border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface); text-decoration: none; color: inherit;
  transition: border-color .18s, transform .18s var(--ease);
}
.case-home-story:hover {
  border-color: var(--ink); transform: translateY(-1px);
}
.chs-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.chs-tag {
  font-size: 12px; font-weight: 600; color: var(--text-3);
  border: 1px solid var(--border); background: var(--bg-alt);
  padding: 2px 8px; border-radius: 999px;
}
.chs-dur { font-size: 12px; font-weight: 650; color: #0f766e; }
.chs-title {
  font-size: 15.5px; line-height: 1.4; color: var(--text-1); font-weight: 700;
}
.chs-sum {
  font-size: 13.5px; line-height: 1.6; color: var(--text-3);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.article-home-card {
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px 16px 18px;
  border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface); text-decoration: none; color: inherit;
  transition: border-color .18s, transform .18s var(--ease);
}
.article-home-card:hover {
  border-color: var(--ink); transform: translateY(-2px);
}
.ah-cat {
  align-self: flex-start;
  font-size: 12px; font-weight: 600; color: var(--text-3);
  border: 1px solid var(--border); background: var(--bg-alt);
  padding: 2px 8px; border-radius: 999px;
}
.ah-title {
  font-size: 15px; line-height: 1.4; color: var(--text-1); font-weight: 700;
}
.ah-sum {
  font-size: 13px; line-height: 1.6; color: var(--text-3);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.guide-cta {
  display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px;
}
.guide-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 16px; font-size: 13.5px; font-weight: 600;
  text-decoration: none; border-radius: 999px;
  border: 1px solid var(--border); color: var(--text-1); background: var(--surface);
  transition: border-color .18s, background .18s, color .18s;
}
.guide-btn:hover { border-color: var(--ink); }
.guide-btn.primary {
  background: var(--ink); border-color: var(--ink); color: #fff;
}
.guide-btn.primary:hover { filter: brightness(1.08); }

.steps-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; }
.step-item { padding: 0; text-align: left; }
.step-num {
  font-family: var(--font-num);
  font-size: 13px; font-weight: 600; color: var(--text-4);
  letter-spacing: .08em; margin-bottom: 10px;
}
.step-title { margin: 0 0 6px; font-size: 15px; color: var(--text-1); font-weight: 600; }
.step-desc { margin: 0; font-size: 13px; color: var(--text-3); line-height: 1.7; }

.trust-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px 32px; }
.trust-item { display: flex; gap: 14px; align-items: flex-start; }
.trust-mark {
  font-family: var(--font-num); font-size: 12px; font-weight: 600;
  color: var(--text-4); letter-spacing: .06em; padding-top: 3px; flex-shrink: 0;
}
.trust-item h4 { margin: 0 0 6px; font-size: 14.5px; font-weight: 600; }
.trust-item p { margin: 0; font-size: 13px; color: var(--text-3); line-height: 1.7; }

@media (max-width: 768px) {
  .hero { min-height: 68vh; }
  .hero-inner { padding-top: 72px; padding-bottom: 40px; }
  .hero-title { max-width: none; }
  .hero-sub { font-size: 13.5px; margin-bottom: 24px; }
  .hero-cta { width: 100%; }
  .hero-cta .btn-ink,
  .hero-cta .btn-ghost { flex: 1; min-width: 0; }
  .section { margin-top: 36px; }
  .category-chips {
    display: flex; flex-wrap: nowrap; gap: 8px;
    overflow-x: auto; -webkit-overflow-scrolling: touch;
    scrollbar-width: none; padding-bottom: 4px; margin: 0 -4px; padding-inline: 4px;
  }
  .category-chips::-webkit-scrollbar { display: none; }
  .category-chip { min-width: max-content; flex-shrink: 0; }
  .tech-chips {
    display: flex; flex-wrap: nowrap; gap: 8px;
    overflow-x: auto; -webkit-overflow-scrolling: touch;
    scrollbar-width: none; padding-bottom: 4px;
  }
  .tech-chips::-webkit-scrollbar { display: none; }
  .hot-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .steps-grid { grid-template-columns: 1fr 1fr; gap: 20px 16px; }
  .prod-head { gap: 8px; }
  .sort-tabs { width: 100%; overflow-x: auto; scrollbar-width: none; }
  .sort-tabs button { padding: 8px 10px 10px; white-space: nowrap; }
}
@media (max-width: 480px) {
  .steps-grid { grid-template-columns: 1fr; }
}
</style>
