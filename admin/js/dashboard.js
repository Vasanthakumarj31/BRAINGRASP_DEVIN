// ── BrainGrasp Admin Dashboard JS ────────────────────────────────────────────

const API = 'http://localhost:3000';

// ── Auth guard ────────────────────────────────────────────────────────────────
const token = localStorage.getItem('adminToken');
if (!token) { window.location.href = 'login.html'; }

// ── Date ──────────────────────────────────────────────────────────────────────
const dateEl = document.getElementById('currentDate');
if (dateEl) {
  dateEl.textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById('navLogout').addEventListener('click', e => {
  e.preventDefault();
  localStorage.removeItem('adminToken');
  window.location.href = 'login.html';
});

// ── Refresh ───────────────────────────────────────────────────────────────────
document.getElementById('refreshBtn').addEventListener('click', () => {
  const icon = document.querySelector('#refreshBtn i');
  icon.style.animation = 'spin 1s linear infinite';
  loadDashboard().finally(() => { icon.style.animation = ''; });
});

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmt(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('en-IN');
}
function fmtRupee(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}
function animateNumber(el, target, duration = 800) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) { start = target; clearInterval(timer); }
    el.textContent = Math.floor(start).toLocaleString('en-IN');
  }, 16);
}

// ── Load Dashboard ────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const res = await fetch(`${API}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('adminToken');
      window.location.href = 'login.html';
      return;
    }
    const data = await res.json();
    renderKPIs(data.kpis);
    renderTopSelling(data.topSelling || []);
    renderLowSelling(data.lowSelling || []);
    renderStatusBars(data.kpis);
    renderRecentOrders(data.recentOrders || []);
  } catch (err) {
    console.error('Dashboard load error:', err);
    showToast('Failed to load dashboard data', 'error');
  }
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function renderKPIs(kpis) {
  const fields = {
    kpiTotalProducts: kpis.totalProducts,
    kpiCartItems:     kpis.cartItems,
    kpiConfirmedOrders: kpis.confirmed,
    kpiDeliveryPending: kpis.deliveryPending,
    kpiDeliveredOrders: kpis.delivered,
    kpiTotalRevenue:   null, // special
    kpiTotalOrders:    null, // special sub
  };

  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el || val === null) return;
    animateNumber(el, val);
  });

  // Revenue (special format)
  const revEl = document.getElementById('kpiTotalRevenue');
  if (revEl) {
    let rv = 0;
    const timer = setInterval(() => {
      rv += kpis.totalRevenue / 50;
      if (rv >= kpis.totalRevenue) { rv = kpis.totalRevenue; clearInterval(timer); }
      revEl.textContent = fmtRupee(Math.floor(rv));
    }, 16);
  }

  // Sub-labels
  const usersCartEl = document.getElementById('kpiUsersCart');
  if (usersCartEl) usersCartEl.textContent = `${kpis.usersWithCart} users with items`;

  const ordersEl = document.getElementById('kpiTotalOrders');
  if (ordersEl) ordersEl.textContent = `${fmt(kpis.totalOrders)} total orders`;
}

// ── Top Selling Products ──────────────────────────────────────────────────────
function renderTopSelling(products) {
  const container = document.getElementById('topSellingList');
  if (!container) return;
  if (products.length === 0) {
    container.innerHTML = '<p class="no-data">No product data yet.</p>';
    return;
  }
  container.innerHTML = products.map((p, i) => `
    <div class="insight-item" style="animation-delay:${i * 0.07}s">
      <div class="insight-rank ${i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : ''}">#${i + 1}</div>
      <img class="insight-img" src="${p.image || 'https://via.placeholder.com/42'}" alt="${p.name}" onerror="this.src='https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=80&h=80&fit=crop'">
      <div class="insight-details">
        <div class="insight-name" title="${p.name}">${p.name}</div>
        <div class="insight-cat">${p.category || '—'}</div>
      </div>
      <div class="insight-sales sales-high">
        <i class="fas fa-arrow-up" style="font-size:10px;margin-right:3px"></i>
        ${fmt(p.sales)} sold
      </div>
    </div>
  `).join('');
}

// ── Low Selling Products ──────────────────────────────────────────────────────
function renderLowSelling(products) {
  const container = document.getElementById('lowSellingList');
  if (!container) return;
  if (products.length === 0) {
    container.innerHTML = '<p class="no-data">All products selling well!</p>';
    return;
  }
  container.innerHTML = products.map((p, i) => {
    const salesClass = (p.sales || 0) === 0 ? 'sales-zero' : 'sales-low';
    const salesIcon  = (p.sales || 0) === 0 ? 'fas fa-times-circle' : 'fas fa-arrow-down';
    const salesLabel = (p.sales || 0) === 0 ? 'No sales' : `${fmt(p.sales)} sold`;
    return `
    <div class="insight-item" style="animation-delay:${i * 0.07}s">
      <div class="insight-rank low">!</div>
      <img class="insight-img" src="${p.image || 'https://via.placeholder.com/42'}" alt="${p.name}" onerror="this.src='https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=80&h=80&fit=crop'">
      <div class="insight-details">
        <div class="insight-name" title="${p.name}">${p.name}</div>
        <div class="insight-cat">${p.category || '—'}</div>
      </div>
      <div class="insight-sales ${salesClass}">
        <i class="${salesIcon}" style="font-size:10px;margin-right:3px"></i>
        ${salesLabel}
      </div>
    </div>`;
  }).join('');
}

// ── Status Bars ───────────────────────────────────────────────────────────────
function renderStatusBars(kpis) {
  const values = {
    barCart:            kpis.cartItems,
    barConfirmed:       kpis.confirmed,
    barDeliveryPending: kpis.deliveryPending,
    barDelivered:       kpis.delivered,
  };
  const fills = {
    fillCart:            kpis.cartItems,
    fillConfirmed:       kpis.confirmed,
    fillDeliveryPending: kpis.deliveryPending,
    fillDelivered:       kpis.delivered,
  };

  const total = Math.max(
    kpis.cartItems + kpis.confirmed + kpis.deliveryPending + kpis.delivered, 1
  );

  Object.entries(values).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = fmt(val);
  });

  // Animate bars after a short delay so CSS transition fires
  requestAnimationFrame(() => {
    setTimeout(() => {
      Object.entries(fills).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.style.width = `${Math.round((val / total) * 100)}%`;
      });
    }, 300);
  });
}

// ── Recent Orders ─────────────────────────────────────────────────────────────
function renderRecentOrders(orders) {
  const tbody = document.getElementById('recentOrdersBody');
  if (!tbody) return;
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">No orders yet. Orders will appear here once customers place them.</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map(o => {
    const statusSlug = (o.status || 'placed').toLowerCase().replace(/\s+/g, '-');
    const date = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return `
    <tr>
      <td><span class="order-id">#${o.id}</span></td>
      <td>
        <div style="font-weight:600;font-size:13px">${o.customer_name || 'Guest'}</div>
        <div style="font-size:11px;color:#94a3b8">${o.customer_email || '—'}</div>
      </td>
      <td style="font-weight:700;color:#22c55e">${fmtRupee(o.total)}</td>
      <td><span class="order-status-badge status-${statusSlug}">${o.status || 'Placed'}</span></td>
      <td style="color:#94a3b8;font-size:12px">${date}</td>
    </tr>`;
  }).join('');
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadDashboard();

// Add spin keyframe dynamically
const styleEl = document.createElement('style');
styleEl.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(styleEl);
