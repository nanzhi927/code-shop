<template>
  <div class="admin-page">
    <h2 class="page-title">B 端询价</h2>
    <div class="admin-panel">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="org" label="机构" min-width="160" />
        <el-table-column prop="contact" label="联系人" width="150" />
        <el-table-column prop="scale" label="规模" width="120" />
        <el-table-column prop="need" label="需求" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-select v-model="row.status" size="small" style="width:90px" @change="upd(row)">
              <el-option v-for="s in ['new','contacted','done']" :key="s" :label="s" :value="s" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" min-width="150" />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../../api';
const list = ref([]); const loading = ref(false);
async function load() { loading.value = true; try { list.value = await http.get('/services/admin/enterprise/leads'); } finally { loading.value = false; } }
async function upd(row) { await http.post(`/services/admin/enterprise/leads/${row.id}`, { status: row.status }); ElMessage.success('已更新'); }
onMounted(load);
</script>
