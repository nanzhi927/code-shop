<template>
  <div class="page-container case-detail" v-loading="loading">
    <template v-if="item">
      <header class="hero">
        <div class="crumb">
          <router-link to="/cases">案例</router-link>
          <span>/</span>
          <span>{{ item.service_label }}</span>
        </div>
        <div class="meta-row">
          <span class="tag">{{ item.service_label }}</span>
          <span v-if="item.duration_label" class="tag dur">{{ item.duration_label }}</span>
          <span v-if="item.tech" class="tag muted">{{ item.tech }}</span>
          <span v-if="item.domain" class="tag muted">{{ item.domain }}</span>
        </div>
        <h1 class="title">{{ item.title }}</h1>
        <p class="result-line">{{ item.summary }}</p>
      </header>

      <section v-if="item.client_scene" class="block scene">
        <h2>当时卡在哪</h2>
        <p>{{ item.client_scene }}</p>
      </section>

      <section v-if="item.result_points?.length" class="block">
        <h2>交付结果</h2>
        <ul class="check-list">
          <li v-for="(p, i) in item.result_points" :key="i">{{ p }}</li>
        </ul>
      </section>

      <section v-if="item.scope_out" class="block scope">
        <h2>明确不接什么</h2>
        <p>{{ item.scope_out }}</p>
      </section>

      <div v-if="htmlContent" class="content md-body" v-html="htmlContent"></div>

      <section v-if="item.deliverables?.length" class="block">
        <h2>交付物清单</h2>
        <ul class="check-list soft">
          <li v-for="(d, i) in item.deliverables" :key="i">{{ d }}</li>
        </ul>
      </section>

      <section v-if="item.gallery?.length" class="block">
        <h2>界面证据（已脱敏）</h2>
        <div class="gallery">
          <figure v-for="(g, i) in item.gallery" :key="i" class="g-item">
            <img :src="g.url" :alt="g.caption || `截图 ${i + 1}`" loading="lazy" />
            <figcaption v-if="g.caption">{{ g.caption }}</figcaption>
          </figure>
        </div>
      </section>
      <p v-else class="evidence-note">真实界面截图将在脱敏后由后台补充；当前以文字交付说明为准。</p>

      <section v-if="item.related_products?.length" class="block">
        <h2>可作底座的源码</h2>
        <div class="prod-grid">
          <router-link
            v-for="p in item.related_products"
            :key="p.id"
            :to="`/products/${p.id}`"
            class="prod-card"
          >
            <ProductCover :product="p" />
            <strong>{{ p.title }}</strong>
            <span v-if="p.tech">{{ p.tech }}</span>
          </router-link>
        </div>
      </section>

      <section class="cta-row">
        <router-link
          v-for="s in serviceLinks"
          :key="s.to"
          class="cta-card"
          :to="s.to"
        >
          <h3>{{ s.title }}</h3>
          <p>{{ s.desc }}</p>
        </router-link>
        <a class="cta-card contact" href="#" @click.prevent="openContact">
          <h3>情况类似？先对一下</h3>
          <p>发题目 / 截图 / 卡点，客服帮你评估是否接、大概几天</p>
        </a>
      </section>
    </template>

    <div v-else-if="!loading" class="empty-illus">
      <p class="ei-title">案例不存在或未发布</p>
      <StoreButton variant="solid" to="/cases">返回案例列表</StoreButton>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import http from '../../api';
import ProductCover from '../../components/ProductCover.vue';
import StoreButton from '../../components/store/StoreButton.vue';
import { renderMarkdown } from '../../utils/markdown';
import { setSeo, resetSeo } from '../../composables/useSeo';
import { useContact } from '../../composables/useContact';

const route = useRoute();
const loading = ref(true);
const item = ref(null);
const { openContact } = useContact();

const htmlContent = computed(() => renderMarkdown(item.value?.content_md || ''));

const SERVICE_CTA = {
  custom: { to: '/services/p/custom', title: '同类要改 / 加模块', desc: '按清单报价，验收后再付尾款节奏可谈' },
  modify: { to: '/services/p/custom', title: '已有源码要改题或补流程', desc: '先对齐改动边界，再排期' },
  deploy: { to: '/services/p/deploy', title: '跑不起来要代跑', desc: '按次协助本机或服务器跑通' },
  defense: { to: '/services/p/defense', title: '需要答辩材料加购', desc: '页序清晰的 PPT + 备用录屏' },
  mixed: { to: '/services', title: '看全部增值服务', desc: '开题、定制、代跑、答辩加购' }
};

const serviceLinks = computed(() => {
  const slugs = item.value?.related_service_slugs?.length
    ? item.value.related_service_slugs
    : [item.value?.service_type].filter(Boolean);
  const seen = new Set();
  const list = [];
  for (const s of slugs) {
    const key = s === 'modify' ? 'custom' : s;
    const cta = SERVICE_CTA[s] || SERVICE_CTA[key] || SERVICE_CTA.mixed;
    if (seen.has(cta.to)) continue;
    seen.add(cta.to);
    list.push(cta);
  }
  if (!list.length) list.push(SERVICE_CTA.mixed);
  return list.slice(0, 2);
});

async function load() {
  loading.value = true;
  item.value = null;
  try {
    const a = await http.get(`/cases/${route.params.slug}`);
    item.value = a;
    setSeo({
      title: `${a.title} - 交付案例`,
      description: (a.summary || a.client_scene || '').slice(0, 150),
      keywords: [a.service_label, a.tech, a.domain, '毕设案例', '交付'].filter(Boolean).join(',')
    });
  } catch {
    item.value = null;
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.slug, () => {
  if (route.name === 'case-detail') load();
});
onMounted(load);
onBeforeUnmount(() => resetSeo());
</script>

<style scoped>
.case-detail { padding: 24px 0 56px; max-width: 720px; }
.hero { margin-bottom: 28px; }
.crumb {
  display: flex; gap: 8px; align-items: center;
  font-size: 13px; color: var(--text-3); margin-bottom: 14px;
}
.crumb a { color: var(--text-2); text-decoration: none; }
.crumb a:hover { color: var(--ink); }
.meta-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.tag {
  font-size: 12px; font-weight: 650; padding: 2px 9px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--bg-alt); color: var(--text-1);
}
.tag.muted { color: var(--text-3); font-weight: 550; }
.tag.dur { color: #0f766e; border-color: rgba(13,148,136,.35); background: rgba(13,148,136,.08); }
.title {
  margin: 0 0 14px; font-family: var(--font-display);
  font-size: clamp(24px, 4vw, 32px); line-height: 1.28; font-weight: 720; letter-spacing: -.02em;
}
.result-line {
  margin: 0; font-size: 16.5px; line-height: 1.7; color: var(--text-1); font-weight: 650;
}

.block { margin: 0 0 28px; }
.block h2 {
  margin: 0 0 12px; font-size: 17px; font-weight: 720; color: var(--text-1);
}
.block > p { margin: 0; font-size: 15.5px; line-height: 1.85; color: var(--text-2); }
.scene {
  padding: 16px 18px; border-radius: 12px;
  background: var(--bg-alt); border: 1px solid var(--border);
}
.scope > p { color: var(--text-3); font-size: 14.5px; }

.check-list {
  margin: 0; padding: 0; list-style: none;
}
.check-list li {
  position: relative; padding: 8px 0 8px 22px;
  font-size: 15px; line-height: 1.6; color: var(--text-2);
  border-bottom: 1px solid var(--border);
}
.check-list li:last-child { border-bottom: 0; }
.check-list li::before {
  content: ""; position: absolute; left: 0; top: .85em;
  width: 8px; height: 8px; border-radius: 50%; background: #0d9488;
}
.check-list.soft li::before { background: var(--text-4); }

.content {
  font-size: 15.5px; line-height: 1.9; color: var(--text-2); margin-bottom: 28px;
}
.content :deep(h2) {
  margin: 1.6em 0 .65em; font-size: 1.15em; font-weight: 720; color: var(--text-1);
}
.content :deep(p) { margin: 0 0 1em; }
.content :deep(ol), .content :deep(ul) { margin: 0 0 1em; padding-left: 1.25em; }
.content :deep(li) { margin: .35em 0; }
.content :deep(strong) { color: var(--text-1); }

.evidence-note {
  margin: -8px 0 28px; font-size: 13px; color: var(--text-4); line-height: 1.6;
}

.gallery {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;
}
.g-item {
  margin: 0; border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
  background: var(--bg-alt);
}
.g-item img { display: block; width: 100%; aspect-ratio: 16/10; object-fit: cover; }
.g-item figcaption {
  padding: 8px 10px; font-size: 12.5px; color: var(--text-3); line-height: 1.45;
}

.prod-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px;
}
.prod-card {
  display: flex; flex-direction: column; gap: 6px;
  border: 1px solid var(--border); border-radius: 12px; padding: 8px;
  text-decoration: none; color: inherit; background: var(--surface);
}
.prod-card strong {
  font-size: 13px; line-height: 1.35;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.prod-card span { font-size: 12px; color: var(--text-3); }

.cta-row { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 8px; }
@media (min-width: 640px) {
  .cta-row { grid-template-columns: 1fr 1fr; }
}
.cta-card {
  display: block; padding: 16px 18px; text-decoration: none; color: inherit;
  border: 1px solid var(--border); border-radius: 12px; background: var(--bg-alt);
}
.cta-card h3 { margin: 0 0 6px; font-size: 15px; color: var(--text-1); }
.cta-card p { margin: 0; font-size: 13px; color: var(--text-3); line-height: 1.5; }
.cta-card:hover { border-color: var(--ink); }
.cta-card.contact { background: var(--ink); border-color: var(--ink); color: #fff; }
.cta-card.contact h3 { color: #fff; }
.cta-card.contact p { color: rgba(255,255,255,.72); }

.empty-illus { text-align: center; padding: 80px 16px; }
.ei-title { font-size: 16px; font-weight: 650; margin: 0 0 16px; }
</style>
