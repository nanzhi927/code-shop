// 技术栈 → 克制墨色占位（忌彩虹渐变）
export const TECH_COLORS = {
  SpringBoot: ['#18181b', '#3f3f46'],
  SSM: ['#1c1917', '#44403c'],
  'JSP+Servlet': ['#27272a', '#52525b'],
  Vue: ['#14532d', '#27272a'],
  Android: ['#052e16', '#1f2937'],
  Python: ['#1e293b', '#334155'],
  微信小程序: ['#14532d', '#3f3f46'],
  'uni-app': ['#164e63', '#27272a'],
  其他: ['#27272a', '#52525b']
};

export function techColor(tech) {
  return TECH_COLORS[tech] || TECH_COLORS['其他'];
}
