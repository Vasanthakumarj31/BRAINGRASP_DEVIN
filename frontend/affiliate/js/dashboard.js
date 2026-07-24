/* Affiliate Dashboard UI Logic */
const API_BASE = (window.AFF_CONFIG && window.AFF_CONFIG.API_BASE) || 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', async () => {
  checkAuth(true);

  // Setup sidebar user info
  const user = getAffUser();
  if (user) {
    const nameEl = document.getElementById('affUserName');
    const emailEl = document.getElementById('affUserEmail');
    const avatarEl = document.getElementById('affUserAvatar');
    if (nameEl) nameEl.textContent = user.name || 'Affiliate';
    if (emailEl) emailEl.textContent = user.email || '';
    if (avatarEl) avatarEl.textContent = (user.name || 'A')[0].toUpperCase();
  }

  // Load dashboard data
  await loadDashboardData();
  await loadCommissions();
  await loadPayouts();

  // Copy referral link handler
  const copyBtn = document.getElementById('btnCopyLink');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const linkInput = document.getElementById('refLinkInput');
      if (linkInput) {
        navigator.clipboard.writeText(linkInput.value).then(() => {
          showCopyToast();
        }).catch(() => {
          linkInput.select();
          document.execCommand('copy');
          showCopyToast();
        });
      }
    });
  }

  // Logout button handler
  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) logoutBtn.addEventListener('click', logoutAffiliate);

  // Mobile sidebar toggle
  const toggleBtn = document.getElementById('mobileToggle');
  const sidebar = document.querySelector('.aff-sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
});

function showCopyToast() {
  const copyBtn = document.getElementById('btnCopyLink');
  if (copyBtn) {
    const origHTML = copyBtn.innerHTML;
    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    copyBtn.style.background = '#10B981';
    setTimeout(() => {
      copyBtn.innerHTML = origHTML;
      copyBtn.style.background = '';
    }, 2000);
  }
}

async function loadDashboardData() {
  const token = getAffToken();
  try {
    const res = await fetch(`${API_BASE}/api/affiliate/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) logoutAffiliate();
      return;
    }

    const data = await res.json();
    const { affiliate, stats } = data;

    // Update referral link
    const origin = window.location.origin;
    const refLink = `${origin}/?ref=${affiliate.code}`;
    const linkInput = document.getElementById('refLinkInput');
    if (linkInput) linkInput.value = refLink;

    const affCodeBadge = document.getElementById('affCodeDisplay');
    if (affCodeBadge) affCodeBadge.textContent = `ID: ${affiliate.id} | Code: ${affiliate.code}`;

    // Update Stats Cards
    setElText('valTotalClicks', stats.totalClicks.toLocaleString());
    setElText('valTotalSales', stats.totalSalesCount.toLocaleString());
    setElText('valTotalEarned', `₹${stats.totalEarned.toLocaleString()}`);
    setElText('valWalletBalance', `₹${stats.currentWalletBalance.toLocaleString()}`);
    setElText('valNextPayoutDate', stats.nextPayoutDate || '1st of next month');
    setElText('valDaysRemaining', `${stats.daysRemaining} Days`);
  } catch (err) {
    console.error('Failed to load affiliate stats:', err);
  }
}

async function loadCommissions() {
  const tableBody = document.getElementById('commissionsTableBody');
  if (!tableBody) return;

  const token = getAffToken();
  try {
    const res = await fetch(`${API_BASE}/api/affiliate/commissions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;

    const commissions = await res.json();
    if (!commissions.length) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748B;padding:20px;">No commissions earned yet. Share your referral link to start earning!</td></tr>`;
      return;
    }

    tableBody.innerHTML = commissions.map(c => `
      <tr>
        <td>#${c.order_id || 'N/A'}</td>
        <td>₹${Number(c.order_amount).toLocaleString()}</td>
        <td>${c.commission_pct}%</td>
        <td><strong style="color:var(--primary)">₹${Number(c.commission_amount).toLocaleString()}</strong></td>
        <td><span class="badge ${String(c.status).toLowerCase()}">${c.status}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load commissions:', err);
  }
}

async function loadPayouts() {
  const tableBody = document.getElementById('payoutsTableBody');
  if (!tableBody) return;

  const token = getAffToken();
  try {
    const res = await fetch(`${API_BASE}/api/affiliate/payouts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;

    const payouts = await res.json();
    if (!payouts.length) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748B;padding:20px;">No payout history yet. Monthly payouts are processed by admin on the 1st of every month.</td></tr>`;
      return;
    }

    tableBody.innerHTML = payouts.map(p => `
      <tr>
        <td>₹${Number(p.amount).toLocaleString()}</td>
        <td>${new Date(p.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
        <td><span class="badge paid">${p.status}</span></td>
        <td>${p.payment_reference || 'Manual Payout'}</td>
        <td>${p.admin_note || '-'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load payouts:', err);
  }
}

function setElText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
