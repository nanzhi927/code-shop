// 运行状态 → 文案/颜色映射（前后台共用）
export const RUN_STATUS = {
  0: { label: '未验证', type: 'info' },
  1: { label: '已验证可运行', type: 'success' },
  2: { label: '有问题', type: 'warning' },
  3: { label: '停止出售', type: 'danger' }
};

// 文件材料类型 → 文案映射
export const FILE_KIND = {
  source: '源码',
  paper: '论文/文档',
  ppt: 'PPT',
  video: '演示视频',
  screenshot: '截图',
  db: '数据库脚本',
  other: '其他材料'
};

export const runStatusText = (s) => RUN_STATUS[s]?.label || '—';
export const runStatusType = (s) => RUN_STATUS[s]?.type || 'info';
