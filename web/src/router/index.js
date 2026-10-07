import { createRouter, createWebHistory } from 'vue-router';
import { SITE_TITLE } from '../composables/useSeo';
import { trackPageview, captureUtmFromUrl } from '../utils/visitTrack';

const routes = [
  {
    path: '/',
    component: () => import('../layouts/StoreLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('../views/store/Home.vue') },
      { path: 'products', name: 'products', meta: { title: '全部源码' }, component: () => import('../views/store/ProductList.vue') },
      { path: 'products/:id', name: 'product-detail', component: () => import('../views/store/ProductDetail.vue') },
      { path: 'cart', name: 'cart', meta: { auth: true, title: '购物车' }, component: () => import('../views/store/Cart.vue') },
      { path: 'checkout', name: 'checkout', meta: { auth: true, title: '确认订单' }, component: () => import('../views/store/Checkout.vue') },
      { path: 'pay/:orderId', name: 'pay', meta: { auth: true, title: '订单支付' }, component: () => import('../views/store/Pay.vue') },
      { path: 'orders', name: 'orders', meta: { auth: true, title: '我的订单' }, component: () => import('../views/store/MyOrders.vue') },
      { path: 'cards', name: 'cards', meta: { auth: true, title: '我的卡密' }, component: () => import('../views/store/MyCards.vue') },
      { path: 'favorites', name: 'favorites', meta: { auth: true, title: '我的收藏' }, component: () => import('../views/store/MyFavorites.vue') },
      { path: 'services', name: 'services', meta: { title: '增值服务' }, component: () => import('../views/store/Services.vue') },
      { path: 'services/p/:slug', name: 'service-landing', meta: { title: '服务详情' }, component: () => import('../views/store/ServiceLanding.vue') },
      { path: 'services/custom', name: 'custom-order', meta: { auth: true, title: '定制开发' }, component: () => import('../views/store/CustomOrder.vue') },
      { path: 'services/proposal', name: 'proposal', meta: { title: '免费开题' }, component: () => import('../views/store/ProposalWizard.vue') },
      { path: 'services/proposal/mine', name: 'proposal-mine', meta: { auth: true, title: '我的开题' }, component: () => import('../views/store/ProposalMine.vue') },
      { path: 'services/enterprise', name: 'enterprise', meta: { title: '机构询价' }, component: () => import('../views/store/Enterprise.vue') },
      { path: 'services/membership', redirect: '/services' },
      { path: 'services/referral', redirect: '/services' },
      { path: 'coupons', name: 'coupons', meta: { title: '领券中心' }, component: () => import('../views/store/Coupons.vue') },
      { path: 'opensource', name: 'opensource', meta: { title: '开源项目' }, component: () => import('../views/store/OpenSource.vue') },
      { path: 'articles', name: 'articles', meta: { title: '教程' }, component: () => import('../views/store/ArticleList.vue') },
      { path: 'articles/:slug', name: 'article-detail', component: () => import('../views/store/ArticleDetail.vue') },
      { path: 'cases', name: 'cases', meta: { title: '交付案例' }, component: () => import('../views/store/CaseList.vue') },
      { path: 'cases/:slug', name: 'case-detail', component: () => import('../views/store/CaseDetail.vue') },
      { path: 'messages', name: 'messages', meta: { auth: true, title: '消息中心' }, component: () => import('../views/store/MyMessages.vue') },
      { path: 'contact', name: 'contact', meta: { title: '联系我们' }, component: () => import('../views/store/Contact.vue') },
      { path: 'help', name: 'help', meta: { title: '帮助中心' }, component: () => import('../views/store/Help.vue') },
      { path: 'about', name: 'about', meta: { title: '关于我们' }, component: () => import('../views/store/About.vue') },
      { path: 'terms', name: 'terms', meta: { title: '服务条款' }, component: () => import('../views/store/Terms.vue') },
      { path: 'privacy', name: 'privacy', meta: { title: '隐私政策' }, component: () => import('../views/store/Privacy.vue') },
      { path: 'login', name: 'login', component: () => import('../views/store/Login.vue') }
    ]
  },
  {
    path: '/admin',
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { admin: true },
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('../views/admin/Dashboard.vue') },
      { path: 'products', name: 'admin-products', component: () => import('../views/admin/ProductManage.vue') },
      { path: 'articles', name: 'admin-articles', component: () => import('../views/admin/ArticleManage.vue') },
      { path: 'cases', name: 'admin-cases', component: () => import('../views/admin/CaseManage.vue') },
      { path: 'qa', name: 'admin-qa', component: () => import('../views/admin/QaCenter.vue') },
      { path: 'orders', name: 'admin-orders', component: () => import('../views/admin/OrderManage.vue') },
      { path: 'refunds', name: 'admin-refunds', component: () => import('../views/admin/RefundManage.vue') },
      { path: 'cards', name: 'admin-cards', component: () => import('../views/admin/CardManage.vue') },
      { path: 'coupons', name: 'admin-coupons', component: () => import('../views/admin/CouponManage.vue') },
      { path: 'notices', name: 'admin-notices', component: () => import('../views/admin/NoticeManage.vue') },
      { path: 'users', name: 'admin-users', component: () => import('../views/admin/UserManage.vue') },
      { path: 'admins', name: 'admin-admins', meta: { superadmin: true }, component: () => import('../views/admin/AdminManage.vue') },
      { path: 'logs', name: 'admin-logs', component: () => import('../views/admin/AdminLogs.vue') },
      { path: 'custom', name: 'admin-custom', component: () => import('../views/admin/CustomManage.vue') },
      { path: 'proposal', name: 'admin-proposal', component: () => import('../views/admin/ProposalManage.vue') },
      { path: 'service-cards', name: 'admin-service-cards', component: () => import('../views/admin/ServiceCards.vue') },
      { path: 'service-pages', name: 'admin-service-pages', component: () => import('../views/admin/ServicePages.vue') },
      { path: 'enterprise', name: 'admin-enterprise', component: () => import('../views/admin/EnterpriseLeads.vue') },
      { path: 'data-report', name: 'admin-data-report', component: () => import('../views/admin/DataReport.vue') },
      { path: 'settings', name: 'admin-settings', component: () => import('../views/admin/Settings.vue') }
    ]
  },
  { path: '/admin/login', name: 'admin-login', component: () => import('../views/store/Login.vue'), props: { admin: true } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/store/NotFound.vue') }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) return true;
    return false;
  } catch {
    return true;
  }
}

function clearAuth() {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
}

router.beforeEach((to) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (to.meta.admin) {
    if (!token || !user || !['admin', 'superadmin', 'ops'].includes(user.role)) return { name: 'admin-login' };
    if (isTokenExpired(token)) {
      clearAuth();
      return { name: 'admin-login' };
    }
    if (to.meta.superadmin && user.role !== 'superadmin') return { name: 'admin-dashboard' };
  }

  if (to.meta.auth) {
    if (!token || !user) return { name: 'login', query: { redirect: to.fullPath } };
    if (isTokenExpired(token)) {
      clearAuth();
      return { name: 'login', query: { redirect: to.fullPath } };
    }
  }
});

router.afterEach((to) => {
  if (!String(to.path || '').startsWith('/admin')) {
    captureUtmFromUrl();
    trackPageview(to.fullPath || to.path);
  }
  if (to.name === 'product-detail') return;
  if (to.name === 'article-detail') return;
  if (to.name === 'case-detail') return;
  if (to.name === 'products' && to.query.keyword) return;
  if (to.name === 'articles' && to.query.keyword) return;
  if (to.name === 'home') return;
  if (to.meta.title) {
    document.title = `${to.meta.title} - 毕设源码商城`;
  } else {
    document.title = SITE_TITLE;
  }
});

export default router;
