const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        host: 'localhost',
        port: 3000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
        }
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve({ status: res.statusCode, data: d }));
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const results = [];
  const check = (name, ok, extra) => {
    results.push({ name, ok: !!ok, extra: extra || '' });
    console.log((ok ? '✓' : '✗'), name, extra || '');
  };

  // 1. 健康检查
  let r = await req('GET', '/api/health');
  check('健康检查', r.status === 200 && JSON.parse(r.data).ok);

  // 2. 商品列表（含封面字段）
  r = await req('GET', '/api/products?page=1&pageSize=3');
  let j = JSON.parse(r.data);
  check('商品列表', r.status === 200 && j.total > 0 && j.total <= 2000 && j.list.length === 3);
  const withCover = j.list.filter((p) => p.cover).length;
  console.log('   (本页含封面:', withCover, ')');

  // 3. 技术栈
  r = await req('GET', '/api/products/techs');
  j = JSON.parse(r.data);
  check('技术栈统计', r.status === 200 && j.length >= 3);

  // 4. 商品详情
  r = await req('GET', '/api/products/1');
  j = JSON.parse(r.data);
  check('商品详情', r.status === 200 && j.title.includes('失物招领') && !!j.cover);
  check('商品详情(details)', r.status === 200 && j.details && Array.isArray(j.details.features));

  // 4b. 搜索联想
  r = await req('GET', '/api/products/suggest?keyword=' + encodeURIComponent('图书'));
  j = JSON.parse(r.data);
  check('搜索联想', r.status === 200 && Array.isArray(j) && j.length > 0);

  // 4c. 拼音兜底搜索
  r = await req('GET', '/api/products?keyword=tushu&page=1&pageSize=3');
  j = JSON.parse(r.data);
  check('拼音兜底搜索', r.status === 200 && j.total > 0);

  // 4d. 相关推荐
  r = await req('GET', '/api/products/related/1');
  j = JSON.parse(r.data);
  check('相关推荐', r.status === 200 && Array.isArray(j));

  // 4e. 公告列表
  r = await req('GET', '/api/notices');
  j = JSON.parse(r.data);
  check('公告列表', r.status === 200 && Array.isArray(j.list));

  // 5. 封面图可访问
  r = await req('GET', j.cover);
  check('封面图访问', r.status === 200 && /image\//.test(r.data.slice(0, 30) || '') || r.status === 200);

  // 6. 注册新用户
  const uname = 'rt' + Date.now().toString().slice(-6);
  r = await req('POST', '/api/auth/register', { username: uname, password: '123456a' });
  j = JSON.parse(r.data);
  check('注册用户', r.status === 200 && j.token);

  // 7. 登录
  r = await req('POST', '/api/auth/login', { username: uname, password: '123456a' });
  j = JSON.parse(r.data);
  check('用户登录', r.status === 200 && j.token);
  const token = j.token;

  // 8. 下单
  r = await req('POST', '/api/orders', { productIds: [1, 2] }, token);
  j = JSON.parse(r.data);
  check('创建订单', r.status === 200 && j.orderNo && j.total === 198);
  const orderId = j.orderId;

  // 9. 管理员登录（提前，用于配置收款码）
  r = await req('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  j = JSON.parse(r.data);
  check('管理员登录', r.status === 200 && ['admin', 'superadmin', 'ops'].includes(j.user.role));
  const adminToken = j.token;

  // 9b. 配置支付宝收款码并扫码支付（替代已关闭的 mock）
  r = await req('GET', '/api/settings', null, adminToken);
  j = JSON.parse(r.data);
  const prevAlipayQr = j.alipay_qr || '';
  r = await req('PUT', '/api/settings', { alipay_qr: '/uploads/qr/test.png', pay_alipay_enabled: '1' }, adminToken);
  j = JSON.parse(r.data);
  check('配置支付宝收款码', r.status === 200 && j.ok);

  r = await req('POST', '/api/orders/' + orderId + '/pay', { method: 'alipay' }, token);
  j = JSON.parse(r.data);
  check('支付宝扫码支付', r.status === 200 && j.ok);

  // mock 应被拒绝
  r = await req('POST', '/api/orders', { productIds: [2] }, token);
  const mockProbeOrderId = JSON.parse(r.data).orderId;
  r = await req('POST', '/api/orders/' + mockProbeOrderId + '/pay', { method: 'mock' }, token);
  check('模拟支付已关闭', r.status === 400);

  // 恢复收款码设置
  await req('PUT', '/api/settings', { alipay_qr: prevAlipayQr }, adminToken);

  // 10. 我的订单
  r = await req('GET', '/api/orders', null, token);
  j = JSON.parse(r.data);
  check('我的订单', r.status === 200 && j.list && j.list.some((o) => o.id === orderId));

  // 11. 我的卡密（空）
  r = await req('GET', '/api/cards', null, token);
  j = JSON.parse(r.data);
  check('我的卡密', r.status === 200 && Array.isArray(j.list));

  // 12. （管理员已在步骤9登录）
  // 13. 后台统计
  r = await req('GET', '/api/admin/stats', null, adminToken);
  j = JSON.parse(r.data);
  check('后台统计', r.status === 200 && j.products >= 1528 && j.products <= 2000);

  // 14. 后台商品列表
  r = await req('GET', '/api/admin/products?page=1&pageSize=5', null, adminToken);
  j = JSON.parse(r.data);
  check('后台商品列表', r.status === 200 && j.list.length === 5);

  // 15. 后台订单列表
  r = await req('GET', '/api/admin/orders', null, adminToken);
  j = JSON.parse(r.data);
  check('后台订单列表', r.status === 200 && j.total >= 1);

  // 16. 发货
  r = await req('POST', '/api/admin/orders/' + orderId + '/ship', { shipping_info: '百度网盘链接: https://pan.baidu.com/s/xxxx\n提取码: abcd' }, adminToken);
  j = JSON.parse(r.data);
  check('后台发货', r.status === 200 && j.ok);

  // 17. 确认收货
  r = await req('POST', '/api/orders/' + orderId + '/confirm', null, token);
  j = JSON.parse(r.data);
  check('确认收货', r.status === 200 && j.ok);

  // 18. 前台首页静态资源
  r = await req('GET', '/');
  check('前台首页(生产)', r.status === 200 && r.data.includes('id="app"'));

  // 19. SPA 路由回退
  r = await req('GET', '/products');
  check('SPA 路由回退', r.status === 200 && r.data.includes('id="app"'));

  // 20. 优惠券全流程
  r = await req('POST', '/api/admin/coupons', {
    name: 'RT券', type: 'full', amount: 5, threshold: 1, stock: 10, per_user: 1, count: 1
  }, adminToken);
  j = JSON.parse(r.data);
  check('后台创建优惠券', r.status === 200 && j.ok && j.codes && j.codes.length === 1);
  const couponCode = j.codes[0];

  r = await req('GET', '/api/admin/coupons?page=1&pageSize=50', null, adminToken);
  j = JSON.parse(r.data);
  const couponRow = j.list && j.list.find((c) => c.code === couponCode);
  check('后台优惠券列表', r.status === 200 && !!couponRow);
  const couponId = couponRow && couponRow.id;

  r = await req('POST', '/api/coupons/' + couponId + '/claim', null, token);
  j = JSON.parse(r.data);
  check('用户领取优惠券', r.status === 200 && j.ok);

  r = await req('GET', '/api/coupons/mine', null, token);
  j = JSON.parse(r.data);
  const ucRow = j.list && j.list.find((c) => c.code === couponCode && c.status === 'unused');
  check('我的优惠券', r.status === 200 && !!ucRow);
  const userCouponId = ucRow && ucRow.id;

  r = await req('POST', '/api/orders', { productIds: [1], userCouponId }, token);
  j = JSON.parse(r.data);
  check('优惠券下单', r.status === 200 && j.total === 94);
  const couponOrderId = j.orderId;

  r = await req('PUT', '/api/settings', { alipay_qr: '/uploads/qr/test.png', pay_alipay_enabled: '1' }, adminToken);
  j = JSON.parse(r.data);
  check('优惠券支付前配置收款码', r.status === 200 && j.ok);

  r = await req('POST', '/api/orders/' + couponOrderId + '/pay', { method: 'alipay' }, token);
  j = JSON.parse(r.data);
  check('优惠券订单支付', r.status === 200 && j.ok);

  await req('PUT', '/api/settings', { alipay_qr: prevAlipayQr }, adminToken);

  r = await req('GET', '/api/orders/' + couponOrderId + '/payrecords', null, token);
  j = JSON.parse(r.data);
  check('支付流水', r.status === 200 && j.list && j.list.length >= 1 && j.list[0].channel === 'alipay');

  r = await req('POST', '/api/orders/' + couponOrderId + '/refund', { reason: 'RT退款', amount: 94 }, token);
  j = JSON.parse(r.data);
  check('申请退款', r.status === 200 && j.ok && j.id);
  const refundId = j.id;

  r = await req('GET', '/api/orders/refunds', null, token);
  j = JSON.parse(r.data);
  const refundRow = j.list && j.list.find((x) => x.id === refundId);
  check('退款列表', r.status === 200 && refundRow && refundRow.status === 'pending');

  r = await req('POST', '/api/admin/refunds/' + refundId, { action: 'refund' }, adminToken);
  j = JSON.parse(r.data);
  check('后台审核退款', r.status === 200 && j.ok);

  // 21. SEO
  r = await req('GET', '/robots.txt');
  check('robots.txt', r.status === 200 && r.data.includes('Sitemap'));

  r = await req('GET', '/sitemap.xml');
  check('sitemap.xml', r.status === 200 && r.data.includes('<urlset'));

  // 22. 站内通知
  r = await req('GET', '/api/notifications', null, token);
  j = JSON.parse(r.data);
  check('站内通知列表', r.status === 200 && Array.isArray(j.list) && typeof j.unread === 'number');

  r = await req('POST', '/api/notifications/read', { ids: [] }, token);
  j = JSON.parse(r.data);
  check('站内通知已读', r.status === 200 && j.ok === true);

  // 23. 管理员管理
  r = await req('GET', '/api/admin/admins', null, adminToken);
  j = JSON.parse(r.data);
  check('管理员列表', r.status === 200 && Array.isArray(j.list) && j.list.length >= 1);

  // 24. 批量发货参数校验
  r = await req('POST', '/api/admin/orders/batch-ship', { orderIds: [], shipping_info: 'x' }, adminToken);
  j = JSON.parse(r.data);
  check('批量发货参数校验', r.status === 400);

  // 25. 报价模板
  r = await req('POST', '/api/services/admin/custom/templates', { name: 'RT模板' }, adminToken);
  j = JSON.parse(r.data);
  check('创建报价模板', r.status === 200 && j.ok === true);

  r = await req('GET', '/api/services/admin/custom/templates', null, adminToken);
  j = JSON.parse(r.data);
  check('报价模板列表', r.status === 200 && j.list.length >= 1);

  // 26. 无结果词转定制
  r = await req('POST', '/api/services/admin/custom/from-keyword', { keyword: 'RT词' + Date.now() }, adminToken);
  j = JSON.parse(r.data);
  check('无结果词转定制', r.status === 200 && j.ok === true && j.id > 0);

  const failed = results.filter((x) => !x.ok).length;
  console.log('\n=== 回归测试完成:', results.length - failed + '/' + results.length, '通过 ===');
  process.exit(failed ? 1 : 0);
})();
