// 支付渠道抽象层；生产环境建议设置 PAY_MOCK_DISABLED=1 关闭模拟支付
const CHANNELS = ['mock', 'epay'];
const ENABLED = { mock: true, epay: false };

async function createPayment({ channel, orderNo, amount, user }) {
  if (process.env.PAY_MOCK_DISABLED === '1' && channel === 'mock') {
    const err = new Error('模拟支付已关闭');
    err.status = 400;
    throw err;
  }
  if (channel === 'mock') {
    const rand4 = Math.floor(Math.random() * 9000) + 1000;
    return {
      channel: 'mock',
      tradeNo: 'T' + Date.now() + rand4,
      status: 'success',
      paidAt: new Date()
    };
  }
  if (channel === 'epay') {
    if (!ENABLED.epay) {
      const err = new Error('易支付渠道未启用');
      err.status = 400;
      throw err;
    }
    // epay 接入点（后台配置开关启用后实现）
    throw new Error('易支付渠道未启用');
  }
  throw new Error('不支持的支付渠道');
}

// 易支付回调验签接入点
function verifyCallback(payload) {
  return { ok: false, reason: 'not_implemented' };
}

async function queryPayment(tradeNo) {
  return { tradeNo, status: 'unknown' };
}

module.exports = { CHANNELS, ENABLED, createPayment, verifyCallback, queryPayment };
