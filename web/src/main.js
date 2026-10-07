import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import './styles/global.css';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';

import App from './App.vue';
import router from './router';
import { resetSeo } from './composables/useSeo';
import { initTheme } from './composables/useTheme';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });

resetSeo();

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

// 滚动入场指令 v-reveal：渐进增强，默认可见，仅 JS 启用动画时才隐藏
app.directive('reveal', {
  mounted(el, binding) {
    const baseClass = binding.modifiers.scale ? 'reveal-scale' : 'reveal';
    el.classList.add(baseClass);

    const delay = binding.value?.value ?? binding.value;
    if (delay) el.style.transitionDelay = `${delay}ms`;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      el.classList.add('in');
      return;
    }

    let observer = null;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      el.classList.add('in');
      clearTimeout(fallbackTimer);
      if (observer) {
        try { observer.unobserve(el); } catch { /* ignore */ }
        try { observer.disconnect(); } catch { /* ignore */ }
        observer = null;
      }
    };

    const fallbackTimer = setTimeout(settle, 1500);
    el._revealCleanup = () => {
      clearTimeout(fallbackTimer);
      if (observer) {
        try { observer.unobserve(el); } catch { /* ignore */ }
        try { observer.disconnect(); } catch { /* ignore */ }
        observer = null;
      }
    };

    try {
      if (typeof IntersectionObserver === 'undefined') {
        settle();
        return;
      }
      // 明确启用动画后再隐藏，避免默认 opacity:0 永久不可见
      el.classList.add('reveal-ready');
      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) settle();
          }
        },
        { threshold: 0.01, rootMargin: '0px' }
      );
      observer.observe(el);
    } catch {
      settle();
    }
  },
  unmounted(el) {
    if (typeof el._revealCleanup === 'function') el._revealCleanup();
  }
});

initTheme();

app.mount('#app');
