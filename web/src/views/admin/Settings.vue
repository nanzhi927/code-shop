<template>
  <div class="admin-page">
    <h2 class="page-title">系统设置</h2>

    <el-card class="sec" shadow="never" v-loading="loading">
      <template #header>客服信息（前台联系弹窗 / 页脚 / 悬浮客服入口）</template>
      <el-form label-width="130px" style="max-width: 640px">
        <el-form-item label="客服 QQ">
          <el-input v-model="form.service_qq" placeholder="如 123456789" />
        </el-form-item>
        <el-form-item label="客服微信">
          <el-input v-model="form.service_wechat" placeholder="如 wxid_xxx 或手机号" />
        </el-form-item>
        <el-form-item label="微信二维码">
          <div class="qr-upload-row">
            <el-upload
              :show-file-list="false"
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
              :http-request="(opt) => uploadQr(opt, 'service_wechat_qr')"
            >
              <el-button size="small" type="primary" plain>上传加好友码</el-button>
            </el-upload>
            <el-button v-if="form.service_wechat_qr" size="small" @click="form.service_wechat_qr = ''">移除</el-button>
          </div>
          <div v-if="form.service_wechat_qr" class="qr-preview">
            <el-image :src="form.service_wechat_qr" style="width: 160px; height: 160px" fit="contain" />
          </div>
          <div class="field-tip">用户扫码添加微信好友（与下方收款码分开）</div>
        </el-form-item>
        <el-form-item label="QQ 二维码">
          <div class="qr-upload-row">
            <el-upload
              :show-file-list="false"
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
              :http-request="(opt) => uploadQr(opt, 'service_qq_qr')"
            >
              <el-button size="small" type="primary" plain>上传加好友码</el-button>
            </el-upload>
            <el-button v-if="form.service_qq_qr" size="small" @click="form.service_qq_qr = ''">移除</el-button>
          </div>
          <div v-if="form.service_qq_qr" class="qr-preview">
            <el-image :src="form.service_qq_qr" style="width: 160px; height: 160px" fit="contain" />
          </div>
        </el-form-item>
        <el-form-item label="客服说明">
          <el-input v-model="form.service_notice" type="textarea" :rows="2" placeholder="如：工作日 9:00-18:00 在线，购买后请加客服发送订单号" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="sec" shadow="never">
      <template #header>免费开题助手</template>
      <el-form label-width="130px" style="max-width: 640px">
        <el-form-item label="功能开关">
          <el-switch
            :model-value="form.proposal_enabled !== '0'"
            @change="(v) => (form.proposal_enabled = v ? '1' : '0')"
          />
        </el-form-item>
        <el-form-item label="注册赠送次数">
          <el-input v-model="form.proposal_register_gift" placeholder="默认 1" style="max-width: 160px" />
          <div class="field-hint">普通用户手机号注册时一次性赠送（建议 1 次）；管理员 / 运营账号开题不限次数</div>
        </el-form-item>
        <el-form-item label="免责声明">
          <el-input v-model="form.proposal_disclaimer" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="sec" shadow="never">
      <template #header>收款设置</template>
      <el-form label-width="110px" style="max-width: 560px">
        <el-form-item label="支付宝收款码">
          <div class="qr-upload-row">
            <el-upload
              :show-file-list="false"
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
              :http-request="(opt) => uploadQr(opt, 'alipay_qr')"
            >
              <el-button size="small" type="primary" plain>上传收款码</el-button>
            </el-upload>
            <el-button v-if="form.alipay_qr" size="small" @click="form.alipay_qr = ''">移除</el-button>
          </div>
          <div v-if="form.alipay_qr" class="qr-preview">
            <el-image :src="form.alipay_qr" style="width: 200px; height: 200px" fit="contain" />
          </div>
        </el-form-item>
        <el-form-item label="微信收款码">
          <div class="qr-upload-row">
            <el-upload
              :show-file-list="false"
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
              :http-request="(opt) => uploadQr(opt, 'wechat_qr')"
            >
              <el-button size="small" type="primary" plain>上传收款码</el-button>
            </el-upload>
            <el-button v-if="form.wechat_qr" size="small" @click="form.wechat_qr = ''">移除</el-button>
          </div>
          <div v-if="form.wechat_qr" class="qr-preview">
            <el-image :src="form.wechat_qr" style="width: 200px; height: 200px" fit="contain" />
          </div>
        </el-form-item>
        <el-form-item label="收款说明">
          <el-input
            v-model="form.pay_notice"
            type="textarea"
            :rows="2"
            placeholder="扫码支付后请点击「我已完成付款」，并添加客服微信发送订单号，核对后立即发货"
          />
        </el-form-item>
        <el-form-item label="模拟支付">
          <el-switch
            :model-value="form.pay_mock_enabled === '1'"
            @change="(v) => (form.pay_mock_enabled = v ? '1' : '0')"
          />
          <span class="switch-tip">关闭后前台不展示，且接口拒绝 mock 支付（生产建议关闭）</span>
        </el-form-item>
        <el-form-item label="卡密兑换">
          <el-switch
            :model-value="form.pay_card_enabled === '1'"
            @change="(v) => (form.pay_card_enabled = v ? '1' : '0')"
          />
        </el-form-item>
        <el-form-item label="支付宝扫码">
          <el-switch
            :model-value="form.pay_alipay_enabled === '1'"
            @change="(v) => (form.pay_alipay_enabled = v ? '1' : '0')"
          />
        </el-form-item>
        <el-form-item label="微信扫码">
          <el-switch
            :model-value="form.pay_wechat_enabled === '1'"
            @change="(v) => (form.pay_wechat_enabled = v ? '1' : '0')"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="sec" shadow="never">
      <template #header>首页 Hero（首屏大标题区）</template>
      <el-form label-width="120px" style="max-width: 640px">
        <el-form-item label="角标文案">
          <el-input v-model="form.banner_badge" placeholder="如 {n}+ 套毕设源码 · 即买即用，{n} 会替换为商品数量" />
        </el-form-item>
        <el-form-item label="主标题">
          <el-input v-model="form.banner_title" placeholder="如 海量毕业设计源码" />
        </el-form-item>
        <el-form-item label="高亮词">
          <el-input v-model="form.banner_title_hl" placeholder="主标题中要渐变高亮的词，如 毕业设计" />
        </el-form-item>
        <el-form-item label="主标题第二行">
          <el-input v-model="form.banner_title2" placeholder="如 一站即买即用" />
        </el-form-item>
        <el-form-item label="副标题">
          <el-input v-model="form.banner_sub" type="textarea" :rows="2" placeholder="如 SpringBoot / SSM / JSP+Servlet 全栈源码，含论文、PPT、数据库脚本" />
        </el-form-item>
        <el-form-item label="搜索框提示">
          <el-input v-model="form.banner_search_ph" placeholder="如 搜索你要的源码，如：图书管理、商城、预约" />
        </el-form-item>
        <el-form-item label="第四项统计">
          <div class="stat4-row">
            <el-input v-model="form.banner_stat4_num" placeholder="数字，如 100%" style="width: 140px" />
            <el-input v-model="form.banner_stat4_label" placeholder="标签，如 已验证可运行" />
          </div>
          <div class="field-tip">前三项（套源码 / 技术栈 / 业务分类）按数据库实时统计，第四项可自定义</div>
        </el-form-item>
        <el-form-item label="兼容旧字段">
          <el-input v-model="form.banner_text" placeholder="旧 Banner 文案（可留空，优先用上方主标题）" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="sec" shadow="never">
      <template #header>公告与站点 SEO</template>
      <el-form label-width="110px" style="max-width: 640px">
        <el-form-item label="顶部公告">
          <el-input v-model="form.announcement" placeholder="前台顶部滚动公告，留空则不显示，如：全部源码即买即用 · 购买后客服极速交付" />
        </el-form-item>
        <el-form-item label="站点描述">
          <el-input v-model="form.site_meta_description" type="textarea" :rows="2" placeholder="首页 meta description，用于搜索引擎收录" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-button type="primary" size="large" :loading="saving" @click="save">保存设置</el-button>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../../api';

const loading = ref(false);
const saving = ref(false);
const form = reactive({
  service_qq: '',
  service_wechat: '',
  service_wechat_qr: '',
  service_qq_qr: '',
  service_notice: '',
  proposal_enabled: '1',
  proposal_register_gift: '1',
  proposal_disclaimer: '',
  banner_text: '',
  banner_sub: '',
  banner_badge: '',
  banner_title: '',
  banner_title_hl: '',
  banner_title2: '',
  banner_search_ph: '',
  banner_stat4_num: '',
  banner_stat4_label: '',
  announcement: '',
  site_meta_description: '',
  alipay_qr: '',
  wechat_qr: '',
  pay_notice: '',
  pay_mock_enabled: '1',
  pay_card_enabled: '1',
  pay_alipay_enabled: '1',
  pay_wechat_enabled: '1'
});

async function uploadQr(options, field) {
  const fd = new FormData();
  fd.append('file', options.file);
  try {
    const res = await http.post('/admin/upload/qr', fd);
    form[field] = res.url;
    options.onSuccess?.(res);
    ElMessage.success('上传成功');
  } catch (e) {
    options.onError?.(e);
  }
}

async function load() {
  loading.value = true;
  try {
    Object.assign(form, await http.get('/settings'));
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    await http.put('/settings', { ...form });
    ElMessage.success('保存成功');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.sec { margin-bottom: 16px; max-width: 760px; }
.qr-upload-row { display: flex; align-items: center; gap: 10px; }
.switch-tip { margin-left: 12px; font-size: 12px; color: var(--text-3); }
.qr-preview { margin-top: 10px; }
.stat4-row { display: flex; gap: 10px; width: 100%; }
.field-tip { margin-top: 6px; font-size: 12px; color: var(--text-3); line-height: 1.5; }
.field-hint { margin-top: 6px; font-size: 12px; color: var(--text-3); line-height: 1.5; }
</style>
