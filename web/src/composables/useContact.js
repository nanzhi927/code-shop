import { ref } from 'vue';
import http from '../api';

const visible = ref(false);
const settings = ref({});
let loaded = false;
let loading = null;

async function ensureSettings(force = false) {
  if (force) loaded = false;
  if (loaded) return settings.value;
  if (loading) return loading;
  loading = (async () => {
    try {
      settings.value = await http.get('/settings/public');
      loaded = true;
    } catch {
      /* keep previous */
    } finally {
      loading = null;
    }
    return settings.value;
  })();
  return loading;
}

export function useContact() {
  async function openContact() {
    await ensureSettings();
    visible.value = true;
  }
  function closeContact() {
    visible.value = false;
  }
  return {
    visible,
    settings,
    openContact,
    closeContact,
    ensureSettings
  };
}
