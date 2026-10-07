<template>
  <component
    :is="tag"
    v-bind="tag === 'button' ? { type: nativeType } : {}"
    class="store-btn"
    :class="[`is-${variant}`, { 'is-block': block, 'is-loading': loading }]"
    :disabled="tag === 'button' ? (disabled || loading) : undefined"
    :to="to"
    @click="onClick"
  >
    <span v-if="loading" class="store-btn-spin" aria-hidden="true" />
    <slot />
  </component>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  variant: { type: String, default: 'solid' }, // solid | outline | ghost | ink
  block: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  to: { type: [String, Object], default: null },
  nativeType: { type: String, default: 'button' }
});

const emit = defineEmits(['click']);

const tag = computed(() => (props.to ? 'router-link' : 'button'));

function onClick(e) {
  if (props.loading || props.disabled) {
    e.preventDefault();
    return;
  }
  emit('click', e);
}
</script>

<style scoped>
.store-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 44px; padding: 0 22px; border-radius: 10px;
  font-size: 14px; font-weight: 600; font-family: inherit;
  letter-spacing: -.01em; cursor: pointer; text-decoration: none;
  border: 1px solid transparent; line-height: 1;
  transition: transform .18s var(--ease), background .18s, border-color .18s, color .18s, opacity .18s;
}
.store-btn:disabled { opacity: .55; cursor: not-allowed; transform: none !important; }
.store-btn.is-block { width: 100%; }
.is-solid { background: var(--ink); color: #fff; border-color: var(--ink); }
.is-solid:hover:not(:disabled) { background: #18181b; transform: translateY(-1px); }
.is-outline { background: transparent; color: var(--text-1); border-color: var(--border-strong); }
.is-outline:hover:not(:disabled) { border-color: var(--ink); background: var(--bg-alt); }
.is-ghost { background: transparent; color: var(--text-2); border-color: transparent; }
.is-ghost:hover:not(:disabled) { color: var(--text-1); background: var(--bg-alt); }
.is-ink { background: #fff; color: var(--ink); border-color: #fff; }
.is-ink:hover:not(:disabled) { transform: translateY(-1px); }
.store-btn-spin {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, .35); border-top-color: #fff;
  animation: spin .7s linear infinite;
}
.is-outline .store-btn-spin,
.is-ghost .store-btn-spin {
  border-color: rgba(10, 10, 11, .2); border-top-color: var(--ink);
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
