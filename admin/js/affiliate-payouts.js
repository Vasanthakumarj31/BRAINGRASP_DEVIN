/* Admin Monthly Affiliate Payouts Module */
(function () {
  const { apiBase, getToken, requireAuth, bindLogout, showToast, esc } = window.AdminApp;

  if (!requireAuth()) return;
  bindLogout();

  function getAuthHeaders() {
    return { 'Authorization': `Bearer ${getToken()}` };
  }

  function escapeHTML(str) {
    return esc(str);
  }

  let activeSelectedAffiliateId = null;

  document.addEventListener('DOMContentLoaded', async () => {
    await loadWallets();
    await loadPayoutHistory();

    // Save payout day setting
    const btnSave = document.getElementById('btnSaveDay');
    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        const day = document.getElementById('payoutDayInput').value;
        try {
          const res = await fetch(`${apiBase()}/api/admin/affiliate-settings`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ payout_day: day })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to update schedule');
          showToast('✅ ' + data.message, 'ok');
          await loadWallets();
        } catch (e) {
          showToast('❌ ' + e.message, 'err');
        }
      });
    }

    // Modal Cancel handler
    const cancelBtn = document.getElementById('modalCancelBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        document.getElementById('payoutModal').classList.remove('open');
        activeSelectedAffiliateId = null;
      });
    }

    // Modal Confirm handler
    const confirmBtn = document.getElementById('modalConfirmBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (!activeSelectedAffiliateId) return;
        const ref = document.getElementById('m_ref').value;
        const note = document.getElementById('m_note').value;
        await processMarkAsPaid(activeSelectedAffiliateId, ref, note);
      });
    }
  });

  async function loadWallets() {
    const tbody = document.getElementById('walletsTableBody');
    const infoEl = document.getElementById('scheduleInfo');

    try {
      const res = await fetch(`${apiBase()}/api/admin/affiliate-wallets`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch affiliate wallets');

      const data = await res.json();
      const { payoutConfig, affiliates } = data;

      if (infoEl) {
        infoEl.textContent = `Payouts occur monthly on day ${payoutConfig.payoutDay}. Next scheduled payout: ${payoutConfig.nextPayoutDate} (${payoutConfig.daysRemaining} days remaining)`;
      }
      const inputDay = document.getElementById('payoutDayInput');
      if (inputDay) inputDay.value = payoutConfig.payoutDay;

      renderWalletsTable(affiliates);
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="no-data">❌ ${err.message}</td></tr>`;
    }
  }

  function renderWalletsTable(affiliates) {
    const tbody = document.getElementById('walletsTableBody');
    if (!tbody) return;

    if (!affiliates.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="no-data">No affiliates registered yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = affiliates.map(a => {
      const bal = Number(a.current_balance);
      const hasUnpaid = bal > 0;

      return `
        <tr>
          <td><code style="background:rgba(79,126,247,.15); color:#4f7ef7; padding:2px 8px; border-radius:4px; font-weight:700;">${a.affiliate_code}</code></td>
          <td><strong>${escapeHTML(a.name)}</strong></td>
          <td>${escapeHTML(a.email)} ${a.phone ? '<br><small style="color:#64748b">' + escapeHTML(a.phone) + '</small>' : ''}</td>
          <td><strong style="font-size:1.1rem; color:${hasUnpaid ? '#22c55e' : '#64748b'}">₹${bal.toLocaleString()}</strong></td>
          <td>₹${Number(a.total_earned).toLocaleString()}</td>
          <td>${a.last_payout_date ? new Date(a.last_payout_date).toLocaleDateString('en-GB') : 'Never'}</td>
          <td>
            ${hasUnpaid ? `
              <button class="btn-primary" style="background:#22c55e; padding:6px 14px; font-size:12px;" onclick="openPayoutModal(${a.affiliate_id}, '${escapeHTML(a.name)}', ${bal})">
                <i class="fas fa-check-circle"></i> Mark as Paid
              </button>
            ` : `
              <span style="color:#64748b; font-size:12px; font-weight:600;"><i class="fas fa-check"></i> Paid Up</span>
            `}
          </td>
        </tr>
      `;
    }).join('');
  }

  function openPayoutModal(affiliateId, name, amount) {
    activeSelectedAffiliateId = affiliateId;
    document.getElementById('modalTitle').textContent = `Pay ₹${amount.toLocaleString()} to ${name}`;
    document.getElementById('modalSub').textContent = `Confirm manual offline payment. This action will reset the affiliate's current wallet balance to ₹0.`;
    document.getElementById('m_ref').value = '';
    document.getElementById('m_note').value = '';
    document.getElementById('payoutModal').classList.add('open');
  }

  async function processMarkAsPaid(affiliateId, payment_reference, admin_note) {
    const btn = document.getElementById('modalConfirmBtn');
    btn.disabled = true;

    try {
      const res = await fetch(`${apiBase()}/api/admin/affiliate-payouts/${affiliateId}`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_reference, admin_note })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process payout');

      showToast('✅ ' + data.message, 'ok');
      document.getElementById('payoutModal').classList.remove('open');
      activeSelectedAffiliateId = null;

      await loadWallets();
      await loadPayoutHistory();
    } catch (err) {
      showToast('❌ ' + err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function loadPayoutHistory() {
    const tbody = document.getElementById('payoutHistoryTableBody');
    if (!tbody) return;

    try {
      const res = await fetch(`${apiBase()}/api/admin/affiliate-payouts`, { headers: getAuthHeaders() });
      if (!res.ok) return;

      const payouts = await res.json();
      if (!payouts.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="no-data">No recorded payout history yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = payouts.map(p => `
        <tr>
          <td>${new Date(p.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
          <td><strong>${escapeHTML(p.affiliate_name)}</strong></td>
          <td><code style="background:rgba(79,126,247,.15); color:#4f7ef7; padding:2px 8px; border-radius:4px; font-weight:700;">${p.affiliate_code}</code></td>
          <td><strong style="color:#22c55e">₹${Number(p.amount).toLocaleString()}</strong></td>
          <td>${p.payment_reference ? escapeHTML(p.payment_reference) : '<span style="color:#64748b">Manual Transfer</span>'}</td>
          <td>${p.admin_note ? escapeHTML(p.admin_note) : '-'}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load payout history:', err);
    }
  }

  window.openPayoutModal = openPayoutModal;
})();
