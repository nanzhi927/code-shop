<template>
  <div class="page-container login-wrap">
    <div class="login-shell">
      <aside class="login-brand" aria-hidden="false">
        <p class="brand-mark">源码商城</p>
        <h1 class="brand-title">精选可运行的实训项目</h1>
        <p class="brand-sub">按技术栈挑选，对照演示，独立完成你的部分。</p>
      </aside>

      <div class="login-card">
        <h2>{{ isAdmin ? '管理员登录' : '登录 / 注册' }}</h2>
        <div v-if="!isAdmin" class="mode-tabs" role="tablist">
          <button type="button" role="tab" :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
          <button type="button" role="tab" :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
        </div>
        <el-form :model="form" label-position="top" size="large" class="login-form" @submit.prevent>
          <el-form-item :label="isAdmin ? '用户名' : '手机号'">
            <el-input
              v-model="form.username"
              :placeholder="isAdmin ? '用户名' : '11 位手机号'"
              :maxlength="(!isAdmin && mode === 'register') ? 11 : 64"
              :inputmode="isAdmin ? 'text' : 'numeric'"
            />
            <div v-if="!isAdmin && mode === 'register'" class="field-tip">请使用 11 位手机号注册</div>
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.password" type="password" placeholder="密码" show-password />
            <div v-if="mode === 'register'" class="field-tip">至少 6 位，需同时包含字母和数字</div>
          </el-form-item>
          <el-form-item v-if="mode === 'register'" label="确认密码">
            <el-input v-model="form.confirmPassword" type="password" placeholder="确认密码" show-password />
          </el-form-item>
          <el-form-item v-if="mode === 'register'" label="昵称（可选）">
            <el-input v-model="form.nickname" placeholder="昵称" />
          </el-form-item>
          <el-form-item v-if="mode === 'register'" label="验证码">
            <div class="captcha-row">
              <el-input v-model="form.captcha" placeholder="验证码" />
              <button type="button" class="captcha-btn" @click="refreshCaptcha" title="点击刷新">
                {{ captcha.a }} {{ captcha.op === '+' ? '+' : '−' }} {{ captcha.b }} = ?
              </button>
            </div>
          </el-form-item>
          <el-form-item v-if="mode === 'register'">
            <el-checkbox v-model="form.agree">
              注册即表示同意
              <a href="#" class="agree-link" @click.prevent="showAgreement = true">《用户协议》</a>
            </el-checkbox>
          </el-form-item>
          <StoreButton variant="solid" block :loading="loading" @click="submit">
            {{ isAdmin ? '登录' : mode === 'login' ? '登录' : '注册' }}
          </StoreButton>
        </el-form>
      </div>
    </div>

    <el-dialog v-model="showAgreement" title="用户协议" width="520px">
      <div class="agreement-body">
        <p>欢迎使用源码商城。注册即表示您同意：</p>
        <p>1. 所购源码仅供学习研究使用，不得用于非法用途。</p>
        <p>2. 请妥善保管账号密码，因泄露造成的损失由用户自行承担。</p>
        <p>3. 商品交付方式以订单页说明为准，如有问题请联系客服。</p>
        <p>4. 注册账号使用手机号标识；新用户将获赠免费开题次数（具体以页面说明为准）。</p>
        <p>5. 本协议为占位说明，正式上线前可替换为完整法律文本。</p>
      </div>
      <template #footer>
        <StoreButton variant="solid" @click="form.agree = true; showAgreement = false">我已阅读并同意</StoreButton>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import http from '../../api';
import { useUserStore } from '../../stores/user';
import StoreButton from '../../components/store/StoreButton.vue';
import { setSeo } from '../../composables/useSeo';

const props = defineProps({ admin: Boolean });
const isAdmin = !!props.admin;
const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const mode = ref('login');
const loading = ref(false);
const showAgreement = ref(false);
const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  nickname: '',
  captcha: '',
  agree: false
});

const PHONE_RE = /^1[3-9]\d{9}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

const captcha = reactive({ a: 0, b: 0, op: '+', answer: 0 });

onMounted(() => {
  if (!isAdmin) {
    setSeo({
      title: '登录 / 注册 - 毕设源码商城',
      description: '登录毕设源码商城，购买毕业设计 / 课程设计完整版源码。',
      keywords: '登录,注册,毕设源码商城'
    });
  }
});

function refreshCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const op = Math.random() > 0.5 ? '+' : '-';
  captcha.a = a;
  captcha.b = b;
  captcha.op = op;
  captcha.answer = op === '+' ? a + b : a - b;
  form.captcha = '';
}

refreshCaptcha();
watch(mode, (m) => { if (m === 'register') refreshCaptcha(); });

async function submit() {
  if (!form.username || !form.password) {
    ElMessage.warning(isAdmin ? '请输入用户名和密码' : '请输入手机号和密码');
    return;
  }
  if (mode.value === 'register') {
    if (!PHONE_RE.test(form.username.trim())) {
      ElMessage.warning('请输入正确的 11 位手机号');
      return;
    }
    if (!PASSWORD_RE.test(form.password)) {
      ElMessage.warning('密码至少 6 位且需同时包含字母和数字');
      return;
    }
    if (form.password !== form.confirmPassword) {
      ElMessage.warning('两次输入的密码不一致');
      return;
    }
    if (String(form.captcha).trim() === '' || Number(form.captcha) !== captcha.answer) {
      ElMessage.warning('验证码错误');
      refreshCaptcha();
      return;
    }
    if (!form.agree) {
      ElMessage.warning('请先勾选同意用户协议');
      return;
    }
  } else if (!isAdmin && !PHONE_RE.test(form.username.trim())) {
    // 普通用户登录也引导用手机号；存量非手机号账号仍可登录
  }
  loading.value = true;
  try {
    if (mode.value === 'register') {
      const res = await http.post('/auth/register', {
        phone: form.username.trim(),
        password: form.password,
        nickname: form.nickname
      });
      const gift = res.proposal_gift ?? res.user?.proposal_credits;
      ElMessage.success(gift > 0 ? `注册成功，已赠送 ${gift} 次免费开题，请登录` : '注册成功，请登录');
      mode.value = 'login';
      return;
    }
    const res = await http.post('/auth/login', { username: form.username.trim(), password: form.password });
    if (isAdmin && !['admin', 'superadmin', 'ops'].includes(res.user.role)) {
      ElMessage.error('该账号不是管理员');
      return;
    }
    userStore.setLogin(res.token, res.user);
    ElMessage.success('登录成功');
    const redirect = route.query.redirect;
    router.push(isAdmin ? '/admin' : (typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'));
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-wrap { padding: 48px 0 72px; }
.login-shell {
  display: grid; grid-template-columns: 1fr 400px; gap: 48px;
  align-items: center; max-width: 920px; margin: 0 auto;
}
.login-brand { padding: 12px 8px; }
.brand-mark {
  margin: 0 0 16px; font-size: 13px; font-weight: 500;
  letter-spacing: .16em; color: var(--text-3);
}
.brand-title {
  margin: 0 0 14px; font-family: var(--font-display);
  font-size: clamp(28px, 4vw, 40px); font-weight: 700;
  letter-spacing: -.03em; line-height: 1.15; color: var(--text-1);
  max-width: 10em;
}
.brand-sub {
  margin: 0; font-size: 15px; color: var(--text-3); line-height: 1.7; max-width: 22em;
}
.login-card {
  width: 100%; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 32px 28px; box-shadow: none;
}
.login-card h2 {
  margin: 0 0 18px; font-size: 20px; font-weight: 650;
  font-family: var(--font-display); letter-spacing: -.02em;
}
.mode-tabs {
  display: flex; gap: 0; margin-bottom: 20px;
  border-bottom: 1px solid var(--border);
}
.mode-tabs button {
  appearance: none; background: none; border: 0; cursor: pointer;
  font-family: inherit; font-size: 14px; font-weight: 500;
  color: var(--text-3); padding: 8px 16px 10px; position: relative;
}
.mode-tabs button.active { color: var(--text-1); font-weight: 600; }
.mode-tabs button.active::after {
  content: ""; position: absolute; left: 16px; right: 16px; bottom: -1px;
  height: 1.5px; background: var(--ink);
}
.login-form :deep(.el-form-item__label) {
  font-weight: 500; color: var(--text-2); margin-bottom: 4px !important;
}
.field-tip { font-size: 12px; color: var(--text-3); margin-top: 4px; line-height: 1.4; }
.captcha-row { display: flex; gap: 10px; width: 100%; }
.captcha-row .el-input { flex: 1; }
.captcha-btn {
  flex-shrink: 0; min-width: 110px; padding: 0 12px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--bg-alt); color: var(--text-1);
  cursor: pointer; font-size: 15px; font-weight: 600; font-family: var(--font-num);
}
.captcha-btn:hover { border-color: var(--ink); }
.agree-link { color: var(--accent); }
.agreement-body { font-size: 14px; color: var(--text-2); line-height: 1.8; }
.agreement-body p { margin-bottom: 8px; }

@media (max-width: 860px) {
  .login-shell { grid-template-columns: 1fr; gap: 20px; max-width: 420px; }
  .login-brand { display: none; }
}
@media (max-width: 768px) {
  .login-wrap { padding: 24px 0 40px; }
  .login-card { padding: 24px 18px; }
  .captcha-row { flex-direction: column; }
  .captcha-btn { min-width: 0; width: 100%; min-height: 44px; }
}
</style>
