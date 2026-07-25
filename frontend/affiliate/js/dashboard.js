/* Affiliate Dashboard UI Logic */
// API_BASE is declared in auth.js which loads before this script

document.addEventListener('DOMContentLoaded', async () => {
  checkAuth(true);

  // Show cached user info immediately from localStorage while API loads
  const cachedUser = getAffUser();
  if (cachedUser) {
    updateSidebarUser(cachedUser.name, cachedUser.email);
  }

  // Load fresh data from API
  await loadDashboardData();
  await loadCommissions();

  // Copy referral link handler
  const copyBtn = document.getElementById('btnCopyLink');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const linkInput = document.getElementById('refLinkInput');
      const val = linkInput && linkInput.value;
      if (!val || val.includes('Loading') || val.includes('Failed')) return;
      navigator.clipboard.writeText(val).then(() => {
        showCopyFeedback(copyBtn, '<i class="fas fa-check"></i> Copied!', '#10B981');
      }).catch(() => {
        linkInput.select();
        document.execCommand('copy');
        showCopyFeedback(copyBtn, '<i class="fas fa-check"></i> Copied!', '#10B981');
      });
    });
  }

  // Share Link button — uses Web Share API if available, falls back to clipboard
  const shareBtn = document.getElementById('btnShareCopy');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const linkInput = document.getElementById('refLinkInput');
      const url = linkInput && linkInput.value;
      if (!url || url.includes('Loading') || url.includes('Failed')) return;
      if (navigator.share) {
        navigator.share({ title: 'BrainyGrasp — Shop Smart!', text: 'Use my referral link to shop at BrainyGrasp:', url });
      } else {
        navigator.clipboard.writeText(url).then(() => {
          showCopyFeedback(shareBtn, '<i class="fas fa-check"></i> Copied!', '#10B981');
        }).catch(() => {});
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

function showCopyFeedback(btn, html, color) {
  const orig = btn.innerHTML;
  const origColor = btn.style.background;
  btn.innerHTML = html;
  btn.style.background = color;
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.style.background = origColor;
  }, 2000);
}

function setElText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Data Loaders ─────────────────────────────────────────────────────────────

async function loadDashboardData() {
  const token = getAffToken();
  const linkInput = document.getElementById('refLinkInput');

  // Add skeleton loading class while fetching
  const statVals = ['valTotalClicks','valTotalSales','valTotalEarned','valWalletBalance','valNextPayoutDate','valDaysRemaining'];
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

    // Sync sidebar user info from fresh API data
    if (affiliate) {
      updateSidebarUser(affiliate.name, affiliate.email);
      // Persist fresh data to localStorage for instant display on next load
      const cached = getAffUser() || {};
      localStorage.setItem('bg_aff_user', JSON.stringify({
        ...cached,
        name: affiliate.name,
        email: affiliate.email,
        code: affiliate.code,
        commission_pct: affiliate.commission_pct
      }));
    }

    // Build referral link
    const origin = window.location.origin;
    // Use store root — strip /affiliate/ path segment
    const storeOrigin = origin.replace(/\/affiliate\/?$/, '');
    const refLink = `${storeOrigin}/?ref=${affiliate.code}`;
    if (linkInput) linkInput.value = refLink;

    // Wire up WhatsApp share button
    const waBtn = document.getElementById('btnShareWhatsApp');
    if (waBtn) {
      const waText = encodeURIComponent(`Shop BrainyGrasp educational toys with my referral! Get great deals here: ${refLink}`);
      waBtn.href = `https://wa.me/?text=${waText}`;
    }

    // Update affiliate code badge and commission %
    const affCodeBadge = document.getElementById('affCodeDisplay');
    if (affCodeBadge) affCodeBadge.textContent = `Code: ${affiliate.code}`;
    setElText('valCommissionPct', `${affiliate.commission_pct || 20}%`);

    // Update Stats Cards
    setElText('valTotalClicks',    (stats.totalClicks       || 0).toLocaleString());
    setElText('valTotalSales',     (stats.totalSalesCount   || 0).toLocaleString());
    setElText('valTotalEarned',    `₹${(stats.totalEarned         || 0).toLocaleString()}`);
    setElText('valWalletBalance',  `₹${(stats.currentWalletBalance || 0).toLocaleString()}`);
    setElText('valNextPayoutDate', stats.nextPayoutDate || '1st of next month');
    setElText('valDaysRemaining',  `${stats.daysRemaining || 0} Days`);

  } catch (err) {
    console.error('Failed to load affiliate stats:', err);
    statVals.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('skeleton-loading');
    });
    if (linkInput) {
      linkInput.value = '';
      linkInput.placeholder = '⚠️ Failed to load. Reload the page to retry.';
    }
    // If it's a network/auth failure on first load, clear and redirect
    if (err && (err.message || '').includes('401') || (err && (err.message || '').includes('403'))) {
      logoutAffiliate();
    }
  }
}

async function loadCommissions() {
  const tableBody = document.getElementById('commissionsTableBody');
  if (!tableBody) return;

  const token = getAffToken();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${API_BASE}/api/affiliate/commissions`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Server error (${res.status})`);

    const commissions = await res.json();
    if (!commissions || !commissions.length) {
      tableBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center;color:#64748B;padding:28px;">
          <div style="font-size:2rem; margin-bottom:8px;">🎯</div>
          No commissions yet. Share your referral link to start earning!
        </td></tr>`;
      return;
    }

    tableBody.innerHTML = commissions.map(c => `
      <tr>
        <td><span style="font-family:monospace; font-weight:600;">#${c.order_id || 'N/A'}</span></td>
        <td>₹${Number(c.order_amount || 0).toLocaleString()}</td>
        <td><span style="background:rgba(255,107,53,0.1);color:var(--primary);padding:2px 8px;border-radius:6px;font-weight:700;">${c.commission_pct}%</span></td>
        <td><strong style="color:var(--primary)">₹${Number(c.commission_amount || 0).toLocaleString()}</strong></td>
        <td><span class="badge ${String(c.status || 'pending').toLowerCase()}">${c.status || 'PENDING'}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load commissions:', err);
    tableBody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;color:#EF4444;padding:20px;">
        ⚠️ Failed to load commission history.
        <button onclick="loadCommissions()" class="btn-retry" style="margin-left:8px;">
          <i class="fas fa-redo"></i> Retry
        </button>
      </td></tr>`;
  }
}
