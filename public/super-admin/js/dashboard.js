/**
 * BoltClick — Super Admin Dashboard JS
 * Handles login, commission KPI loading, chart rendering, and ledger table.
 */

const API = '/api/admin';
let token = null;
let chartInstance = null;
let currentPage = 1;
let filterFrom = '';
let filterTo = '';

/* ══════════════════════════════════════════════════════════
   AUTH
   ══════════════════════════════════════════════════════════ */
function saveToken(t) {
  token = t;
  sessionStorage.setItem('sa_token', t);
}

function loadToken() {
  token = sessionStorage.getItem('sa_token');
  return !!token;
}

function logout() {
  sessionStorage.removeItem('sa_token');
  token = null;
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

function togglePass() {
  const p = document.getElementById('password');
  p.type = p.type === 'password' ? 'text' : 'password';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  const btnText = document.getElementById('loginBtnText');
  const spinner = document.getElementById('loginSpinner');

  errEl.classList.add('hidden');
  btnText.textContent = 'Signing in…';
  spinner.classList.remove('hidden');
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!data.success || data.role !== 'superAdmin') {
      throw new Error(data.message || 'Access denied — invalid super admin credentials.');
    }

    saveToken(data.token);
    showDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btnText.textContent = 'Sign In';
    spinner.classList.add('hidden');
    btn.disabled = false;
  }
});

/* ══════════════════════════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════════════════════════ */
document.querySelectorAll('.nav-item').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const section = link.dataset.section;
    switchSection(section);
    document.querySelectorAll('.nav-item').forEach((l) => l.classList.remove('active'));
    link.classList.add('active');
  });
});

function switchSection(name) {
  document.getElementById('sectionOverview').classList.add('hidden');
  document.getElementById('sectionCommissions').classList.add('hidden');

  if (name === 'overview') {
    document.getElementById('sectionOverview').classList.remove('hidden');
    document.getElementById('pageTitle').textContent = 'Platform Overview';
    document.getElementById('pageSub').textContent = 'Live commission earnings across all restaurants';
  } else if (name === 'commissions') {
    document.getElementById('sectionCommissions').classList.remove('hidden');
    document.getElementById('pageTitle').textContent = 'Commission Ledger';
    document.getElementById('pageSub').textContent = 'Full history of all earned commissions';
    loadCommissions();
  }
}

/* ══════════════════════════════════════════════════════════
   SHOW DASHBOARD
   ══════════════════════════════════════════════════════════ */
function showDashboard() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadAll();
}

function loadAll() {
  loadStats();
  loadChart();
}

/* ══════════════════════════════════════════════════════════
   KPI STATS
   ══════════════════════════════════════════════════════════ */
async function loadStats() {
  try {
    const res = await authFetch(`${API}/commissions/stats`);
    const { data } = res;

    document.getElementById('kpiTotal').textContent   = fmtCurrency(data.totalEarned);
    document.getElementById('kpiToday').textContent   = fmtCurrency(data.todayEarned);
    document.getElementById('kpiMonth').textContent   = fmtCurrency(data.monthEarned);
    document.getElementById('kpiOrders').textContent  = data.totalOrders.toLocaleString();
    document.getElementById('kpiRate').textContent    = `@ ${data.commissionRate}% per order`;

    const monthName = new Date().toLocaleString('en', { month: 'long', year: 'numeric' });
    document.getElementById('kpiMonthName').textContent = monthName;
  } catch (err) {
    console.error('Stats load error', err);
  }
}

/* ══════════════════════════════════════════════════════════
   CHART — last 30 days
   ══════════════════════════════════════════════════════════ */
async function loadChart() {
  try {
    const res = await authFetch(`${API}/commissions?limit=1000`);
    const records = res.data || [];

    // Aggregate by day
    const byDay = {};
    records.forEach((r) => {
      const d = new Date(r.earnedAt).toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' });
      byDay[d] = (byDay[d] || 0) + r.commissionAmount;
    });

    // Fill last 30 days
    const labels = [];
    const values = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' });
      labels.push(d.toLocaleDateString('en', { month: 'short', day: 'numeric' }));
      values.push(Math.round(byDay[key] || 0));
    }

    const ctx = document.getElementById('commissionChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Commission (FCFA)',
          data: values,
          backgroundColor: 'rgba(124,58,237,0.55)',
          borderColor: '#7c3aed',
          borderWidth: 1.5,
          borderRadius: 6,
          hoverBackgroundColor: 'rgba(157,101,255,0.7)',
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y.toLocaleString()} FCFA`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#5a5a72', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            ticks: {
              color: '#5a5a72', font: { size: 11 },
              callback: (v) => v.toLocaleString(),
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
        },
      },
    });
  } catch (err) {
    console.error('Chart load error', err);
  }
}

/* ══════════════════════════════════════════════════════════
   COMMISSION TABLE
   ══════════════════════════════════════════════════════════ */
async function loadCommissions(page = 1) {
  currentPage = page;
  const tbody = document.getElementById('commissionBody');
  tbody.innerHTML = `<tr><td colspan="8" class="loading-row">Loading…</td></tr>`;

  const params = new URLSearchParams({ page, limit: 25 });
  if (filterFrom) params.set('from', filterFrom);
  if (filterTo)   params.set('to', filterTo + 'T23:59:59');

  try {
    const res = await authFetch(`${API}/commissions?${params}`);
    const { data, total } = res;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="loading-row">No commission records found.</td></tr>`;
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    tbody.innerHTML = data.map((c, i) => {
      const order = c.orderId;
      const dt = new Date(c.earnedAt);
      const dateStr = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = dt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
      const rowNum = (page - 1) * 25 + i + 1;

      return `
        <tr>
          <td class="mono">${rowNum}</td>
          <td class="mono">${order ? String(order._id).slice(-8).toUpperCase() : String(c.orderId).slice(-8).toUpperCase()}</td>
          <td>${order?.phone || '—'}</td>
          <td>${formatFulfil(order?.fulfillmentType)}</td>
          <td class="order-total">${fmtCurrency(c.orderTotal)}</td>
          <td class="commission-val">${fmtCurrency(c.commissionAmount)}</td>
          <td>${dateStr} <span style="color:#5a5a72">${timeStr}</span></td>
          <td><span class="badge badge-earned">${c.status}</span></td>
        </tr>`;
    }).join('');

    renderPagination(total, 25, page);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="loading-row" style="color:#f43f5e">Error loading commissions: ${err.message}</td></tr>`;
  }
}

function renderPagination(total, limit, current) {
  const pages = Math.ceil(total / limit);
  const el = document.getElementById('pagination');
  if (pages <= 1) { el.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="loadCommissions(${current - 1})" ${current === 1 ? 'disabled' : ''}>← Prev</button>`;
  const start = Math.max(1, current - 2);
  const end   = Math.min(pages, current + 2);
  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn ${p === current ? 'active' : ''}" onclick="loadCommissions(${p})">${p}</button>`;
  }
  html += `<button class="page-btn" onclick="loadCommissions(${current + 1})" ${current === pages ? 'disabled' : ''}>Next →</button>`;
  el.innerHTML = html;
}

/* ══════════════════════════════════════════════════════════
   FILTERS
   ══════════════════════════════════════════════════════════ */
function applyFilter() {
  filterFrom = document.getElementById('filterFrom').value;
  filterTo   = document.getElementById('filterTo').value;
  loadCommissions(1);
}

function clearFilter() {
  filterFrom = ''; filterTo = '';
  document.getElementById('filterFrom').value = '';
  document.getElementById('filterTo').value = '';
  loadCommissions(1);
}

/* ══════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════ */
async function authFetch(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) { logout(); throw new Error('Session expired'); }
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'API error');
  return json;
}

function fmtCurrency(v) {
  if (v === undefined || v === null) return '—';
  return Number(v).toLocaleString('fr-CM') + ' FCFA';
}

function formatFulfil(t) {
  const m = { delivery: '🚗 Delivery', pickup: '🏪 Pickup', in_restaurant: '🍽️ Dine In' };
  return m[t] || t || '—';
}

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
if (loadToken()) {
  showDashboard();
}
