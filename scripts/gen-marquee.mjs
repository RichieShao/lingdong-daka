// scripts/gen-marquee.mjs
// 生成 / 刷新 marquee.json（走马灯线上内容池）。
//
// 用法：node scripts/gen-marquee.mjs
//
// 设计说明：
//   1. 内容定位「初中 / 高中阶段」，覆盖语文 / 数学 / 英语 / 物理 / 化学 的名言、公式、语法与技巧。
//   2. 默认使用内置精选池，并用「当天日期」作种子打乱顺序，使每天展示的内容都不同。
//   3. 配合 .github/workflows/daily-marquee.yml 的定时任务，可每天自动提交新内容，
//      前端访问 ./marquee.json?t=日期 即可拿到当天版本（真正「每天从线上摘取新内容」）。
//
// 扩展（真正从网上抓取）：
//   若要每天从真实网络来源摘取最新内容，在 buildPool() 里接入你的内容源即可，例如：
//     - 调用某个返回初中/高中知识点的开放 API；
//     - 抓取教育类站点 / RSS，解析出名言、公式、语法等条目；
//     - 调用大模型 API 按「初中/高中 + 科目 + 类型」生成当日内容（需配置 API Key 到仓库 Secrets）。
//   只要最终返回与下方 POOL 同结构的数组，前端无需改动。

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ---------- 内置精选池（初中 / 高中） ----------
const POOL = [
  { subject: '语文', type: '名言', text: '读书破万卷，下笔如有神。' },
  { subject: '语文', type: '名言', text: '腹有诗书气自华，读书万卷始通神。' },
  { subject: '语文', type: '名言', text: '业精于勤，荒于嬉；行成于思，毁于随。' },
  { subject: '语文', type: '古诗词', text: '落霞与孤鹜齐飞，秋水共长天一色。' },
  { subject: '语文', type: '古诗词', text: '长风破浪会有时，直挂云帆济沧海。' },
  { subject: '语文', type: '古诗词', text: '会当凌绝顶，一览众山小。' },
  { subject: '语文', type: '技巧', text: '阅读理解：先读题再读文，定位关键词句，答案多在原文。' },
  { subject: '语文', type: '技巧', text: '作文：开头亮明观点，结尾升华主题，结构清晰易得分。' },
  { subject: '语文', type: '技巧', text: '文言文：积累常见实词虚词，结合上下文推断词义。' },
  { subject: '数学', type: '公式', text: '二次函数顶点横坐标：x = −b / (2a)。' },
  { subject: '数学', type: '公式', text: '勾股定理：a² + b² = c²。' },
  { subject: '数学', type: '公式', text: '等差数列求和：Sₙ = n(a₁ + aₙ) / 2。' },
  { subject: '数学', type: '公式', text: '一元二次方程求根：x = [−b ± √(b²−4ac)] / (2a)。' },
  { subject: '数学', type: '公式', text: '圆的标准方程：(x−a)² + (y−b)² = r²。' },
  { subject: '数学', type: '公式', text: '三角函数恒等式：sin²α + cos²α = 1。' },
  { subject: '数学', type: '技巧', text: '解方程：先移项合并同类项，再消元或配方。' },
  { subject: '数学', type: '技巧', text: '几何证明：从已知条件与目标结论双向推导，寻找中间桥梁。' },
  { subject: '数学', type: '概念', text: '函数：每个自变量 x 对应唯一因变量 y。' },
  { subject: '英语', type: '语法', text: '现在完成时：have / has + 过去分词，强调过去对现在的影响。' },
  { subject: '英语', type: '语法', text: '定语从句：先行词 + that / which / who。' },
  { subject: '英语', type: '语法', text: 'if 条件句：主将从现（主句将来时，从句现在时）。' },
  { subject: '英语', type: '语法', text: '被动语态：be + 过去分词。' },
  { subject: '英语', type: '句型', text: 'It is + adj. + to do sth. 做某事是……的。' },
  { subject: '英语', type: '名言', text: 'Practice makes perfect. 熟能生巧。' },
  { subject: '英语', type: '技巧', text: '完形填空：先通读把握大意，再逐空结合语境。' },
  { subject: '英语', type: '技巧', text: '阅读：抓首尾段与各段主题句，快速定位主旨。' },
  { subject: '英语', type: '词汇', text: '前缀 un- / dis- 表否定，re- 表「再、又」。' },
  { subject: '物理', type: '公式', text: '速度：v = s / t。' },
  { subject: '物理', type: '公式', text: '密度：ρ = m / V。' },
  { subject: '物理', type: '公式', text: '压强：p = F / S。' },
  { subject: '物理', type: '公式', text: '欧姆定律：I = U / R。' },
  { subject: '物理', type: '公式', text: '功：W = F·s。' },
  { subject: '物理', type: '概念', text: '牛顿第一定律：物体不受力时保持静止或匀速直线运动。' },
  { subject: '物理', type: '技巧', text: '受力分析：先重力，再弹力，后摩擦，不漏不添。' },
  { subject: '化学', type: '概念', text: '质量守恒定律：化学反应前后总质量不变。' },
  { subject: '化学', type: '方程式', text: '2H₂ + O₂ 点燃 2H₂O。' },
  { subject: '化学', type: '概念', text: '氧化物：由两种元素组成且一种是氧的化合物。' },
  { subject: '化学', type: '技巧', text: '化学方程式配平：先配平原子个数，再标条件与状态。' },
  { subject: '化学', type: '概念', text: '酸碱指示剂：石蕊遇酸红遇碱蓝，酚酞遇碱红。' },
  { subject: '化学', type: '概念', text: '催化剂：改变反应速率而本身质量和化学性质不变。' },
];

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// 用日期作种子打乱顺序（确定性的伪随机，保证当天一致、跨天不同）
function dailyShuffle(arr, seedStr) {
  let seed = 0;
  for (const ch of seedStr) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const j = seed % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 如需真正从网络抓取，替换此函数返回值即可（结构需与 POOL 一致）
function buildPool() {
  return POOL;
}

const out = {
  level: '初中/高中',
  updated: todayStr(),
  note: '走马灯内容池：初中/高中 语文/数学/英语/物理/化学。由 scripts/gen-marquee.mjs 每日刷新（GitHub Actions 定时运行）。',
  pool: dailyShuffle(buildPool(), todayStr()),
};

writeFileSync(join(root, 'marquee.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('[gen-marquee] 已生成 marquee.json，共 ' + out.pool.length + ' 条，更新日期 ' + out.updated);
