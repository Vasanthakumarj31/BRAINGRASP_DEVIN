/* Admin Affiliates JS Module */
(function () {
  const { requireAuth, bindLogout, adminFetch, showToast, esc } = window.AdminApp;

  if (!requireAuth()) return;
  bindLogout();

  function escapeHTML(str) {
    return esc(str);
  }

  let allAffiliates = [];

  document.addEventListener('DOMContentLoaded', async () => {
    await loadAffiliates();

    // Search input handler
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = allAffiliates.filter(a =>
          (a.name || '').toLowerCase().includes(q) ||
          (a.email || '').toLowerCase().includes(q) ||
          (a.affiliate_code || '').toLowerCase().includes(q)
        );
        renderAffiliatesTable(filtered);
      });
    }

    // Toggle Form
    const showBtn = document.getElementById('showAddFormBtn');
    const cancelBtn = document.getElementById('cancelFormBtn');
    const formSec = document.getElementById('affiliateFormSection');

    if (showBtn) {
      showBtn.addEventListener('click', () => {
        resetForm();
        document.getElementById('formTitle').textContent = 'Create New Affiliate Account';
        document.getElementById('pwdGroup').style.display = 'block';
        document.getElementById('f_password').required = true;
        document.getElementById('f_email').disabled = false;
        document.getElementById('statusGroup').style.display = 'none';
        formSec.style.display = 'block';
        formSec.scrollIntoView({ behavior: 'smooth' });
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        formSec.style.display = 'none';
        resetForm();
      });
    }

    // Submit Handler
    const form = document.getElementById('affiliateForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleSaveAffiliate();
      });
    }
  });

  async function loadAffiliates() {
    const tbody = document.getElementById('affiliatesTableBody');
    const countEl = document.getElementById('affiliateCount');

    try {
      const res = await adminFetch('/admin/affiliates');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }

      allAffiliates = await res.json();
      if (countEl) countEl.textContent = `${allAffiliates.length} Total Registered Affiliates`;

      renderAffiliatesTable(allAffiliates);
    } catch (err) {
      if (err.message !== 'Session expired') {
        if (countEl) countEl.textContent = 'Could not load affiliates';
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="no-data">❌ Couldn't connect to server — check that the API is running and try again.</td></tr>`;
      }
    }
  }

  function renderAffiliatesTable(affiliates) {
    const tbody = document.getElementById('affiliatesTableBody');
    if (!tbody) return;

    if (!affiliates.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="no-data">No affiliates found. Click "+ Create Affiliate Account" to add one.</td></tr>`;
      return;
    }

    tbody.innerHTML = affiliates.map(a => `
      <tr>
        <td><strong>#${a.id}</strong></td>
        <td><strong>${escapeHTML(a.name)}</strong></td>
        <td>${escapeHTML(a.email)}</td>
        <td><code style="background:rgba(79,126,247,.15); color:#4f7ef7; padding:2px 8px; border-radius:4px; font-weight:700;">${a.affiliate_code}</code></td>
        <td>${a.commission_pct}%</td>
        <td>${a.total_clicks}</td>
        <td>${a.total_sales}</td>
        <td><strong style="color:#22c55e">₹${Number(a.current_balance).toLocaleString()}</strong></td>
        <td><span class="${a.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">${a.status}</span></td>
        <td>
          <button class="btn-secondary" style="padding:4px 10px; font-size:12px;" onclick="editAffiliate(${a.id})">
            <i class="fas fa-edit"></i> Edit
          </button>
        </td>
      </tr>
    `).join('');
  }

  function editAffiliate(id) {
    const aff = allAffiliates.find(a => a.id === id);
    if (!aff) return;

    document.getElementById('editAffiliateId').value = aff.id;
    document.getElementById('formTitle').textContent = `Edit Affiliate: ${aff.name} (${aff.affiliate_code})`;
    document.getElementById('f_name').value = aff.name;
    document.getElementById('f_email').value = aff.email;
    document.getElementById('f_email').disabled = true;
    document.getElementById('pwdGroup').style.display = 'none';
    document.getElementById('f_password').required = false;
    document.getElementById('f_phone').value = aff.phone || '';
    document.getElementById('f_commission').value = aff.commission_pct;
    document.getElementById('f_status').value = aff.status;
    document.getElementById('statusGroup').style.display = 'block';

    const formSec = document.getElementById('affiliateFormSection');
    formSec.style.display = 'block';
    formSec.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleSaveAffiliate() {
    const editId = document.getElementById('editAffiliateId').value;
    const name = document.getElementById('f_name').value;
    const email = document.getElementById('f_email').value;
    const password = document.getElementById('f_password').value;
    const phone = document.getElementById('f_phone').value;
    const commission_pct = document.getElementById('f_commission').value;
    const status = document.getElementById('f_status').value;

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;

    try {
      let path, method, body;

      if (editId) {
        path = `/admin/affiliates/${editId}`;
        method = 'PUT';
        body = JSON.stringify({ name, phone, commission_pct, status });
      } else {
        path = '/admin/affiliates';
        method = 'POST';
        body = JSON.stringify({ name, email, password, phone, commission_pct });
      }

      const res = await adminFetch(path, { method, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save affiliate');

      showToast(editId ? '✅ Affiliate updated successfully!' : '✅ Affiliate created successfully!', 'ok');
      document.getElementById('affiliateFormSection').style.display = 'none';
      resetForm();
      await loadAffiliates();

    } catch (err) {
      showToast('❌ ' + err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  function resetForm() {
    document.getElementById('editAffiliateId').value = '';
    document.getElementById('affiliateForm').reset();
    document.getElementById('f_email').disabled = false;
  }

  window.editAffiliate = editAffiliate;
})();
