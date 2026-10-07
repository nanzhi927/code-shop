<template>
  <el-container class="admin-layout" :class="{ collapsed: collapsed }">
    <el-aside :width="asideWidth" class="admin-aside">
      <div class="brand">
        <span class="brand-mark">CS</span>
        <div v-show="!collapsed" class="brand-text">
          <strong>源码商城</strong>
          <span>管理后台</span>
        </div>
      </div>
      <el-scrollbar class="aside-scroll">
        <el-menu
          :default-active="$route.path"
          router
          class="aside-menu"
          :collapse="collapsed"
          :collapse-transition="false"
        >
          <el-menu-item
            v-for="item in menuItems"
            :key="item.index"
            :index="item.index"
            v-show="!item.superadmin || userStore.isSuperadmin"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <template #title>{{ item.label }}</template>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>
      <button class="collapse-btn" type="button" @click="collapsed = !collapsed" :title="collapsed ? '展开' : '收起'">
        <el-icon :size="16"><component :is="collapsed ? 'Expand' : 'Fold'" /></el-icon>
      </button>
    </el-aside>

    <el-container class="admin-body">
      <el-header class="admin-header" height="48px">
        <button class="mobile-menu" aria-label="打开菜单" @click="drawerOpen = true">
          <el-icon :size="20"><Menu /></el-icon>
        </button>
        <div class="header-title">
          <span class="crumb-root">后台</span>
          <span class="crumb-sep">/</span>
          <span class="crumb-current">{{ pageTitle }}</span>
        </div>
        <div class="header-actions">
          <button class="icon-btn" @click="toggle" :aria-label="isDark ? '切换浅色' : '切换深色'">
            <el-icon :size="16"><component :is="isDark ? 'Sunny' : 'Moon'" /></el-icon>
          </button>
          <el-dropdown trigger="click" @command="onUserCommand">
            <button class="user-trigger" type="button">
              <span class="user-avatar">{{ avatarLetter }}</span>
              <span class="user-name">{{ userStore.user?.nickname || '管理员' }}</span>
              <el-icon :size="12"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="home">查看前台</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="admin-main">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>

    <el-drawer v-model="drawerOpen" direction="ltr" :size="220" :with-header="false" class="admin-drawer">
      <div class="brand drawer-brand">
        <span class="brand-mark">CS</span>
        <div class="brand-text">
          <strong>源码商城</strong>
          <span>管理后台</span>
        </div>
      </div>
      <el-menu :default-active="$route.path" router class="aside-menu drawer-menu" @select="drawerOpen = false">
        <el-menu-item
          v-for="item in menuItems"
          :key="'d-' + item.index"
          :index="item.index"
          v-show="!item.superadmin || userStore.isSuperadmin"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
    </el-drawer>
  </el-container>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '../stores/user';
import { useTheme } from '../composables/useTheme';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const { isDark, toggle } = useTheme();
const drawerOpen = ref(false);
const collapsed = ref(false);

const asideWidth = computed(() => (collapsed.value ? '64px' : '220px'));

const menuItems = [
  { index: '/admin', label: '数据概览', icon: 'DataBoard' },
  { index: '/admin/products', label: '商品管理', icon: 'Goods' },
  { index: '/admin/articles', label: '文章管理', icon: 'Reading' },
  { index: '/admin/cases', label: '案例管理', icon: 'Collection' },
  { index: '/admin/qa', label: '质检中心', icon: 'CircleCheck' },
  { index: '/admin/orders', label: '订单管理', icon: 'List' },
  { index: '/admin/refunds', label: '售后管理', icon: 'RefreshLeft' },
  { index: '/admin/cards', label: '卡密管理', icon: 'Tickets' },
  { index: '/admin/coupons', label: '优惠券管理', icon: 'Ticket' },
  { index: '/admin/notices', label: '公告管理', icon: 'Bell' },
  { index: '/admin/users', label: '用户管理', icon: 'User' },
  { index: '/admin/admins', label: '管理员管理', icon: 'UserFilled', superadmin: true },
  { index: '/admin/logs', label: '操作日志', icon: 'Document' },
  { index: '/admin/custom', label: '定制管理', icon: 'EditPen' },
  { index: '/admin/proposal', label: '开题管理', icon: 'Notebook' },
  { index: '/admin/service-cards', label: '服务卡片', icon: 'Grid' },
  { index: '/admin/service-pages', label: '服务页面', icon: 'Document' },
  { index: '/admin/enterprise', label: 'B 端询价', icon: 'OfficeBuilding' },
  { index: '/admin/data-report', label: '数据洞察', icon: 'TrendCharts' },
  { index: '/admin/settings', label: '系统设置', icon: 'Setting' }
];

const TITLE_MAP = Object.fromEntries(menuItems.map((m) => [m.index, m.label]));
const pageTitle = computed(() => TITLE_MAP[route.path] || '管理后台');
const avatarLetter = computed(() => (userStore.user?.nickname || 'A').slice(0, 1).toUpperCase());

function onUserCommand(cmd) {
  if (cmd === 'logout') {
    userStore.logout();
    router.push('/admin/login');
  } else if (cmd === 'home') {
    router.push('/');
  }
}
</script>

<style scoped>
.admin-layout {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--bg);
}

.admin-aside {
  background: var(--admin-aside-bg);
  border-right: none;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 2;
  height: 100%;
  transition: width .25s var(--ease);
  overflow: hidden;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, .06);
  flex-shrink: 0;
}

.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: #fff;
  font-weight: 800;
  font-size: 12px;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  min-width: 0;
}

.brand-text strong {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}

.brand-text span {
  font-size: 10px;
  color: var(--admin-aside-text);
}

.aside-scroll {
  flex: 1;
  height: 0;
  padding: 8px 0;
}

.aside-menu {
  border-right: none !important;
  background: transparent !important;
  --el-menu-bg-color: transparent;
  --el-menu-text-color: var(--admin-aside-text);
  --el-menu-hover-bg-color: var(--admin-aside-hover);
  --el-menu-active-color: var(--admin-aside-active);
}

:deep(.aside-menu .el-menu-item) {
  height: 40px;
  line-height: 40px;
  margin: 2px 8px;
  border-radius: 6px;
  color: var(--admin-aside-text) !important;
  font-weight: 500;
  font-size: 13.5px;
  position: relative;
}

:deep(.aside-menu .el-menu-item .el-icon) {
  color: inherit;
  font-size: 16px;
}

:deep(.aside-menu .el-menu-item:hover) {
  background: var(--admin-aside-hover) !important;
  color: #fff !important;
}

:deep(.aside-menu .el-menu-item.is-active) {
  background: var(--admin-aside-active-bg) !important;
  color: var(--admin-aside-active) !important;
  font-weight: 600;
}

:deep(.aside-menu .el-menu-item.is-active::before) {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
}

.collapse-btn {
  height: 40px;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, .06);
  background: transparent;
  color: var(--admin-aside-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color .15s, background .15s;
}
.collapse-btn:hover {
  color: #fff;
  background: var(--admin-aside-hover);
}

.admin-body {
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}

.admin-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: 48px !important;
  flex-shrink: 0;
  box-shadow: none;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.crumb-root { color: var(--text-3); font-size: 12px; }
.crumb-sep { color: var(--text-4); font-size: 11px; }
.crumb-current {
  color: var(--text-1);
  font-size: 14px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.icon-btn,
.mobile-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-2);
  transition: background .15s, color .15s;
}

.icon-btn:hover,
.mobile-menu:hover {
  background: var(--bg-alt);
  color: var(--text-1);
}

.mobile-menu { display: none; }

.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px 0 4px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  color: var(--text-1);
  transition: background .15s, border-color .15s;
}

.user-trigger:hover {
  background: var(--bg-alt);
  border-color: var(--border);
}

.user-avatar {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: var(--ink);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

html.dark .user-avatar {
  background: var(--accent);
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-main {
  background: var(--bg);
  padding: 16px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.drawer-brand {
  margin: -20px -20px 8px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, .06);
  background: var(--admin-aside-bg);
}

@media (max-width: 960px) {
  .admin-aside { display: none; }
  .mobile-menu { display: flex; }
  .admin-main { padding: 12px; }
  .user-name { display: none; }
  .admin-header { padding: 0 12px; }
}
</style>

<style>
.admin-drawer .el-drawer__body {
  padding: 16px 8px;
  background: var(--admin-aside-bg);
}
.admin-drawer .drawer-menu {
  border-right: none !important;
  background: transparent !important;
  --el-menu-bg-color: transparent;
  --el-menu-text-color: var(--admin-aside-text);
  --el-menu-hover-bg-color: var(--admin-aside-hover);
  --el-menu-active-color: #fff;
}
.admin-drawer .el-menu-item {
  height: 40px;
  line-height: 40px;
  margin: 2px 4px;
  border-radius: 6px;
  color: var(--admin-aside-text) !important;
}
.admin-drawer .el-menu-item:hover {
  background: var(--admin-aside-hover) !important;
  color: #fff !important;
}
.admin-drawer .el-menu-item.is-active {
  background: var(--admin-aside-active-bg) !important;
  color: #fff !important;
  font-weight: 600;
}
</style>
