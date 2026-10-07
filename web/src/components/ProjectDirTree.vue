<template>
  <div v-if="lines.length" class="dir-tree-wrap">
    <div class="dir-panel">
      <div
        v-for="(line, i) in lines"
        :key="i"
        class="dir-line"
        :class="{ root: line.depth === 0, more: line.more }"
      >
        <span class="dir-prefix" aria-hidden="true">{{ line.prefix }}</span>
        <span class="dir-icon" :class="line.kind" aria-hidden="true" />
        <span class="dir-name">{{ line.name }}</span>
        <span v-if="line.hint" class="dir-hint">{{ line.hint }}</span>
        <span v-if="line.meta" class="dir-meta">{{ line.meta }}</span>
      </div>
    </div>
    <p class="dir-note">目录由本地源码真实扫描生成</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  tree: { type: Object, default: null }
});

function flatten(node, prefixParts = [], isLast = true, depth = 0, out = []) {
  if (!node) return out;

  let prefix = '';
  if (depth > 0) {
    prefix = prefixParts.map((cont) => (cont ? '│  ' : '   ')).join('') + (isLast ? '└─ ' : '├─ ');
  }

  const kids = node.children || [];
  const isDir = node.type === 'dir' || kids.length > 0 || !!node.summary;
  const more = node.type === 'more';
  const meta = node.summary || (node.count ? `${node.count} 项` : '');

  out.push({
    depth,
    prefix,
    name: node.name + (isDir && kids.length ? '/' : ''),
    hint: node.hint || '',
    meta,
    kind: more ? 'more' : isDir ? 'dir' : 'file',
    more
  });

  kids.forEach((child, i) => {
    const last = i === kids.length - 1;
    const nextParts = depth === 0 ? [] : [...prefixParts, !isLast];
    flatten(child, nextParts, last, depth + 1, out);
  });

  return out;
}

const lines = computed(() => (props.tree ? flatten(props.tree) : []));
</script>

<style scoped>
.dir-tree-wrap { margin: 0; }
.dir-panel {
  background: #f7f7f5;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Sarasa Mono SC', 'Microsoft YaHei Mono', monospace;
  font-size: 13px;
  line-height: 1.75;
}
.dir-line {
  display: flex;
  align-items: center;
  white-space: nowrap;
  min-height: 26px;
  color: var(--text-2);
}
.dir-line.root {
  margin-bottom: 6px;
  padding: 4px 8px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--border);
  font-weight: 750;
  color: var(--text-1);
}
.dir-line.more { color: var(--text-3); }
.dir-prefix {
  color: #a1a1aa;
  white-space: pre;
  flex-shrink: 0;
}
.dir-icon {
  width: 12px;
  height: 12px;
  margin-right: 8px;
  flex-shrink: 0;
  border-radius: 2px;
  position: relative;
}
.dir-icon.dir {
  background: #ccfbf1;
  border: 1px solid #2dd4bf;
}
.dir-icon.dir::after {
  content: '';
  position: absolute;
  left: 2px;
  right: 2px;
  top: 2px;
  height: 3px;
  border-radius: 1px 1px 0 0;
  background: #5eead4;
}
.dir-icon.file {
  background: #fff;
  border: 1px solid #d4d4d8;
}
.dir-icon.more {
  width: 0;
  margin-right: 0;
  border: 0;
}
.dir-name { font-weight: 650; color: var(--text-1); }
.dir-line.more .dir-name { font-weight: 500; color: var(--text-3); }
.dir-hint {
  margin-left: 10px;
  color: #0f766e;
  font-size: 12px;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-weight: 500;
}
.dir-hint::before { content: '— '; color: #a1a1aa; }
.dir-meta {
  margin-left: 10px;
  color: var(--text-3);
  font-size: 12px;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-weight: 500;
}
.dir-note {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--text-4);
  text-align: right;
}
</style>
