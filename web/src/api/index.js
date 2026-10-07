import axios from 'axios';
import { ElMessage } from 'element-plus';
import { useUserStore } from '../stores/user';
import router from '../router';

const http = axios.create({ baseURL: '/api', timeout: 20000 });

let redirecting = false;

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => {
    redirecting = false;
    return res.data;
  },
  (err) => {
    const status = err.response?.status;
    const msg = err.response?.data?.message || '请求失败';
    if (status === 401) {
      if (redirecting) return Promise.reject(err);
      redirecting = true;
      ElMessage.error(msg);
      const userStore = useUserStore();
      userStore.logout();
      const cur = router.currentRoute.value.path;
      const target = cur.startsWith('/admin') ? '/admin/login' : '/login';
      if (cur !== target) router.push(target);
      setTimeout(() => { redirecting = false; }, 1500);
      return Promise.reject(err);
    }
    ElMessage.error(msg);
    return Promise.reject(err);
  }
);

export default http;
