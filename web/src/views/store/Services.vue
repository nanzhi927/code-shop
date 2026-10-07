<template>
  <div class="page-container svc-page">
    <div class="svc-hero">
      <h1 class="svc-title fade-up">增值服务</h1>
      <p class="svc-sub fade-up stagger-1">开题获客 → 定制变现 → 代跑售后 → 答辩加购</p>
    </div>

    <div v-if="loading" class="svc-grid" aria-hidden="true">
      <div v-for="i in 6" :key="i" class="svc-card sk-card">
        <div class="sk-ico sk-block" />
        <div class="sk-line sk-block" />
        <div class="sk-line sk-block short" />
      </div>
    </div>
    <div v-else class="svc-grid">
      <button
        v-for="(s, i) in items"
        :key="s.id || i"
        type="button"
        class="svc-card"
        :style="{ animationDelay: `${Math.min(i, 5) * 40}ms` }"
        @click="go(s)"
      >
        <div class="svc-mark">{{ markOf(s, i) }}</div>
        <div class="svc-copy">
          <h3>{{ s.title }}</h3>
          <p>{{ s.desc }}</p>
        </div>
        <div class="svc-go">了解详情 →</div>
      </button>
      <div v-if="!items.length" class="empty-illus" style="grid-column: 1 / -1">
        <div class="ei-icon">空</div>
        <p class="ei-title">暂无服务</p>
        <p class="ei-desc">请稍后再来</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import http from '../../api';
import { setSeo } from '../../composables/useSeo';

const router = useRouter();
const items = ref([]);
const loading = ref(true);

const FALLBACK = [
  { id: 'c0', title: '免费开题助手', desc: '只填题目、点选确认，生成开题报告初稿；注册赠送次数', to: '/services/p/proposal' },
  { id: 'c1', title: '定制开发 / 二次开发', desc: '改功能、改界面或从零搭建；提需求→报价→验收，平台担保', to: '/services/p/custom' },
  { id: 'c2', title: '代跑 / 部署 / 环境搭建', desc: '源码跑不起来、要本地或服务器部署，按次协助', to: '/services/p/deploy' },
  { id: 'c7', title: '答辩 PPT / 讲解视频', desc: '源码加购：演示向 PPT 与录屏，辅助你自己答辩讲解', to: '/services/p/defense' }
];

function markOf(s, i) {
  const raw = String(s.icon || '').trim();
  if (raw && !/\p{Extended_Pictographic}/u.test(raw)) return raw.slice(0, 1);
  return String(i + 1).padStart(2, '0');
}

function go(s) {
  if (!s?.to) return;
  if (/^https?:\/\//i.test(s.to)) window.open(s.to, '_blank', 'noopener');
  else router.push(s.to);
}

onMounted(async () => {
  setSeo({
    title: '增值服务 - 毕业设计定制 / 开题 / 代跑 / 答辩加购',
    description: '毕业设计增值服务：免费开题、定制二次开发、代跑部署、答辩 PPT 加购。',
    keywords: '增值服务,毕业设计定制,毕设开题,代跑部署,答辩PPT'
  });
  loading.value = true;
  try {
    const res = await http.get('/services/cards');
    items.value = res.list?.length ? res.list : FALLBACK;
  } catch {
    items.value = FALLBACK;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.svc-page { padding: 16px 0 60px; }
.svc-hero { text-align: left; padding: 28px 0 24px; max-width: 36em; }
.svc-title {
  font-family: var(--font-display);
  font-size: clamp(24px, 4vw, 32px); font-weight: 700;
  margin: 0 0 10px; letter-spacing: -.02em;
}
.svc-sub { color: var(--text-3); font-size: 14.5px; margin: 0; line-height: 1.7; }
.svc-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 14px; min-height: 120px;
}
.svc-card {
  appearance: none; text-align: left; font-family: inherit;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 22px; cursor: pointer; width: 100%;
  display: flex; flex-direction: column; gap: 10px;
  transition: border-color .18s, transform .18s;
  animation: cardIn .32s var(--ease-out) both;
}
@keyframes cardIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.svc-card:hover { border-color: var(--ink); transform: translateY(-1px); }
.svc-mark {
  font-family: var(--font-num); font-size: 12px; font-weight: 600;
  color: var(--text-4); letter-spacing: .06em;
}
.svc-copy { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.svc-card h3 { margin: 0; font-size: 15px; font-weight: 600; color: var(--text-1); }
.svc-card p { margin: 0; font-size: 13px; color: var(--text-3); line-height: 1.65; }
.svc-go { color: var(--text-3); font-size: 13px; font-weight: 500; }

.sk-block {
  background: linear-gradient(90deg, var(--sk-1) 25%, var(--sk-2) 50%, var(--sk-1) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
  border-radius: 8px;
}
.sk-card { pointer-events: none; animation: none; }
.sk-ico { width: 28px; height: 14px; }
.sk-line { height: 14px; width: 80%; margin-top: 4px; }
.sk-line.short { width: 55%; height: 12px; }

@media (max-width: 768px) {
  .svc-page { padding: 8px 0 40px; }
  .svc-hero { padding: 16px 0 18px; }
  .svc-grid { grid-template-columns: 1fr; gap: 10px; }
  .svc-card { padding: 18px; }
}
</style>
