# 灵动打卡 · 技术方案（TECH）

> 技术选型 + 架构 + 数据模型 + 设计 token。后端细节本 v1 不涉及（localStorage）。

## 1. 技术选型
- **前端**：原生 HTML / CSS / JS，无框架、无构建（契合前端架构师角色 + `mobile-dev` 响应式 Web 模板）。
- **存储**：`localStorage`（单 key JSON 状态树）。
- **部署**：静态托管（CloudStudio / 直接打开 `index.html`）。
- **设计还原**：复用 `ui-patterns`（卡片式布局 + 底部导航；极简 + 玻璃拟态走马灯）。

## 2. 架构
单页应用（SPA）：`index.html` + `style.css` + `script.js`。
- 视图切换：底部导航 5 tab，JS 控制 section 显隐（无路由库）。
- 状态：`state` 对象 ↔ `localStorage`，所有写操作后 `save()`。
- 渲染：轻量 `render()` 按当前视图重绘列表/卡片。

## 3. 目录结构
```
lingdong-daka/
  index.html        # 骨架：header / 5 个 view section / 底部导航 / 弹层
  style.css         # 设计 token + 布局 + 组件 + 响应式断点
  script.js         # 数据层 + 视图渲染 + 交互 + 走马灯 + 积分
  docs/PRD.md
  docs/TECH.md
```

## 4. 数据模型（localStorage key：`lingdong_daka_v1`）
```jsonc
{
  "points": 0,            // 积分余额
  "streak": 0,            // 连续打卡天数
  "lastCheckIn": "",      // 最近打卡日期 YYYY-MM-DD
  "subjects": [ { "id":"s1", "name":"语文", "color":"#ef4444", "icon":"📖" } ],
  "tasks":    [ { "id":"t1", "title":"背单词50个", "subjectId":"s3", "dueDate":"2026-08-10", "done":false, "createdAt":0, "completedAt":0, "points":20 } ],
  "checkins": [ { "id":"c1", "subjectId":"s1", "date":"2026-07-30", "time":"08:30", "points":10, "note":"" } ],
  "countdowns":[ { "id":"d1", "title":"高考", "targetDate":"2027-06-07", "color":"#6366f1" } ],
  "flows":    [ { "id":"f1", "type":"earn", "amount":10, "reason":"打卡·语文", "refId":"c1", "createdAt":0 } ]
}
```
- 走马灯内容（语数英名言/公式/语法）为**静态种子数据**，置于 `script.js` 常量。

## 5. 积分规则（实现）
- 打卡：基础 +10；streak 达到 3 额外 +5，≥7 额外 +10（streak 在打卡时根据 `lastCheckIn` 推算）。
- 完成任务：+20（仅首次完成计入）。
- 每次收支写 `flows`。

## 6. 设计 token（莫高风格 CSS 变量）
```css
:root{
  --c-primary:#6366f1; --c-primary-2:#8b5cf6;
  --c-accent:#22d3ee;  --c-gold:#f59e0b;
  --bg:#f4f6fb; --card:#ffffff; --text:#1f2937; --muted:#6b7280;
  --line:#eceff5;
  --radius:18px; --radius-sm:12px;
  --shadow:0 8px 24px rgba(30,41,59,.08);
  --space:8px;  /* 8px 栅格 */
  --safe-b:env(safe-area-inset-bottom,0);
}
```

## 7. 视觉规范（引用 ui-patterns）
- **布局**：卡片式（Card-based）+ 底部导航（Bottom Navigation）。
- **风格**：极简（Minimalism）为底；首页走马灯用玻璃拟态（Glassmorphism）强调，确保文字可读性（半透明暗底 + 高对比文字）。
- **组件**：走马灯 carousel、FAB（快速打卡）、Bottom Sheet（新增科目/任务/倒数日）、数据列表、积分卡。

## 8. 部署目标
- 本地：双击 `index.html`（`file://` 下 localStorage 可用）。
- 云端：CloudStudio 静态托管，产出在线链接（满足「交付运行」）。

## 9. 测试与验收
- 构建检查：无（原生，浏览器打开即运行）。
- 功能自测：打卡→积分/历史/流水/streak 联动；增删改持久化；走马灯轮播；四断点。
- 联调：无后端，前端即终态。
