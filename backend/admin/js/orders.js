/* BrainGrasp Admin — Orders (live list, detail modal, status updates) */
(function () {
  const {
    requireAuth, bindLogout, adminFetch, showToast, esc, fmtDate, fmtRupee
  } = window.AdminApp;

  if (!requireAuth()) return;
  bindLogout();

  let currentStatus = 'all';
  let currentSearch = '';
  let currentPage = 1;
  let totalOrders = 0;
  let currentOrderId = null;

  const PAGE_SIZE = 20;

  function badgeClass(s) {
    const m = {
      placed: 'b-placed', confirmed: 'b-confirmed', shipped: 'b-shipped',
      delivered: 'b-delivered', cancelled: 'b-cancelled', paid: 'b-paid'
    };
    return m[(s || '').toLowerCase()] || 'b-placed';
  }

  async function loadOrders() {
    const tbody = document.getElementById('ordersTbody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading"><i class="fas fa-spinner"></i></td></tr>';

    try {
      const params = new URLSearchParams({ page: currentPage, limit: PAGE_SIZE });
      if (currentStatus !== 'all') params.set('status', currentStatus);
      if (currentSearch) params.set('search', currentSearch);

      const res = await adminFetch(`/admin/orders?${params}`);
      const { orders, total } = await res.json();
      totalOrders = total;
      renderTable(orders);

      const countEl = document.getElementById('orderCount');
      if (countEl) countEl.textContent = `${total} order${total !== 1 ? 's' : ''} total`;

      document.getElementById('pageInfo').textContent =
        `Showing ${orders.length} of ${total} (page ${currentPage})`;
      document.getElementById('prevBtn').disabled = currentPage <= 1;
      document.getElementById('nextBtn').disabled = currentPage * PAGE_SIZE >= total;
    } catch (err) {
      if (err.message !== 'Session expired') {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">Failed to load orders. Check that the API is running.</td></tr>';
      }
    }
  }

  function renderTable(orders) {
    const tbody = document.getElementById('ordersTbody');
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="no-data">No orders found.</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(o => {
      const addr = [o.line1, o.city, o.state, o.pincode].filter(Boolean).join(', ');
      const items = Array.isArray(o.items) ? o.items : [];
      const itemCount = items.reduce((s, i) => s + (i.quantity || 1), 0);
      return `<tr data-id="${o.id}">
        <td><span class="oid">#${o.id}</span></td>
        <td>
          <div style="font-weight:600">${esc(o.customer_name || 'Guest')}</div>
          <div style="font-size:11px;color:var(--muted)">${esc(o.customer_email || '—')}</div>
        </td>
        <td style="font-size:12px;max-width:180px">
          ${esc(o.addr_name || '')}<br>
          <span style="color:var(--muted)">${esc(addr || '—')}</span><br>
          <span style="color:var(--muted)">${esc(o.addr_phone || '')}</span>
        </td>
        <td style="font-weight:600">${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
        <td style="font-weight:700;color:var(--green)">${fmtRupee(o.total)}</td>
        <td><span class="badge ${badgeClass(o.status)}">${esc(o.status || 'Placed')}</span></td>
        <td style="font-size:12px">${fmtDate(o.expected_delivery)}</td>
        <td style="font-size:12px;color:var(--muted)">${fmtDate(o.created_at)}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.onclick = () => openModal(tr.dataset.id);
    });
  }

  async function openModal(id) {
    currentOrderId = id;
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.add('open');
    document.getElementById('modalInfo').innerHTML =
      '<div style="color:var(--muted);grid-column:1/-1">Loading…</div>';
    document.getElementById('modalItems').innerHTML = '';
    document.getElementById('modalTotals').innerHTML = '';

    try {
      const res = await adminFetch(`/admin/orders/${id}`);
      const o = await res.json();

      document.getElementById('modalTitle').textContent = `Order #${o.id} · ${o.status}`;

      const addressLine = [o.addr_name, o.line1, o.city, o.state, o.pincode].filter(Boolean).join(', ');
      document.getElementById('modalInfo').innerHTML = `
        <div class="info-block"><label>Customer</label><span>${esc(o.customer_name || 'Guest')}</span></div>
        <div class="info-block"><label>Email</label><span>${esc(o.customer_email || '—')}</span></div>
        <div class="info-block"><label>Phone</label><span>${esc(o.addr_phone || '—')}</span></div>
        <div class="info-block"><label>Payment</label><span>${esc((o.payment_method || 'cod').toUpperCase())}</span></div>
        <div class="info-block" style="grid-column:1/-1">
          <label>Delivery Address</label><span>${esc(addressLine || '—')}</span>
        </div>
        <div class="info-block"><label>Expected Delivery</label><span>${fmtDate(o.expected_delivery)}</span></div>
        <div class="info-block"><label>Actual Delivery</label><span>${fmtDate(o.delivery_date)}</span></div>
        <div class="info-block"><label>Order Date</label><span>${fmtDate(o.created_at)}</span></div>
        ${o.admin_note ? `<div class="info-block" style="grid-column:1/-1"><label>Admin Note</label><span>${esc(o.admin_note)}</span></div>` : ''}
      `;

      const items = Array.isArray(o.items) ? o.items : [];
      document.getElementById('modalItems').innerHTML = items.map(it => `
        <div class="item-row">
          <div>
            <div class="item-name">${esc(it.name || '—')}</div>
            <div class="item-meta">Qty: ${it.quantity || 1} × ${fmtRupee(it.price)}</div>
          </div>
          <div class="item-price">${fmtRupee(it.price * (it.quantity || 1))}</div>
        </div>
      `).join('');

      const shipping = o.total - o.subtotal;
      document.getElementById('modalTotals').innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted)">
          <span>Subtotal</span><span>${fmtRupee(o.subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-top:4px">
          <span>Shipping</span><span>${shipping > 0 ? fmtRupee(shipping) : 'FREE'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;margin-top:8px">
          <span>Total</span><span style="color:var(--green)">${fmtRupee(o.total)}</span>
        </div>
      `;

      document.getElementById('statusSelect').value = o.status || 'Placed';
      document.getElementById('expectedDeliveryInput').value =
        o.expected_delivery ? o.expected_delivery.split('T')[0] : '';
      document.getElementById('deliveryDateInput').value =
        o.delivery_date ? o.delivery_date.split('T')[0] : '';
      document.getElementById('adminNoteInput').value = o.admin_note || '';
    } catch (err) {
      if (err.message !== 'Session expired') {
        document.getElementById('modalInfo').innerHTML =
          '<div style="color:var(--red)">Failed to load order.</div>';
      }
    }
  }

  document.getElementById('modalClose')?.addEventListener('click', () => {
    document.getElementById('modalOverlay').classList.remove('open');
  });
  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') {
      document.getElementById('modalOverlay').classList.remove('open');
    }
  });

  document.getElementById('saveStatusBtn')?.addEventListener('click', async () => {
    if (!currentOrderId) return;
    const btn = document.getElementById('saveStatusBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    try {
      const res = await adminFetch(`/admin/orders/${currentOrderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: document.getElementById('statusSelect').value,
          expected_delivery: document.getElementById('expectedDeliveryInput').value || null,
          delivery_date: document.getElementById('deliveryDateInput').value || null,
          admin_note: document.getElementById('adminNoteInput').value || null
        })
      });

      if (res.ok) {
        showToast('✅ Order updated successfully!', 'ok');
        document.getElementById('modalOverlay').classList.remove('open');
        loadOrders();
      } else {
        showToast('❌ Failed to update order', 'err');
      }
    } catch (err) {
      if (err.message !== 'Session expired') showToast('❌ Network error', 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status;
      currentPage = 1;
      loadOrders();
    });
  });

  let searchTimer;
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      loadOrders();
    }, 400);
  });

  document.getElementById('prevBtn')?.addEventListener('click', () => {
    currentPage--;
    loadOrders();
  });
  document.getElementById('nextBtn')?.addEventListener('click', () => {
    currentPage++;
    loadOrders();
  });

  loadOrders();
})();
