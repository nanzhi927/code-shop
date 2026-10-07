<template>
  <div class="admin-page">
    <div class="toolbar">
      <h2 class="page-title">服务页面</h2>
      <div class="toolbar-actions">
        <el-button type="primary" :loading="saving" @click="save">保存当前页</el-button>
      </div>
    </div>

    <div class="admin-panel" v-loading="loading">
      <p class="hint">前台路径为 <code>/services/p/&lt;slug&gt;</code>。修改后立即对用户可见。会员 / 分销已下线，勿再配置相关链接。</p>

      <el-tabs v-model="active" type="border-card" @tab-change="onTab">
        <el-tab-pane
          v-for="p in list"
          :key="p.slug"
          :label="p.title || p.slug"
          :name="p.slug"
        >
          <el-form label-width="100px" class="form">
            <el-form-item label="Slug">
              <el-input :model-value="p.slug" disabled />
            </el-form-item>
            <el-form-item label="标题">
              <el-input v-model="p.title" maxlength="80" show-word-limit />
            </el-form-item>
            <el-form-item label="副标题">
              <el-input v-model="p.subtitle" maxlength="160" show-word-limit />
            </el-form-item>
            <el-form-item label="角标">
              <el-input v-model="p.badge" maxlength="40" placeholder="如：模拟页 · 可后台编辑" />
            </el-form-item>
            <el-form-item label="亮点">
              <div class="hl-list">
                <div v-for="(_, hi) in p.highlights" :key="hi" class="hl-row">
                  <el-input v-model="p.highlights[hi]" maxlength="80" placeholder="亮点文案" />
                  <el-button type="danger" size="small" plain @click="p.highlights.splice(hi, 1)">删</el-button>
                </div>
                <el-button size="small" @click="p.highlights.push('')" :disabled="p.highlights.length >= 8">添加亮点</el-button>
              </div>
            </el-form-item>
            <el-form-item label="正文">
              <el-input v-model="p.body" type="textarea" :rows="8" maxlength="8000" show-word-limit placeholder="多段用空行分隔" />
            </el-form-item>
            <el-form-item label="按钮文案">
              <el-input v-model="p.ctaText" maxlength="40" />
            </el-form-item>
            <el-form-item label="按钮链接">
              <el-input v-model="p.ctaTo" maxlength="120" placeholder="/contact 或 /services/custom" />
            </el-form-item>
            <el-form-item label="底部提示">
              <el-input v-model="p.contactTip" maxlength="200" />
            </el-form-item>
            <el-form-item label="预览">
              <el-link type="primary" :href="`/services/p/${p.slug}`" target="_blank">打开前台页 →</el-link>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../../api';

const list = ref([]);
const active = ref('');
const loading = ref(false);
const saving = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/services/admin/pages');
    list.value = (res.list || []).map((p) => ({
      ...p,
      highlights: Array.isArray(p.highlights) ? [...p.highlights] : []
    }));
    if (!active.value && list.value.length) active.value = list.value[0].slug;
  } finally {
    loading.value = false;
  }
}

function onTab() { /* keep form state in list */ }

async function save() {
  for (const p of list.value) {
    if (!String(p.title || '').trim()) return ElMessage.warning('请填写各页标题');
  }
  saving.value = true;
  try {
    const res = await http.put('/services/admin/pages', { list: list.value });
    list.value = (res.list || []).map((p) => ({
      ...p,
      highlights: Array.isArray(p.highlights) ? [...p.highlights] : []
    }));
    ElMessage.success('已保存');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.hint { margin: 0 0 14px; font-size: 13px; color: var(--text-3); line-height: 1.6; }
.hint code { font-size: 12px; background: var(--bg-alt); padding: 1px 6px; border-radius: 4px; }
.form { max-width: 720px; padding-top: 8px; }
.hl-list { width: 100%; display: flex; flex-direction: column; gap: 8px; }
.hl-row { display: flex; gap: 8px; align-items: center; }
</style>
