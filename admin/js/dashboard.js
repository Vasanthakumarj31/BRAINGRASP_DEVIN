/* BrainGrasp Admin — Dashboard (live KPIs from API) */
(function () {
  const {
    requireAuth, bindLogout, adminFetch, showToast, esc, animNum, fmtDate
  } = window.AdminApp;

  if (!requireAuth()) return;
  bindLogout();

  const dateEl = document.getElementById('dateLabel');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  document.getElementById('refreshBtn')?.addEventListener('click', () => loadDashboard(true));

  function rankClass(i) {
    return i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
  }

  function renderProducts(listId, items, isLow) {
    const c = document.getElementById(listId);
    if (!c) return;
    if (!items || items.length === 0) {
      c.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:10px 0">No data yet.</p>';
      return;
    }
    c.innerHTML = items.map((p, i) => {
      const sales = p.sales ?? 0;
      const cls = isLow ? (sales === 0 ? 'zero' : 'lo') : 'hi';
      const ico = isLow ? (sales === 0 ? 'fa-times-circle' : 'fa-arrow-down') : 'fa-arrow-up';
      const lbl = sales === 0 ? 'No sales' : `${Number(sales).toLocaleString('en-IN')} sold`;
      return `<div class="pi-item">
        <div class="pi-rank ${isLow ? 'warn' : rankClass(i)}">${isLow ? '!' : '#' + (i + 1)}</div>
        <img class="pi-img" src="${esc(p.image || '')}" alt="${esc(p.name)}" onerror="this.src='https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=80&h=80&fit=crop'">
        <div class="pi-info">
          <div class="pi-name" title="${esc(p.name)}">${esc(p.name)}</div>
          <div class="pi-cat">${esc(p.category || '—')} · ₹${Number(p.price).toLocaleString('en-IN')}</div>
        </div>
        <div class="pi-sales ${cls}"><i class="fas ${ico}" style="font-size:9px;margin-right:3px"></i>${lbl}</div>
      </div>`;
    }).join('');
  }

  function renderBars(kpis) {
    const vals = { bCart: kpis.cartItems, bConf: kpis.confirmed, bPend: kpis.deliveryPending, bDel: kpis.delivered };
    const fills = { fCart: kpis.cartItems, fConf: kpis.confirmed, fPend: kpis.deliveryPending, fDel: kpis.delivered };
    const total = Math.max(Object.values(vals).reduce((a, b) => a + b, 0), 1);
    Object.entries(vals).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Number(v).toLocaleString('en-IN');
    });
    requestAnimationFrame(() => setTimeout(() => {
      Object.entries(fills).forEach(([id, v]) => {
        const el = document.getElementById(id);
        if (el) el.style.width = `${Math.round(v / total * 100)}%`;
      });
    }, 300));
  }

  function statusBadgeClass(status) {
    const slug = (status || 'placed').toLowerCase().replace(/\s+/g, '-');
    return `b-${slug}`;
  }

  function renderOrders(orders) {
    const tbody = document.getElementById('ordersTbody');
    if (!tbody) return;
    if (!orders || orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="no-data">No orders yet. They will appear here once customers place them.</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td><span class="oid">#${o.id}</span></td>
        <td>
          <div style="font-weight:600">${esc(o.customer_name || 'Guest')}</div>
          <div style="font-size:11px;color:var(--muted)">${esc(o.customer_email || '—')}</div>
        </td>
        <td style="font-weight:700;color:var(--green)">₹${Number(o.total).toLocaleString('en-IN')}</td>
        <td><span class="badge ${statusBadgeClass(o.status)}">${esc(o.status || 'Placed')}</span></td>
        <td style="color:var(--muted);font-size:12px">${fmtDate(o.created_at)}</td>
      </tr>
    `).join('');
  }

  async function loadDashboard(showRefreshToast) {
    const btn = document.getElementById('refreshBtn');
    if (btn) btn.style.transform = 'rotate(360deg)';

    try {
      const res = await adminFetch('/admin/dashboard');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const { kpis, topSelling, lowSelling, recentOrders } = await res.json();

      animNum(document.getElementById('kUsers'), kpis.totalUsers);
      animNum(document.getElementById('kTotal'), kpis.totalProducts);
      animNum(document.getElementById('kCart'), kpis.cartItems);
      animNum(document.getElementById('kConfirmed'), kpis.confirmed);
      animNum(document.getElementById('kPending'), kpis.deliveryPending);
      animNum(document.getElementById('kDelivered'), kpis.delivered);
      animNum(document.getElementById('kRevenue'), kpis.totalRevenue, '₹');

      const cn = document.getElementById('kCartNote');
      if (cn) cn.textContent = `${kpis.usersWithCart} users with active cart`;
      const on = document.getElementById('kOrdersNote');
      if (on) on.textContent = `${kpis.totalOrders} total orders`;

      renderBars(kpis);
      renderProducts('topList', topSelling, false);
      renderProducts('lowList', lowSelling, true);
      renderOrders(recentOrders);

      if (showRefreshToast) showToast('Dashboard refreshed ✓', 'ok');
    } catch (err) {
      if (err.message !== 'Session expired') {
        console.error(err);
        showToast('Failed to load dashboard: ' + err.message, 'err');
      }
    } finally {
      setTimeout(() => { if (btn) btn.style.transform = ''; }, 600);
    }
  }

  loadDashboard(false);
})();
