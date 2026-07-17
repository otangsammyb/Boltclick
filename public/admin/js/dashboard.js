/**
 * Admin Dashboard JavaScript — API integration, charts, live Socket.IO
 */
'use strict';

const API_BASE = '/api/admin';
const token = localStorage.getItem('adminToken');

// Redirect to login if not authenticated
if (!token) window.location.href = '/admin/login.html';

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

// ── API helper ───────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, { ...opts, headers: { ...headers, ...opts.headers } });
  if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; }
  return res.json();
}

// ── Number format ─────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString() + ' FCFA';
const fmtN = (n) => Number(n || 0).toLocaleString();

// ── Animated counter ─────────────────────────────────────────────────────────
function animateCount(el, target, isCurrency = false) {
  const duration = 800;
  const startTime = performance.now();
  const start = 0;
  const update = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const val = Math.round(start + (target - start) * ease);
    el.textContent = isCurrency ? val.toLocaleString() + ' FCFA' : fmtN(val);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ── Status badge HTML ─────────────────────────────────────────────────────────
const statusBadge = (s) => `<span class="status-badge s-${s}">${s.replace(/_/g, ' ')}</span>`;

// ── Page navigation ───────────────────────────────────────────────────────────
const pages = document.querySelectorAll('.page');
const navItems = document.querySelectorAll('.nav-item');

function navigateTo(pageId) {
  pages.forEach(p => p.classList.remove('active'));
  navItems.forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + pageId)?.classList.add('active');
  document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
  document.getElementById('pageTitle').textContent = pageId.charAt(0).toUpperCase() + pageId.slice(1);
  pageLoaders[pageId]?.();
}

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(item.dataset.page);
  });
});

// ── Sidebar toggle (mobile) ───────────────────────────────────────────────────
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('adminToken');
  window.location.href = '/admin/login.html';
});

// ── Avatar dropdown actions ───────────────────────────────────────────────────
document.getElementById('avatarSettingsBtn')?.addEventListener('click', () => {
  navigateTo('settings');
});

document.getElementById('avatarLogoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('adminToken');
  window.location.href = '/admin/login.html';
});


// ── Charts ───────────────────────────────────────────────────────────────────
const CHART_DEFAULTS = {
  color: '#00ed64',
  gridColor: 'rgba(0,104,74,0.3)',
  textColor: '#6b9e8d',
  font: 'Inter',
};

function chartOptions(axisX = true, axisY = true) {
  return {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: axisX ? { grid: { color: CHART_DEFAULTS.gridColor }, ticks: { color: CHART_DEFAULTS.textColor, font: { family: CHART_DEFAULTS.font, size: 11 } } } : { display: false },
      y: axisY ? { grid: { color: CHART_DEFAULTS.gridColor }, ticks: { color: CHART_DEFAULTS.textColor, font: { family: CHART_DEFAULTS.font, size: 11 } } } : { display: false },
    },
  };
}

let revenueChart, itemsChart, ratingsChart;

async function loadDashboard() {
  // Stats
  const { data } = await api('/stats');
  if (!data) return;

  animateCount(document.getElementById('statTodayRevenue'), data.todayRevenue, true);
  animateCount(document.getElementById('statTodayOrders'), data.todayOrders);
  animateCount(document.getElementById('statCustomers'), data.totalUsers);

  document.getElementById('statTotalRevenue').textContent = 'Total: ' + fmt(data.totalRevenue);
  document.getElementById('statPendingOrders').textContent = data.pendingOrders + ' pending';
  document.getElementById('statRating').innerHTML = data.avgRating.toFixed(1) + ' <i class="hgi hgi-stroke hgi-star-01" style="color:var(--amber);font-size:14px"></i>';
  document.getElementById('statBookings').textContent = data.activeBookings + ' active bookings';

  // Update badges
  const ob = document.getElementById('ordersBadge');
  ob.textContent = data.pendingOrders || '';
  const hb = document.getElementById('handoffBadge');
  hb.textContent = data.pendingHandoffs || '';

  // Revenue chart
  await loadRevenueChart(7);

  // Popular items chart
  const items = await api('/analytics/popular-items');
  const iLabels = (items.data || []).slice(0, 6).map(i => i._id);
  const iData = (items.data || []).slice(0, 6).map(i => i.count);

  if (itemsChart) itemsChart.destroy();
  itemsChart = new Chart(document.getElementById('itemsChart'), {
    type: 'bar',
    data: {
      labels: iLabels,
      datasets: [{ data: iData, backgroundColor: '#00684a', borderRadius: 6, hoverBackgroundColor: '#00ed64' }],
    },
    options: chartOptions(),
  });

  // Live orders
  await loadLiveOrders();
}

async function loadRevenueChart(days) {
  const res = await api(`/analytics/revenue?days=${days}`);
  const rLabels = (res.data || []).map(d => d._id);
  const rData = (res.data || []).map(d => d.revenue);

  if (revenueChart) revenueChart.destroy();
  revenueChart = new Chart(document.getElementById('revenueChart'), {
    type: 'line',
    data: {
      labels: rLabels,
      datasets: [{
        data: rData,
        borderColor: '#00ed64',
        backgroundColor: 'rgba(0,237,100,0.08)',
        borderWidth: 2.5,
        pointBackgroundColor: '#00ed64',
        pointRadius: 4,
        tension: 0.4,
        fill: true,
      }],
    },
    options: chartOptions(),
  });
}

document.getElementById('revenueRange')?.addEventListener('change', (e) => {
  loadRevenueChart(e.target.value);
});

async function loadLiveOrders() {
  const res = await api('/orders?limit=10');
  const tbody = document.getElementById('liveOrdersBody');
  const orders = res.data || [];
  if (!orders.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No orders yet</td></tr>'; return; }

  tbody.innerHTML = orders.map((o, i) => `
    <tr style="animation-delay:${i * 0.04}s">
      <td><code style="color:var(--green);font-size:11px">${o._id.toString().slice(-6).toUpperCase()}</code></td>
      <td>${o.phone}</td>
      <td style="font-weight:700">${fmt(o.total)}</td>
      <td>${o.fulfillmentType === 'delivery' ? '<i class="hgi hgi-stroke hgi-truck-01" style="font-size: 14px"></i> Delivery' : o.fulfillmentType === 'in_restaurant' ? '<i class="hgi hgi-stroke hgi-restaurant" style="font-size: 14px"></i> In Restaurant' + (o.tableNumber ? ` (T${o.tableNumber})` : '') : '<i class="hgi hgi-stroke hgi-shopping-cart-01" style="font-size: 14px"></i> Pickup'}</td>
      <td>${statusBadge(o.status)}</td>
      <td style="color:var(--muted);font-size:12px">${new Date(o.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Douala', hour: '2-digit', minute: '2-digit' })}</td>
    </tr>
  `).join('');
}

// ── ORDERS PAGE ───────────────────────────────────────────────────────────────
let currentOrdersPage = 1;

async function loadOrders(page = currentOrdersPage) {
  currentOrdersPage = Math.max(1, parseInt(page) || 1);
  const filter = document.getElementById('orderStatusFilter').value;
  const search = document.getElementById('orderSearchRef').value.trim();
  
  let url = `/orders?limit=20&page=${currentOrdersPage}`;
  if (filter) url += `&status=${filter}`;
  if (search) url += `&search=${search}`;

  const res = await api(url);
  const tbody = document.getElementById('ordersBody');
  const orders = res.data || [];
  
  // Pagination UI
  const total = res.total || 0;
  const totalPages = Math.ceil(total / 20) || 1;
  const pageInfo = document.getElementById('ordersPageInfo');
  if (pageInfo) pageInfo.textContent = `Page ${page} of ${totalPages}`;
  
  const btnPrev = document.getElementById('btnOrdersPrev');
  if (btnPrev) btnPrev.disabled = page <= 1;
  
  const btnNext = document.getElementById('btnOrdersNext');
  if (btnNext) btnNext.disabled = page >= totalPages;

  if (!orders.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No orders found</td></tr>'; return; }

  tbody.innerHTML = orders.map((o, i) => {
    let fulfillIcon = '<i class="hgi hgi-stroke hgi-shopping-cart-01" style="font-size: 14px"></i>';
    let fulfillText = 'Pickup';
    if (o.fulfillmentType === 'delivery') {
      fulfillIcon = '<i class="hgi hgi-stroke hgi-truck-01" style="font-size: 14px"></i>';
      fulfillText = 'Delivery';
    } else if (o.fulfillmentType === 'in_restaurant') {
      fulfillIcon = '<i class="hgi hgi-stroke hgi-restaurant" style="font-size: 14px"></i>';
      fulfillText = 'In Restaurant';
      if (o.tableNumber) fulfillText += ` (T${o.tableNumber})`;
    }

    return `
      <tr style="animation-delay:${i * 0.03}s">
        <td><code style="color:var(--green);font-size:11px">${o._id.toString().slice(-6).toUpperCase()}</code></td>
        <td>${o.phone}</td>
        <td style="font-size:12px">${(o.items || []).map(it => `${it.nameEn} ×${it.quantity}`).join(', ')}</td>
        <td style="font-weight:700">${fmt(o.total)}</td>
        <td>${fulfillIcon} ${fulfillText}</td>
        <td>${o.paymentMethod || '—'}</td>
        <td>${statusBadge(o.status)}</td>
        <td>
          <select class="btn-sm btn-outline" onchange="updateOrderStatus('${o._id}', this.value)" style="background:var(--dark);color:var(--text)">
            <option>Change…</option>
            ${['PAID','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'].map(s => `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>
    `
  }).join('');
}

document.getElementById('orderStatusFilter')?.addEventListener('change', () => loadOrders(1));
document.getElementById('btnSearchOrder')?.addEventListener('click', () => loadOrders(1));
document.getElementById('orderSearchRef')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadOrders(1); });
document.getElementById('btnOrdersPrev')?.addEventListener('click', () => { if (currentOrdersPage > 1) loadOrders(currentOrdersPage - 1); });
document.getElementById('btnOrdersNext')?.addEventListener('click', () => loadOrders(currentOrdersPage + 1));

async function updateOrderStatus(id, status) {
  if (!status || status === 'Change…') return;
  await api(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  loadOrders();
}
window.updateOrderStatus = updateOrderStatus;

// ── MENU PAGE ─────────────────────────────────────────────────────────────────
async function loadMenu() {
  const res = await api('/menu');
  const grid = document.getElementById('menuGrid');
  const items = res.data || [];
  if (!items.length) { grid.innerHTML = '<p style="color:var(--muted);padding:20px">No menu items yet. Click + Add Item to start.</p>'; return; }

  grid.innerHTML = items.map(item => `
    <div class="menu-item-card ${item.available ? '' : 'unavailable'}">
      <div class="menu-item-img">
        ${item.imageUrl ? `<img src="${item.imageUrl}" style="width:100%;height:100%;object-fit:cover" />` : '<i class="hgi hgi-stroke hgi-plate-01"></i>'}
      </div>
      <div class="menu-item-body">
        <div class="menu-item-name">${item.nameEn}</div>
        <div class="menu-item-cat">${item.category || 'Main'} · ${item.nameFr}</div>
        <div class="menu-item-price">${item.price.toLocaleString()} FCFA</div>
        <div class="menu-item-actions" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
          <button class="btn-sm" onclick="editMenuItem('${item._id}')" style="background-color:#2563eb; border:1px solid #2563eb; color:white; padding:10px 0; border-radius:8px; cursor:pointer; font-weight: 700;">Edit</button>
          <button class="btn-sm" onclick="toggleItem('${item._id}')" style="background-color:${item.available ? '#f59e0b' : 'green'}; border:1px solid ${item.available ? '#f59e0b' : 'green'}; color:white; padding:10px 0; border-radius:8px; cursor:pointer; font-weight: 700;">${item.available ? 'Disable' : 'Enable'}</button>
          <button class="btn-sm" onclick="deleteMenuItem('${item._id}')" style="background-color:#dc2626; border:1px solid #dc2626; color:white; padding:10px 0; border-radius:8px; cursor:pointer; font-weight: 700;">Del</button>
        </div>
      </div>
    </div>
  `).join('');
}

// Menu Modal
document.getElementById('addMenuItemBtn')?.addEventListener('click', () => {
  document.getElementById('menuItemId').value = '';
  document.getElementById('menuForm').reset();
  document.getElementById('modalTitle').textContent = 'Add Menu Item';
  document.getElementById('menuModal').classList.add('open');
});
document.getElementById('modalClose')?.addEventListener('click', () => {
  document.getElementById('menuModal').classList.remove('open');
});

document.getElementById('menuForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('menuItemId').value;
  const formData = new FormData();
  formData.append('nameEn', document.getElementById('nameEn').value);
  formData.append('nameFr', document.getElementById('nameFr').value);
  formData.append('descriptionEn', document.getElementById('descriptionEn').value);
  formData.append('descriptionFr', document.getElementById('descriptionFr').value);
  formData.append('price', document.getElementById('price').value);
  formData.append('category', document.getElementById('category').value);
  const imgFile = document.getElementById('menuImage').files[0];
  if (imgFile) formData.append('image', imgFile);

  const method = id ? 'PUT' : 'POST';
  const url = id ? `/menu/${id}` : '/menu';
  await fetch(API_BASE + url, { method, headers: { Authorization: `Bearer ${token}` }, body: formData });

  document.getElementById('menuModal').classList.remove('open');
  loadMenu();
});

async function editMenuItem(id) {
  const res = await api('/menu');
  const item = (res.data || []).find(i => i._id === id);
  if (!item) return;
  document.getElementById('menuItemId').value = item._id;
  document.getElementById('nameEn').value = item.nameEn;
  document.getElementById('nameFr').value = item.nameFr;
  document.getElementById('descriptionEn').value = item.descriptionEn || '';
  document.getElementById('descriptionFr').value = item.descriptionFr || '';
  document.getElementById('price').value = item.price;
  document.getElementById('category').value = item.category || '';
  document.getElementById('modalTitle').textContent = 'Edit Menu Item';
  document.getElementById('menuModal').classList.add('open');
}
window.editMenuItem = editMenuItem;

async function toggleItem(id) {
  await api(`/menu/${id}/toggle`, { method: 'PATCH' });
  loadMenu();
}
window.toggleItem = toggleItem;

async function deleteMenuItem(id) {
  if (!confirm('Delete this menu item?')) return;
  await api(`/menu/${id}`, { method: 'DELETE' });
  loadMenu();
}
window.deleteMenuItem = deleteMenuItem;

// ── BOOKINGS ──────────────────────────────────────────────────────────────────
async function loadBookings() {
  const [bRes, aRes] = await Promise.all([api('/bookings?status=CONFIRMED'), api('/bookings/availability')]);
  const avail = aRes.data;
  document.getElementById('availabilityPill').textContent =
    `${avail?.available || 0} / ${avail?.total || 0} tables available`;

  const tbody = document.getElementById('bookingsBody');
  const bookings = bRes.data || [];
  if (!bookings.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No bookings</td></tr>'; return; }

  tbody.innerHTML = bookings.map((b, i) => `
    <tr style="animation-delay:${i * 0.03}s">
      <td>${b.phone}</td>
      <td>${b.date}</td>
      <td>${b.time}</td>
      <td>${b.guests}</td>
      <td>${statusBadge(b.status)}</td>
      <td>
        <button class="btn-sm" onclick="updateBooking('${b._id}','CANCELLED')" style="background-color:#dc2626; border:1px solid #dc2626; color:white; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight: 700;">Cancel</button>
        <button class="btn-sm" onclick="updateBooking('${b._id}','COMPLETED')" style="background-color:green; border:1px solid green; color:white; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight: 700;">Done</button>
      </td>
    </tr>
  `).join('');
}

async function updateBooking(id, status) {
  await api(`/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  loadBookings();
}
window.updateBooking = updateBooking;

// ── DELIVERY ──────────────────────────────────────────────────────────────────
let driversList = [];

async function loadDelivery() {
  const [gRes, dRes] = await Promise.all([api('/delivery-groups'), api('/drivers')]);
  driversList = dRes.data || [];
  const container = document.getElementById('deliveryGroups');
  const groups = gRes.data || [];
  if (!groups.length) { container.innerHTML = '<p style="color:var(--muted);padding:20px">No active delivery groups.</p>'; return; }

  container.innerHTML = groups.map(g => `
    <div class="delivery-group-card">
      <div class="dg-header">
        <span class="dg-title">Group ${g._id.toString().slice(-6).toUpperCase()}</span>
        ${statusBadge(g.status)}
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px">${(g.orderIds || []).length} order(s) · ${g.riderName || 'Unassigned'}</div>
      ${(g.orderIds || []).map(o => `
        <div class="dg-order"><i class="hgi hgi-stroke hgi-location-01" style="color:var(--green);font-size:12px"></i> ${o.deliveryAddress || 'N/A'} · <strong>${o.total?.toLocaleString()} FCFA</strong></div>
      `).join('')}
      <div style="display:flex;gap:8px;margin-top:10px">
        <select id="rider-select-${g._id}" class="btn-sm" style="flex:1;background:var(--dark);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 10px">
          <option value="">Select Rider…</option>
          ${driversList.map(d => `<option value="${d.riderId}" ${d.riderId === g.riderId ? 'selected' : ''}>${d.name} (${d.riderId})</option>`).join('')}
        </select>
        <button class="btn-sm btn-action" onclick="assignRider('${g._id}')">Assign</button>
      </div>
    </div>
  `).join('');
}

async function assignRider(groupId) {
  const select = document.getElementById('rider-select-' + groupId);
  const riderId = select.value;
  if (!riderId) return alert('Please select a rider');
  
  const driver = driversList.find(d => d.riderId === riderId);
  await api(`/delivery-groups/${groupId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ riderId, riderName: driver.name }),
  });
  loadDelivery();
}
window.assignRider = assignRider;

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────
async function loadCustomers() {
  const res = await api('/customers');
  const tbody = document.getElementById('customersBody');
  const customers = res.data || [];
  if (!customers.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No customers yet</td></tr>'; return; }

  tbody.innerHTML = customers.map((c, i) => `
    <tr style="animation-delay:${i * 0.03}s">
      <td>${c.phone}</td>
      <td>${c.language === 'fr' ? 'French' : 'English'}</td>
      <td>${c.totalOrders || 0}</td>
      <td>${fmt(c.totalSpent)}</td>
      <td style="color:var(--muted);font-size:12px">${new Date(c.createdAt).toLocaleDateString('en-GB')}</td>
    </tr>
  `).join('');
}

// ── DRIVERS ───────────────────────────────────────────────────────────────────
async function loadDrivers() {
  const res = await api('/drivers');
  const tbody = document.getElementById('driversBody');
  const drivers = res.data || [];
  if (!drivers.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No drivers authorized yet</td></tr>'; return; }

  tbody.innerHTML = drivers.map((d, i) => `
    <tr style="animation-delay:${i * 0.03}s">
      <td style="font-weight:700">${d.name}</td>
      <td><code style="color:var(--green)">${d.riderId}</code></td>
      <td><code>${d.driverCode}</code></td>
      <td>${d.phone || '—'}</td>
      <td><button class="btn-sm" onclick="deleteDriver('${d._id}')" style="background-color:#dc2626; border:1px solid #dc2626; color:white; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight: 700;">Delete</button></td>
    </tr>
  `).join('');
}

document.getElementById('addDriverBtn')?.addEventListener('click', () => {
  document.getElementById('driverModal').classList.add('open');
});
document.getElementById('driverModalClose')?.addEventListener('click', () => {
  document.getElementById('driverModal').classList.remove('open');
});

document.getElementById('driverForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    name: document.getElementById('driverName').value,
    riderId: document.getElementById('riderId').value,
    phone: document.getElementById('driverPhone').value,
  };
  await api('/drivers', { method: 'POST', body: JSON.stringify(body) });
  document.getElementById('driverModal').classList.remove('open');
  document.getElementById('driverForm').reset();
  loadDrivers();
});

async function deleteDriver(id) {
  if (!confirm('Revoke authorization for this driver?')) return;
  await api(`/drivers/${id}`, { method: 'DELETE' });
  loadDrivers();
}
window.deleteDriver = deleteDriver;

// ── DELIVERY ──────────────────────────────────────────────────────────────────
let adminMap = null;
let driverMarkers = {};

async function assignDriver(groupId) {
  const val = document.getElementById('assign_' + groupId).value;
  const [riderId, riderName] = val ? val.split('|') : ['', ''];
  await api(`/delivery-groups/${groupId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ riderId, riderName })
  });
  loadDelivery();
}
window.assignDriver = assignDriver;

async function loadDelivery() {
  if (!adminMap) {
    adminMap = L.map('adminDeliveryMap').setView([3.8480, 11.5021], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(adminMap);
  }

  const [resGroups, resDrivers] = await Promise.all([
    api('/delivery-groups'),
    api('/drivers')
  ]);
  
  const groups = resGroups.data || [];
  const drivers = resDrivers.data || [];
  const container = document.getElementById('deliveryGroups');
  
  if (!groups.length) {
    container.innerHTML = '<div style="color:var(--muted);padding:20px;">No active delivery groups found.</div>';
    return;
  }

  container.innerHTML = groups.map(g => `
    <div style="background:var(--mid);border:1px solid var(--border);border-radius:12px;padding:15px;margin-bottom:15px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h4 style="color:var(--green);font-size:14px;">GROUP ${g._id.slice(-6).toUpperCase()}</h4>
        ${statusBadge(g.status)}
      </div>
      <p style="font-size:12px;color:var(--muted);margin:8px 0;">Assigned to: <strong style="color:var(--text)">${g.riderId || 'Unassigned'}</strong> ${g.riderName ? `(${g.riderName})` : ''}</p>
      
      <div style="margin:10px 0; display:flex; align-items:center; gap:8px;">
        <select class="btn-sm btn-outline" id="assign_${g._id}" style="background:var(--dark);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;">
          <option value="">-- Assign Driver --</option>
          ${drivers.map(d => `<option value="${d.riderId}|${d.name}" ${g.riderId === d.riderId ? 'selected' : ''}>${d.riderId} - ${d.name}</option>`).join('')}
        </select>
        <button class="btn-sm" onclick="assignDriver('${g._id}')" style="background-color:#2563eb; border:1px solid #2563eb; color:white; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight: 700;">Assign</button>
      </div>

      <div style="margin-top:10px;">
        ${g.orderIds.map(o => `
          <div style="border-top:1px solid var(--border);padding:8px 0;font-size:12px;">
            <i class="hgi hgi-stroke hgi-location-01" style="color:#ff5252"></i> ${o.deliveryAddress || 'Coords: '+ (o.deliveryLat?.toFixed(4)||'') +', '+ (o.deliveryLng?.toFixed(4)||'')}
            <div style="color:var(--muted);margin-left:18px;">${o.phone} | ${o.status}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
  
  const groupCoords = [];
  groups.forEach(g => {
    g.orderIds.forEach(o => {
      if (o.deliveryLat && o.deliveryLng) {
        groupCoords.push([o.deliveryLat, o.deliveryLng]);
        L.circleMarker([o.deliveryLat, o.deliveryLng], {
          radius: 5, color: '#ff5252', fillColor: '#ff5252', fillOpacity: 0.8
        }).addTo(adminMap);
      }
    });
  });
  
  if (groupCoords.length > 0) {
    adminMap.fitBounds(L.latLngBounds(groupCoords), { padding: [50, 50] });
  }
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
async function loadAnalytics() {
  const res = await api('/ratings');
  const ratings = res.data || [];
  const counts = [0,0,0,0,0];
  ratings.forEach(r => { if (r.score >= 1 && r.score <= 5) counts[r.score - 1]++; });

  if (ratingsChart) ratingsChart.destroy();
  ratingsChart = new Chart(document.getElementById('ratingsChart'), {
    type: 'bar',
    data: {
      labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
      datasets: [{ data: counts, backgroundColor: ['#ff5252','#ffb300','#6bdff5','#00684a','#00ed64'], borderRadius: 8 }],
    },
    options: { ...chartOptions(), plugins: { legend: { display: false } } },
  });
}

// ── HANDOFFS ──────────────────────────────────────────────────────────────────
async function loadHandoffs() {
  const res = await api('/handoffs');
  const tbody = document.getElementById('handoffsBody');
  const handoffs = res.data || [];
  if (!handoffs.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No pending handoffs ✅</td></tr>'; return; }

  tbody.innerHTML = handoffs.map((h, i) => `
    <tr style="animation-delay:${i * 0.03}s">
      <td><i class="hgi hgi-stroke hgi-customer-service-01" style="color:var(--muted);font-size:14px;margin-right:2px"></i> ${h.phone}</td>
      <td style="font-size:12px;color:var(--muted)">${new Date(h.createdAt).toLocaleString('en-GB')}</td>
      <td>${h.resolved ? statusBadge('COMPLETED') : '<span class="status-badge s-PENDING">OPEN</span>'}</td>
      <td>
        <button class="btn-sm" onclick="resolveHandoff('${h._id}')" style="background-color:green; border:1px solid green; color:white; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight: 700;">Resolve</button>
      </td>
    </tr>
  `).join('');
}

async function resolveHandoff(id) {
  await api(`/handoffs/${id}/resolve`, { method: 'PATCH', body: JSON.stringify({ note: 'Resolved by admin' }) });
  loadHandoffs();
}
window.resolveHandoff = resolveHandoff;

// ── QR CODES ──────────────────────────────────────────────────────────────────
async function loadQRCodes() {
  const res = await api('/qrcodes');
  const printArea = document.getElementById('qrPrintArea');
  const codes = res.data || [];
  
  if (!codes.length) {
    printArea.innerHTML = '<p style="color:var(--muted); grid-column: 1/-1;">No saved QR codes found.</p>';
    document.getElementById('printQrBtn').style.display = 'none';
    return;
  }
  
  document.getElementById('printQrBtn').style.display = 'inline-block';
  printArea.innerHTML = codes.map(c => `
    <div class="qr-card">
      <div>
        <img src="${c.imageUrl}?t=${Date.now()}" alt="Table ${c.number}" style="width:200px; height:200px; object-fit:contain;" />
      </div>
      <div class="qr-label">Table ${c.number}</div>
      <div class="no-print" style="margin-top: 15px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
        <a href="${c.imageUrl}" download="Table_${c.number}_QRCode.png" class="btn-sm" style="background-color: green; border: 1px solid green; color: white; padding: 12px 10px; border-radius: 10px; text-decoration: none; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">IMG</a>
        <a href="/api/admin/qrcodes/${c._id}/pdf" target="_blank" class="btn-sm" style="background-color: green; border: 1px solid green; color: white; padding: 12px 10px; border-radius: 10px; text-decoration: none; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">PDF</a>
        <button onclick="deleteQRCode('${c._id}')" class="btn-sm" style="background-color: #dc2626; border: 1px solid #dc2626; color: white; padding: 12px 10px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">DEL</button>
      </div>
    </div>
  `).join('');
}

async function deleteQRCode(id) {
  if (!confirm('Delete this QR code?')) return;
  await api(`/qrcodes/${id}`, { method: 'DELETE' });
  loadQRCodes();
}
window.deleteQRCode = deleteQRCode;

document.getElementById('qrForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const count = parseInt(document.getElementById('qrTableCount').value, 10);
  const logoFile = document.getElementById('qrLogoUpload').files[0];

  // Fetch settings to get default logo & wa number
  const settingsRes = await api('/settings');
  const waNumber = settingsRes.data?.whatsappNumber || '';
  if (!waNumber) alert("Warning: Restaurant WhatsApp number is missing.");
  const cleanNumber = waNumber.replace(/\D/g, '');
  let logoUrl = settingsRes.data?.logoUrl || '';

  if (logoFile) {
    const formData = new FormData();
    formData.append('logo', logoFile);
    const res = await fetch(API_BASE + '/settings/qr-logo', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
    const data = await res.json();
    if (data.success && data.data.logoUrl) {
      logoUrl = data.data.logoUrl + '?t=' + Date.now();
    }
  }

  const btn = document.getElementById('btnGenerateSave');
  btn.disabled = true;
  btn.textContent = 'Generating...';

  try {
    for (let i = 1; i <= count; i++) {
      const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent('Order for Table ' + i)}`;
      
      const qrCode = new QRCodeStyling({
        width: 800, height: 800, data: url, image: logoUrl || '',
        dotsOptions: { color: "#001e2b", type: "rounded" },
        backgroundOptions: { color: "#ffffff" },
        imageOptions: { crossOrigin: "anonymous", margin: 5 }
      });
      
      const blob = await qrCode.getRawData("png");
      const fd = new FormData();
      fd.append('number', i);
      fd.append('image', blob, `table-${i}.png`);
      
      await fetch(API_BASE + '/qrcodes', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    }
    await loadQRCodes();
  } catch (err) {
    console.error(err);
    alert('Error generating QR Codes');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate & Save';
  }
});

document.getElementById('printQrBtn')?.addEventListener('click', () => window.print());

// ── Page loaders map ─────────────────────────────────────────────────────────
const pageLoaders = {
  dashboard: loadDashboard,
  orders: loadOrders,
  menu: loadMenu,
  bookings: loadBookings,
  delivery: loadDelivery,
  customers: loadCustomers,
  analytics: loadAnalytics,
  handoffs: loadHandoffs,
  drivers: loadDrivers,
  qrcodes: loadQRCodes,
  settings: loadSettings,
};

// ── Socket.IO real-time ───────────────────────────────────────────────────────
try {
  const socket = io();
  socket.on('newOrder', () => {
    if (document.getElementById('page-dashboard').classList.contains('active')) loadDashboard();
    if (document.getElementById('page-orders').classList.contains('active')) loadOrders();
  });
  
  socket.on('driverLocationUpdate', (data) => {
    const { riderId, lat, lng } = data;
    if (!adminMap || !lat || !lng) return;
    
    if (!driverMarkers[riderId]) {
      driverMarkers[riderId] = L.marker([lat, lng], {
        icon: L.divIcon({
          html: '<div style="background:var(--green);border:2px solid var(--dark);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.5);"><i class="hgi hgi-stroke hgi-motorbike-02" style="color:var(--dark);font-size:16px"></i></div><div style="background:var(--dark);color:var(--text);font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-top:4px;text-align:center;box-shadow:0 2px 5px rgba(0,0,0,0.5)">' + riderId + '</div>',
          className: 'admin-driver-pin',
          iconSize: [32, 50],
          iconAnchor: [16, 25]
        })
      }).addTo(adminMap);
    } else {
      driverMarkers[riderId].setLatLng([lat, lng]);
    }
  });

} catch (e) {
  console.error("Socket error", e);
}

// ── Initial load ─────────────────────────────────────────────────────────────
loadDashboard();

// ── CUSTOM PDF EXPORT ─────────────────────────────────────────────────────────
async function downloadReport(type) {
  const btn = document.getElementById(`btnReport${type}`);
  btn.textContent = 'Generating...';
  
  try {
    const res = await fetch(`${API_BASE}/analytics/report?type=${type}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to generate report');
    
    let filename = `${type.toUpperCase()}_REPORT_${new Date().toISOString().split('T')[0]}.pdf`;
    const cd = res.headers.get('Content-Disposition');
    if (cd && cd.indexOf('filename="') > -1) {
      filename = cd.split('filename="')[1].split('"')[0];
    }
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch(e) {
    alert(e.message);
  } finally {
    btn.innerHTML = `<i class="hgi hgi-stroke hgi-document-download-01" style="margin-right:4px;"></i>${type === 'daily' ? 'Daily' : 'Monthly'} Report`;
  }
}
window.downloadReport = downloadReport;

// \u2500\u2500 SETTINGS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function applyHeaderLogo(url, name = '') {
  // Sidebar logo (left of "RestaurantBot" text)
  const sidebarImg = document.getElementById('sidebarLogo');
  const defaultIcon = document.getElementById('sidebarDefaultIcon');
  const logoText = document.querySelector('.logo-text');

  if (name && logoText) logoText.textContent = name;

  if (url) {
    if (sidebarImg) { sidebarImg.src = url; sidebarImg.style.display = 'block'; }
    if (defaultIcon) defaultIcon.style.display = 'none';
  } else {
    if (sidebarImg) { sidebarImg.src = ''; sidebarImg.style.display = 'none'; }
    if (defaultIcon) defaultIcon.style.display = 'inline-flex';
  }
}

async function loadSettings() {
  const res = await api('/settings');
  const logoUrl = res.data?.logoUrl || '';
  const restaurantName = res.data?.restaurantName || '';

  // Update preview
  const preview = document.getElementById('settingsLogoPreview');
  const placeholder = document.getElementById('settingsLogoPlaceholder');
  const removeBtn = document.getElementById('logoRemoveBtn');

  if (logoUrl) {
    preview.src = logoUrl;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    removeBtn.style.display = 'inline-flex';
  } else {
    preview.src = '';
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
    removeBtn.style.display = 'none';
  }

  // Populate CamPay Settings
  if (res.data?.campayUsername) {
    document.getElementById('campayUsername').value = res.data.campayUsername;
  }
  if (res.data?.campayPassword) {
    // It comes back as ******** if set, indicating a password exists
    document.getElementById('campayPassword').placeholder = '******** (Keys stored securely)';
  }
  if (res.data?.campayAppName) document.getElementById('campayAppName').value = res.data.campayAppName;
  if (res.data?.campayBaseUrl) document.getElementById('campayBaseUrl').value = res.data.campayBaseUrl;
  if (res.data?.campayWebhookUrl) document.getElementById('campayWebhookUrl').value = res.data.campayWebhookUrl;

  applyHeaderLogo(logoUrl, restaurantName);
}

// Upload logo form
document.getElementById('logoUploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = document.getElementById('logoFileInput').files[0];
  if (!file) return;

  const btn = document.getElementById('logoUploadBtn');
  const msg = document.getElementById('logoUploadMsg');
  btn.textContent = 'Uploading...';
  btn.disabled = true;

  const formData = new FormData();
  formData.append('logo', file);

  const res = await fetch(`${API_BASE}/settings/qr-logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();

  btn.innerHTML = '<i class="hgi hgi-stroke hgi-upload-01" style="margin-right:6px;"></i>Upload Logo';
  btn.disabled = false;

  if (data.success) {
    msg.textContent = '\u2705 Logo uploaded successfully!';
    msg.style.color = 'var(--green)';
    msg.style.display = 'block';
    loadSettings();
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  } else {
    msg.textContent = '\u274c Upload failed. Please try again.';
    msg.style.color = 'var(--red)';
    msg.style.display = 'block';
  }
});

// Remove logo
document.getElementById('logoRemoveBtn')?.addEventListener('click', async () => {
  if (!confirm('Remove the restaurant logo?')) return;
  // Delete via sending an empty overwrite — just clear from frontend & backend
  await fetch(`${API_BASE}/settings/remove-logo`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  applyHeaderLogo(null);
  loadSettings();
});

// Update CamPay Settings
document.getElementById('campayForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btn = document.getElementById('campaySaveBtn');
  const msg = document.getElementById('campaySaveMsg');
  const text = document.getElementById('campaySaveText');
  
  const campayUsername = document.getElementById('campayUsername').value;
  const campayPassword = document.getElementById('campayPassword').value;
  const campayAppName = document.getElementById('campayAppName').value;
  const campayBaseUrl = document.getElementById('campayBaseUrl').value;
  const campayWebhookUrl = document.getElementById('campayWebhookUrl').value;

  text.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/settings/campay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ campayUsername, campayPassword, campayAppName, campayBaseUrl, campayWebhookUrl }),
    });
    const data = await res.json();
    
    if (data.success) {
      msg.textContent = '\u2705 Payment keys saved securely!';
      msg.style.color = 'var(--green)';
      msg.style.display = 'block';
      document.getElementById('campayPassword').value = ''; // clear input
      loadSettings();
      setTimeout(() => { msg.style.display = 'none'; }, 4000);
    } else {
      throw new Error(data.message || 'Save failed');
    }
  } catch (err) {
    msg.textContent = '\u274c ' + err.message;
    msg.style.color = 'var(--red)';
    msg.style.display = 'block';
  } finally {
    text.textContent = 'Save Gateway Keys';
    btn.disabled = false;
  }
});

// ── Bootstrap header logo on page load ───────────────────────────────────────
(async () => {
  try {
    const res = await api('/settings');
    if (res.data) applyHeaderLogo(res.data.logoUrl, res.data.restaurantName);
  } catch (e) {}
})();

// -- THEME TOGGLE LOGIC ------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem('adminTheme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (!icon) return;
  if (theme === 'light') {
    icon.className = 'hgi hgi-stroke hgi-sun-01';
  } else {
    icon.className = 'hgi hgi-stroke hgi-moon-01';
  }
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('adminTheme', next);
  updateThemeIcon(next);
}

document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
initTheme();
