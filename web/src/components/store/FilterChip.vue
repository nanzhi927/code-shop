<template>
  <button
    type="button"
    class="filter-chip"
    :class="{ active }"
    @click="$emit('click')"
  >
    <slot />
    <em v-if="count != null" class="chip-count">{{ count }}</em>
  </button>
</template>

<script setup>
defineProps({
  active: { type: Boolean, default: false },
  count: { type: [Number, String], default: null }
});
defineEmits(['click']);
</script>

<style scoped>
.filter-chip {
  appearance: none;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-alt);
  color: var(--text-2);
  font-size: 13px; font-weight: 500; font-family: inherit;
  cursor: pointer; white-space: nowrap;
  transition: border-color .18s, background .18s, color .18s;
}
.filter-chip:hover { border-color: var(--ink); color: var(--text-1); background: var(--surface); }
.filter-chip.active {
  background: var(--ink); border-color: var(--ink); color: #fff; font-weight: 600;
}
.chip-count {
  font-style: normal; font-size: 11.5px; color: var(--text-4);
  font-variant-numeric: tabular-nums; font-family: var(--font-num);
}
.filter-chip.active .chip-count { color: rgba(255, 255, 255, .72); }
</style>
