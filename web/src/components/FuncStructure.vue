<template>
  <div v-if="tree?.children?.length" class="func-structure">
    <div class="fs-scroll">
      <div class="fs-canvas">
        <div class="fs-node fs-root">{{ tree.name }}</div>
        <div class="fs-join" aria-hidden="true"><span class="fs-v" /></div>

        <div class="fs-level2" :style="{ '--n': tree.children.length }">
          <div class="fs-bar" aria-hidden="true" />
          <div v-for="branch in tree.children" :key="branch.name" class="fs-col">
            <span class="fs-v down" aria-hidden="true" />
            <div class="fs-node fs-branch">{{ branch.name }}</div>
            <template v-if="branch.children?.length">
              <span class="fs-v down" aria-hidden="true" />
              <ul class="fs-leaves">
                <li v-for="leaf in branch.children" :key="leaf.name">
                  <div class="fs-node fs-leaf">{{ leaf.name }}</div>
                </li>
              </ul>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  tree: { type: Object, default: null }
});
</script>

<style scoped>
.func-structure {
  margin: 0;
  background: #fafaf8;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 28px 16px 24px;
}
.fs-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.fs-canvas {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: min(100%, 620px);
  margin: 0 auto;
}

.fs-node {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  border: 1px solid var(--text-1);
  border-radius: 3px;
  background: #fff;
  color: var(--text-1);
  font-weight: 650;
  line-height: 1.35;
  position: relative;
  z-index: 1;
}
.fs-root {
  min-width: 176px;
  max-width: 300px;
  padding: 10px 20px;
  font-size: 14.5px;
  font-weight: 750;
  background: var(--text-1);
  color: #fff;
  border-color: var(--text-1);
}
.fs-branch {
  min-width: 120px;
  padding: 8px 14px;
  font-size: 13px;
  border-color: #0f766e;
  color: #0f766e;
  background: #f0fdfa;
}
.fs-leaf {
  width: 100%;
  min-height: 34px;
  padding: 6px 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
  border-color: #d4d4d8;
  background: #fff;
}

.fs-join {
  display: flex;
  justify-content: center;
  height: 20px;
}
.fs-v {
  display: block;
  width: 1px;
  height: 100%;
  background: #a1a1aa;
}
.fs-v.down { height: 14px; flex-shrink: 0; }

.fs-level2 {
  --n: 2;
  display: grid;
  grid-template-columns: repeat(var(--n), minmax(140px, 1fr));
  gap: 0 36px;
  width: min(100%, 680px);
  position: relative;
  justify-items: center;
  align-items: start;
}
.fs-bar {
  position: absolute;
  top: 0;
  left: calc(100% / var(--n) / 2);
  right: calc(100% / var(--n) / 2);
  height: 1px;
  background: #a1a1aa;
  pointer-events: none;
}
.fs-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 200px;
}
.fs-leaves {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.fs-leaves li { width: 100%; }

@media (max-width: 640px) {
  .fs-level2 {
    grid-template-columns: 1fr;
    gap: 20px;
    width: 100%;
    max-width: 260px;
  }
  .fs-bar { display: none; }
  .func-structure { padding: 18px 10px; }
}
</style>
