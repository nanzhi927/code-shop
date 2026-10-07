import { ref } from 'vue';

export const THEME_KEY = 'code-shop-theme';

export function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', !!dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {}
}

export function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(dark);
    return dark;
  } catch {
    return false;
  }
}

export function useTheme() {
  const isDark = ref(initTheme());

  function toggle() {
    isDark.value = !isDark.value;
    applyTheme(isDark.value);
  }

  return { isDark, toggle };
}
