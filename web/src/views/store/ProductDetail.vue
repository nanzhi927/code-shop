<template>
  <div class="page-container" v-loading="loading">
    <el-breadcrumb separator="/" style="margin: 20px 0">
      <el-breadcrumb-item to="/">首页</el-breadcrumb-item>
      <el-breadcrumb-item to="/products">全部源码</el-breadcrumb-item>
      <el-breadcrumb-item>{{ product?.title }}</el-breadcrumb-item>
    </el-breadcrumb>

    <div v-if="product" class="detail">
      <!-- 顶部：画廊 + 主信息 -->
      <div class="top-grid">
        <div class="cover-side">
          <div class="main-cover" @click="zoomCover">
            <img v-if="mainImg" :src="mainImg" :alt="product.title" decoding="async" />
            <ProductCover v-else :product="product" class="cover-placeholder" eager />
          </div>
          <div v-if="thumbnails.length > 1" class="thumbs">
            <div
              v-for="(t, i) in thumbnails" :key="i"
              class="thumb" :class="{ active: mainImg === t }"
              @click="mainImg = t"
            >
              <img :src="t" alt="缩略图" loading="lazy" decoding="async" />
            </div>
          </div>
          <ul class="cover-assure">
            <li>含源码工程 · 数据库脚本 · 运行说明（标配）</li>
            <li>论文 / PPT / 演示视频以商品页标注为准</li>
            <li>付款后加客服发订单号，核对后发网盘</li>
          </ul>
        </div>
        <div class="info-card">
          <div class="head">
            <div class="title-line">
              <h1>{{ product.title }}</h1>
              <span v-if="product.category" class="cat-pill">{{ product.category }}</span>
              <span
                v-if="product.run_status != null"
                class="run-pill"
                :class="'rs-' + product.run_status"
              >{{ runStatusText(product.run_status) }}</span>
            </div>
            <div class="meta-badges">
              <span v-if="product.tech" class="mb mb-tech">{{ product.tech }}</span>
              <span v-for="b in materialBadges" :key="b.key" class="mb" :class="b.cls">
                <i class="mb-dot" aria-hidden="true" />{{ b.label }}
              </span>
            </div>
          </div>

          <dl class="spec-list">
            <div class="spec-row">
              <dt>源码编号</dt>
              <dd>{{ product.product_no || '—' }}</dd>
            </div>
            <div class="spec-row">
              <dt>体积</dt>
              <dd>{{ product.size_mb >= 1024 ? (product.size_mb / 1024).toFixed(1) + ' GB' : product.size_mb + ' MB' }}</dd>
            </div>
            <div class="spec-row">
              <dt>技术栈</dt>
              <dd>{{ product.tech }}</dd>
            </div>
            <div class="spec-row">
              <dt>交付方式</dt>
              <dd>购买后人工发货（网盘链接）</dd>
            </div>
          </dl>

          <div class="buy-bar">
            <div class="buy-main">
              <div class="price-box">
                <span class="now">¥{{ product.price }}</span>
                <span v-if="Number(product.original_price) > Number(product.price)" class="orig">¥{{ product.original_price }}</span>
              </div>
              <div class="guarantee-row">
                <span>{{ runStatusText(product.run_status) }}</span>
                <span>售后保障</span>
                <span>网盘交付</span>
              </div>
            </div>
            <div class="btns">
              <StoreButton variant="outline" @click="addCart">加入购物车</StoreButton>
              <StoreButton variant="solid" @click="buyNow">立即购买</StoreButton>
            </div>
            <div class="aux-links">
              <button v-if="product.demo_url" type="button" class="aux-link" @click="openDemo">在线演示</button>
              <button v-if="product.video_url" type="button" class="aux-link" @click="scrollToVideo">介绍视频</button>
              <button type="button" class="aux-link" @click="shareLink">分享</button>
              <button type="button" class="aux-link" @click="toggleFav">{{ favorited ? '已收藏' : '收藏' }}</button>
            </div>
          </div>

          <div class="mini-meta">
            <span>销量 {{ product.sales || 0 }}</span>
            <span>浏览 {{ product.views || 0 }}</span>
            <span v-if="product.demo_url" class="demo-hint">支持在线演示，点击上方按钮即可体验</span>
          </div>

          <div class="delivery-flow">
            <h3 class="delivery-title">交付流程</h3>
            <div class="delivery-steps">
              <div class="d-step">
                <span class="d-num">1</span>
                <div>
                  <b>付款下单</b>
                  <p>完成支付后请保留订单号</p>
                </div>
              </div>
              <div class="d-step">
                <span class="d-num">2</span>
                <div>
                  <b>加客服发订单号</b>
                  <p>添加客服微信 / QQ，把订单号发给客服</p>
                </div>
              </div>
              <div class="d-step">
                <span class="d-num">3</span>
                <div>
                  <b>核对后发网盘</b>
                  <p>客服核对订单后，发送网盘下载方式</p>
                </div>
              </div>
            </div>
            <p class="delivery-warn">只付款、不加客服、不发订单号，无法完成交付。</p>
            <div v-if="hasServiceContact" class="delivery-contact">
              <div v-if="settings.service_wechat || settings.service_qq" class="dc-rows">
                <span v-if="settings.service_wechat">微信：<b>{{ settings.service_wechat }}</b></span>
                <span v-if="settings.service_qq">QQ：<b>{{ settings.service_qq }}</b></span>
              </div>
              <div v-if="settings.service_wechat_qr || settings.service_qq_qr" class="dc-qr">
                <div v-if="settings.service_wechat_qr" class="dc-qr-item">
                  <el-image :src="settings.service_wechat_qr" style="width: 88px; height: 88px" fit="contain" lazy />
                  <span>微信扫码</span>
                </div>
                <div v-if="settings.service_qq_qr" class="dc-qr-item">
                  <el-image :src="settings.service_qq_qr" style="width: 88px; height: 88px" fit="contain" lazy />
                  <span>QQ 扫码</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 详情内容区 -->
      <div class="detail-body">
        <div v-if="product.video_url" id="intro-video" class="d-block">
          <h3 class="d-title">介绍视频</h3>
          <div class="video-wrap">
            <iframe
              v-if="isEmbed(product.video_url)"
              :src="embedUrl(product.video_url)"
              allowfullscreen
              allow="fullscreen; encrypted-media"
              referrerpolicy="no-referrer"
            />
            <video v-else :src="product.video_url" controls playsinline preload="metadata" />
          </div>
          <p v-if="!isEmbed(product.video_url) && isExternalPage(product.video_url)" class="video-ext">
            无法内嵌播放时，可
            <a :href="safeHttpUrl(product.video_url)" target="_blank" rel="noopener noreferrer">新窗口打开视频</a>
          </p>
        </div>

        <div v-if="hasIntroContent" class="d-block about-block">
          <h3 class="d-title">关于本项目</h3>

          <p v-if="introOverview" class="about-lead">{{ introOverview }}</p>

          <div v-if="introMaterials.length" class="about-row">
            <div class="about-k">交付内容</div>
            <div class="about-v mat-wrap">
              <span v-for="m in introMaterials" :key="m" class="mat-chip">{{ m }}</span>
            </div>
          </div>

          <div v-if="introFeatures.length" class="about-row">
            <div class="about-k">核心功能</div>
            <div class="about-v">
              <ul class="about-cols">
                <li v-for="f in introFeatures" :key="f">{{ f }}</li>
              </ul>
            </div>
          </div>

          <div v-if="techLine.length || runEnvTags.length" class="about-row">
            <div class="about-k">技术环境</div>
            <div class="about-v">
              <p v-if="techLine.length" class="about-text"><span class="about-sub">技术栈</span>{{ techLine.join(' · ') }}</p>
              <p v-if="runEnvTags.length" class="about-text"><span class="about-sub">运行环境</span>{{ runEnvTags.join(' · ') }}</p>
            </div>
          </div>

          <div v-if="tableLine.length" class="about-row">
            <div class="about-k">数据库</div>
            <div class="about-v">
              <p class="about-note">共 {{ tableLine.length }} 张核心表</p>
              <ul class="about-cols mono">
                <li v-for="tb in tableLine" :key="tb">{{ tb }}</li>
              </ul>
            </div>
          </div>

          <div v-if="introScenario.length" class="about-row">
            <div class="about-k">适用场景</div>
            <div class="about-v">
              <ul class="about-list">
                <li v-for="s in introScenario" :key="s">{{ s }}</li>
              </ul>
            </div>
          </div>

          <div v-if="introDelivery.length" class="about-row about-row-last">
            <div class="about-k">购买说明</div>
            <div class="about-v">
              <ul class="about-list soft">
                <li v-for="s in introDelivery" :key="s">{{ s }}</li>
              </ul>
            </div>
          </div>
        </div>

        <div v-if="funcTree" class="d-block">
          <h3 class="d-title">功能结构图</h3>
          <FuncStructure :tree="funcTree" />
        </div>

        <div v-if="dirTree" class="d-block">
          <h3 class="d-title">项目目录</h3>
          <ProjectDirTree :tree="dirTree" />
        </div>

        <div v-if="details.screenshots?.length" class="d-block">
          <h3 class="d-title">项目截图</h3>
          <div class="shot-grid">
            <div v-for="(s, i) in details.screenshots" :key="s" class="shot-item">
              <el-image
                :src="s"
                fit="cover"
                lazy
                :preview-src-list="details.screenshots"
                :initial-index="i"
                preview-teleported
              />
            </div>
          </div>
        </div>

        <div v-if="product.files?.length" class="d-block">
          <h3 class="d-title">文件清单</h3>
          <div class="file-list">
            <div v-for="f in product.files" :key="f.id" class="file-row">
              <el-tag size="small" effect="plain">{{ FILE_KIND[f.kind] || f.kind || '其他材料' }}</el-tag>
              <span class="file-name">{{ fileDisplayName(f) }}</span>
              <span class="file-size">{{ formatSize(f.size_mb) }}</span>
            </div>
          </div>
        </div>

        <div v-if="product.qa_note" class="d-block">
          <el-alert
            type="warning" show-icon :closable="false"
            title="注意事项" :description="product.qa_note" class="qa-alert"
          />
        </div>

        <div v-if="product.reviews?.length" class="d-block">
          <h3 class="d-title">用户评价（{{ product.reviews.length }}）</h3>
          <div v-if="reviewStats" class="review-summary">
            <div class="rs-left">
              <span class="rs-avg">{{ reviewStats.avgRating }}</span>
              <el-rate :model-value="reviewStats.avgRating" disabled />
              <span class="rs-total">共 {{ reviewStats.total }} 条评价</span>
            </div>
            <div class="rs-bars">
              <div v-for="d in reviewStats.distribution" :key="d.star" class="rs-bar-row">
                <span class="rs-star">{{ d.star }}星</span>
                <div class="rs-bar-track"><div class="rs-bar-fill" :style="{ width: (d.count / reviewStats.total * 100) + '%' }"></div></div>
                <span class="rs-count">{{ d.count }}</span>
              </div>
            </div>
          </div>
          <div class="review-list">
            <div v-for="r in product.reviews" :key="r.id" class="review-item">
              <div class="review-head">
                <span class="review-user">{{ r.username || '匿名用户' }}</span>
                <el-rate :model-value="r.rating" disabled size="small" />
                <span class="review-time">{{ r.created_at }}</span>
              </div>
              <p v-if="r.content" class="review-content">{{ r.content }}</p>
            </div>
          </div>
        </div>

        <div class="d-block notice">
          <h3 class="d-title">购买须知</h3>
          <ol class="notice-list">
            <li>本商品仅供学习参考，请勿用于商业用途或学术不端。</li>
            <li>交付请按上方「交付流程」完成：付款 → 加客服发订单号 → 领取网盘链接。</li>
          </ol>
        </div>
      </div>

      <section v-if="related.length" class="related">
        <SectionHeader title="相关推荐" more-to="/products" />
        <div class="product-grid related-grid">
          <ProductCard
            v-for="p in related"
            :key="p.id"
            :product="p"
          />
        </div>
      </section>
    </div>

    <transition name="slide-up">
      <div v-if="showSticky && product" class="sticky-bar glass">
        <img v-if="product.cover" :src="product.cover" class="sb-cover" loading="lazy" decoding="async" />
        <div class="sb-info">
          <div class="sb-title">{{ product.title }}</div>
          <div class="sb-price">¥{{ product.price }}</div>
        </div>
        <div class="sb-btns">
          <StoreButton variant="outline" @click="addCart">加入购物车</StoreButton>
          <StoreButton variant="solid" @click="buyNow">立即购买</StoreButton>
        </div>
      </div>
    </transition>

    <el-dialog v-model="previewVisible" width="720px" :title="product?.title" destroy-on-close>
      <div style="text-align:center">
        <el-image :src="details.screenshots?.[previewIndex]" fit="contain" style="max-height: 70vh; width: 100%" />
      </div>
      <template #footer>
        <el-button @click="previewIndex = (previewIndex - 1 + details.screenshots.length) % details.screenshots.length">上一张</el-button>
        <el-button type="primary" @click="previewIndex = (previewIndex + 1) % details.screenshots.length">下一张</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import http from '../../api';
import { useCartStore } from '../../stores/cart';
import { useUserStore } from '../../stores/user';
import ProductCover from '../../components/ProductCover.vue';
import ProductCard from '../../components/store/ProductCard.vue';
import SectionHeader from '../../components/store/SectionHeader.vue';
import StoreButton from '../../components/store/StoreButton.vue';
import FuncStructure from '../../components/FuncStructure.vue';
import ProjectDirTree from '../../components/ProjectDirTree.vue';
import { FILE_KIND, runStatusText } from '../../utils/runStatus';
import { setSeo, resetSeo, setJsonLd, removeJsonLd } from '../../composables/useSeo';

const RUN_ENV_MAP = {
  maven: 'Maven', node: 'Node/npm', springBoot: 'Spring Boot', sql: '数据库脚本',
  vue: 'Vue', servlet: 'Servlet/JSP', mybatis: 'MyBatis', jsp: 'JSP'
};

const route = useRoute();
const router = useRouter();
const cartStore = useCartStore();
const userStore = useUserStore();

const product = ref(null);
const loading = ref(true);
const favorited = ref(false);
const previewIndex = ref(0);
const previewVisible = ref(false);
const mainImg = ref('');
const related = ref([]);
const showSticky = ref(false);
const settings = ref({});
function onResize() {}

const hasServiceContact = computed(() => {
  const s = settings.value || {};
  return !!(s.service_wechat || s.service_qq || s.service_wechat_qr || s.service_qq_qr);
});

const details = computed(() => product.value?.details || {});

const intro = computed(() => details.value.intro || null);

const introOverview = computed(() => {
  if (intro.value?.overview) return intro.value.overview;
  const raw = (product.value?.description || '').replace(/\n*——由源码探测自动生成[^\n]*/g, '').trim();
  if (!raw) return '';
  // 旧版【章节】文本：只取概述段正文
  const m = raw.match(/【项目概述】\s*([\s\S]*?)(?=\n【|$)/);
  if (m) return m[1].replace(/\n+/g, '').trim();
  if (raw.includes('【')) return '';
  return raw;
});

const introMaterials = computed(() => intro.value?.materials || []);
const introFeatures = computed(() => intro.value?.features || details.value.features || []);
const introScenario = computed(() => intro.value?.scenario || []);
const introDelivery = computed(() => intro.value?.delivery || []);
const materialBadges = computed(() => {
  const p = product.value;
  if (!p) return [];
  const list = [];
  // 只打真实存在的材料标，文案短、好认
  if (Number(p.has_paper)) list.push({ key: 'paper', label: '含论文', cls: 'mb-paper' });
  if (Number(p.has_db)) list.push({ key: 'db', label: '含数据库', cls: 'mb-db' });
  if (Number(p.has_ppt)) list.push({ key: 'ppt', label: '含PPT', cls: 'mb-ppt' });
  if (Number(p.has_video)) list.push({ key: 'video', label: '含视频教程', cls: 'mb-video' });
  if (p.demo_url) list.push({ key: 'demo', label: '可在线演示', cls: 'mb-demo' });
  if (p.video_url) list.push({ key: 'intro', label: '有介绍视频', cls: 'mb-intro' });
  if (Number(p.run_status) === 1) list.push({ key: 'ok', label: '已验证可运行', cls: 'mb-ok' });
  return list;
});
const funcTree = computed(() => {
  const t = intro.value?.func_tree || details.value.func_tree;
  if (t?.children?.length) return t;
  const feats = introFeatures.value;
  if (!feats.length || !product.value) return null;
  const mid = Math.ceil(feats.length / 2);
  return {
    name: String(product.value.title || '本系统').replace(/的设计与实现$/g, '').replace(/设计与实现$/g, '').slice(0, 18),
    children: [
      { name: '前台用户端', children: feats.slice(0, mid).map((name) => ({ name })) },
      { name: '后台管理端', children: feats.slice(mid).map((name) => ({ name })) }
    ]
  };
});

const dirTree = computed(() => intro.value?.dir_tree || details.value.dir_tree || null);

const techLine = computed(() => {
  const fromIntro = intro.value?.tech_stack;
  const list = (fromIntro?.length ? fromIntro : details.value.tech_points) || [];
  // 去重保序
  const seen = new Set();
  return list.filter((t) => {
    const k = String(t).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
});

const tableLine = computed(() => {
  const fromIntro = intro.value?.db_tables;
  return (fromIntro?.length ? fromIntro : details.value.db_tables) || [];
});
const thumbnails = computed(() => {
  if (!product.value) return [];
  const t = [];
  if (product.value.cover) t.push(product.value.cover);
  (details.value.screenshots || []).forEach((s) => t.push(s));
  return t;
});
const runEnvTags = computed(() => {
  const env = product.value?.runEnv || {};
  return Object.entries(RUN_ENV_MAP).filter(([k]) => env[k]).map(([, label]) => label);
});

const hasIntroContent = computed(() =>
  !!(introOverview.value || introMaterials.value.length || introFeatures.value.length
    || techLine.value.length || tableLine.value.length || introScenario.value.length
    || runEnvTags.value.length)
);

const reviewStats = computed(() => {
  const reviews = product.value?.reviews || [];
  const total = reviews.length;
  if (!total) return null;
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  reviews.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 0)));
    dist[star]++;
    sum += Number(r.rating) || 0;
  });
  return {
    avgRating: Math.round((sum / total) * 10) / 10,
    total,
    distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: dist[star] }))
  };
});

function safeHttpUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('/') && !u.startsWith('//')) return u;
  try {
    const parsed = new URL(u, window.location.origin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
  } catch { /* ignore */ }
  return '';
}

function openDemo() {
  const href = safeHttpUrl(product.value?.demo_url);
  if (!href) return ElMessage.warning('演示地址无效');
  window.open(href, '_blank', 'noopener,noreferrer');
}

function scrollToVideo() {
  const el = document.getElementById('intro-video');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function isExternalPage(url) {
  return /^https?:\/\//i.test(String(url || '')) && !/\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
}

function isEmbed(url) {
  return /bilibili\.com|youtu\.be|youtube\.com|youku\.com|player\.bilibili/i.test(String(url || ''));
}
function embedUrl(url) {
  const u = String(url || '');
  const bv = u.match(/bilibili\.com\/video\/(BV[\w]+)/i)?.[1]
    || u.match(/[?&]bvid=(BV[\w]+)/i)?.[1];
  if (bv) return `https://player.bilibili.com/player.html?bvid=${bv}&autoplay=0`;
  const aid = u.match(/bilibili\.com\/video\/av(\d+)/i)?.[1];
  if (aid) return `https://player.bilibili.com/player.html?aid=${aid}&autoplay=0`;
  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/i)?.[1];
  if (yt) return `https://www.youtube.com/embed/${yt}`;
  return u;
}

function formatSize(mb) {
  if (mb == null || mb === '') return '—';
  return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb + ' MB';
}
function fileDisplayName(f) {
  const ext = f.ext ? '.' + f.ext : '';
  return ext && !f.name.endsWith(ext) ? f.name + ext : f.name;
}

async function load() {
  loading.value = true;
  favorited.value = false;
  try {
    const [prod, settingsRes] = await Promise.all([
      http.get(`/products/${route.params.id}`),
      http.get('/settings/public').catch(() => ({}))
    ]);
    product.value = prod;
    settings.value = settingsRes || {};
    mainImg.value = product.value.cover || '';
    const p = product.value;
    const seoDesc =
      p.meta_description || (p.description || '').slice(0, 120) || undefined;
    setSeo({
      title: p.meta_title || p.title,
      description: seoDesc,
      keywords: p.meta_keywords || p.tech
    });
    const productLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.title
    };
    if (seoDesc) productLd.description = seoDesc;
    if (p.price != null && p.price !== '') {
      productLd.offers = {
        '@type': 'Offer',
        price: String(p.price),
        priceCurrency: 'CNY'
      };
    }
    setJsonLd('product-detail', productLd);
    if (userStore.isLogin) {
      const r = await http.get(`/favorites/status/${route.params.id}`);
      favorited.value = r.favorited;
    }
    loadRelated(product.value.tech, product.value.id);
  } finally {
    loading.value = false;
  }
}

async function loadRelated(tech, id) {
  try {
    const res = await http.get('/products', { params: { tech, pageSize: 8, sort: 'sales' } });
    related.value = (res.list || []).filter((p) => p.id !== id).slice(0, 4);
  } catch { /* 忽略 */ }
}

function onScroll() { showSticky.value = window.scrollY > 480; }
function zoomCover() {
  if (details.value.screenshots?.length) { previewIndex.value = 0; previewVisible.value = true; }
}
function addCart() { cartStore.add(product.value); ElMessage.success('已加入购物车'); }
async function shareLink() {
  const url = location.href;
  try { await navigator.clipboard.writeText(url); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  }
  ElMessage.success('链接已复制');
}
async function buyNow() {
  if (!userStore.isLogin) { ElMessage.warning('请先登录'); router.push('/login'); return; }
  try {
    // 详情接口仅返回在售商品；404 即已下架/不存在。若带 status 则仅 0 拦截
    const fresh = await http.get(`/products/${product.value.id}`);
    if (Number(fresh.status) === 0) {
      ElMessage.warning('商品已下架');
      return;
    }
    cartStore.add(fresh);
    router.push('/checkout');
  } catch {
    ElMessage.warning('商品已下架');
  }
}
async function toggleFav() {
  if (!userStore.isLogin) { ElMessage.warning('请先登录'); router.push('/login'); return; }
  if (favorited.value) {
    await http.delete(`/favorites/${product.value.id}`);
    favorited.value = false; ElMessage.success('已取消收藏');
  } else {
    await http.post('/favorites', { productId: product.value.id });
    favorited.value = true; ElMessage.success('收藏成功');
  }
}
function scrollTop() {
  window.scrollTo({ top: 0 });
}

watch(
  () => route.params.id,
  (id) => {
    if (!id) return;
    if (route.name !== 'product-detail') return;
    previewVisible.value = false;
    showSticky.value = false;
    load();
    window.scrollTo({ top: 0 });
  }
);

onMounted(() => {
  load();
  onResize();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
});
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onResize);
  removeJsonLd('product-detail');
  resetSeo();
});
</script>

<style scoped>
.detail { padding: 8px 0 40px; }
.top-grid {
  display: grid; grid-template-columns: minmax(380px, 460px) 1fr; gap: 36px;
  align-items: flex-start; margin-bottom: 32px;
}
@media (min-width: 769px) {
  .info-card { position: sticky; top: 88px; align-self: flex-start; }
  .cover-side { position: sticky; top: 88px; align-self: flex-start; }
}
.cover-side {
  background: transparent; border: 0; padding: 0; box-shadow: none;
  display: flex; flex-direction: column;
}
.cover-side .main-cover {
  width: 100%; aspect-ratio: 4 / 3; border-radius: 12px; overflow: hidden; cursor: zoom-in;
  border: 1px solid var(--border); background: var(--bg-alt);
}
.main-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-placeholder { width: 100%; height: 100%; border-radius: 0; }
.thumbs { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
.thumb {
  width: 64px; height: 64px; border-radius: 10px; overflow: hidden; cursor: pointer;
  border: 2px solid transparent; opacity: .7; transition: all .2s var(--ease);
}
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb.active, .thumb:hover { opacity: 1; border-color: var(--accent); }
.cover-assure {
  list-style: none; margin: 14px 0 0; padding: 12px 14px;
  border: 1px solid var(--border); border-radius: 12px; background: var(--bg-alt);
  display: flex; flex-direction: column; gap: 6px;
}
.cover-assure li {
  position: relative; padding-left: 18px;
  font-size: 12.5px; line-height: 1.6; color: var(--text-2);
}
.cover-assure li::before {
  content: ''; position: absolute; left: 4px; top: 8px;
  width: 5px; height: 5px; border-radius: 50%; background: var(--accent);
}

.info-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 24px;
  box-shadow: none;
}
.head h1 {
  font-family: var(--font-display);
  font-size: 22px; line-height: 1.35; margin: 0; font-weight: 650; letter-spacing: -.02em; color: var(--text-1);
}
.title-line { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.cat-pill, .run-pill {
  display: inline-flex; align-items: center;
  font-size: 12px; font-weight: 650; padding: 3px 10px; border-radius: 999px;
  line-height: 1.4;
}
.cat-pill {
  color: var(--text-2); background: var(--bg-alt); border: 1px solid var(--border);
}
.run-pill.rs-1 { color: #fff; background: #16a34a; }
.run-pill.rs-0 { color: #fff; background: #71717a; }
.run-pill.rs-2 { color: #fff; background: #d97706; }

.meta-badges {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
}
.mb {
  display: inline-flex; align-items: center; gap: 6px;
  height: 26px; padding: 0 10px;
  border-radius: 6px; border: 1px solid var(--border);
  font-size: 12px; font-weight: 500; letter-spacing: .01em;
  line-height: 1; white-space: nowrap;
  color: var(--text-2); background: var(--bg-alt);
}
.mb-dot { display: none; }
.mb-tech,
.mb-paper, .mb-db, .mb-ppt, .mb-video, .mb-demo, .mb-intro, .mb-ok {
  color: var(--text-2); background: var(--bg-alt); border-color: var(--border);
}
.mb-tech { color: var(--text-1); font-weight: 600; }

.spec-list {
  margin: 18px 0 0; padding: 0; display: grid; gap: 0;
  border-top: 1px solid var(--border);
}
.spec-row {
  display: grid; grid-template-columns: 88px 1fr; gap: 12px;
  padding: 12px 0; border-bottom: 1px solid var(--border);
}
.spec-row dt { margin: 0; font-size: 12.5px; color: var(--text-3); font-weight: 500; }
.spec-row dd { margin: 0; font-size: 13.5px; color: var(--text-1); }

.buy-bar {
  margin-top: 20px; padding: 0; border: 0; background: transparent;
  display: flex; flex-direction: column; gap: 14px; box-shadow: none;
}
.buy-main { display: flex; flex-direction: column; gap: 8px; }
.price-box { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.now {
  color: var(--price); font-size: 32px; font-weight: 650; letter-spacing: -.03em;
  font-family: var(--font-num); font-variant-numeric: tabular-nums;
}
.orig {
  color: var(--text-4); text-decoration: line-through; font-size: 14px;
  font-family: var(--font-num); font-variant-numeric: tabular-nums;
}
.guarantee-row {
  display: flex; flex-wrap: wrap; gap: 0; font-size: 12.5px; color: var(--text-3);
}
.guarantee-row span {
  position: relative; padding-right: 12px; margin-right: 12px;
}
.guarantee-row span:not(:last-child)::after {
  content: ''; position: absolute; right: 0; top: 50%;
  width: 1px; height: 10px; background: var(--border-strong);
  transform: translateY(-50%);
}
.btns { display: flex; gap: 10px; flex-wrap: wrap; }
.btns :deep(.store-btn) { min-width: 140px; }
.aux-links { display: flex; flex-wrap: wrap; gap: 4px 16px; }
.aux-link {
  appearance: none; background: none; border: 0; padding: 0;
  font-family: inherit; font-size: 13px; font-weight: 500;
  color: var(--text-3); cursor: pointer;
}
.aux-link:hover { color: var(--text-1); }
.mini-meta { margin-top: 4px; display: flex; gap: 16px; color: var(--text-3); font-size: 12.5px; flex-wrap: wrap; }
.demo-hint { color: var(--text-3); font-weight: 500; }

.delivery-flow {
  margin-top: 18px; padding: 16px 16px 14px;
  border-radius: 14px; border: 1px solid var(--border);
  background: var(--surface);
}
.delivery-title {
  margin: 0 0 12px; font-size: 13.5px; font-weight: 750; color: var(--text-1);
}
.delivery-steps {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;
}
.d-step {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 10px 12px; border-radius: 12px;
  background: var(--bg-alt); border: 1px solid var(--border);
}
.d-num {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 8px;
  display: grid; place-items: center;
  font-size: 12px; font-weight: 800; color: #fff; background: var(--ink);
}
.d-step b { display: block; font-size: 13px; color: var(--text-1); margin-bottom: 2px; }
.d-step p { margin: 0; font-size: 12px; color: var(--text-3); line-height: 1.55; }
.delivery-warn {
  margin: 12px 0 0; font-size: 12.5px; line-height: 1.6;
  color: #b45309; font-weight: 650;
}
.delivery-contact { margin-top: 12px; }
.dc-rows {
  display: flex; flex-wrap: wrap; gap: 10px 18px;
  font-size: 13px; color: var(--text-2); margin-bottom: 10px;
}
.dc-rows b { color: var(--text-1); }
.dc-qr { display: flex; gap: 18px; flex-wrap: wrap; }
.dc-qr-item {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-3); font-weight: 600;
}

.detail-body { display: flex; flex-direction: column; gap: 14px; }
.d-block {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 22px 24px 24px;
  box-shadow: none;
}
.d-title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--text-1);
  letter-spacing: -.01em;
}
.d-desc { color: var(--text-2); line-height: 1.85; font-size: 14.5px; margin: 0; white-space: pre-line; }

.about-block { padding-bottom: 10px; }
.about-lead {
  margin: 0;
  max-width: 48em;
  font-size: 15px;
  line-height: 1.9;
  color: var(--text-2);
}
.about-row {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 10px 24px;
  padding: 16px 0;
  border-top: 1px solid var(--border);
}
.about-row:first-of-type { margin-top: 18px; }
.about-row-last { padding-bottom: 4px; }
.about-k {
  font-size: 12.5px;
  font-weight: 650;
  color: var(--text-3);
  padding-top: 3px;
}
.about-v { min-width: 0; color: var(--text-1); }
.about-text {
  margin: 0 0 6px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-2);
}
.about-text:last-child { margin-bottom: 0; }
.about-sub {
  display: inline-block;
  min-width: 4.5em;
  margin-right: 8px;
  color: var(--text-4);
  font-size: 12.5px;
  font-weight: 600;
}
.about-note { margin: 0 0 10px; font-size: 12.5px; color: var(--text-3); }
.mat-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
.mat-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  background: var(--bg-alt);
  border: 1px solid var(--border);
}
.about-cols {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 24px;
}
.about-cols li {
  position: relative;
  padding-left: 12px;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--text-2);
}
.about-cols li::before {
  content: '';
  position: absolute;
  left: 0;
  top: .6em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-4);
}
.about-cols.mono li {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  color: var(--text-3);
}
.about-list {
  margin: 0;
  padding-left: 1.15em;
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--text-2);
}
.about-list.soft { color: var(--text-3); font-size: 13px; }

.shot-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.shot-item {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  cursor: zoom-in;
  aspect-ratio: 4/3;
  background: var(--bg-alt);
  transition: transform .2s var(--ease), box-shadow .2s var(--ease);
}
.shot-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}
.shot-item :deep(.el-image) { width: 100%; height: 100%; }
.video-wrap { border-radius: 12px; overflow: hidden; border: 1px solid var(--border); }
.video-wrap iframe, .video-wrap video { width: 100%; height: 420px; display: block; border: 0; }
.video-ext { margin: 10px 0 0; font-size: 13px; color: var(--text-3); }
.video-ext a { color: var(--accent); font-weight: 600; }
.file-list { display: flex; flex-direction: column; gap: 8px; }
.file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13.5px;
  color: var(--text-2);
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bg-alt);
}
.file-row .el-tag { flex-shrink: 0; }
.file-name { word-break: break-all; flex: 1; }
.file-size { color: var(--text-3); font-size: 12.5px; flex-shrink: 0; }
.qa-alert { margin: 0; border-radius: 12px; }
.notice-list { padding-left: 20px; color: var(--text-2); line-height: 2; font-size: 14px; margin: 0; }
.notice { background: var(--bg-alt); }

.review-summary {
  display: flex; gap: 28px; flex-wrap: wrap; align-items: flex-start;
  margin-bottom: 18px; padding: 16px 18px; background: var(--bg-alt);
  border: 1px solid var(--border); border-radius: 12px;
}
.rs-left { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 120px; }
.rs-avg { font-size: 36px; font-weight: 800; color: var(--text-1); line-height: 1; }
.rs-total { font-size: 12px; color: var(--text-3); }
.rs-bars { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px; }
.rs-bar-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.rs-star { width: 28px; color: var(--text-3); flex-shrink: 0; }
.rs-bar-track { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.rs-bar-fill { height: 100%; background: var(--accent); border-radius: 4px; transition: width .3s var(--ease); }
.rs-count { width: 24px; text-align: right; color: var(--text-3); flex-shrink: 0; }

.review-list { display: flex; flex-direction: column; gap: 12px; }
.review-item { border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; background: var(--bg-alt); }
.review-head { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.review-user { font-weight: 700; color: var(--text-1); }
.review-time { color: var(--text-3); font-size: 12px; margin-left: auto; }
.review-content { color: var(--text-2); line-height: 1.8; margin: 0; }

.related { margin-top: 28px; }
.related-grid { margin-top: 4px; }

.sticky-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 200;
  display: flex; align-items: center; gap: 16px; padding: 12px 24px;
  border-top: 1px solid var(--border); box-shadow: var(--shadow-sm);
}
.sb-cover { width: 48px; height: 48px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
.sb-info { flex: 1; min-width: 0; }
.sb-title { font-weight: 600; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-price {
  color: var(--price); font-weight: 650; font-size: 16px;
  font-family: var(--font-num); font-variant-numeric: tabular-nums;
}
.sb-btns { display: flex; gap: 10px; flex-shrink: 0; }
.sb-btns :deep(.store-btn) { height: 40px; padding: 0 16px; }
.slide-up-enter-active, .slide-up-leave-active { transition: transform .22s var(--ease); }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }

@media (max-width: 900px) {
  .top-grid { grid-template-columns: 1fr; gap: 14px; }
  .video-wrap iframe, .video-wrap video { height: 220px; }
}

@media (max-width: 768px) {
  .detail { padding: 0 0 88px; }
  .top-grid { gap: 12px; margin-bottom: 16px; }
  .info-card, .cover-side, .d-block { padding: 14px; border-radius: 12px; }
  .head h1 { font-size: 18px; }
  .title-line { margin-bottom: 10px; }
  .buy-bar { padding: 0; margin-top: 14px; border-radius: 0; }
  .now { font-size: 28px; }
  .btns { flex-direction: column; }
  .btns :deep(.store-btn) { width: 100%; min-width: 0; }
  .delivery-steps { grid-template-columns: 1fr; gap: 8px; }
  .shot-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .about-row { grid-template-columns: 1fr; gap: 6px; padding: 14px 0; }
  .about-cols { grid-template-columns: 1fr; gap: 6px; }
  .about-lead { font-size: 14px; }
  .related-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .file-row { flex-wrap: wrap; gap: 6px 10px; }
  .file-size { width: 100%; margin-left: 0; }
  .review-summary { padding: 12px; gap: 16px; }
  .rs-avg { font-size: 28px; }
  .sticky-bar {
    bottom: calc(var(--mobile-nav-h, 56px) + env(safe-area-inset-bottom));
    padding: 10px 12px;
    gap: 10px;
    z-index: 250;
  }
  .sb-cover { display: none; }
  .sb-btns { flex-direction: row; gap: 8px; }
  .sb-btns :deep(.store-btn) { flex: 1; height: 40px; padding: 0 10px; }
  .sb-title { font-size: 13px; }
  .sb-price { font-size: 16px; }
}
</style>
