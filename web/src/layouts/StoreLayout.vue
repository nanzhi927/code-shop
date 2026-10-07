<template>
  <div class="store-layout">
    <div v-if="notices.length" class="notice-bar">
      <el-carousel height="28px" direction="vertical" :autoplay="true" :interval="4000" indicator-position="none">
        <el-carousel-item v-for="n in notices" :key="n.id">
          <div class="notice-item">{{ n.title }}：{{ n.content }}</div>
        </el-carousel-item>
      </el-carousel>
    </div>
    <div v-if="settings.announcement" class="topbar">{{ settings.announcement }}</div>
    <header class="store-header">
      <div class="page-container header-inner">
        <button class="mobile-menu" aria-label="打开菜单" @click="drawerOpen = true">
          <el-icon :size="22"><Menu /></el-icon>
        </button>
        <router-link to="/" class="logo">
          <span class="logo-mark">码</span>
          <span class="logo-text">源码商城</span>
        </router-link>

        <div class="header-search">
          <div class="search-pill">
            <el-icon class="search-ico"><Search /></el-icon>
            <el-autocomplete
              v-model="headerKeyword"
              class="search-field"
              placeholder="搜索源码名称 / 关键词"
              :fetch-suggestions="headerSuggest"
              :trigger-on-focus="false"
              popper-class="header-suggest-popper"
              @select="onHeaderSelect"
              @keyup.enter="doHeaderSearch"
            />
            <button type="button" class="search-go" @click="doHeaderSearch">搜索</button>
          </div>
        </div>

        <nav class="nav">
          <router-link to="/" exact-active-class="active">首页</router-link>
          <router-link to="/products" active-class="active">全部源码</router-link>
          <router-link to="/articles" active-class="active">教程</router-link>
          <router-link to="/cases" active-class="active">案例</router-link>
          <router-link to="/opensource" active-class="active">开源项目</router-link>
          <router-link to="/services" active-class="active">服务</router-link>
        </nav>

        <div class="actions">
          <router-link to="/cart" class="icon-btn cart-btn" title="购物车">
            <el-badge :value="cartCount" :hidden="cartCount === 0">
              <el-icon size="20"><ShoppingCart /></el-icon>
            </el-badge>
            <span class="cart-text">购物车</span>
          </router-link>
          <button class="icon-btn theme-btn" @click="toggle" :aria-label="isDark ? '切换浅色' : '切换深色'">
            <el-icon :size="18"><component :is="isDark ? 'Sunny' : 'Moon'" /></el-icon>
          </button>
          <template v-if="userStore.isLogin">
            <router-link to="/messages" class="icon-btn bell-btn" title="消息">
              <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99">
                <el-icon :size="18"><Bell /></el-icon>
              </el-badge>
            </router-link>
            <el-dropdown @command="onCommand">
              <span class="user-name">{{ userStore.user.nickname }}</span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="orders">我的订单</el-dropdown-item>
                  <el-dropdown-item command="messages">消息中心</el-dropdown-item>
                  <el-dropdown-item command="cards">我的卡密</el-dropdown-item>
                  <el-dropdown-item command="favorites">我的收藏</el-dropdown-item>
                  <el-dropdown-item v-if="userStore.isAdmin" command="admin">管理后台</el-dropdown-item>
                  <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <router-link to="/login" class="login-btn">登录 / 注册</router-link>
          </template>
        </div>
      </div>
    </header>

    <el-drawer v-model="drawerOpen" direction="ltr" :size="260" :with-header="false" class="mobile-drawer">
      <nav class="drawer-nav">
        <div class="drawer-search">
          <el-input
            v-model="headerKeyword"
            placeholder="搜索源码"
            clearable
            @keyup.enter="doHeaderSearch(); drawerOpen = false"
          >
            <template #append>
              <el-button @click="doHeaderSearch(); drawerOpen = false">搜</el-button>
            </template>
          </el-input>
        </div>
        <router-link to="/" exact-active-class="active" @click="drawerOpen = false">首页</router-link>
        <router-link to="/products" active-class="active" @click="drawerOpen = false">全部源码</router-link>
        <router-link to="/articles" active-class="active" @click="drawerOpen = false">教程</router-link>
        <router-link to="/cases" active-class="active" @click="drawerOpen = false">案例</router-link>
        <router-link to="/opensource" active-class="active" @click="drawerOpen = false">开源项目</router-link>
        <router-link to="/services" active-class="active" @click="drawerOpen = false">增值服务</router-link>
        <a href="#" @click.prevent="drawerOpen = false; openContact()">联系客服</a>
        <template v-if="userStore.isLogin">
          <router-link to="/orders" active-class="active" @click="drawerOpen = false">我的订单</router-link>
          <router-link to="/cards" active-class="active" @click="drawerOpen = false">我的卡密</router-link>
          <router-link to="/favorites" active-class="active" @click="drawerOpen = false">我的收藏</router-link>
          <router-link to="/messages" active-class="active" @click="drawerOpen = false">消息中心</router-link>
          <a href="#" @click.prevent="onCommand('logout')">退出登录</a>
        </template>
        <router-link v-else to="/login" class="drawer-login" @click="drawerOpen = false">登录 / 注册</router-link>
      </nav>
    </el-drawer>

    <main class="store-main">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <footer class="store-footer">
      <div class="page-container">
        <p class="footer-brand">源码商城</p>
        <p class="tips footer-links">
          <router-link class="contact-link" to="/products">全部源码</router-link>
          <span class="sep">·</span>
          <router-link class="contact-link" to="/articles">毕设教程</router-link>
          <span class="sep">·</span>
          <router-link class="contact-link" to="/cases">交付案例</router-link>
          <span class="sep">·</span>
          <router-link class="contact-link" to="/opensource">开源项目</router-link>
          <span class="sep">·</span>
          <a class="contact-link" href="https://gitee.com/nanzhiyu/code-shop" target="_blank" rel="noopener">Gitee</a>
          <span class="sep">·</span>
          <router-link class="contact-link" to="/about">关于</router-link>
          <span class="sep">·</span>
          <router-link class="contact-link" to="/contact">联系</router-link>
          <span class="sep">·</span>
          <router-link class="contact-link" to="/help">帮助</router-link>
        </p>
        <p class="tips service">
          <span v-if="settings.service_qq">客服QQ：{{ settings.service_qq }}</span>
          <span v-if="settings.service_wechat">客服微信：{{ settings.service_wechat }}</span>
        </p>
        <p class="tips legal-links">
          <router-link class="contact-link muted" to="/terms">服务条款</router-link>
          <span class="sep">·</span>
          <router-link class="contact-link muted" to="/privacy">隐私政策</router-link>
        </p>
      </div>
    </footer>

    <button
      type="button"
      class="chat-fab"
      :class="{ 'chat-fab--raise': fabRaise }"
      aria-label="联系客服"
      @click="openContact"
    >
      <el-icon :size="22"><ChatDotRound /></el-icon>
      <span class="chat-fab-text">客服</span>
    </button>
    <ContactDialog />

    <nav class="mobile-tabbar" aria-label="底部导航">
      <router-link to="/" class="tab-item" exact-active-class="active">
        <el-icon :size="20"><HomeFilled /></el-icon>
        <span>首页</span>
      </router-link>
      <router-link to="/products" class="tab-item" active-class="active">
        <el-icon :size="20"><Grid /></el-icon>
        <span>源码</span>
      </router-link>
      <router-link to="/services" class="tab-item" active-class="active">
        <el-icon :size="20"><Briefcase /></el-icon>
        <span>服务</span>
      </router-link>
      <router-link to="/cart" class="tab-item" active-class="active">
        <el-badge :value="cartCount" :hidden="cartCount === 0" :max="99">
          <el-icon :size="20"><ShoppingCart /></el-icon>
        </el-badge>
        <span>购物车</span>
      </router-link>
      <a
        href="#"
        class="tab-item"
        :class="{ active: isMeTab }"
        @click.prevent="onMeTab"
      >
        <el-icon :size="20"><User /></el-icon>
        <span>{{ userStore.isLogin ? '我的' : '登录' }}</span>
      </a>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '../stores/user';
import { useCartStore } from '../stores/cart';
import { useTheme } from '../composables/useTheme';
import { useContact } from '../composables/useContact';
import ContactDialog from '../components/ContactDialog.vue';
import http from '../api';

const userStore = useUserStore();
const cartStore = useCartStore();
const { isDark, toggle } = useTheme();
const { openContact } = useContact();
const router = useRouter();
const route = useRoute();

const cartCount = computed(() => cartStore.totalCount);
const settings = ref({});
const notices = ref([]);
const drawerOpen = ref(false);
const unreadCount = ref(0);
const headerKeyword = ref('');
let unreadTimer = null;

const ME_PATHS = ['/orders', '/cards', '/favorites', '/messages', '/login', '/contact', '/services/proposal'];
const isMeTab = computed(() => ME_PATHS.some((p) => route.path === p || route.path.startsWith(p + '/')));
const fabRaise = computed(() => route.path.startsWith('/services/p/'));

function onMeTab() {
  if (userStore.isLogin) drawerOpen.value = true;
  else router.push('/login');
}

function doHeaderSearch() {
  const kw = headerKeyword.value?.trim() || '';
  router.push({ path: '/products', query: kw ? { keyword: kw } : {} });
}

async function headerSuggest(q, cb) {
  const kw = String(q || '').trim();
  if (!kw) return cb([]);
  try {
    const arr = await http.get('/products/suggest', { params: { keyword: kw } });
    const list = Array.isArray(arr) ? arr : [];
    cb(list.map((t) => ({ value: t })));
  } catch { cb([]); }
}
function onHeaderSelect(item) {
  headerKeyword.value = item && item.value ? item.value : headerKeyword.value;
  doHeaderSearch();
}

async function loadUnread() {
  try {
    const r = await http.get('/notifications', { params: { page: 1, pageSize: 1 } });
    unreadCount.value = r.unread || 0;
  } catch {}
}

function onCommand(cmd) {
  drawerOpen.value = false;
  if (cmd === 'orders') router.push('/orders');
  else if (cmd === 'messages') router.push('/messages');
  else if (cmd === 'cards') router.push('/cards');
  else if (cmd === 'favorites') router.push('/favorites');
  else if (cmd === 'admin') router.push('/admin');
  else if (cmd === 'logout') {
    userStore.logout();
    router.push('/');
  }
}

onMounted(async () => {
  if (route.query.ref) localStorage.setItem('refCode', String(route.query.ref));
  try {
    settings.value = await http.get('/settings/public');
  } catch {
    // 忽略设置加载失败
  }
  try {
    const res = await http.get('/notices');
    notices.value = res.list || [];
  } catch {
    // 忽略公告加载失败
  }
  if (userStore.isLogin) loadUnread();
  unreadTimer = setInterval(() => {
    if (userStore.isLogin) loadUnread();
  }, 60000);
});

onBeforeUnmount(() => {
  if (unreadTimer) clearInterval(unreadTimer);
});

watch(() => route.path, (path) => {
  if (path === '/messages' && userStore.isLogin) loadUnread();
});

watch(() => route.query.keyword, (kw) => {
  if (typeof kw === 'string') headerKeyword.value = kw;
}, { immediate: true });
</script>

<style scoped>
.store-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.store-main {
  flex: 1 0 auto;
  width: 100%;
}
.notice-bar {
  background: var(--bg);
  color: var(--text-3);
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  border-bottom: 1px solid var(--border);
}
.notice-item {
  height: 28px;
  line-height: 28px;
  text-align: center;
  padding: 0 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topbar {
  background: var(--ink); color: #fff; text-align: center;
  font-size: 12.5px; font-weight: 600; letter-spacing: .2px; padding: 7px 0;
}
.store-header {
  background: var(--header-bg);
  backdrop-filter: saturate(180%) blur(16px);
  -webkit-backdrop-filter: saturate(180%) blur(16px);
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 100;
}
.header-inner {
  display: flex; align-items: center; height: var(--header-h); gap: 20px;
}
.mobile-menu {
  display: none;
  background: none; border: none; cursor: pointer; color: var(--text-1);
  padding: 4px; flex-shrink: 0;
}
.logo {
  display: flex; align-items: center; gap: 8px; font-size: 16px;
  font-weight: 650; color: var(--text-1); flex-shrink: 0; letter-spacing: -.02em;
  font-family: var(--font-display);
}
.logo-mark {
  width: 22px; height: 22px; border-radius: 4px; display: grid; place-items: center;
  background: var(--ink); color: #fff; font-weight: 700; font-size: 11px;
  letter-spacing: 0;
}
.logo-text {
  color: var(--text-1);
  -webkit-text-fill-color: var(--text-1);
}
.header-search {
  flex: 1; max-width: 420px; min-width: 0;
}
.search-pill {
  display: flex; align-items: center; gap: 6px;
  height: 40px; padding: 3px 4px 3px 12px;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 999px;
  transition: border-color .18s, background .18s, box-shadow .18s;
}
.search-pill:focus-within {
  background: var(--surface);
  border-color: var(--ink);
  box-shadow: 0 0 0 3px rgba(10, 10, 11, .05);
}
.search-ico {
  color: var(--text-3); font-size: 16px; flex-shrink: 0;
}
.search-field {
  flex: 1; min-width: 0; height: 100%;
  display: flex; align-items: center;
}
.search-field :deep(.el-input),
.search-field :deep(.el-autocomplete),
.search-field.el-autocomplete {
  width: 100%;
  height: 100%;
}
.search-field :deep(.el-input__wrapper) {
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
  border-radius: 0 !important;
  padding: 0 !important;
  height: 100% !important;
  min-height: 0 !important;
}
.search-field :deep(.el-input__wrapper:hover),
.search-field :deep(.el-input__wrapper.is-focus),
.search-field :deep(.el-input.is-focus .el-input__wrapper) {
  background: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
}
.search-field :deep(.el-input__inner) {
  height: 100% !important;
  border: 0 !important;
  outline: none !important;
  background: transparent !important;
  box-shadow: none !important;
  font-size: 13.5px;
  color: var(--text-1);
  font-family: inherit;
  padding: 0 !important;
  line-height: 34px;
}
.search-field :deep(.el-input__inner::placeholder) { color: var(--text-4); }
.search-go {
  flex-shrink: 0; height: 32px; padding: 0 14px;
  border: 0; border-radius: 999px; cursor: pointer;
  background: var(--ink); color: #fff;
  font-size: 12.5px; font-weight: 600; font-family: inherit;
  transition: background .18s, transform .15s;
}
.search-go:hover { background: #27272a; }
.search-go:active { transform: scale(.97); }
.nav { display: flex; gap: 24px; flex-shrink: 0; }
.nav a {
  color: var(--text-2); font-size: 14px; font-weight: 600;
  padding: 4px 0; position: relative; transition: color .2s;
}
.nav a::after {
  content: ""; position: absolute; left: 0; bottom: -4px; width: 0; height: 2px;
  background: var(--accent); border-radius: 2px; transition: width .22s var(--ease);
}
.nav a:hover, .nav a.active { color: var(--text-1); }
.nav a:hover::after, .nav a.active::after { width: 100%; }
.actions { display: flex; align-items: center; gap: 12px; flex-shrink: 0; margin-left: auto; }
.icon-btn {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--text-2); font-weight: 600; font-size: 13.5px;
  background: none; border: none; cursor: pointer; padding: 4px;
  transition: color .2s;
}
.icon-btn:hover { color: var(--text-1); }
.theme-btn { border-radius: 8px; }
.user-name {
  cursor: pointer; color: var(--text-1); font-weight: 600; font-size: 13.5px;
  max-width: 88px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.login-btn {
  color: #fff; background: var(--ink); padding: 8px 16px; border-radius: 999px;
  font-size: 13px; font-weight: 650;
  transition: transform .18s var(--ease), background .18s;
}
.login-btn:hover { background: #27272a; transform: translateY(-1px); }
.store-footer {
  background: var(--footer-bg); color: var(--footer-text);
  margin-top: 80px; padding: 48px 0 36px; text-align: left;
  flex-shrink: 0;
}
.store-footer p { color: var(--footer-text); font-size: 13px; line-height: 1.9; }
.store-footer .footer-brand {
  font-family: var(--font-display); font-size: 15px; font-weight: 600;
  color: var(--footer-bright); letter-spacing: -.02em; margin: 0 0 12px;
}
.store-footer .tips { color: var(--footer-muted); }
.store-footer .contact-link.muted { color: var(--footer-muted); font-weight: 500; }
.store-footer .legal-links { margin-top: 8px; }
.store-footer .service {
  display: flex; gap: 24px; justify-content: flex-start;
  color: var(--footer-bright); flex-wrap: wrap;
}
.store-footer .service span { color: var(--footer-bright); font-weight: 600; }
.store-footer .contact-link { color: var(--footer-bright); font-weight: 600; }
.store-footer .contact-link:hover { opacity: .85; }
.store-footer .sep { margin: 0 8px; color: var(--footer-muted); }
.store-footer .footer-links {
  display: flex; flex-wrap: wrap; justify-content: flex-start; align-items: center;
  gap: 4px 0; padding: 0; line-height: 2;
}

.drawer-nav {
  display: flex; flex-direction: column; gap: 4px; padding: 16px 12px;
}
.drawer-search { margin-bottom: 12px; }
.drawer-nav a {
  display: block; padding: 12px 14px; color: var(--text-2); font-weight: 600;
  font-size: 15px; border-radius: 10px; transition: background .2s;
}
.drawer-nav a:hover, .drawer-nav a.active {
  color: var(--text-1); background: var(--bg-alt);
}
.drawer-login {
  margin-top: 8px; text-align: center; background: var(--ink) !important;
  color: #fff !important; border-radius: 999px !important;
}

.mobile-tabbar {
  display: none;
}

.chat-fab {
  position: fixed;
  right: 20px;
  bottom: 28px;
  z-index: 280;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 48px;
  padding: 0 16px 0 14px;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  background: var(--ink);
  color: #fff;
  font-size: 14px;
  font-weight: 650;
  font-family: inherit;
  box-shadow: 0 10px 28px -10px rgba(10, 10, 11, .45);
  transition: transform .18s var(--ease), background .18s;
}
.chat-fab:hover { background: #27272a; transform: translateY(-2px); }
.chat-fab:active { transform: scale(.97); }
.chat-fab-text { letter-spacing: .02em; }

@media (max-width: 1024px) {
  .nav { display: none; }
  .header-search { max-width: 280px; }
}
@media (max-width: 768px) {
  .mobile-menu { display: flex; align-items: center; }
  .header-search { display: none; }
  .header-inner { height: auto; min-height: 52px; gap: 10px; padding: 8px 0; }
  .logo { font-size: 15px; gap: 8px; }
  .logo-text { max-width: 5.5em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .logo-mark { width: 22px; height: 22px; font-size: 11px; }
  .actions { gap: 4px; }
  .cart-text { display: none; }
  .coupon-link { display: none; }
  .bell-btn { display: none; }
  .theme-btn { padding: 6px; }
  .login-btn { padding: 6px 12px; font-size: 12px; }
  .user-name { max-width: 48px; font-size: 12px; }
  .topbar {
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    padding: 6px 12px; font-size: 12px;
  }
  .store-footer {
    margin-top: 36px;
    padding: 32px 0 calc(24px + var(--mobile-nav-h, 56px) + env(safe-area-inset-bottom));
  }
  .store-footer .service { gap: 12px; flex-direction: column; }

  .chat-fab {
    right: 14px;
    bottom: calc(var(--mobile-nav-h, 56px) + env(safe-area-inset-bottom) + 14px);
    height: 44px;
    padding: 0 14px 0 12px;
    font-size: 13px;
  }
  .chat-fab--raise {
    bottom: calc(var(--mobile-nav-h, 56px) + env(safe-area-inset-bottom) + 72px);
  }

  .mobile-tabbar {
    display: flex;
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 300;
    height: calc(var(--mobile-nav-h, 56px) + env(safe-area-inset-bottom));
    padding: 0 4px env(safe-area-inset-bottom);
    background: var(--header-bg);
    backdrop-filter: saturate(180%) blur(16px);
    -webkit-backdrop-filter: saturate(180%) blur(16px);
    border-top: 1px solid var(--border);
    justify-content: space-around;
    align-items: stretch;
  }
  .tab-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--text-3);
    font-size: 10.5px;
    font-weight: 600;
    text-decoration: none;
    min-width: 0;
    padding: 6px 2px;
    position: relative;
    -webkit-tap-highlight-color: transparent;
  }
  .tab-item :deep(.el-badge) { line-height: 1; }
  .tab-item.active { color: var(--ink); }
  .tab-item.active .el-icon { color: var(--ink); }
  .tab-item.active::before {
    content: ""; position: absolute; top: 0; left: 28%; right: 28%;
    height: 1.5px; background: var(--ink);
  }
}
</style>
