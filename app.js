/* ============================================================
 * 考研每日工作台 · 应用逻辑
 * 依赖 plan.js（EXAM_DATE / SUBJECTS / PHASES / SCHEDULE / DAYS）
 * 每天任务可自由编辑 / 添加 / 删除；另有「我的自定义计划」清单。
 * ============================================================ */

const STORAGE_KEY = 'kaoyan-dashboard-state-v2';

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
function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}
function daysBetween(from, to) {
  const a = new Date(from + 'T00:00:00');
  const b = new Date(to + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

/* ================= 状态 ================= */
let state = loadState();
let editingId = null;      // 正在编辑的任务 id（今日/某天 共用）
let editingPlanId = null;  // 正在编辑的自定义计划 id

function seedTasks(date) {
  const entry = planDayExact(date);
  const tasks = [];
  if (entry) {
    DEFAULT_TASK_KEYS.forEach(k => {
      if (entry.tasks[k]) tasks.push({ id: k, subject: k, text: entry.tasks[k], done: false });
    });
  }
  return tasks;
}

function defaultDay(date) {
  return { tasks: seedTasks(date), schedule: {}, reflection: '' };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === 'object') {
        return { examDate: EXAM_DATE, days: {}, plans: [], ...s };
      }
    }
  } catch (e) { console.warn('读取存档失败，使用默认', e); }
  return { examDate: EXAM_DATE, days: {}, plans: [] };
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('保存失败', e); }
}

function getDay(date) {
  if (!state.days[date]) state.days[date] = defaultDay(date);
  return state.days[date];
}

/* ================= 计划数据查找 ================= */
function planDayFor(dateStr) {
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

/* ================= 任务渲染（可编辑） ================= */
function fillSubjectSelect(sel) {
  sel.innerHTML = '';
  SUBJECTS.forEach(s => {
    const o = document.createElement('option');
    o.value = s.key;
    o.textContent = s.short;
    sel.appendChild(o);
  });
  const o = document.createElement('option');
  o.value = '';
  o.textContent = '自定';
  sel.appendChild(o);
}

function appendTaskRow(listEl, date, t) {
  const li = document.createElement('li');
  li.className = 'task-item';

  const check = document.createElement('div');
  check.className = 'task-check' + (t.done ? ' done' : '');
  check.textContent = t.done ? '✓' : '';
  check.addEventListener('click', () => { t.done = !t.done; saveState(); refreshTaskViews(); });
  li.appendChild(check);

  const subj = t.subject ? subjectOf(t.subject) : null;
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
  li.appendChild(badge);

  if (editingId === t.id) {
    const input = document.createElement('input');
    input.className = 'task-input';
    input.value = t.text;
    input.dataset.id = t.id;
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      else if (e.key === 'Escape') { editingId = null; refreshTaskViews(); }
    });
    input.addEventListener('blur', () => commitEditTask(date, input));
    li.appendChild(input);
    setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 0);
  } else {
    const text = document.createElement('span');
    text.className = 'task-text' + (t.done ? ' done' : '');
    text.textContent = t.text;
    li.appendChild(text);

    const editBtn = document.createElement('button');
    editBtn.className = 'task-edit';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', () => { editingId = t.id; refreshTaskViews(); });
    li.appendChild(editBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'task-del';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', () => deleteTask(date, t.id));
  li.appendChild(delBtn);

  listEl.appendChild(li);
}

function renderTodayTasks() {
  const date = todayStr();
  const entry = planDayExact(date);
  const d = getDay(date);
  const list = document.getElementById('task-list');
  document.getElementById('task-day-label').textContent =
    entry ? `（${entry.date} · 第${entry.day}天）`
          : '（今天不在计划区间内，可自由添加）';
  list.innerHTML = '';
  d.tasks.forEach(t => appendTaskRow(list, date, t));
  renderProgress(d.tasks);
}

function renderProgress(tasks) {
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('today-percent').textContent = `${done}/${total} · ${pct}%`;
  document.getElementById('today-fill').style.width = pct + '%';
}

function refreshTaskViews() {
  renderTodayTasks();
  const picker = document.getElementById('day-picker');
  if (picker && picker.value) renderDayDetail(picker.value);
}

function commitEditTask(date, input) {
  const id = input.dataset.id;
  const val = input.value.trim();
  const d = getDay(date);
  const t = d.tasks.find(x => x.id === id);
  if (t) {
    if (val) t.text = val;
    else d.tasks = d.tasks.filter(x => x.id !== id);
  }
  editingId = null;
  saveState();
  refreshTaskViews();
}

function deleteTask(date, id) {
  const d = getDay(date);
  d.tasks = d.tasks.filter(x => x.id !== id);
  editingId = null;
  saveState();
  refreshTaskViews();
}

function addTask(date, subjectKey, text) {
  if (!text) return;
  const d = getDay(date);
  d.tasks.push({ id: 't' + Date.now(), subject: subjectKey || null, text, done: false });
  saveState();
  refreshTaskViews();
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
  document.getElementById('reflection').value = getDay(date).reflection || '';
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

/* ================= 渲染：某一天（可编辑） ================= */
function renderDayDetail(dateStr) {
  const box = document.getElementById('day-detail');
  box.innerHTML = '';
  const entry = planDayExact(dateStr);
  const d = getDay(dateStr);

  const header = document.createElement('div');
  header.style.marginBottom = '10px';
  header.innerHTML = entry
    ? `<b>第 ${entry.day} 天 · ${entry.date}</b>${entry.phase ? `<span class="muted"> · ${entry.phase.name}</span>` : ''}`
    : `<b>${dateStr}</b> <span class="muted">（不在计划区间内，可自由添加任务）</span>`;
  box.appendChild(header);

  const list = document.createElement('ul');
  list.className = 'task-list';
  d.tasks.forEach(t => appendTaskRow(list, dateStr, t));
  box.appendChild(list);

  const addRow = document.createElement('div');
  addRow.className = 'add-task';
  const sel = document.createElement('select');
  fillSubjectSelect(sel);
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = '添加任务…';
  const btn = document.createElement('button');
  btn.textContent = '＋';
  const doAdd = () => { addTask(dateStr, sel.value, inp.value.trim()); };
  btn.addEventListener('click', doAdd);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
  addRow.appendChild(sel);
  addRow.appendChild(inp);
  addRow.appendChild(btn);
  box.appendChild(addRow);
}

/* ================= 渲染：我的自定义计划 ================= */
function renderPlans() {
  const list = document.getElementById('plan-list');
  list.innerHTML = '';
  state.plans.forEach(p => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const check = document.createElement('div');
    check.className = 'task-check' + (p.done ? ' done' : '');
    check.textContent = p.done ? '✓' : '';
    check.addEventListener('click', () => { p.done = !p.done; saveState(); renderPlans(); });
    li.appendChild(check);

    if (editingPlanId === p.id) {
      const input = document.createElement('input');
      input.className = 'task-input';
      input.value = p.text;
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        else if (e.key === 'Escape') { editingPlanId = null; renderPlans(); }
      });
      input.addEventListener('blur', () => {
        const v = input.value.trim();
        if (v) p.text = v; else state.plans = state.plans.filter(x => x.id !== p.id);
        editingPlanId = null;
        saveState();
        renderPlans();
      });
      li.appendChild(input);
      setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 0);
    } else {
      const text = document.createElement('span');
      text.className = 'task-text' + (p.done ? ' done' : '');
      text.textContent = p.text;
      li.appendChild(text);

      const editBtn = document.createElement('button');
      editBtn.className = 'task-edit';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', () => { editingPlanId = p.id; renderPlans(); });
      li.appendChild(editBtn);
    }

    const del = document.createElement('button');
    del.className = 'task-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      state.plans = state.plans.filter(x => x.id !== p.id);
      saveState();
      renderPlans();
    });
    li.appendChild(del);
    list.appendChild(li);
  });
}

function addPlan(text) {
  if (!text) return;
  state.plans.push({ id: 'p' + Date.now(), text, done: false });
  saveState();
  renderPlans();
}

/* ================= 渲染：各科 ================= */
function renderSubjects() {
  const list = document.getElementById('subject-list');
  list.innerHTML = '';
  SUBJECTS.forEach(s => {
    const done = Object.values(state.days).filter(d =>
      d.tasks && d.tasks.some(t => t.subject === s.key && t.done)
    ).length;
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
      <div class="subject-target">已坚持 ${done}/${DAYS.length} 天 · ${pct}%</div>
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
    : '安卓手机用 Chrome 打开网址 → 右上角菜单「安装应用 / 添加到主屏幕」→ 桌面出现图标。';
}

/* ================= 视图切换 ================= */
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById('view-' + name);
  if (sec) sec.classList.add('active');
  const btn = document.querySelector('.nav-btn[data-view="' + name + '"]');
  if (btn) btn.classList.add('active');
  if (name === 'plan') { renderPhases(); renderPlans(); }
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
    if (!s || typeof s !== 'object') throw new Error('格式不对');
    state = { examDate: EXAM_DATE, days: {}, plans: [], ...s };
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
  renderTodayTasks();
  renderSchedule(date);
  renderReflection(date);
}

function renderAll() {
  renderTopbar();
  renderHero();
  renderToday();
  renderPhases();
  renderPlans();
  renderSubjects();
  renderTips();
  renderSettings();
}

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.addEventListener('click', () => switchView(b.dataset.view)));

  fillSubjectSelect(document.getElementById('new-task-subject'));

  const doAddToday = () => {
    const sel = document.getElementById('new-task-subject');
    const inp = document.getElementById('new-task-input');
    addTask(todayStr(), sel.value, inp.value.trim());
  };
  document.getElementById('add-task-btn').addEventListener('click', doAddToday);
  document.getElementById('new-task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doAddToday();
  });

  const doAddPlan = () => addPlan(document.getElementById('new-plan-input').value.trim());
  document.getElementById('add-plan-btn').addEventListener('click', doAddPlan);
  document.getElementById('new-plan-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doAddPlan();
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

  window.addEventListener('focus', () => { renderTopbar(); renderHero(); renderToday(); });
}

renderAll();
bindEvents();
