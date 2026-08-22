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
      'out for delivery': 'b-shipped', delivered: 'b-delivered',
      cancelled: 'b-cancelled', rto: 'b-cancelled', paid: 'b-paid'
    };
    return m[(s || '').toLowerCase()] || 'b-placed';
  }

  async function loadOrders() {
    const tbody = document.getElementById('ordersTbody');
    tbody.innerHTML = '<tr><td colspan="9" class="loading"><i class="fas fa-spinner"></i></td></tr>';

    try {
      const params = new URLSearchParams({ page: currentPage, limit: PAGE_SIZE });
      if (currentStatus !== 'all') params.set('status', currentStatus);
      if (currentSearch) params.set('search', currentSearch);

      const res = await adminFetch(`/admin/orders?${params}`);

      // Guard: treat non-2xx responses as errors so we don't destructure
      // `undefined` out of an error JSON like {"error":"Failed to fetch orders"}
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }

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
        tbody.innerHTML = '<tr><td colspan="9" class="no-data">❌ Couldn\'t connect to server — check that the API is running and try again.</td></tr>';

        const countEl = document.getElementById('orderCount');
        if (countEl) countEl.textContent = 'Could not load orders';
        document.getElementById('pageInfo').textContent = '—';
        document.getElementById('prevBtn').disabled = true;
        document.getElementById('nextBtn').disabled = true;
      }
    }
  }

  async function refreshTracking(id, btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    try {
      const res = await adminFetch(`/admin/orders/${id}/refresh-tracking`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`✅ Status updated: ${data.tracking_status || data.status}`, 'ok');
        loadOrders();
      } else {
        showToast(`❌ ${data.error || 'Refresh failed'}`, 'err');
      }
    } catch (err) {
      if (err.message !== 'Session expired') showToast('❌ Network error', 'err');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh'; }
    }
  }

  async function pushShiprocket(id, btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...'; }
    try {
      const res = await adminFetch(`/admin/orders/${id}/push-shiprocket`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`✅ Shipment booked! AWB: ${data.awb}`, 'ok');
        loadOrders();
      } else {
        showToast(`❌ ${data.error || 'Shipment booking failed'}`, 'err');
      }
    } catch (err) {
      if (err.message !== 'Session expired') showToast('❌ Network error', 'err');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Book'; }
    }
  }

  function renderTable(orders) {
    const tbody = document.getElementById('ordersTbody');
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="no-data">No orders found.</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(o => {
      const shipStatus = o.tracking_status || o.status || 'Placed';
      const awb = o.awb_number || '—';
      const courier = o.courier_name || '—';
      const payMode = (o.payment_method || 'COD').toUpperCase();

      let actionBtn = '';
      if (o.awb_number) {
        actionBtn = `<button class="btn-refresh-shipment" data-id="${o.id}" style="padding:4px 8px;font-size:11px;cursor:pointer;border-radius:6px;border:1px solid #cbd5e1;background:#fff;" title="Refresh status from Shiprocket"><i class="fas fa-sync-alt"></i> Refresh</button>`;
      } else {
        actionBtn = `<button class="btn-push-shipment" data-id="${o.id}" style="padding:4px 8px;font-size:11px;cursor:pointer;border-radius:6px;border:none;background:#667eea;color:#fff;" title="Push order to Shiprocket"><i class="fas fa-paper-plane"></i> Book</button>`;
      }

      return `<tr data-id="${o.id}">
        <td><span class="oid">#${o.id}</span></td>
        <td>
          <div style="font-weight:600">${esc(o.customer_name || 'Guest')}</div>
          <div style="font-size:11px;color:var(--muted)">${esc(o.customer_email || '—')}</div>
        </td>
        <td style="font-weight:700;color:var(--green)">${fmtRupee(o.total)}</td>
        <td><span class="badge" style="background:#eef2ff;color:#4f46e5;font-weight:700;">${payMode}</span></td>
        <td><span class="badge ${badgeClass(shipStatus)}">${esc(shipStatus)}</span></td>
        <td><span style="font-family:monospace;font-size:12px;font-weight:600;color:#334155">${esc(awb)}</span></td>
        <td style="font-size:12px;color:var(--muted)">${esc(courier)}</td>
        <td style="font-size:12px;color:var(--muted)">${fmtDate(o.created_at)}</td>
        <td style="text-align:center" onclick="event.stopPropagation()">
          ${actionBtn}
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.onclick = () => openModal(tr.dataset.id);
    });

    tbody.querySelectorAll('.btn-refresh-shipment').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        refreshTracking(btn.dataset.id, btn);
      };
    });
    tbody.querySelectorAll('.btn-push-shipment').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        pushShiprocket(btn.dataset.id, btn);
      };
    });
  }

  async function openModal(id) {
    currentOrderId = id;
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.add('open');
    document.getElementById('modalInfo').innerHTML =
      '<div style="color:var(--muted);grid-column:1/-1">Loading…</div>';
    document.getElementById('modalShipment').innerHTML = '';
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

      const shipmentEl = document.getElementById('modalShipment');
      if (o.awb_number || o.shipment_id) {
        shipmentEl.innerHTML = `
          <div style="background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div><strong>Shipment ID:</strong> ${esc(o.shipment_id || 'N/A')}</div>
              <button class="btn-refresh-shipment" data-id="${o.id}" style="padding:4px 8px;font-size:11px;cursor:pointer;border-radius:6px;border:1px solid #cbd5e1;background:#fff;"><i class="fas fa-sync-alt"></i> Refresh</button>
            </div>
            <div><strong>AWB Code:</strong> <span style="font-family:monospace;font-weight:700;">${esc(o.awb_number || 'N/A')}</span></div>
            <div><strong>Courier:</strong> ${esc(o.courier_name || 'N/A')}</div>
            <div><strong>Shiprocket Status:</strong> ${esc(o.tracking_status || o.status || 'N/A')}</div>
            ${o.estimated_delivery ? `<div><strong>Est. Delivery:</strong> ${fmtDate(o.estimated_delivery)}</div>` : ''}
          </div>
        `;
        shipmentEl.querySelector('.btn-refresh-shipment')?.addEventListener('click', (e) => {
          refreshTracking(o.id, e.currentTarget);
        });
      } else {
        shipmentEl.innerHTML = `
          <div style="background:#fffbe6;padding:12px;border-radius:8px;border:1px solid #ffe58f;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
            <span><i class="fas fa-exclamation-triangle" style="color:#faad14;"></i> Not yet pushed to Shiprocket</span>
            <button class="btn-push-shipment" data-id="${o.id}" style="padding:4px 10px;font-size:12px;cursor:pointer;border-radius:6px;border:none;background:#667eea;color:#fff;"><i class="fas fa-paper-plane"></i> Book Shipment</button>
          </div>
        `;
        shipmentEl.querySelector('.btn-push-shipment')?.addEventListener('click', (e) => {
          pushShiprocket(o.id, e.currentTarget);
        });
      }

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
