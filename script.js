/* =========================================================
   灵动打卡 · 逻辑层（原生 JS + localStorage）
   设计还原：ui-patterns（卡片式 + 底部导航 + 玻璃拟态走马灯）
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  const KEY = 'lingdong_daka_v1';
  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];
  const CHECKIN_BASE = 10;
  const TASK_POINTS = 20;

  // 走马灯静态种子（语文/数学/英语：名言、公式、语法）
  const MARQUEE = [
    { subject: '语文', items: [
      { type: '名言', text: '读书破万卷，下笔如有神。' },
      { type: '名言', text: '腹有诗书气自华，读书万卷始通神。' },
      { type: '技巧', text: '阅读理解：先读题再读文，定位关键词句。' },
      { type: '技巧', text: '作文开头亮明观点，结尾升华主题，结构清晰易得分。' },
    ]},
    { subject: '数学', items: [
      { type: '公式', text: '二次函数顶点横坐标：x = −b / (2a)。' },
      { type: '公式', text: '勾股定理：a² + b² = c²。' },
      { type: '公式', text: '等差数列求和：Sₙ = n(a₁ + aₙ) / 2。' },
      { type: '技巧', text: '解方程：先移项合并同类项，再消元或配方。' },
    ]},
    { subject: '英语', items: [
      { type: '语法', text: '现在完成时：have / has + 过去分词。' },
      { type: '语法', text: '定语从句：先行词 + that / which / who。' },
      { type: '语法', text: 'if 引导的条件句：主将从现（主句将来时，从句现在时）。' },
      { type: '名言', text: 'Practice makes perfect. 熟能生巧。' },
    ]},
  ];

  /* ---------- 状态 ---------- */
  let state = load();
  if (!state.focus) state.focus = { date: '', todayCount: 0, total: 0 };

  function defaultState() {
    return {
      points: 0,
      streak: 0,
      lastCheckIn: '',
      subjects: [
        { id: uid(), name: '语文', color: '#ef4444', icon: '📖' },
        { id: uid(), name: '数学', color: '#3b82f6', icon: '🔢' },
        { id: uid(), name: '英语', color: '#10b981', icon: '🔤' },
      ],
      tasks: [],
      checkins: [],
      countdowns: [],
      flows: [],
      focus: { date: '', todayCount: 0, total: 0 },
      gifts: defaultGifts(),
    };
  }
  function defaultGifts() {
    return [
      { id: uid(), name: '奶茶', icon: '🧋', points: 100 },
      { id: uid(), name: '电影票', icon: '🎬', points: 300 },
      { id: uid(), name: '小零食', icon: '🍪', points: 150 },
    ];
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.subjects) {
        if (!Array.isArray(s.gifts)) s.gifts = defaultGifts();
        return s;
      }
    } catch (e) {}
    return defaultState();
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  /* ---------- 工具 ---------- */
  function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function todayStr() { return fmtDate(new Date()); }
  function parseDate(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function daysUntil(target) {
    const t = parseDate(target);
    const n = new Date(); const today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((t - today) / 86400000);
  }
  function subjById(id) { return state.subjects.find(s => s.id === id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  /* ---------- 走马灯（在线内容 + 每日轮换） ---------- */
  let slides = [];
  let mIndex = 0;
  let mTimer = null;

  const MARQUEE_URL = './marquee.json';   // 线上内容（部署到任意静态托管均可用相对路径）
  const MARQUEE_PER_DAY = 8;              // 每天展示的条数

  // 拉取线上内容；失败则回退到内置 MARQUEE
  async function loadMarqueeItems() {
    try {
      const res = await fetch(MARQUEE_URL + '?t=' + todayStr(), { cache: 'no-cache' });
      if (!res.ok) throw new Error('http ' + res.status);
      const data = await res.json();
      if (data && Array.isArray(data.pool) && data.pool.length) {
        return data.pool.map(it => ({ subject: it.subject, type: it.type, text: it.text }));
      }
    } catch (e) {
      console.warn('[marquee] 线上内容获取失败，使用内置回退：', e && e.message);
    }
    const items = [];
    MARQUEE.forEach(g => g.items.forEach(it => items.push({ subject: g.subject, type: it.type, text: it.text })));
    return items;
  }

  // 按日期种子从内容池取一段，保证每天展示不同内容
  function dailySlice(items, n) {
    if (items.length <= n) return items.slice();
    const dayNum = Math.floor(Date.now() / 86400000);
    const start = dayNum % items.length;
    const out = [];
    for (let i = 0; i < n; i++) out.push(items[(start + i) % items.length]);
    return out;
  }

  function renderMarquee() {
    const track = document.getElementById('marqueeTrack');
    track.innerHTML = slides.map(s =>
      '<div class="marquee-slide">' + escapeHtml(s.text) + '</div>'
    ).join('');
    const dots = document.getElementById('marqueeDots');
    dots.innerHTML = slides.map((_, i) => '<span class="dot' + (i === mIndex ? ' active' : '') + '"></span>').join('');
    const cur = slides[mIndex];
    document.getElementById('marqueeSubject').textContent = cur.subject;
    document.getElementById('marqueeType').textContent = cur.type;
    track.style.transform = 'translateX(' + (-mIndex * 100) + '%)';
  }
  function goMarquee(i) {
    mIndex = (i + slides.length) % slides.length;
    renderMarquee();
  }
  async function startMarquee() {
    const items = await loadMarqueeItems();
    slides = dailySlice(items, Math.min(MARQUEE_PER_DAY, items.length));
    renderMarquee();
    clearInterval(mTimer);
    mTimer = setInterval(() => goMarquee(mIndex + 1), 4500);
  }

  /* ---------- 视图切换 ---------- */
  let currentView = 'home';
  function switchView(name) {
    currentView = name;
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    if (name === 'home') renderHome();
    else if (name === 'checkin') renderCheckin();
    else if (name === 'tasks') renderTasks();
    else if (name === 'countdown') renderCountdown();
    else if (name === 'me') renderMe();
    else if (name === 'focus') renderFocus();
    // FAB 图标随视图变化
    const fab = document.getElementById('fab');
    if (name === 'focus') fab.style.display = 'none';
    else {
      fab.style.display = '';
      fab.textContent = (name === 'tasks' || name === 'countdown' || name === 'me') ? '＋' : '✓';
    }
  }

  /* ---------- 渲染：积分 / 首页 ---------- */
  function renderPoints() { document.getElementById('pointsBalance').textContent = state.points; }

  function renderHome() {
    renderPoints();
    // 概览
    const today = todayStr();
    const todayCIs = state.checkins.filter(c => c.date === today);
    const nearest = state.countdowns
      .map(c => daysUntil(c.targetDate))
      .filter(d => d >= 0)
      .sort((a, b) => a - b)[0];
    document.getElementById('homeStats').innerHTML = [
      stat(state.streak, '天', false, '连续打卡'),
      stat(todayCIs.length, '次', false, '今日打卡'),
      stat(nearest == null ? '—' : nearest, nearest == null ? '' : '天', true, '最近目标'),
    ].join('');
    // 今日待打卡（全部科目，已打卡标记）
    const doneSet = new Set(todayCIs.map(c => c.subjectId));
    document.getElementById('homeSubjects').innerHTML = state.subjects.length
      ? state.subjects.map(s => subjChip(s, doneSet.has(s.id))).join('')
      : '<div class="empty">还没有科目，去「任务」添加</div>';
    // 近期任务（未完成前 4）
    const open = state.tasks.filter(t => !t.done).slice(0, 4);
    document.getElementById('homeTasks').innerHTML = open.length
      ? open.map(taskRow).join('')
      : '<div class="empty">暂无待办任务</div>';
    // 最新积分
    const flows = state.flows.slice(-4).reverse();
    document.getElementById('homeFlows').innerHTML = flows.length
      ? flows.map(flowRow).join('')
      : '<div class="empty">还没有积分记录</div>';
  }
  function stat(num, unit, gold, lab) {
    return '<div class="stat"><div class="num' + (gold ? ' gold' : '') + '">' + num + (unit ? '<small style="font-size:12px"> ' + unit + '</small>' : '') + '</div><div class="lab">' + lab + '</div></div>';
  }
  function subjChip(s, done) {
    return '<div class="subj-chip' + (done ? ' done' : '') + '" data-subj="' + s.id + '">' +
      '<span class="bar" style="background:' + s.color + '"></span>' +
      '<span class="ico">' + s.icon + '</span><span class="nm">' + escapeHtml(s.name) + '</span></div>';
  }
  function taskRow(t) {
    const s = subjById(t.subjectId);
    return '<div class="task' + (t.done ? ' done' : '') + '" data-task="' + t.id + '">' +
      '<div class="check" data-act="done">' + (t.done ? '✓' : '') + '</div>' +
      '<div class="t-main"><div class="t-title">' + escapeHtml(t.title) + '</div>' +
      '<div class="t-meta"><span class="tag-subj">' + (s ? s.icon + ' ' + escapeHtml(s.name) : '未分类') + '</span>' +
      (t.dueDate ? '<span>📅 ' + t.dueDate + '</span>' : '') + '</div></div>' +
      '<span class="pts">+' + t.points + '⭐</span>' +
      '<button class="t-del" data-act="del">✕</button></div>';
  }
  function flowRow(f) {
    const cls = f.type === 'earn' ? 'earn' : 'spend';
    const sign = f.type === 'earn' ? '+' : '−';
    const ico = f.type === 'earn' ? '⬆' : '⬇';
    return '<div class="fl ' + cls + '"><span class="fl-ico">' + ico + '</span>' +
      '<div class="fl-main"><div>' + escapeHtml(f.reason) + '</div>' +
      '<div class="fl-date">' + new Date(f.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</div></div>' +
      '<span class="fl-amt">' + sign + f.amount + '⭐</span></div>';
  }

  /* ---------- 渲染：打卡 ---------- */
  function renderCheckin() {
    const today = todayStr();
    const doneSet = new Set(state.checkins.filter(c => c.date === today).map(c => c.subjectId));
    document.getElementById('checkinSubjects').innerHTML = state.subjects.length
      ? state.subjects.map(s => subjChip(s, doneSet.has(s.id))).join('')
      : '<div class="empty">还没有科目，去「任务」添加</div>';
    const todayCIs = state.checkins.filter(c => c.date === today).reverse();
    document.getElementById('todayCount').textContent = todayCIs.length + ' 次';
    document.getElementById('checkinToday').innerHTML = todayCIs.length
      ? todayCIs.map(c => {
          const s = subjById(c.subjectId);
          return '<div class="ci"><span class="ci-ico">' + (s ? s.icon : '✅') + '</span>' +
            '<div class="ci-main"><div>' + (s ? escapeHtml(s.name) : '已删科目') + ' 打卡</div>' +
            '<div class="ci-sub">' + c.time + (c.note ? ' · ' + escapeHtml(c.note) : '') + '</div></div>' +
            '<span class="ci-pts">+' + c.points + '⭐</span></div>';
        }).join('')
      : '<div class="empty">今天还没打卡，点上面的科目开始吧</div>';
  }

  /* ---------- 渲染：任务 ---------- */
  function renderTasks() {
    renderSubjectManage();
    populateSubjectFilter('taskFilter');
    const f = document.getElementById('taskFilter').value;
    const list = state.tasks
      .filter(t => !f || t.subjectId === f)
      .sort((a, b) => (a.done - b.done) || (b.createdAt - a.createdAt));
    document.getElementById('taskList').innerHTML = list.length
      ? list.map(taskRow).join('')
      : '<div class="empty">暂无任务，点右下角 ＋ 添加</div>';
  }
  function renderSubjectManage() {
    const el = document.getElementById('subjectManage');
    if (!el) return;
    el.innerHTML = state.subjects.length
      ? state.subjects.map(s =>
          '<div class="sm"><span class="sm-dot" style="background:' + s.color + '"></span>' +
          '<span class="sm-name">' + s.icon + ' ' + escapeHtml(s.name) + '</span>' +
          '<button class="sm-del" data-subj-del="' + s.id + '">删除</button></div>'
        ).join('')
      : '<div class="empty">还没有科目，点右上角 ＋ 科目</div>';
  }

  /* ---------- 渲染：倒数日 ---------- */
  function renderCountdown() {
    const list = state.countdowns.slice().sort((a, b) => daysUntil(a.targetDate) - daysUntil(b.targetDate));
    document.getElementById('countdownList').innerHTML = list.length
      ? list.map(c => {
          const d = daysUntil(c.targetDate);
          const txt = d > 0 ? '剩 ' + d + ' 天' : (d === 0 ? '就是今天！' : '已到期 ' + (-d) + ' 天');
          return '<div class="cd' + (d < 0 ? ' over' : '') + '" style="background:linear-gradient(135deg,' + c.color + ',' + shade(c.color) + ')">' +
            '<div class="cd-days">' + (d >= 0 ? d : 0) + '<small>天</small></div>' +
            '<div class="cd-info"><div class="cd-title">' + escapeHtml(c.title) + '</div>' +
            '<div class="cd-date">' + c.targetDate + ' · ' + txt + '</div></div>' +
            '<button class="cd-del" data-cd="' + c.id + '">✕</button></div>';
        }).join('')
      : '<div class="empty">还没有倒数日，点右上角 ＋ 新增</div>';
  }
  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, r - 40); g = Math.max(0, g - 40); b = Math.max(0, b - 40);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* ---------- 渲染：我的 ---------- */
  function renderMe() {
    // 积分兑换
    renderGifts();
    // 历史（可按科目筛选）
    populateSubjectFilter('historyFilter', true);
    const f = document.getElementById('historyFilter').value;
    const list = state.checkins.filter(c => !f || c.subjectId === f).slice().reverse();
    document.getElementById('historyList').innerHTML = list.length
      ? list.map(c => {
          const s = subjById(c.subjectId);
          const wk = ['日', '一', '二', '三', '四', '五', '六'][parseDate(c.date).getDay()];
          return '<div class="hi"><span class="hi-ico">' + (s ? s.icon : '✅') + '</span>' +
            '<div class="hi-main"><div>' + (s ? escapeHtml(s.name) : '已删科目') + ' 打卡' + (c.note ? ' · ' + escapeHtml(c.note) : '') + '</div>' +
            '<div class="hi-sub">+' + c.points + '⭐</div></div>' +
            '<span class="hi-date">' + c.date + ' 周' + wk + ' ' + c.time + '</span></div>';
        }).join('')
      : '<div class="empty">还没有打卡记录</div>';
    // 积分流水
    const flows = state.flows.slice().reverse();
    document.getElementById('flowList').innerHTML = flows.length
      ? flows.map(flowRow).join('')
      : '<div class="empty">还没有积分记录</div>';
  }
  function renderGifts() {
    const el = document.getElementById('giftList');
    if (!el) return;
    el.innerHTML = state.gifts.length
      ? state.gifts.map(g => {
          const afford = state.points >= g.points;
          return '<div class="gift">' +
            '<span class="gift-ico">' + g.icon + '</span>' +
            '<div class="gift-main"><div class="gift-name">' + escapeHtml(g.name) + '</div>' +
            '<div class="gift-pts">' + g.points + ' 分</div></div>' +
            '<button class="gift-redeem' + (afford ? '' : ' disabled') + '" data-redeem="' + g.id + '">兑换</button>' +
            '<button class="gift-edit" data-gift-edit="' + g.id + '" title="修改分值">✎</button>' +
            '<button class="gift-del" data-gift-del="' + g.id + '" title="删除">✕</button></div>';
        }).join('')
      : '<div class="empty">还没有礼品，点右上角 ＋ 礼品 添加</div>';
  }
  function populateSubjectFilter(id, withAll) {
    const sel = document.getElementById(id);
    const cur = sel.value;
    sel.innerHTML = (withAll ? '<option value="">全部</option>' : '<option value="">全部科目</option>') +
      state.subjects.map(s => '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>').join('');
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  }

  /* ---------- 业务动作 ---------- */
  function doCheckIn(subjectId, note) {
    const s = subjById(subjectId);
    if (!s) return;
    const now = new Date();
    const today = fmtDate(now);
    const yest = fmtDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    // streak
    if (state.lastCheckIn !== today) {
      state.streak = (state.lastCheckIn === yest) ? state.streak + 1 : 1;
    }
    let bonus = 0;
    if (state.streak >= 7) bonus = 10; else if (state.streak >= 3) bonus = 5;
    const gain = CHECKIN_BASE + bonus;
    const cid = uid();
    state.checkins.push({ id: cid, subjectId, date: today, time: fmtTime(now), points: gain, note: note || '' });
    state.flows.push({ id: uid(), type: 'earn', amount: gain, reason: '打卡·' + s.name + (bonus ? '（连击+' + bonus + '）' : ''), refId: cid, createdAt: now.getTime() });
    state.points += gain;
    state.lastCheckIn = today;
    save();
    toast('打卡成功 +' + gain + '⭐' + (bonus ? ' 连击奖励!' : ''));
    renderPoints();
    if (currentView === 'home') renderHome();
    if (currentView === 'checkin') renderCheckin();
  }

  function completeTask(id) {
    const t = state.tasks.find(x => x.id === id);
    if (!t || t.done) return;
    t.done = true; t.completedAt = Date.now();
    state.points += t.points;
    state.flows.push({ id: uid(), type: 'earn', amount: t.points, reason: '完成任务·' + t.title, refId: id, createdAt: Date.now() });
    save(); toast('任务完成 +' + t.points + '⭐'); renderPoints();
    if (currentView === 'home') renderHome();
    if (currentView === 'tasks') renderTasks();
    if (currentView === 'me') renderMe();
  }
  function deleteTask(id) {
    const t = state.tasks.find(x => x.id === id);
    if (!t) return;
    if (t.done) {
      state.points = Math.max(0, state.points - t.points);
      state.flows = state.flows.filter(f => f.refId !== id);
    }
    state.tasks = state.tasks.filter(x => x.id !== id);
    save(); renderPoints();
    if (currentView === 'home') renderHome();
    if (currentView === 'tasks') renderTasks();
    if (currentView === 'me') renderMe();
  }
  function addSubject(name, color, icon) {
    name = (name || '').trim(); if (!name) { toast('请输入科目名'); return; }
    state.subjects.push({ id: uid(), name, color: color || COLORS[0], icon: icon || '📘' });
    save(); toast('已添加科目'); closeSheet();
    if (currentView === 'tasks') renderTasks();
    if (currentView === 'home') renderHome();
    if (currentView === 'checkin') renderCheckin();
  }
  function addTask(title, subjectId, dueDate, points) {
    title = (title || '').trim(); if (!title) { toast('请输入任务内容'); return; }
    state.tasks.push({ id: uid(), title, subjectId: subjectId || '', dueDate: dueDate || '', done: false, createdAt: Date.now(), completedAt: 0, points: Math.max(1, parseInt(points, 10) || TASK_POINTS) });
    save(); toast('已添加任务'); closeSheet();
    if (currentView === 'tasks') renderTasks();
    if (currentView === 'home') renderHome();
  }
  function addCountdown(title, targetDate, color) {
    title = (title || '').trim(); if (!title || !targetDate) { toast('请填标题和日期'); return; }
    state.countdowns.push({ id: uid(), title, targetDate, color: color || COLORS[0] });
    save(); toast('已添加倒数日'); closeSheet();
    if (currentView === 'countdown') renderCountdown();
    if (currentView === 'home') renderHome();
  }
  function deleteSubject(id) {
    const hasRel = state.checkins.some(c => c.subjectId === id) || state.tasks.some(t => t.subjectId === id);
    const doDelete = () => {
      state.subjects = state.subjects.filter(s => s.id !== id);
      save(); renderTasks();
      if (currentView === 'home') renderHome();
      if (currentView === 'checkin') renderCheckin();
    };
    if (hasRel) confirmDialog('删除科目', '该科目下有关联的打卡/任务记录，删除后历史会显示为「已删科目」。确定删除？', doDelete);
    else doDelete();
  }
  function deleteCountdown(id) {
    state.countdowns = state.countdowns.filter(c => c.id !== id);
    save(); renderCountdown();
    if (currentView === 'home') renderHome();
  }
  function resetAll() {
    confirmDialog('清空所有数据', '将清空科目、任务、打卡、倒数日、积分与流水等全部数据，此操作不可恢复。', () => {
      state = defaultState(); save();
      toast('已清空全部数据'); switchView('home');
    });
  }

  /* ---------- 番茄钟（专注） ---------- */
  const FOCUS_POINTS = 15;
  const MODES = {
    focus: { sec: 25 * 60, emoji: '🍅', tip: '专注学习中…', tipStart: '开始专注吧～' },
    short: { sec: 5 * 60, emoji: '☕', tip: '休息一下～', tipStart: '来杯短休息 ☕' },
    long:  { sec: 15 * 60, emoji: '🌙', tip: '好好放松～', tipStart: '长休一下 🌙' },
  };
  let ft = { mode: 'focus', remain: MODES.focus.sec, running: false, iv: null };

  function fmtFocus(s) { return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
  function focusResetState() {
    if (!state.focus) state.focus = { date: '', todayCount: 0, total: 0 };
  }
  function renderFocus() {
    focusResetState();
    document.getElementById('focusToday').textContent = state.focus.todayCount;
    document.getElementById('focusTotal').textContent = state.focus.total;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === ft.mode));
    document.getElementById('focusEmoji').textContent = MODES[ft.mode].emoji;
    document.getElementById('focusTime').textContent = fmtFocus(ft.remain);
    document.getElementById('focusTip').textContent = ft.running ? MODES[ft.mode].tip : MODES[ft.mode].tipStart;
    document.getElementById('focusToggle').textContent = ft.running ? '暂停' : '开始';
    updateRing();
  }
  function updateRing() {
    const c = 2 * Math.PI * 100;
    const p = ft.remain / MODES[ft.mode].sec;
    const fg = document.getElementById('ringFg');
    if (fg) fg.style.strokeDashoffset = c * (1 - p);
  }
  function ringSetup() {
    const c = 2 * Math.PI * 100;
    const fg = document.getElementById('ringFg');
    if (fg) { fg.style.strokeDasharray = c; fg.style.strokeDashoffset = c; }
  }
  function setMode(m) {
    if (!MODES[m] || m === ft.mode) return;
    pauseFocus(); ft.mode = m; ft.remain = MODES[m].sec;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    renderFocus();
  }
  function toggleFocus() { ft.running ? pauseFocus() : startFocus(); }
  function startFocus() {
    focusResetState();
    if (ft.remain <= 0) ft.remain = MODES[ft.mode].sec;
    ft.running = true;
    document.getElementById('focusEmoji').classList.add('bounce');
    document.getElementById('focusToggle').textContent = '暂停';
    document.getElementById('focusTip').textContent = MODES[ft.mode].tip;
    clearInterval(ft.iv);
    ft.iv = setInterval(() => {
      ft.remain--;
      if (ft.remain <= 0) {
        ft.remain = 0; updateRing();
        document.getElementById('focusTime').textContent = '00:00';
        completeFocus(); return;
      }
      updateRing();
      document.getElementById('focusTime').textContent = fmtFocus(ft.remain);
    }, 1000);
  }
  function pauseFocus() {
    ft.running = false; clearInterval(ft.iv);
    const e = document.getElementById('focusEmoji'); if (e) e.classList.remove('bounce');
    const t = document.getElementById('focusToggle'); if (t) t.textContent = '开始';
  }
  function resetFocus() { pauseFocus(); ft.remain = MODES[ft.mode].sec; renderFocus(); }
  function completeFocus() {
    pauseFocus();
    if (ft.mode === 'focus') {
      if (state.focus.date !== todayStr()) state.focus = { date: todayStr(), todayCount: 0, total: state.focus.total || 0 };
      state.focus.todayCount++;
      state.focus.total = (state.focus.total || 0) + 1;
      state.points += FOCUS_POINTS;
      state.flows.push({ id: uid(), type: 'earn', amount: FOCUS_POINTS, reason: '番茄钟·完成一个专注', refId: '', createdAt: Date.now() });
      save(); renderPoints();
      confettiBurst();
      toast('🍅 完成一个番茄 +' + FOCUS_POINTS + '⭐');
    } else {
      toast('休息结束，继续加油！');
    }
    ft.remain = MODES[ft.mode].sec;
    renderFocus();
  }
  function confettiBurst() {
    const ring = document.querySelector('.focus-ring'); if (!ring) return;
    const emojis = ['🍅', '✨', '⭐', '🎉', '💛', '🌟'];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = 'confetti'; s.textContent = emojis[i % emojis.length];
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 70;
      s.style.setProperty('--tx', (Math.cos(a) * d) + 'px');
      s.style.setProperty('--ty', (Math.sin(a) * d) + 'px');
      ring.appendChild(s);
      setTimeout(() => s.remove(), 950);
    }
  }

  /* ---------- 底部弹层 ---------- */
  const mask = document.getElementById('sheetMask');
  const sheet = document.getElementById('sheet');
  const sheetBody = document.getElementById('sheetBody');
  const sheetTitle = document.getElementById('sheetTitle');

  function openSheet(title, html) {
    sheetTitle.textContent = title;
    sheetBody.innerHTML = html;
    mask.classList.add('show');
  }
  function closeSheet() { mask.classList.remove('show'); }

  function checkinSheet(presetId) {
    const opts = state.subjects.map(s => '<option value="' + s.id + '"' + (s.id === presetId ? ' selected' : '') + '>' + escapeHtml(s.name) + '</option>').join('');
    if (!state.subjects.length) { toast('请先到「我的」添加科目'); return; }
    openSheet('打卡',
      '<div class="field"><label>科目</label><select id="f-subj">' + opts + '</select></div>' +
      '<div class="field"><label>备注（可选）</label><textarea id="f-note" placeholder="今天学了什么？"></textarea></div>' +
      '<button class="submit-btn" id="f-submit">打卡 +' + CHECKIN_BASE + '⭐</button>'
    );
    document.getElementById('f-submit').onclick = () => {
      const id = document.getElementById('f-subj').value;
      const note = document.getElementById('f-note').value;
      closeSheet(); doCheckIn(id, note);
    };
  }
  function subjectSheet() {
    openSheet('新增科目',
      '<div class="field"><label>科目名称</label><input id="f-name" placeholder="如：物理" maxlength="8"></div>' +
      '<div class="field"><label>图标（emoji）</label><input id="f-icon" value="📘" maxlength="2"></div>' +
      '<div class="field"><label>颜色</label><div class="color-row" id="f-colors">' +
      COLORS.map((c, i) => '<span class="color-dot' + (i === 0 ? ' sel' : '') + '" data-c="' + c + '" style="background:' + c + '"></span>').join('') +
      '</div></div>' +
      '<button class="submit-btn" id="f-submit">添加</button>'
    );
    let pick = COLORS[0];
    sheetBody.querySelectorAll('.color-dot').forEach(d => d.onclick = () => {
      sheetBody.querySelectorAll('.color-dot').forEach(x => x.classList.remove('sel'));
      d.classList.add('sel'); pick = d.dataset.c;
    });
    document.getElementById('f-submit').onclick = () => addSubject(document.getElementById('f-name').value, pick, document.getElementById('f-icon').value);
  }
  function taskSheet() {
    if (!state.subjects.length) { toast('请先到「我的」添加科目'); return; }
    const opts = state.subjects.map(s => '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>').join('');
    openSheet('新增任务',
      '<div class="field"><label>任务内容</label><input id="f-title" placeholder="如：背 50 个单词" maxlength="40"></div>' +
      '<div class="field"><label>所属科目</label><select id="f-subj">' + opts + '</select></div>' +
      '<div class="field"><label>截止日期（可选）</label><input id="f-due" type="date"></div>' +
      '<div class="field"><label>完成奖励积分</label><input id="f-pts" type="number" value="' + TASK_POINTS + '" min="1"></div>' +
      '<button class="submit-btn" id="f-submit">添加</button>'
    );
    document.getElementById('f-submit').onclick = () => addTask(
      document.getElementById('f-title').value,
      document.getElementById('f-subj').value,
      document.getElementById('f-due').value,
      document.getElementById('f-pts').value
    );
  }
  function countdownSheet() {
    openSheet('新增倒数日',
      '<div class="field"><label>标题</label><input id="f-title" placeholder="如：期中考试" maxlength="20"></div>' +
      '<div class="field"><label>目标日期</label><input id="f-date" type="date"></div>' +
      '<div class="field"><label>颜色</label><div class="color-row" id="f-colors">' +
      COLORS.map((c, i) => '<span class="color-dot' + (i === 0 ? ' sel' : '') + '" data-c="' + c + '" style="background:' + c + '"></span>').join('') +
      '</div></div>' +
      '<button class="submit-btn" id="f-submit">添加</button>'
    );
    let pick = COLORS[0];
    sheetBody.querySelectorAll('.color-dot').forEach(d => d.onclick = () => {
      sheetBody.querySelectorAll('.color-dot').forEach(x => x.classList.remove('sel'));
      d.classList.add('sel'); pick = d.dataset.c;
    });
    document.getElementById('f-submit').onclick = () => addCountdown(document.getElementById('f-title').value, document.getElementById('f-date').value, pick);
  }
  function giftSheet(editId) {
    const g = editId ? state.gifts.find(x => x.id === editId) : null;
    openSheet(editId ? '编辑礼品' : '新增礼品',
      '<div class="field"><label>礼品名称</label><input id="f-gname" placeholder="如：奶茶" maxlength="12" value="' + (g ? escapeHtml(g.name) : '') + '"></div>' +
      '<div class="field"><label>图标（emoji）</label><input id="f-gicon" maxlength="2" value="' + (g ? g.icon : '🎁') + '"></div>' +
      '<div class="field"><label>兑换所需积分</label><input id="f-gpts" type="number" min="1" value="' + (g ? g.points : 100) + '"></div>' +
      '<button class="submit-btn" id="f-submit">保存</button>'
    );
    document.getElementById('f-submit').onclick = () => {
      const name = (document.getElementById('f-gname').value || '').trim();
      const icon = (document.getElementById('f-gicon').value || '').trim() || '🎁';
      const pts = Math.max(1, parseInt(document.getElementById('f-gpts').value, 10) || 100);
      if (!name) { toast('请输入礼品名'); return; }
      if (g) { g.name = name; g.icon = icon; g.points = pts; }
      else state.gifts.push({ id: uid(), name, icon, points: pts });
      save(); toast('已保存'); closeSheet();
      if (currentView === 'me') renderMe();
    };
  }
  function deleteGift(id) {
    const g = state.gifts.find(x => x.id === id); if (!g) return;
    confirmDialog('删除礼品', '确定删除「' + g.name + '」？', () => {
      state.gifts = state.gifts.filter(x => x.id !== id);
      save(); if (currentView === 'me') renderMe();
    });
  }
  function redeemGift(id) {
    const g = state.gifts.find(x => x.id === id); if (!g) return;
    if (state.points < g.points) {
      confirmDialog('积分不足', '兑换「' + g.name + '」需要 ' + g.points + ' 分，你当前有 ' + state.points + ' 分，继续加油攒积分吧～', () => {});
      return;
    }
    confirmDialog('确认兑换', '将消耗 ' + g.points + ' 分兑换「' + g.name + '」，确定？', () => {
      state.points -= g.points;
      state.flows.push({ id: uid(), type: 'spend', amount: g.points, reason: '兑换·' + g.name, refId: '', createdAt: Date.now() });
      save(); renderPoints(); renderMe();
      toast('兑换成功 🎉 消耗 ' + g.points + ' 分');
    });
  }

  /* ---------- 应用内确认弹层（替代原生 confirm） ---------- */
  function confirmDialog(title, msg, onOk) {
    const mask = document.getElementById('confirmMask');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;
    const ok = document.getElementById('confirmOk');
    const cancel = document.getElementById('confirmCancel');
    mask.classList.add('show');
    ok.onclick = () => { mask.classList.remove('show'); onOk(); };
    cancel.onclick = () => { mask.classList.remove('show'); };
    mask.onclick = (e) => { if (e.target === mask) mask.classList.remove('show'); };
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    // 底部导航
    document.getElementById('bottomNav').addEventListener('click', e => {
      const b = e.target.closest('.nav-btn'); if (b) switchView(b.dataset.view);
    });
    // 走马灯
    document.getElementById('marqPrev').onclick = () => goMarquee(mIndex - 1);
    document.getElementById('marqNext').onclick = () => goMarquee(mIndex + 1);
    // FAB
    document.getElementById('fab').onclick = () => {
      if (currentView === 'tasks') taskSheet();
      else if (currentView === 'countdown') countdownSheet();
      else if (currentView === 'me') giftSheet();
      else checkinSheet();
    };
    // 番茄钟
    document.querySelectorAll('.mode-btn').forEach(b => b.onclick = () => setMode(b.dataset.mode));
    document.getElementById('focusToggle').onclick = toggleFocus;
    document.getElementById('focusReset').onclick = resetFocus;
    // 弹层关闭
    document.getElementById('sheetClose').onclick = closeSheet;
    mask.addEventListener('click', e => { if (e.target === mask) closeSheet(); });
    // 「我的」内按钮
    document.getElementById('addSubjectBtn').onclick = subjectSheet;
    document.getElementById('addGiftBtn').onclick = () => giftSheet();
    document.getElementById('addCountdownBtn').onclick = countdownSheet;
    document.getElementById('resetBtn').onclick = resetAll;

    // 科目筛选（任务）
    document.getElementById('taskFilter').onchange = renderTasks;
    document.getElementById('historyFilter').onchange = renderMe;

    // 首页 / 打卡页：科目芯片点击 → 打卡
    document.getElementById('view-home').addEventListener('click', e => {
      const c = e.target.closest('.subj-chip'); if (c) doCheckIn(c.dataset.subj, '');
      const t = e.target.closest('.task'); if (t) onTaskClick(t, e.target);
    });
    document.getElementById('view-checkin').addEventListener('click', e => {
      const c = e.target.closest('.subj-chip'); if (c) checkinSheet(c.dataset.subj);
    });
    // 任务页：科目删除 + 任务点击
    document.getElementById('view-tasks').addEventListener('click', e => {
      const del = e.target.closest('[data-subj-del]'); if (del) { deleteSubject(del.dataset.subjDel); return; }
      const t = e.target.closest('.task'); if (t) onTaskClick(t, e.target);
    });
    // 倒数日删除
    document.getElementById('view-countdown').addEventListener('click', e => {
      const d = e.target.closest('[data-cd]'); if (d) deleteCountdown(d.dataset.cd);
    });
    // 我的：礼品兑换 / 编辑 / 删除 + 任务点击
    document.getElementById('view-me').addEventListener('click', e => {
      const r = e.target.closest('[data-redeem]'); if (r) { redeemGift(r.dataset.redeem); return; }
      const ed = e.target.closest('[data-gift-edit]'); if (ed) { giftSheet(ed.dataset.giftEdit); return; }
      const dl = e.target.closest('[data-gift-del]'); if (dl) { deleteGift(dl.dataset.giftDel); return; }
      const t = e.target.closest('.task'); if (t) onTaskClick(t, e.target);
    });
  }
  function onTaskClick(t, target) {
    const id = t.dataset.task; if (!id) return;
    if (target.closest('[data-act="del"]')) deleteTask(id);
    else completeTask(id);
  }

  /* ---------- 底部栏反光：随滚动角度缓动 ---------- */
  function bindSheen() {
    const navEl = document.getElementById('bottomNav');
    let raf = 0;
    function update() {
      raf = 0;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      // 用滚动位置驱动一条斜向反光的纵向位移与倾斜，模拟光线角度变化
      navEl.style.setProperty('--sheen-y', (Math.cos(y / 90) * 5).toFixed(2));
      navEl.style.setProperty('--sheen-skew', (Math.sin(y / 70) * 5).toFixed(2));
    }
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  /* ---------- 启动 ---------- */
  function init() {
    bind();
    bindSheen();
    ringSetup();
    startMarquee();
    switchView('home');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
