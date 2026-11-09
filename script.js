/* ═══════════════════════════════════════════
   СтудБюджет PRO — state + tabs + charts
   ═══════════════════════════════════════════ */

const STORAGE_KEY = 'studbudget_pro_v1';

const CATEGORIES = {
  'Еда':         { color: '#2fd67a' },
  'Транспорт':   { color: '#3d8bff' },
  'Учёба':       { color: '#a06bff' },
  'Развлечения': { color: '#ffc857' },
  'Жильё':       { color: '#ff6b9d' },
  'Здоровье':    { color: '#00d4d4' },
  'Другое':      { color: '#7c8698' },
};

const state = {
  budget: 0,
  expenses: [],  // { id, amount, category, desc, date }
  goals: [],     // { id, name, target, saved }
};

/* ═══ Утилиты ═══ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const formatMoney = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch (e) { console.warn('Load error', e); }
}

/* ═══ Табы ═══ */
function switchTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
  if (name === 'analytics') renderAnalytics();
  if (name === 'goals')     renderGoals();
  if (name === 'overview')  renderOverview();
  if (name === 'expenses')  renderExpenses();
}

$$('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
$$('[data-jump]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.jump)));

/* ═══ Обзор ═══ */
function renderOverview() {
  const spent = state.expenses.reduce((s, e) => s + e.amount, 0);
  const left = state.budget - spent;
  const realPct = state.budget > 0 ? (spent / state.budget) * 100 : 0;

  $('#spentValue').textContent = formatMoney(spent);
  $('#leftValue').textContent = formatMoney(left);
  $('#leftValue').classList.toggle('negative', left < 0);
  $('#percentValue').textContent = Math.round(realPct) + '%';

  const bar = $('#progressBar');
  bar.style.width = Math.min(realPct, 100) + '%';
  bar.classList.remove('warn', 'danger');
  if (realPct >= 90) bar.classList.add('danger');
  else if (realPct >= 60) bar.classList.add('warn');

  // Последние траты
  const recent = $('#recentList');
  recent.innerHTML = '';
  const last3 = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  if (last3.length === 0) {
    $('#recentEmpty').style.display = 'block';
  } else {
    $('#recentEmpty').style.display = 'none';
    last3.forEach(e => recent.appendChild(buildExpenseItem(e)));
  }

  // Превью целей
  const goalsPrev = $('#goalsPreview');
  goalsPrev.innerHTML = '';
  const active = state.goals.slice(0, 3);
  if (active.length === 0) {
    $('#goalsEmpty').style.display = 'block';
  } else {
    $('#goalsEmpty').style.display = 'none';
    active.forEach(g => {
      const pct = Math.min(g.saved / g.target * 100, 100);
      const div = document.createElement('div');
      div.className = 'goal-mini';
      div.innerHTML = `
        <span class="goal-mini-name">${escapeHtml(g.name)}</span>
        <span class="goal-mini-amounts">${formatMoney(g.saved)} / ${formatMoney(g.target)}</span>
        <div class="goal-mini-bar"><div class="goal-mini-fill" style="width:${pct}%"></div></div>
      `;
      goalsPrev.appendChild(div);
    });
  }
}

/* ═══ Траты ═══ */
function buildExpenseItem(e) {
  const li = document.createElement('li');
  li.className = 'expense-item';
  const color = CATEGORIES[e.category]?.color || '#7c8698';
  const date = new Date(e.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

  const hasDesc = !!(e.desc && e.desc.trim());
  const title = hasDesc ? e.desc : e.category;
  const sub   = hasDesc ? `${e.category} · ${date}` : date;
  const titleClass = hasDesc ? 'expense-title' : 'expense-title expense-title--bold';

  li.innerHTML = `
    <span class="cat-dot" style="background:${color}"></span>
    <div class="expense-info">
      <span class="${titleClass}">${escapeHtml(title)}</span>
      <span class="expense-cat">${escapeHtml(sub)}</span>
    </div>
    <span class="expense-amount">−${formatMoney(e.amount)}</span>
    <button class="delete-btn" data-id="${e.id}" title="Удалить">×</button>
  `;
  return li;
}

function renderExpenses() {
  const cat = $('#filterCategory').value;
  const q = $('#filterSearch').value.trim().toLowerCase();

  const filtered = state.expenses
    .filter(e => !cat || e.category === cat)
    .filter(e => !q || (e.desc || '').toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));

  const list = $('#expenseList');
  list.innerHTML = '';
  $('#countBadge').textContent = state.expenses.length;

  if (filtered.length === 0) {
    $('#expensesEmpty').style.display = 'block';
  } else {
    $('#expensesEmpty').style.display = 'none';
    filtered.forEach(e => list.appendChild(buildExpenseItem(e)));
  }
}

/* Делегирование удаления — работает для всех списков */
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.delete-btn');
  if (!btn) return;
  state.expenses = state.expenses.filter(x => x.id !== btn.dataset.id);
  saveState();
  renderAll();
});

/* Форма добавления траты */
$('#expenseForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const amount = Number($('#amountInput').value);
  const category = $('#categorySelect').value;
  const desc = $('#descInput').value.trim();
  if (!amount || amount <= 0 || !category) return;

  state.expenses.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    amount, category, desc,
    date: new Date().toISOString(),
  });
  saveState();
  renderAll();
  ev.target.reset();
  $('#amountInput').focus();
});

/* Фильтры */
$('#filterCategory').addEventListener('change', renderExpenses);
$('#filterSearch').addEventListener('input', renderExpenses);

/* ═══ Аналитика ═══ */
function renderAnalytics() {
  renderDonut();
  renderBars();
  renderMetrics();
}

function renderDonut() {
  const g = $('#donutSegments');
  g.innerHTML = '';

  const totals = {};
  state.expenses.forEach(e => {
    totals[e.category] = (totals[e.category] || 0) + e.amount;
  });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (total === 0) {
    $('#analyticsEmpty').style.display = 'block';
    $('#donutTotal').textContent = '0 ₽';
    $('#categoryLegend').innerHTML = '';
    return;
  }
  $('#analyticsEmpty').style.display = 'none';

  const r = 45;
  const C = 2 * Math.PI * r;
  let angle = -90;

  entries.forEach(([cat, amount]) => {
    const pct = amount / total;
    const len = pct * C;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', 60);
    circle.setAttribute('cy', 60);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', CATEGORIES[cat]?.color || '#7c8698');
    circle.setAttribute('stroke-width', 16);
    circle.setAttribute('stroke-dasharray', `${len} ${C}`);
    circle.setAttribute('transform', `rotate(${angle} 60 60)`);
    g.appendChild(circle);
    angle += pct * 360;
  });

  $('#donutTotal').textContent = formatMoney(total);

  const legend = $('#categoryLegend');
  legend.innerHTML = '';
  entries.forEach(([cat, amount]) => {
    const pct = Math.round((amount / total) * 100);
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-dot" style="background:${CATEGORIES[cat]?.color || '#7c8698'}"></span>
      <span class="legend-name">${cat}</span>
      <span class="legend-pct">${pct}%</span>
      <span class="legend-val">${formatMoney(amount)}</span>
    `;
    legend.appendChild(item);
  });
}

function renderBars() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString('ru-RU', { month: 'short' }),
    });
  }

  const totals = months.map(m =>
    state.expenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      })
      .reduce((s, e) => s + e.amount, 0)
  );
  const max = Math.max(...totals, 1);

  const chart = $('#barsChart');
  chart.innerHTML = '';
  months.forEach((m, i) => {
    const h = totals[i] / max * 100;
    const col = document.createElement('div');
    col.className = 'bar-col';
    col.innerHTML = `
      <div class="bar-value">${totals[i] > 0 ? (totals[i] / 1000).toFixed(0) + 'k' : ''}</div>
      <div class="bar-track">
        <div class="bar-fill" style="height:${totals[i] > 0 ? Math.max(h, 3) : 0}%"></div>
      </div>
      <div class="bar-label">${m.label}</div>
    `;
    chart.appendChild(col);
  });
}

function renderMetrics() {
  const now = new Date();
  const thisMonth = state.expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthSum = thisMonth.reduce((s, e) => s + e.amount, 0);
  const days = now.getDate();
  $('#avgDaily').textContent = formatMoney(days ? monthSum / days : 0);

  const totals = {};
  state.expenses.forEach(e => totals[e.category] = (totals[e.category] || 0) + e.amount);
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  $('#topCategory').textContent = top ? top[0] : '—';
  $('#totalCount').textContent = state.expenses.length;
}

/* ═══ Цели ═══ */
function renderGoals() {
  const wrap = $('#goalsList');
  wrap.innerHTML = '';

  if (state.goals.length === 0) {
    $('#goalsListEmpty').style.display = 'block';
    return;
  }
  $('#goalsListEmpty').style.display = 'none';

  state.goals.forEach(g => {
    const pct = Math.min((g.saved / g.target) * 100, 100);
    const card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML = `
      <div class="goal-head">
        <span class="goal-name">${escapeHtml(g.name)}</span>
        <button class="goal-del" data-goal-id="${g.id}" title="Удалить">×</button>
      </div>
      <div class="goal-amounts">
        <span class="goal-saved">${formatMoney(g.saved)}</span>
        <span>из ${formatMoney(g.target)} · ${Math.round(pct)}%</span>
      </div>
      <div class="goal-progress"><div class="goal-progress-fill" style="width:${pct}%"></div></div>
      <div class="goal-actions">
        <input class="goal-add-input" type="number" min="1" placeholder="Сумма, ₽" data-goal-input="${g.id}">
        <button class="goal-add-btn" data-goal-add="${g.id}">Отложить</button>
      </div>
    `;
    wrap.appendChild(card);
  });
}

$('#goalForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const name = $('#goalName').value.trim();
  const target = Number($('#goalTarget').value);
  if (!name || !target || target <= 0) return;

  state.goals.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, target, saved: 0,
  });
  saveState();
  renderGoals();
  renderOverview();
  ev.target.reset();
});

/* Обработчик кнопок внутри целей (делегирование) */
document.addEventListener('click', (ev) => {
  // Удаление цели
  const del = ev.target.closest('.goal-del');
  if (del) {
    state.goals = state.goals.filter(g => g.id !== del.dataset.goalId);
    saveState();
    renderGoals();
    renderOverview();
    return;
  }
  // Пополнение
  const addBtn = ev.target.closest('[data-goal-add]');
  if (addBtn) {
    const id = addBtn.dataset.goalAdd;
    const input = document.querySelector(`[data-goal-input="${id}"]`);
    const val = Number(input.value);
    if (!val || val <= 0) return;
    const goal = state.goals.find(g => g.id === id);
    if (goal) {
      goal.saved += val;
      saveState();
      renderGoals();
      renderOverview();
    }
  }
});

/* ═══ Бюджет ═══ */
$('#budgetInput').addEventListener('input', () => {
  const v = Number($('#budgetInput').value);
  state.budget = isFinite(v) && v >= 0 ? v : 0;
  saveState();
  renderOverview();
});

/* ═══ Экспорт / Сброс ═══ */
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `studbudget-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$('#resetBtn').addEventListener('click', () => {
  if (!confirm('Удалить все данные: бюджет, траты и цели?')) return;
  state.budget = 0;
  state.expenses = [];
  state.goals = [];
  saveState();
  renderAll();
});

/* ═══ Полный рендер ═══ */
function renderAll() {
  $('#budgetInput').value = state.budget || '';
  renderOverview();
  renderExpenses();
  renderAnalytics();
  renderGoals();
}

/* ═══ Старт ═══ */
loadState();
$('#budgetInput').value = state.budget || '';
renderOverview();
renderExpenses();
