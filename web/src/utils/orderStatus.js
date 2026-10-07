// 订单状态 → 文案/颜色映射（前后台共用）
export const ORDER_STATUS = {
  pending: { text: '待支付', type: 'warning' },
  paid: { text: '已支付待发货', type: 'primary' },
  shipped: { text: '已发货', type: 'success' },
  completed: { text: '已完成', type: 'info' },
  cancelled: { text: '已取消', type: 'danger' },
  refunded: { text: '已退款', type: 'danger' }
};

export const statusText = (s) => ORDER_STATUS[s]?.text || s || '—';
export const statusType = (s) => ORDER_STATUS[s]?.type || 'info';
