/* Affiliate Wallet & Payouts UI Logic */
// API_BASE is declared in auth.js which loads before this script

document.addEventListener('DOMContentLoaded', async () => {
  checkAuth(true);

  // Show cached user info immediately from localStorage while API loads
  const cachedUser = getAffUser();
  if (cachedUser) {
    updateSidebarUser(cachedUser.name, cachedUser.email);
  }

  // Load fresh wallet data and payout history
  await loadWalletData();
  await loadPayouts();

  // Logout handler
  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) logoutBtn.addEventListener('click', logoutAffiliate);

  // Mobile sidebar toggle
  const toggleBtn = document.getElementById('mobileToggle');
  const sidebar = document.querySelector('.aff-sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function updateSidebarUser(name, email) {
  const nameEl   = document.getElementById('affUserName');
  const emailEl  = document.getElementById('affUserEmail');
  const avatarEl = document.getElementById('affUserAvatar');
  if (nameEl)   nameEl.textContent  = name  || 'Affiliate';
  if (emailEl)  emailEl.textContent = email || '';
  if (avatarEl) avatarEl.textContent = (name || '?')[0].toUpperCase();
}

function setElText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Data Loaders ─────────────────────────────────────────────────────────────

async function loadWalletData() {
  const token = getAffToken();

  // Add skeleton loading class while fetching
  const statVals = ['valWalletBalance', 'valTotalEarned', 'valNextPayoutDate', 'valDaysRemaining'];
  statVals.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('skeleton-loading');
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${API_BASE}/api/affiliate/stats`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) { logoutAffiliate(); return; }
      throw new Error(`Server error (${res.status})`);
    }

    const data = await res.json();
    const { affiliate, stats } = data;

    // Remove skeleton classes
    statVals.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('skeleton-loading');
    });

    // Sync sidebar user details from fresh API data
    if (affiliate) {
      updateSidebarUser(affiliate.name, affiliate.email);
    }

    // Update Wallet Stats Cards
    setElText('valWalletBalance',  `₹${(stats.currentWalletBalance || 0).toLocaleString()}`);
    setElText('valTotalEarned',    `₹${(stats.totalEarned          || 0).toLocaleString()}`);
    setElText('valNextPayoutDate', stats.nextPayoutDate || '1st of next month');
    setElText('valDaysRemaining',  `${stats.daysRemaining || 0} Days`);

  } catch (err) {
    console.error('Failed to load wallet stats:', err);
    statVals.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('skeleton-loading');
    });
    // Show error in balance fields rather than leaving them stuck
    setElText('valWalletBalance', '⚠️ Error');
    setElText('valTotalEarned',   '⚠️ Error');
    setElText('valNextPayoutDate','—');
    setElText('valDaysRemaining', '—');
  }
}

async function loadPayouts() {
  const tableBody = document.getElementById('payoutsTableBody');
  if (!tableBody) return;

  const token = getAffToken();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${API_BASE}/api/affiliate/payouts`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Server error (${res.status})`);

    const payouts = await res.json();
    if (!payouts || !payouts.length) {
      tableBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center;color:#64748B;padding:28px;">
          <div style="font-size:2rem; margin-bottom:8px;">💰</div>
          No payout history yet.<br>
          <span style="font-size:0.85rem;">Monthly payouts are processed by admin on the 1st of every month.</span>
        </td></tr>`;
      return;
    }

    tableBody.innerHTML = payouts.map(p => `
      <tr>
        <td><strong style="color:var(--primary)">₹${Number(p.amount || 0).toLocaleString()}</strong></td>
        <td>${new Date(p.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
        <td><span class="badge paid">${p.status || 'PAID'}</span></td>
        <td><span style="font-family:monospace; font-size:0.9rem;">${p.payment_reference || '—'}</span></td>
        <td>${p.admin_note || '—'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load payouts:', err);
    tableBody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;color:#EF4444;padding:20px;">
        ⚠️ Failed to load payout history.
        <button onclick="loadPayouts()" class="btn-retry" style="margin-left:8px;">
          <i class="fas fa-redo"></i> Retry
        </button>
      </td></tr>`;
  }
}
