// ── Config ───────────────────────────────────────────────────────────────────
const API = 'http://localhost:3000/api';

// ── Auth Guard ───────────────────────────────────────────────────────────────
const token = localStorage.getItem('adminToken');
const isLoginPage = window.location.pathname.includes('login');

if (!token && !isLoginPage) {
  window.location.href = 'login.html';
} else if (token && isLoginPage) {
  window.location.href = 'index.html';
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorDiv = document.getElementById('loginError');
    errorDiv.style.display = 'none';

    try {
      const res = await fetch(`${API}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginForm.username.value,
          password: loginForm.password.value
        })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('adminToken', data.token);
        window.location.href = 'index.html';
      } else {
        errorDiv.textContent = data.error || 'Login failed';
        errorDiv.style.display = 'block';
      }
    } catch {
      errorDiv.textContent = 'Network error. Is the backend running?';
      errorDiv.style.display = 'block';
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD PAGE
// ─────────────────────────────────────────────────────────────────────────────
if (!isLoginPage) {

  // ── Logout ──────────────────────────────────────────────────────────────
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('adminToken');
    window.location.href = 'login.html';
  });

  // ── Toast helper ────────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast toast-${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  // ── State ────────────────────────────────────────────────────────────────
  let allProducts = [];   // flat array of all products
  let editMode = false;

  // ── Load Products ────────────────────────────────────────────────────────
  async function loadProducts() {
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading-row">Loading…</td></tr>';

    try {
      // Call the PROTECTED admin endpoint — returns grouped { trending:[…], … }
      const res = await fetch(`${API}/admin/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('adminToken');
        window.location.href = 'login.html';
        return;
      }
      const grouped = await res.json();   // { trending:[...], bestsellers:[...], … }

      // Flatten and attach group_name to each product
      allProducts = [];
      for (const [group, items] of Object.entries(grouped)) {
        items.forEach(p => { p.group_name = p.group_name || group; allProducts.push(p); });
      }

      // Sort newest first
      allProducts.sort((a, b) => b.id - a.id);

      renderTable(allProducts);
      document.getElementById('productCount').textContent =
        `${allProducts.length} product${allProducts.length !== 1 ? 's' : ''} in database`;

    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="8" class="error-row">⚠️ Failed to load products. Is the backend running?</td></tr>';
      console.error(err);
    }
  }

  // ── Render Table ─────────────────────────────────────────────────────────
  function renderTable(products) {
    const tbody = document.getElementById('productsTableBody');
    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No products found. Add one above!</td></tr>';
      return;
    }

    tbody.innerHTML = products.map(p => `
      <tr>
        <td><span class="id-badge">#${p.id}</span></td>
        <td class="img-cell">
          <img src="${p.image}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/60x45?text=No+Img'">
        </td>
        <td class="name-cell">${p.name}</td>
        <td><span class="group-tag group-${p.group_name}">${capitalize(p.group_name)}</span></td>
        <td>${p.category || '—'}</td>
        <td class="price-cell">₹${Number(p.price).toLocaleString()}</td>
        <td><span class="badge-tag badge-${p.badge}">${p.badge || '—'}</span></td>
        <td class="actions-cell">
          <button class="btn-edit" data-id="${p.id}">✏️ Edit</button>
          <button class="btn-del" data-id="${p.id}">🗑 Delete</button>
        </td>
      </tr>
    `).join('');

    // Attach action listeners
    tbody.querySelectorAll('.btn-del').forEach(btn =>
      btn.addEventListener('click', () => deleteProduct(btn.dataset.id))
    );
    tbody.querySelectorAll('.btn-edit').forEach(btn =>
      btn.addEventListener('click', () => openEditForm(btn.dataset.id))
    );
  }

  // ── Capitalize helper ─────────────────────────────────────────────────────
  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  // ── Search Filter ─────────────────────────────────────────────────────────
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.group_name || '').toLowerCase().includes(q)
    );
    renderTable(filtered);
  });

  // ── Form Show/Hide ────────────────────────────────────────────────────────
  const formSection   = document.getElementById('productFormSection');
  const showAddBtn    = document.getElementById('showAddFormBtn');
  const cancelFormBtn = document.getElementById('cancelFormBtn');

  showAddBtn?.addEventListener('click', () => {
    editMode = false;
    resetForm();
    document.getElementById('formTitle').textContent = 'Add New Product';
    document.getElementById('submitBtn').textContent = '💾 Save Product';
    formSection.style.display = 'block';
    formSection.scrollIntoView({ behavior: 'smooth' });
  });

  cancelFormBtn?.addEventListener('click', () => {
    formSection.style.display = 'none';
    resetForm();
  });

  // ── Image Preview ─────────────────────────────────────────────────────────
  document.getElementById('f_image')?.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    const preview = document.getElementById('imagePreview');
    const img     = document.getElementById('previewImg');
    if (url) {
      img.src = url;
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
  });

  // ── Reset Form ────────────────────────────────────────────────────────────
  function resetForm() {
    document.getElementById('productForm').reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('imagePreview').style.display = 'none';
  }

  // ── Open Edit Form ────────────────────────────────────────────────────────
  function openEditForm(id) {
    const p = allProducts.find(x => String(x.id) === String(id));
    if (!p) return;

    editMode = true;
    document.getElementById('editProductId').value = p.id;
    document.getElementById('f_name').value         = p.name || '';
    document.getElementById('f_group_name').value   = p.group_name || 'trending';
    document.getElementById('f_badge').value        = p.badge || '';
    document.getElementById('f_price').value        = p.price || '';
    document.getElementById('f_original_price').value = p.original_price || '';
    document.getElementById('f_save').value         = p.save || '';
    document.getElementById('f_reviews').value      = p.reviews || 0;
    document.getElementById('f_age').value          = p.age || '';
    document.getElementById('f_age_group').value    = p.age_group || '';
    document.getElementById('f_category').value     = p.category || '';
    document.getElementById('f_type').value         = p.type || 'Single Products';
    document.getElementById('f_theme').value        = p.theme || '';
    document.getElementById('f_launch_date').value  = p.launch_date ? p.launch_date.split('T')[0] : '';
    document.getElementById('f_sales').value        = p.sales || 0;
    document.getElementById('f_offer').value        = p.offer || '';
    document.getElementById('f_image').value        = p.image || '';

    // skills is stored as JSONB — could be array or string
    const skills = Array.isArray(p.skills) ? p.skills.join(', ') : (p.skills || '');
    document.getElementById('f_skills').value = skills;

    // Show image preview
    if (p.image) {
      document.getElementById('previewImg').src = p.image;
      document.getElementById('imagePreview').style.display = 'block';
    }

    document.getElementById('formTitle').textContent = 'Edit Product';
    document.getElementById('submitBtn').textContent = '💾 Update Product';
    formSection.style.display = 'block';
    formSection.scrollIntoView({ behavior: 'smooth' });
  }

  // ── Submit Form (Add or Edit) ─────────────────────────────────────────────
  document.getElementById('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    // Build payload from form fields
    const skillsRaw = document.getElementById('f_skills').value.trim();
    const payload = {
      name:           document.getElementById('f_name').value.trim(),
      group_name:     document.getElementById('f_group_name').value,
      badge:          document.getElementById('f_badge').value,
      price:          document.getElementById('f_price').value,
      original_price: document.getElementById('f_original_price').value || document.getElementById('f_price').value,
      save:           document.getElementById('f_save').value || '0%',
      reviews:        document.getElementById('f_reviews').value || 0,
      age:            document.getElementById('f_age').value.trim(),
      age_group:      document.getElementById('f_age_group').value,
      category:       document.getElementById('f_category').value,
      type:           document.getElementById('f_type').value,
      theme:          document.getElementById('f_theme').value,
      launch_date:    document.getElementById('f_launch_date').value || new Date().toISOString().split('T')[0],
      sales:          document.getElementById('f_sales').value || 0,
      offer:          document.getElementById('f_offer').value.trim() || 'Buy any 2 | Get FLAT 10% OFF',
      image:          document.getElementById('f_image').value.trim(),
      skills:         skillsRaw,   // backend will split comma-separated string
    };

    const editId = document.getElementById('editProductId').value;
    const url    = editMode ? `${API}/admin/products/${editId}` : `${API}/admin/products`;
    const method = editMode ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(editMode ? '✅ Product updated!' : '✅ Product added!');
        formSection.style.display = 'none';
        resetForm();
        loadProducts();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save product', 'error');
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('adminToken');
          window.location.href = 'login.html';
        }
      }
    } catch (err) {
      showToast('Network error. Is the backend running?', 'error');
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = editMode ? '💾 Update Product' : '💾 Save Product';
    }
  });

  // ── Delete Product ────────────────────────────────────────────────────────
  async function deleteProduct(id) {
    if (!confirm('Delete this product? This cannot be undone.')) return;

    try {
      const res = await fetch(`${API}/admin/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showToast('🗑 Product deleted');
        loadProducts();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete', 'error');
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('adminToken');
          window.location.href = 'login.html';
        }
      }
    } catch {
      showToast('Network error', 'error');
    }
  }

  // ── Initial Load ──────────────────────────────────────────────────────────
  loadProducts();
}
