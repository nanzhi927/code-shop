<template>
  <div class="page-container">
    <h2 class="page-title">B 端 / 机构批量采购</h2>
    <p class="sub">学校、培训机构、辅导班可批量授权源码 / 课程，提供发票与合同。提交需求后我们 1 工作日内联系。</p>

    <el-card class="form-card">
      <el-form :model="form" label-width="100px" label-position="top" class="ent-form">
        <el-form-item label="机构名称"><el-input v-model="form.org" placeholder="如 XX 大学计算机学院 / XX 培训机构" /></el-form-item>
        <el-form-item label="联系人" required><el-input v-model="form.contact" placeholder="姓名 / 电话 / 微信" /></el-form-item>
        <el-form-item label="采购规模"><el-input v-model="form.scale" placeholder="如 50 套 / 100 人授权" /></el-form-item>
        <el-form-item label="需求描述" required><el-input v-model="form.need" type="textarea" :rows="4" placeholder="需要的技术栈、用途、预算等" /></el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="submit" class="submit-btn">提交询价</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../../api';
import { setSeo } from '../../composables/useSeo';

const submitting = ref(false);
const form = reactive({ org: '', contact: '', scale: '', need: '' });

async function submit() {
  if (!form.contact || !form.need) return ElMessage.warning('请填写联系人与需求');
  submitting.value = true;
  try { await http.post('/services/enterprise/lead', form); ElMessage.success('已提交，我们将尽快联系您'); Object.assign(form, { org:'', contact:'', scale:'', need:'' }); } finally { submitting.value = false; }
}

onMounted(() => {
  setSeo({
    title: '机构询价 - 毕设源码批量采购',
    description: '学校、培训机构批量采购毕业设计 / 课程设计源码，支持发票与合同。',
    keywords: '机构询价,毕设源码批量,毕业设计采购'
  });
});
</script>

<style scoped>
.page-title { margin: 16px 0 6px; }
.sub { color: var(--text-3); font-size: 14px; margin: 0 0 20px; line-height: 1.7; }
.form-card { max-width: 680px; }
.ent-form { max-width: 560px; }

@media (max-width: 768px) {
  .page-title { margin: 12px 0 8px; font-size: 18px; }
  .sub { font-size: 13px; margin-bottom: 14px; }
  .submit-btn { width: 100%; }
}
</style>
