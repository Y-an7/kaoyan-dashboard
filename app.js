/* ============================================================
 * 考研每日工作台 · 应用逻辑
 * 依赖 plan.js（EXAM_DATE / SUBJECTS / PHASES / SCHEDULE / DAYS）
 * ============================================================ */

const STORAGE_KEY = 'kaoyan-dashboard-state-v1';

/* ---------- 各科现状（用于「各科」页展示） ---------- */
const SUBJECT_STATUS = {
  math:     '高数强化到二重积分，线代/概率论未开始 → 10/4 起收尾高数，10/11 线代，10/22 概率论',
  english:  '真题一刷完、二刷+小三门已开始 → 补上作文(25分)，10/10 起手',
  politics: '0 基础 → 10/4 起跟强化课(马原起手)+肖1000，12 月靠肖8+肖4',
  major:    '货币金融过了武玄宇十讲、公司理财(罗斯)刚开始 → 10 月刷完公司理财+货币金融二轮',
};

const TIPS = [
  '数学：强化以「会做真题」为准，不恋战；11/3 起真题一刷是绝对主线。',
  '政治：0 基础也来得及，但每天必须雷打不动 1-1.5h；选择靠肖1000+肖8+肖4，主观题靠肖4背熟。',
  '英语：单词全程不断；<b>作文 25 分</b> 10 月中必须起手，别拖到 12 月。',
  '专业课：背诵量大（名词/简答/论述），12 月留足背诵时间；计算题全在公司理财。',
  '以终为始：每天只做对「考试得分」有直接贡献的事，反推今天必须完成什么。',
  '主攻真题：数学/英语/专业课以真题为核心，政治以肖题为核心。',
];

const DEFAULT_TASK_KEYS = ['math', 'english', 'politics', 'major'];

/* ================= 日期工具 ================= */
function pad(n) { return String(n).padStart(2, '0'); }
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return toDateStr(new Date()); }

function daysBetween(from, to) {
  const a = new Date(from + 'T00:00:00');
  const b = new Date(to + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

/* ================= 状态 ================= */
let state = loadState();

function defaultDay() {
  const t = {};
  DEFAULT_TASK_KEYS.forEach(k => (t[k] = false));
  return { tasks: t, schedule: {}, reflection: '', custom: [] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === 'object') return { examDate: EXAM_DATE, days: {}, ...s };
    }
  } catch (e) { console.warn('读取存档失败，使用默认', e); }
  return { examDate: EXAM_DATE, days: {} };
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('保存失败', e); }
}

function getDay(date) {
  if (!state.days[date]) state.days[date] = defaultDay();
  return state.days[date];
}

/* ================= 计划数据查找 ================= */
function planDayFor(dateStr) {
  // 返回日期 >= dateStr 的第一天（无则最后一天）
  return DAYS.find(d => d.date >= dateStr) || DAYS[DAYS.length - 1];
}
function planDayExact(dateStr) {
  return DAYS.find(d => d.date === dateStr) || null;
}

function subjectOf(key) { return SUBJECTS.find(s => s.key === key); }

/* ================= 渲染：顶部与倒计时 ================= */
function renderTopbar() {
  document.getElementById('topbar-date').textContent =
    `考试 ${state.examDate} · 西南财经大学 金融专硕`;
  const left = daysBetween(todayStr(), state.examDate);
  const pill = document.getElementById('countdown-pill');
  if (left > 0) pill.textContent = `倒计时 ${left} 天`;
  else if (left === 0) pill.textContent = '今天考试！';
  else pill.textContent = '考试已结束';
}

function renderHero() {
  const left = daysBetween(todayStr(), state.examDate);
  document.getElementById('hero-count').textContent = left > 0 ? left : '—';
  const day = planDayFor(todayStr());
  const isToday = day.date === todayStr();
  document.getElementById('hero-day').textContent =
    `${isToday ? '今天是计划第' : '下一个计划日是第'} ${day.day} 天 · ${day.date}`;
  document.getElementById('hero-sub').textContent =
    day.phase ? `当前阶段：${day.phase.name}（${day.phase.range}）` : '';
}

/* ================= 渲染：今日任务 ================= */
function taskItemsFor(date) {
  const entry = planDayExact(date);
  const d = getDay(date);
  const items = [];
  if (entry) {
    DEFAULT_TASK_KEYS.forEach(key => {
      const text = entry.tasks[key];
      if (text) items.push({ id: key, subject: key, text, done: !!d.tasks[key], custom: false });
    });
  }
  d.custom.forEach(c => items.push({ id: c.id, subject: null, text: c.text, done: c.done, custom: true }));
  return { items, day: d, entry };
}

function renderTasks(date) {
  const entry = planDayExact(date);
  const { items, day } = taskItemsFor(date);
  const list = document.getElementById('task-list');

  document.getElementById('task-day-label').textContent =
    entry ? `（${entry.date} · 第${entry.day}天${entry.date === todayStr() ? '' : ' · 预览'}）`
          : '（今天不在计划区间内）';

  list.innerHTML = '';
  items.forEach(it => {
    const li = document.createElement('li');
    li.className = 'task-item';
    const subj = it.subject ? subjectOf(it.subject) : null;

    const check = document.createElement('div');
    check.className = 'task-check' + (it.done ? ' done' : '');
    check.textContent = it.done ? '✓' : '';
    check.addEventListener('click', () => toggleTask(date, it.id, it.custom));

    const badge = document.createElement('span');
    badge.className = 'task-subject';
    if (subj) {
      badge.textContent = subj.short;
      badge.style.color = subj.color;
      badge.style.background = subj.color + '1a';
    } else {
      badge.textContent = '自定';
      badge.style.color = '#64748b';
      badge.style.background = '#f1f5f9';
    }

    const text = document.createElement('span');
    text.className = 'task-text' + (it.done ? ' done' : '');
    text.textContent = it.text;

    li.appendChild(check);
    li.appendChild(badge);
    li.appendChild(text);

    if (it.custom) {
      const del = document.createElement('button');
      del.className = 'task-del';
      del.textContent = '×';
      del.addEventListener('click', () => removeCustomTask(date, it.id));
      li.appendChild(del);
    }
    list.appendChild(li);
  });

  renderProgress(date, items);
}

function toggleTask(date, id, custom) {
  const d = getDay(date);
  if (custom) {
    const c = d.custom.find(x => x.id === id);
    if (c) c.done = !c.done;
  } else {
    d.tasks[id] = !d.tasks[id];
  }
  saveState();
  renderTasks(date);
}

function removeCustomTask(date, id) {
  const d = getDay(date);
  d.custom = d.custom.filter(x => x.id !== id);
  saveState();
  renderTasks(date);
}

function addCustomTask(date) {
  const input = document.getElementById('new-task-input');
  const text = input.value.trim();
  if (!text) return;
  const d = getDay(date);
  d.custom.push({ id: 'c' + Date.now(), text, done: false });
  input.value = '';
  saveState();
  renderTasks(date);
}

function renderProgress(date, items) {
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('today-percent').textContent = `${done}/${total} · ${pct}%`;
  document.getElementById('today-fill').style.width = pct + '%';
}

/* ================= 渲染：今日课表 ================= */
function renderSchedule(date) {
  const d = getDay(date);
  const list = document.getElementById('schedule-list');
  list.innerHTML = '';
  SCHEDULE.forEach(b => {
    const li = document.createElement('li');
    li.className = 'schedule-item';
    const done = !!d.schedule[b.time];

    const time = document.createElement('span');
    time.className = 'schedule-time';
    time.textContent = b.time;

    const label = document.createElement('span');
    label.className = 'schedule-label';
    label.textContent = b.label;
    if (done) label.style.textDecoration = 'line-through';

    const dot = document.createElement('span');
    dot.className = 'schedule-dot';
    if (b.subject) {
      const subj = subjectOf(b.subject);
      dot.style.background = done ? subj.color : subj.color + '55';
    } else {
      dot.style.background = done ? '#94a3b8' : '#e2e8f0';
    }

    li.appendChild(time);
    li.appendChild(dot);
    li.appendChild(label);
    li.addEventListener('click', () => {
      d.schedule[b.time] = !d.schedule[b.time];
      saveState();
      renderSchedule(date);
    });
    list.appendChild(li);
  });
}

/* ================= 渲染：复盘 ================= */
function renderReflection(date) {
  const el = document.getElementById('reflection');
  el.value = getDay(date).reflection || '';
}

/* ================= 渲染：计划总览 ================= */
function renderPhases() {
  const today = todayStr();
  const list = document.getElementById('phase-list');
  list.innerHTML = '';
  PHASES.forEach(p => {
    const start = phaseStartDate(p);
    const end = phaseEndDate(p);
    let cls = 'phase-item';
    let nowTag = '';
    if (today >= start && today <= end) { cls += ' now'; nowTag = '<span class="phase-now-tag">进行中</span>'; }
    else if (today > end) { cls += ' done'; }

    const div = document.createElement('div');
    div.className = cls;
    div.innerHTML = `
      <div class="phase-head">
        <span class="phase-key">${p.key}</span>
        <span class="phase-name">${p.name}${nowTag}</span>
        <span class="phase-days">${p.days}天</span>
      </div>
      <div class="phase-range">${p.range}</div>
      <div class="phase-note">${p.note}</div>`;
    list.appendChild(div);
  });
}

/* ================= 渲染：某一天详情 ================= */
function renderDayDetail(dateStr) {
  const entry = planDayExact(dateStr);
  const box = document.getElementById('day-detail');
  if (!entry) {
    box.innerHTML = '<p class="muted">该日期不在 10/4-12/18 计划区间内。</p>';
    return;
  }
  const d = getDay(dateStr);
  let html = `<div style="margin-bottom:10px;"><b>第 ${entry.day} 天 · ${entry.date}</b>` +
    (entry.phase ? `<span class="muted"> · ${entry.phase.name}</span>` : '') + `</div>`;
  DEFAULT_TASK_KEYS.forEach(key => {
    const subj = subjectOf(key);
    const text = entry.tasks[key];
    const done = !!d.tasks[key];
    html += `
      <div class="task-item" style="border-bottom:none;">
        <div class="task-check ${done ? 'done' : ''}" data-toggle="${key}">${done ? '✓' : ''}</div>
        <span class="task-subject" style="color:${subj.color};background:${subj.color}1a;">${subj.short}</span>
        <span class="task-text ${done ? 'done' : ''}">${text}</span>
      </div>`;
  });
  box.innerHTML = html;
  box.querySelectorAll('[data-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.getAttribute('data-toggle');
      const day = getDay(dateStr);
      day.tasks[key] = !day.tasks[key];
      saveState();
      renderDayDetail(dateStr);
    });
  });
}

/* ================= 渲染：各科 ================= */
function renderSubjects() {
  const list = document.getElementById('subject-list');
  list.innerHTML = '';
  SUBJECTS.forEach(s => {
    const done = DEFAULT_TASK_KEYS.includes(s.key)
      ? Object.values(state.days).filter(d => d.tasks && d.tasks[s.key]).length : 0;
    const pct = Math.round((done / DAYS.length) * 100);

    const div = document.createElement('div');
    div.className = 'subject-item';
    div.innerHTML = `
      <div class="subject-head">
        <span class="subject-dot" style="background:${s.color};"></span>
        <span class="subject-name">${s.name}</span>
        <span class="subject-score">目标 ${s.target} / ${s.score}</span>
      </div>
      <div class="subject-target">${s.exam}</div>
      <div class="subject-bar"><div class="subject-fill" style="width:${pct}%;background:${s.color};"></div></div>
      <div class="subject-target">坚持 ${done}/${DAYS.length} 天 · ${pct}%</div>
      <div class="subject-target" style="margin-top:6px;">${SUBJECT_STATUS[s.key] || ''}</div>`;
    list.appendChild(div);
  });
}

function renderTips() {
  const list = document.getElementById('tips-list');
  list.innerHTML = '';
  TIPS.forEach(t => {
    const li = document.createElement('li');
    li.innerHTML = t;
    list.appendChild(li);
  });
}

/* ================= 渲染：设置 ================= */
function renderSettings() {
  document.getElementById('exam-date').value = state.examDate;
  const hint = document.getElementById('install-hint');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  hint.textContent = isStandalone
    ? '已安装为应用，支持离线使用。'
    : '部署上线后：安卓手机用 Chrome 打开网址 → 右上角菜单「安装应用 / 添加到主屏幕」→ 桌面出现图标，点开即用。';
}

/* ================= 视图切换 ================= */
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById('view-' + name);
  if (sec) sec.classList.add('active');
  const btn = document.querySelector('.nav-btn[data-view="' + name + '"]');
  if (btn) btn.classList.add('active');
  if (name === 'plan') renderPhases();
  if (name === 'subjects') { renderSubjects(); renderTips(); }
  if (name === 'settings') renderSettings();
  window.scrollTo(0, 0);
}

/* ================= 备份 / 恢复 ================= */
function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kaoyan-backup-' + todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(json) {
  try {
    const s = JSON.parse(json);
    if (!s || typeof s !== 'object' || !s.days) throw new Error('格式不对');
    state = { examDate: EXAM_DATE, days: {}, ...s };
    saveState();
    renderAll();
    switchView('today');
    alert('导入成功');
  } catch (e) {
    alert('导入失败：' + e.message);
  }
}

/* ================= 初始化 ================= */
function renderToday() {
  const date = todayStr();
  renderTasks(date);
  renderSchedule(date);
  renderReflection(date);
}

function renderAll() {
  renderTopbar();
  renderHero();
  renderToday();
  renderPhases();
  renderSubjects();
  renderTips();
  renderSettings();
}

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.addEventListener('click', () => switchView(b.dataset.view)));

  document.getElementById('add-task-btn').addEventListener('click', () => addCustomTask(todayStr()));
  document.getElementById('new-task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addCustomTask(todayStr());
  });

  document.getElementById('reflection').addEventListener('input', e => {
    getDay(todayStr()).reflection = e.target.value;
    saveState();
  });

  document.getElementById('exam-date').addEventListener('change', e => {
    if (!e.target.value) return;
    state.examDate = e.target.value;
    saveState();
    renderTopbar();
    renderHero();
  });

  // 计划页：某一天查看
  const picker = document.getElementById('day-picker');
  picker.value = todayStr();
  picker.addEventListener('change', e => renderDayDetail(e.target.value));
  document.getElementById('day-prev').addEventListener('click', () => {
    picker.value = shiftDate(picker.value, -1);
    renderDayDetail(picker.value);
  });
  document.getElementById('day-next').addEventListener('click', () => {
    picker.value = shiftDate(picker.value, 1);
    renderDayDetail(picker.value);
  });
  renderDayDetail(picker.value);

  // 备份
  document.getElementById('export-btn').addEventListener('click', exportBackup);
  document.getElementById('import-btn').addEventListener('click', () =>
    document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => importData(reader.result);
    reader.readAsText(f);
    e.target.value = '';
  });
  document.getElementById('paste-import-btn').addEventListener('click', () =>
    importData(document.getElementById('import-text').value));

  // 每天首次打开，刷新「今天」
  window.addEventListener('focus', () => { renderTopbar(); renderHero(); renderToday(); });
}

function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}

renderAll();
bindEvents();
