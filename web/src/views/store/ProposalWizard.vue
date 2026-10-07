<template>
  <div class="page-container proposal-page">
    <div class="head">
      <div>
        <h1 class="page-title">免费开题助手</h1>
        <p class="sub">输入题目 → 点选确认 → 生成开题报告初稿（仅供学习参考）</p>
      </div>
      <div class="head-right">
        <router-link v-if="isLogin" class="mine-link" to="/services/proposal/mine">我的开题</router-link>
        <div class="quota" v-if="meta">
          <span v-if="meta.need_login">手机号注册赠送 <b>{{ meta.gift || meta.limit || 1 }}</b> 次</span>
          <span v-else-if="meta.unlimited">免费次数 <b>不限</b></span>
          <span v-else>剩余免费次数 <b>{{ meta.remaining }}</b></span>
          <span v-if="meta.ai_mode === 'mock'" class="mock-tag">演示模式</span>
        </div>
      </div>
    </div>

    <el-steps :active="step" finish-status="success" align-center class="steps">
      <el-step title="题目与确认" />
      <el-step title="确认大纲" />
      <el-step title="生成结果" />
    </el-steps>

    <!-- Step 0: 题目 → 点选确认 -->
    <section v-show="step === 0" class="panel">
      <template v-if="phase === 'title'">
        <label class="field-label" for="proposal-title">开题题目</label>
        <el-input
          id="proposal-title"
          v-model="form.title"
          maxlength="120"
          show-word-limit
          size="large"
          placeholder="例如：基于 SpringBoot 的校园失物招领系统"
          @keyup.enter="goConfirm"
        />
        <p class="field-hint">只需输入题目，技术栈、领域、功能模块下一步点选即可</p>
        <div class="actions">
          <el-button type="primary" size="large" @click="goConfirm">下一步：点选确认</el-button>
        </div>
      </template>

      <template v-else>
        <div class="confirm-head">
          <button type="button" class="back-link" @click="phase = 'title'">← 改题目</button>
          <h2 class="confirm-title">{{ form.title }}</h2>
          <p class="field-hint">已按题目预填，不满意直接点选切换</p>
        </div>

        <div class="chip-block">
          <div class="chip-label">学历</div>
          <div class="chip-row">
            <FilterChip
              v-for="d in DEGREE_OPTS"
              :key="d"
              :active="form.degree === d"
              @click="form.degree = d"
            >{{ d }}</FilterChip>
          </div>
        </div>

        <div class="chip-block">
          <div class="chip-label">技术栈</div>
          <div class="chip-row">
            <FilterChip
              v-for="t in techOpts"
              :key="t"
              :active="form.tech === t"
              @click="onTechPick(t)"
            >{{ t }}</FilterChip>
          </div>
        </div>

        <div class="chip-block">
          <div class="chip-label">业务领域</div>
          <div class="chip-row">
            <FilterChip
              v-for="d in domainOpts"
              :key="d"
              :active="form.domain === d"
              @click="onDomainPick(d)"
            >{{ d }}</FilterChip>
          </div>
        </div>

        <div class="chip-block">
          <div class="chip-label">
            功能模块
            <span>AI 按题目生成，点选多选，至少 1 项</span>
            <button
              type="button"
              class="regen-mods"
              :disabled="modulesLoading"
              @click="loadAiModules({ force: true })"
            >{{ modulesLoading ? '生成中…' : '换一批' }}</button>
          </div>
          <div v-if="modulesLoading && !moduleOpts.length" class="mods-loading">正在根据题目生成功能模块…</div>
          <div class="chip-row wrap" :class="{ dim: modulesLoading }">
            <FilterChip
              v-for="m in moduleOpts"
              :key="m"
              :active="selectedModules.includes(m)"
              @click="toggleModule(m)"
            >{{ m }}</FilterChip>
          </div>
          <div v-if="productHints.length" class="product-hints">
            <p class="chip-sub">站内相关源码，点一下可带入模块</p>
            <div class="hint-cards">
              <button
                v-for="p in productHints"
                :key="p.id"
                type="button"
                class="hint-card"
                :class="{ on: adoptedProductId === p.id }"
                @click="adoptProduct(p)"
              >
                <strong>{{ p.title }}</strong>
                <span>{{ p.tech || '源码' }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="chip-block">
          <div class="chip-label">篇幅</div>
          <div class="chip-row">
            <FilterChip
              v-for="w in WORD_OPTS"
              :key="w.value"
              :active="form.wordCount === w.value"
              @click="form.wordCount = w.value"
            >{{ w.label }}</FilterChip>
          </div>
        </div>

        <div class="chip-block">
          <div class="chip-label">可选</div>
          <div class="chip-row wrap">
            <FilterChip :active="wantTemplate" @click="wantTemplate = !wantTemplate">
              上传学校模板
            </FilterChip>
            <FilterChip :active="agreed" @click="agreed = !agreed">
              已阅读并同意免责声明
            </FilterChip>
          </div>
          <p class="disclaimer">{{ meta?.disclaimer }}</p>
        </div>

        <div class="actions">
          <el-button size="large" @click="phase = 'title'">上一步</el-button>
          <el-button type="primary" size="large" :loading="creating" @click="createSession">
            下一步：确认大纲
          </el-button>
        </div>
      </template>
    </section>

    <!-- Step 1: 大纲点选 -->
    <section v-show="step === 1" class="panel">
      <div v-if="wantTemplate" class="upload-box">
        <el-upload
          drag
          :show-file-list="false"
          accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          :http-request="uploadTemplate"
          :disabled="!session?.id || uploading"
        >
          <div class="upload-inner">
            <p class="u-title">{{ uploading ? '正在解析模板…' : '上传学校开题模板（.docx / .pdf）' }}</p>
            <p class="u-sub">识别章节后可在下方点选调整</p>
          </div>
        </el-upload>
        <p v-if="session?.has_template" class="upload-ok">已关联模板</p>
      </div>

      <div class="chip-block">
        <div class="chip-label">大纲预设</div>
        <div class="chip-row">
          <FilterChip :active="outlinePreset === 'slim'" @click="applyOutlinePreset('slim')">精简 5 章</FilterChip>
          <FilterChip :active="outlinePreset === 'standard'" @click="applyOutlinePreset('standard')">标准 8 章</FilterChip>
          <FilterChip :active="outlinePreset === 'full'" @click="applyOutlinePreset('full')">完整 10 章</FilterChip>
        </div>
      </div>

      <p class="hint">点选要保留的章节（至少 3 章）；顺序即报告结构。</p>
      <div class="outline-chips">
        <button
          v-for="(c, i) in outlinePool"
          :key="c.id"
          type="button"
          class="outline-chip"
          :class="{ on: c.on }"
          @click="c.on = !c.on"
        >
          <span class="oc-idx">{{ i + 1 }}</span>
          <span class="oc-title">{{ c.title }}</span>
        </button>
      </div>

      <div class="actions">
        <el-button size="large" @click="backToConfirm">上一步</el-button>
        <el-button type="primary" size="large" :loading="savingOutline || generating" @click="saveAndGenerate">
          保存并生成
        </el-button>
      </div>
    </section>

    <!-- Step 2: 结果 -->
    <section v-show="step === 2" class="panel">
      <div v-if="generating" class="gen-box">
        <el-icon class="is-loading" :size="28"><Loading /></el-icon>
        <p>{{ streamStatus || '正在按章生成开题报告…' }}</p>
        <div v-if="streamProgress.total" class="prog">
          <el-progress :percentage="streamPercent" :stroke-width="8" />
        </div>
        <article v-if="liveMd" class="md-preview live" v-html="renderMd(liveMd)" />
      </div>
      <template v-else-if="session?.content_md">
        <div class="result-toolbar">
          <el-button type="primary" @click="copyMd">复制全文</el-button>
          <el-button @click="downloadMd">下载 Markdown</el-button>
          <el-button @click="downloadDocx" :loading="exporting">导出 Word</el-button>
          <el-button @click="regen" :disabled="!canRegen">重新生成</el-button>
          <el-button @click="resetAll">再开一题</el-button>
        </div>
        <div v-if="chapterActions.length" class="chapter-actions">
          <h4>单章改写 <small>本篇剩余 {{ rewriteLeft }} 次</small></h4>
          <div v-for="ch in chapterActions" :key="ch.index" class="ch-row">
            <span class="ch-title">{{ ch.index + 1 }}. {{ ch.title }}</span>
            <div class="ch-btns">
              <el-button size="small" :loading="rewritingIndex === ch.index" @click="rewriteOne(ch.index, 'rewrite')">重写</el-button>
              <el-button size="small" :loading="rewritingIndex === ch.index" @click="rewriteOne(ch.index, 'expand')">扩写</el-button>
              <el-button size="small" :loading="rewritingIndex === ch.index" @click="rewriteOne(ch.index, 'shrink')">缩写</el-button>
            </div>
          </div>
        </div>
        <article class="md-preview" v-html="renderMd(session.content_md)" />
        <section v-if="related.length" class="related">
          <h3>可用作实现底座的源码</h3>
          <div class="rel-grid">
            <a v-for="p in related" :key="p.id" class="rel-card" href="#" @click.prevent="$router.push(`/products/${p.id}`)">
              <ProductCover :product="p" />
              <strong>{{ p.title }}</strong>
              <span v-if="p.tech" class="tech-tag">{{ p.tech }}</span>
            </a>
          </div>
          <div class="rel-cta">
            <el-button type="primary" @click="goCustom">需要二次开发？去定制</el-button>
            <el-button @click="openContact">联系客服</el-button>
          </div>
        </section>
      </template>
      <el-empty v-else description="暂无内容" />
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import http from '../../api';
import ProductCover from '../../components/ProductCover.vue';
import FilterChip from '../../components/store/FilterChip.vue';
import { useContact } from '../../composables/useContact';
import { streamProposalGenerate } from '../../composables/useProposalStream';
import { useUserStore } from '../../stores/user';
import { setSeo } from '../../composables/useSeo';

const DEGREE_OPTS = ['本科', '专科', '研究生'];
const WORD_OPTS = [
  { label: '约 2000 字', value: '约2000字' },
  { label: '约 3000 字', value: '约3000字' },
  { label: '约 5000 字', value: '约5000字' }
];

const DEFAULT_TECHS = ['SpringBoot', 'SSM', 'JSP+Servlet', 'Vue', '小程序', 'Python', '其他'];
const DEFAULT_DOMAINS = ['校园教育', '电子商务', '医疗健康', '政务办公', '餐饮外卖', '图书管理', '人事财务', '物联网', '其他'];

const MODULE_BANK = {
  校园教育: ['用户登录注册', '信息发布', '审核管理', '消息通知', '数据统计', '后台管理'],
  电子商务: ['商品浏览', '购物车下单', '订单管理', '支付对接', '评价售后', '后台管理'],
  医疗健康: ['预约挂号', '病历查询', '药品管理', '消息提醒', '后台管理'],
  政务办公: ['事项申报', '流程审批', '公文管理', '进度查询', '后台管理'],
  餐饮外卖: ['菜品浏览', '在线下单', '配送跟踪', '评价反馈', '后台管理'],
  图书管理: ['图书检索', '借还管理', '预约续借', '逾期提醒', '后台管理'],
  人事财务: ['考勤打卡', '请假审批', '薪资核算', '报表统计', '后台管理'],
  物联网: ['设备接入', '数据采集', '实时监控', '告警推送', '后台管理'],
  其他: ['用户登录注册', '核心业务办理', '数据查询统计', '消息通知', '后台管理']
};

const OUTLINE_PRESETS = {
  slim: ['选题背景与意义', '研究内容与目标', '研究方法与技术路线', '系统需求分析', '进度安排'],
  standard: [
    '选题背景与意义', '国内外研究现状', '研究内容与目标', '研究方法与技术路线',
    '系统需求分析', '总体设计思路', '可行性分析', '进度安排'
  ],
  full: [
    '选题背景与意义', '国内外研究现状', '研究内容与目标', '研究方法与技术路线',
    '系统需求分析', '总体设计思路', '可行性分析', '进度安排', '预期成果', '参考文献'
  ]
};

const TECH_RULES = [
  { re: /spring\s*boot|springboot|boot/i, tech: 'SpringBoot' },
  { re: /\bssm\b|mybatis/i, tech: 'SSM' },
  { re: /jsp|servlet/i, tech: 'JSP+Servlet' },
  { re: /小程序|uni-?app|微信/i, tech: '小程序' },
  { re: /python|django|flask|fastapi/i, tech: 'Python' },
  { re: /\bvue\b|react|前端/i, tech: 'Vue' }
];

const DOMAIN_RULES = [
  { re: /校园|教务|宿舍|失物|选课|学生|毕业|图书|图书馆/i, domain: '校园教育' },
  { re: /图书|图书馆/i, domain: '图书管理' },
  { re: /商城|电商|购物|外卖|点餐|餐饮/i, domain: '电子商务' },
  { re: /外卖|点餐|餐饮/i, domain: '餐饮外卖' },
  { re: /医疗|医院|挂号|健康|药店/i, domain: '医疗健康' },
  { re: /政务|办公|审批|公文|党建/i, domain: '政务办公' },
  { re: /人事|财务|薪资|考勤|erp/i, domain: '人事财务' },
  { re: /物联网|传感器|设备监控|智能家居/i, domain: '物联网' }
];

const router = useRouter();
const { openContact } = useContact();
const userStore = useUserStore();
const isLogin = computed(() => userStore.isLogin);

const step = ref(0);
const phase = ref('title'); // title | confirm
const meta = ref(null);
const agreed = ref(false);
const wantTemplate = ref(false);
const creating = ref(false);
const uploading = ref(false);
const savingOutline = ref(false);
const generating = ref(false);
const exporting = ref(false);
const rewritingIndex = ref(-1);
const rewriteLeft = ref(8);
const session = ref(null);
const related = ref([]);
const streamStatus = ref('');
const streamProgress = reactive({ index: 0, total: 0 });
const liveMd = ref('');
const selectedModules = ref([]);
const moduleOpts = ref([]);
const modulesLoading = ref(false);
const productHints = ref([]);
const adoptedProductId = ref(null);
const outlinePreset = ref('standard');
const outlinePool = ref([]);
let abortCtrl = null;
let modulesReqSeq = 0;

const form = reactive({
  title: '',
  major: '',
  degree: '本科',
  tech: 'SpringBoot',
  domain: '校园教育',
  background: '',
  innovation: '',
  wordCount: '约3000字'
});

const techOpts = computed(() => meta.value?.techs?.length ? meta.value.techs : DEFAULT_TECHS);
const domainOpts = computed(() => meta.value?.domains?.length ? meta.value.domains : DEFAULT_DOMAINS);
const canRegen = computed(() => !!(meta.value?.unlimited || (meta.value?.remaining || 0) > 0));

const streamPercent = computed(() => {
  if (!streamProgress.total) return 0;
  return Math.min(99, Math.round(((streamProgress.index + 1) / streamProgress.total) * 100));
});

const chapterActions = computed(() => {
  const md = session.value?.content_md || '';
  const re = /^##\s+(.+)$/gm;
  const list = [];
  let m;
  let i = 0;
  while ((m = re.exec(md))) {
    list.push({ index: i++, title: m[1].replace(/^\d+[.、．)\s]+/, '').trim() });
  }
  return list;
});

function ensureGuestKey() {
  let k = localStorage.getItem('proposal_guest_key');
  if (!k) {
    k = `gk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('proposal_guest_key', k);
  }
  return k;
}

function guestHeaders() {
  return { 'X-Guest-Key': ensureGuestKey() };
}

function inferFromTitle(title) {
  const t = String(title || '');
  let tech = 'SpringBoot';
  for (const r of TECH_RULES) {
    if (r.re.test(t)) { tech = r.tech; break; }
  }
  let domain = '其他';
  for (const r of DOMAIN_RULES) {
    if (r.re.test(t)) { domain = r.domain; break; }
  }
  return { tech, domain };
}

function modulesForDomain(domain) {
  return [...(MODULE_BANK[domain] || MODULE_BANK.其他)];
}

async function loadAiModules({ force = false, preferKeep = false } = {}) {
  const title = form.title.trim();
  if (!title) return;
  const seq = ++modulesReqSeq;
  modulesLoading.value = true;
  try {
    const res = await http.post(
      '/proposal/suggest-modules',
      { title, tech: form.tech, domain: form.domain },
      { headers: guestHeaders(), timeout: 60000 }
    );
    if (seq !== modulesReqSeq) return;
    const mods = (res.modules || []).map((m) => String(m).trim()).filter(Boolean);
    if (!mods.length) {
      moduleOpts.value = modulesForDomain(form.domain);
    } else {
      moduleOpts.value = mods;
    }
    if (preferKeep) {
      const keep = selectedModules.value.filter((m) => moduleOpts.value.includes(m));
      selectedModules.value = keep.length ? keep : moduleOpts.value.slice(0, Math.min(6, moduleOpts.value.length));
    } else if (force || !selectedModules.value.length) {
      selectedModules.value = moduleOpts.value.slice(0, Math.min(6, moduleOpts.value.length));
    } else {
      const keep = selectedModules.value.filter((m) => moduleOpts.value.includes(m));
      selectedModules.value = keep.length ? keep : moduleOpts.value.slice(0, Math.min(6, moduleOpts.value.length));
    }
    adoptedProductId.value = null;
  } catch {
    if (seq !== modulesReqSeq) return;
    if (!moduleOpts.value.length) {
      moduleOpts.value = modulesForDomain(form.domain);
      selectedModules.value = moduleOpts.value.slice(0, 4);
    }
    ElMessage.warning('模块生成失败，已使用本地备选');
  } finally {
    if (seq === modulesReqSeq) modulesLoading.value = false;
  }
}

function toggleModule(m) {
  const i = selectedModules.value.indexOf(m);
  if (i >= 0) selectedModules.value.splice(i, 1);
  else selectedModules.value.push(m);
}

function onDomainPick(d) {
  form.domain = d;
  adoptedProductId.value = null;
  loadAiModules({ preferKeep: true });
}

function onTechPick(t) {
  form.tech = t;
  loadAiModules({ preferKeep: true });
}

async function goConfirm() {
  const title = form.title.trim();
  if (!title) return ElMessage.warning('请先输入开题题目');
  form.title = title;
  const inferred = inferFromTitle(title);
  form.tech = inferred.tech;
  form.domain = inferred.domain;
  selectedModules.value = [];
  moduleOpts.value = [];
  adoptedProductId.value = null;
  phase.value = 'confirm';
  loadAiModules({ force: true });
  loadProductHints();
}

async function loadProductHints() {
  productHints.value = [];
  try {
    const res = await http.get('/proposal/suggest-products', {
      params: { keyword: form.title.slice(0, 40), tech: form.tech === '其他' ? undefined : form.tech },
      headers: guestHeaders()
    });
    productHints.value = (res.list || []).slice(0, 3);
  } catch {
    productHints.value = [];
  }
}

async function adoptProduct(p) {
  try {
    const res = await http.get(`/proposal/product-modules/${p.id}`, { headers: guestHeaders() });
    if (res.tech) form.tech = res.tech;
    if (res.domainHint && domainOpts.value.includes(res.domainHint)) {
      form.domain = res.domainHint;
    }
    const mods = (res.modules || []).map((m) => String(m).trim()).filter(Boolean).slice(0, 10);
    if (mods.length) {
      moduleOpts.value = [...new Set([...mods, ...modulesForDomain(form.domain)])].slice(0, 12);
      selectedModules.value = mods.slice(0, 6);
      adoptedProductId.value = p.id;
      ElMessage.success(`已带入 ${mods.length} 个模块`);
    } else {
      ElMessage.warning('该商品暂无结构化模块');
    }
  } catch {
    ElMessage.error('读取模块失败');
  }
}

function buildOutlinePool(titles, selectedSet) {
  return titles.map((title, i) => ({
    id: `c${i + 1}`,
    title,
    level: 1,
    on: selectedSet ? selectedSet.has(title) : true
  }));
}

function applyOutlinePreset(key) {
  outlinePreset.value = key;
  const titles = OUTLINE_PRESETS[key] || OUTLINE_PRESETS.standard;
  outlinePool.value = buildOutlinePool(titles);
}

function syncOutlineFromSession(list) {
  const titles = (list || []).map((c) => c.title).filter(Boolean);
  if (!titles.length) {
    applyOutlinePreset('standard');
    return;
  }
  outlinePreset.value = '';
  outlinePool.value = buildOutlinePool(titles, new Set(titles));
}

function activeOutline() {
  return outlinePool.value
    .filter((c) => c.on && c.title.trim())
    .map((c, i) => ({ id: c.id || `c${i + 1}`, title: c.title.trim(), level: 1 }));
}

function backToConfirm() {
  step.value = 0;
  phase.value = 'confirm';
}

async function loadMeta() {
  meta.value = await http.get('/proposal/meta', { headers: guestHeaders() });
  if (!outlinePool.value.length) applyOutlinePreset('standard');
}

async function createSession() {
  if (!isLogin.value) {
    ElMessage.warning('请先使用手机号注册登录；注册即赠送免费开题次数');
    router.push({ path: '/login', query: { redirect: '/services/proposal' } });
    return;
  }
  if (!agreed.value) return ElMessage.warning('请点选「已阅读并同意免责声明」');
  if (!form.title.trim()) return ElMessage.warning('请填写开题题目');
  if (!form.tech || !form.domain) return ElMessage.warning('请点选技术栈与业务领域');
  if (!selectedModules.value.length) return ElMessage.warning('请至少点选 1 个功能模块');

  creating.value = true;
  try {
    const res = await http.post('/proposal/sessions', {
      agreed: true,
      mode: wantTemplate.value ? 'hybrid' : 'qa',
      guest_key: ensureGuestKey(),
      profile: {
        ...form,
        modulesText: selectedModules.value.join('、')
      }
    }, { headers: guestHeaders() });
    if (res.guest_key) localStorage.setItem('proposal_guest_key', res.guest_key);
    session.value = res.session;
    syncOutlineFromSession(res.session.outline);
    step.value = 1;
  } finally {
    creating.value = false;
  }
}

async function uploadTemplate(opt) {
  if (!session.value?.id) return;
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append('file', opt.file);
    const res = await http.post(`/proposal/sessions/${session.value.id}/template`, fd, {
      headers: guestHeaders()
    });
    session.value = res.session;
    syncOutlineFromSession(res.session.outline);
    ElMessage.success(res.message || '模板已处理');
    opt.onSuccess?.(res);
  } catch (e) {
    opt.onError?.(e);
  } finally {
    uploading.value = false;
  }
}

async function saveAndGenerate() {
  if (!session.value?.id) return;
  const outline = activeOutline();
  if (outline.length < 3) return ElMessage.warning('请至少点选 3 个章节');
  savingOutline.value = true;
  try {
    const res = await http.put(`/proposal/sessions/${session.value.id}/outline`, {
      outline
    }, { headers: guestHeaders() });
    session.value = res.session;
  } finally {
    savingOutline.value = false;
  }
  await runGenerate(false);
}

async function runGenerate(force) {
  if (!session.value?.id) return;
  generating.value = true;
  step.value = 2;
  related.value = [];
  liveMd.value = `# ${form.title}\n\n`;
  streamStatus.value = '准备生成…';
  streamProgress.index = 0;
  streamProgress.total = activeOutline().length || outlinePool.value.filter((c) => c.on).length || 0;
  abortCtrl?.abort();
  abortCtrl = new AbortController();

  try {
    await streamProposalGenerate({
      id: session.value.id,
      force: !!force,
      signal: abortCtrl.signal,
      onEvent: async (event, data) => {
        if (event === 'chapter_start') {
          streamProgress.index = data.index || 0;
          streamProgress.total = data.total || streamProgress.total;
          streamStatus.value = `正在撰写：${data.title || ''}（${(data.index || 0) + 1}/${data.total || '?'}）`;
        } else if (event === 'chapter_done') {
          streamProgress.index = data.index || 0;
          streamProgress.total = data.total || streamProgress.total;
          liveMd.value += `\n## ${(data.index || 0) + 1}. ${data.title}\n\n${data.content || ''}\n`;
        } else if (event === 'done') {
          session.value = data.session;
          if (data.quota) meta.value = { ...meta.value, ...data.quota };
          liveMd.value = data.session?.content_md || liveMd.value;
          streamStatus.value = data.reused ? '已加载上次结果' : '生成完成';
        } else if (event === 'error') {
          if (data.quota) meta.value = { ...meta.value, ...data.quota };
          throw new Error(data.message || '生成失败');
        }
      }
    });
    await loadRelated();
    ElMessage.success(streamStatus.value || '生成完成');
    try { meta.value = await http.get('/proposal/meta', { headers: guestHeaders() }); } catch { /* ignore */ }
  } catch (e) {
    if (e.name === 'AbortError') return;
    ElMessage.error(e.message || '生成失败');
    try {
      const res = await http.post(`/proposal/sessions/${session.value.id}/generate`, { force: !!force }, {
        headers: guestHeaders(),
        timeout: 180000
      });
      session.value = res.session;
      if (res.quota) meta.value = { ...meta.value, ...res.quota };
      await loadRelated();
      ElMessage.success(res.reused ? '已加载上次结果' : '生成完成');
    } catch {
      step.value = 1;
    }
  } finally {
    generating.value = false;
  }
}

async function regen() {
  await runGenerate(true);
}

function resetAll() {
  session.value = null;
  liveMd.value = '';
  related.value = [];
  step.value = 0;
  phase.value = 'title';
  form.title = '';
  selectedModules.value = [];
  productHints.value = [];
  adoptedProductId.value = null;
  wantTemplate.value = false;
  agreed.value = false;
  applyOutlinePreset('standard');
  loadMeta();
}

async function loadRelated() {
  try {
    const kw = form.title.slice(0, 20) || form.domain;
    const res = await http.get('/products', {
      params: {
        page: 1,
        pageSize: 6,
        keyword: kw,
        tech: form.tech === '其他' ? undefined : form.tech,
        sort: 'sales'
      }
    });
    related.value = res.list || [];
  } catch {
    related.value = [];
  }
}

function goCustom() {
  const modules = selectedModules.value.join('、');
  const desc = [
    `由免费开题助手转化：${form.title}`,
    `技术栈：${form.tech}`,
    `领域：${form.domain}`,
    modules ? `模块：${modules}` : '',
    '希望基于站内源码二次开发 / 按开题范围实现。'
  ].filter(Boolean).join('\n');
  router.push({
    path: '/services/custom',
    query: {
      title: form.title,
      tech: form.tech,
      description: desc.slice(0, 900)
    }
  });
}

async function rewriteOne(index, action) {
  if (!session.value?.id) return;
  rewritingIndex.value = index;
  try {
    const res = await http.post(`/proposal/sessions/${session.value.id}/chapters/rewrite`, {
      index, action
    }, { headers: guestHeaders(), timeout: 120000 });
    session.value = res.session;
    if (typeof res.rewriteLeft === 'number') rewriteLeft.value = res.rewriteLeft;
    ElMessage.success('章节已更新');
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '改写失败');
  } finally {
    rewritingIndex.value = -1;
  }
}

function renderMd(src) {
  const esc = String(src || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const lines = esc.split('\n');
  const out = [];
  let inTable = false;
  let inUl = false;
  const closeUl = () => { if (inUl) { out.push('</ul>'); inUl = false; } };
  const closeTable = () => { if (inTable) { out.push('</tbody></table>'); inTable = false; } };
  const inlineMd = (s) => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  for (const line of lines) {
    if (/^\|.+\|$/.test(line.trim())) {
      closeUl();
      const cells = line.trim().split('|').filter(Boolean).map((c) => c.trim());
      if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue;
      if (!inTable) {
        out.push('<table><tbody>');
        inTable = true;
        out.push(`<tr>${cells.map((c) => `<th>${c}</th>`).join('')}</tr>`);
      } else {
        out.push(`<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`);
      }
      continue;
    }
    closeTable();
    if (/^###\s+/.test(line)) { closeUl(); out.push(`<h4>${line.replace(/^###\s+/, '')}</h4>`); continue; }
    if (/^##\s+/.test(line)) { closeUl(); out.push(`<h3>${line.replace(/^##\s+/, '')}</h3>`); continue; }
    if (/^#\s+/.test(line)) { closeUl(); out.push(`<h2>${line.replace(/^#\s+/, '')}</h2>`); continue; }
    if (/^>\s?/.test(line)) { closeUl(); out.push(`<blockquote>${line.replace(/^>\s?/, '')}</blockquote>`); continue; }
    if (/^[-*]\s+/.test(line)) {
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${inlineMd(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }
    closeUl();
    if (!line.trim()) out.push('');
    else out.push(`<p>${inlineMd(line)}</p>`);
  }
  closeUl();
  closeTable();
  return out.join('\n');
}

async function copyMd() {
  const t = session.value?.content_md || '';
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  ElMessage.success('已复制 Markdown');
}

function downloadMd() {
  const t = session.value?.content_md || '';
  if (!t) return;
  const blob = new Blob([t], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(form.title || '开题报告').slice(0, 40)}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function downloadDocx() {
  if (!session.value?.id) return;
  exporting.value = true;
  try {
    const gk = ensureGuestKey();
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`/api/proposal/sessions/${session.value.id}/export.docx?guest_key=${encodeURIComponent(gk)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('导出失败');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(form.title || '开题报告').slice(0, 40)}.docx`;
    a.click();
    URL.revokeObjectURL(a.href);
    ElMessage.success('已开始下载 Word');
  } catch (e) {
    ElMessage.error(e.message || '导出失败');
  } finally {
    exporting.value = false;
  }
}

onMounted(async () => {
  setSeo({
    title: '免费开题 - 毕业设计 / 毕设开题报告助手',
    description: '免费生成毕业设计、毕设开题报告，辅助课程设计选题与论文开题。',
    keywords: '免费开题,毕业设计开题,毕设开题,课程设计'
  });
  ensureGuestKey();
  try {
    await loadMeta();
  } catch {
    ElMessage.error('开题服务暂不可用');
  }
});

onBeforeUnmount(() => {
  abortCtrl?.abort();
});
</script>

<style scoped>
.proposal-page { padding: 16px 0 64px; max-width: 880px; }
.head {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
}
.head-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mine-link {
  font-size: 13px; font-weight: 650; color: var(--accent);
  padding: 8px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface);
}
.page-title { margin: 0 0 6px; font-size: 24px; }
.sub { margin: 0; color: var(--text-3); font-size: 14px; line-height: 1.6; }
.quota {
  font-size: 13px; color: var(--text-3);
  background: var(--bg-alt); border: 1px solid var(--border);
  padding: 8px 12px; border-radius: 999px; white-space: nowrap;
}
.quota b { color: var(--ink); }
.mock-tag {
  margin-left: 8px; font-size: 11px; font-weight: 700; color: #0f766e;
  background: var(--accent-soft); padding: 2px 8px; border-radius: 999px;
}
.steps { margin-bottom: 24px; }
.panel {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 16px; padding: 22px 20px;
}
.field-label {
  display: block; margin-bottom: 8px;
  font-size: 14px; font-weight: 650; color: var(--text-1);
}
.field-hint { margin: 10px 0 0; font-size: 13px; color: var(--text-3); line-height: 1.55; }
.confirm-head { margin-bottom: 18px; }
.back-link {
  appearance: none; border: 0; background: transparent; padding: 0;
  font: inherit; font-size: 13px; color: var(--text-3); cursor: pointer; margin-bottom: 8px;
}
.back-link:hover { color: var(--ink); }
.confirm-title {
  margin: 0 0 6px; font-size: 18px; line-height: 1.4; color: var(--text-1); font-weight: 720;
}
.chip-block { margin-bottom: 18px; }
.chip-label {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px;
  font-size: 13px; font-weight: 650; color: var(--text-2); margin-bottom: 8px;
}
.chip-label span { font-weight: 500; color: var(--text-4); font-size: 12px; }
.regen-mods {
  appearance: none; margin-left: auto; border: 0; background: none; cursor: pointer;
  font: inherit; font-size: 12.5px; font-weight: 650; color: var(--accent); padding: 0 2px;
}
.regen-mods:disabled { opacity: .55; cursor: wait; }
.mods-loading {
  margin: 0 0 10px; font-size: 13px; color: var(--text-3);
}
.chip-row.dim { opacity: .55; pointer-events: none; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.chip-row.wrap { gap: 8px; }
.chip-sub { margin: 10px 0 8px; font-size: 12.5px; color: var(--text-3); }
.product-hints { margin-top: 4px; }
.hint-cards { display: grid; grid-template-columns: 1fr; gap: 8px; }
@media (min-width: 640px) {
  .hint-cards { grid-template-columns: repeat(3, 1fr); }
}
.hint-card {
  appearance: none; text-align: left; cursor: pointer;
  border: 1px solid var(--border); border-radius: 12px;
  background: var(--bg-alt); padding: 10px 12px;
  display: flex; flex-direction: column; gap: 4px;
  transition: border-color .18s, background .18s;
}
.hint-card strong {
  font-size: 13px; line-height: 1.35; color: var(--text-1);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.hint-card span { font-size: 12px; color: var(--text-3); }
.hint-card:hover, .hint-card.on { border-color: var(--ink); background: var(--surface); }
.disclaimer { margin: 10px 0 0; font-size: 12.5px; color: var(--text-4); line-height: 1.6; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.hint { margin: 0 0 12px; color: var(--text-3); font-size: 13.5px; }
.upload-box { margin-bottom: 16px; }
.upload-inner { padding: 8px; }
.u-title { margin: 0 0 4px; font-weight: 700; color: var(--text-1); }
.u-sub { margin: 0; font-size: 12.5px; color: var(--text-3); }
.upload-ok { margin: 8px 0 0; font-size: 13px; color: #0f766e; font-weight: 600; }
.outline-chips { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.outline-chip {
  appearance: none; display: flex; align-items: center; gap: 10px;
  width: 100%; text-align: left; cursor: pointer;
  border: 1px solid var(--border); border-radius: 12px;
  background: var(--bg-alt); padding: 10px 12px;
  font: inherit; color: var(--text-2);
  transition: border-color .18s, background .18s, color .18s;
}
.outline-chip.on {
  border-color: var(--ink); background: var(--surface); color: var(--text-1); font-weight: 600;
}
.oc-idx {
  width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
  display: grid; place-items: center;
  background: var(--border); color: var(--text-3);
  font-size: 12px; font-weight: 700;
}
.outline-chip.on .oc-idx { background: var(--ink); color: #fff; }
.oc-title { font-size: 14px; line-height: 1.4; }
.chapter-actions {
  margin-bottom: 14px; padding: 12px 14px; border: 1px solid var(--border);
  border-radius: 12px; background: var(--bg-alt);
}
.chapter-actions h4 { margin: 0 0 10px; font-size: 14px; }
.chapter-actions small { color: var(--text-3); font-weight: 500; margin-left: 8px; }
.ch-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 0; border-top: 1px solid var(--border); flex-wrap: wrap;
}
.ch-row:first-of-type { border-top: 0; }
.ch-title { font-size: 13px; font-weight: 600; color: var(--text-2); }
.ch-btns { display: flex; gap: 6px; flex-wrap: wrap; }
.gen-box {
  text-align: center; padding: 24px 12px 12px; color: var(--text-3);
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.prog { width: min(420px, 100%); }
.md-preview.live { text-align: left; width: 100%; max-height: 420px; overflow: auto; margin-top: 8px; }
.result-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.md-preview {
  border: 1px solid var(--border); border-radius: 12px; padding: 18px 16px;
  background: var(--bg-alt); line-height: 1.8; color: var(--text-2); font-size: 14.5px;
}
.md-preview :deep(h2) { font-size: 20px; margin: 0 0 12px; color: var(--ink); }
.md-preview :deep(h3) { font-size: 17px; margin: 22px 0 10px; color: var(--ink); }
.md-preview :deep(h4) { font-size: 15px; margin: 14px 0 8px; }
.md-preview :deep(p) { margin: 0 0 10px; }
.md-preview :deep(ul) { margin: 0 0 12px; padding-left: 1.2em; }
.md-preview :deep(blockquote) {
  margin: 0 0 12px; padding: 8px 12px; border-left: 3px solid var(--accent);
  background: var(--surface); color: var(--text-3); border-radius: 0 8px 8px 0;
}
.md-preview :deep(table) { width: 100%; border-collapse: collapse; margin: 0 0 14px; font-size: 13px; }
.md-preview :deep(th), .md-preview :deep(td) {
  border: 1px solid var(--border); padding: 8px 10px; text-align: left; background: var(--surface);
}
.md-preview :deep(th) { font-weight: 700; background: var(--bg); }
.related { margin-top: 28px; }
.related h3 { margin: 0 0 12px; font-size: 17px; }
.rel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.rel-card {
  border: 1px solid var(--border); border-radius: 12px; padding: 8px;
  background: var(--surface); display: flex; flex-direction: column; gap: 6px;
}
.rel-card strong {
  font-size: 12.5px; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.rel-cta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }

@media (max-width: 768px) {
  .page-title { font-size: 20px; }
  .panel { padding: 16px 14px; }
  .actions .el-button { width: 100%; margin: 0; }
  .result-toolbar .el-button { flex: 1 1 calc(50% - 4px); }
}
</style>
