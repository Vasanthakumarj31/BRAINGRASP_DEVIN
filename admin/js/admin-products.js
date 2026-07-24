/* BrainGrasp Admin — Product management */
(function () {
  const {
    requireAuth, bindLogout, adminFetch, showToast, esc
  } = window.AdminApp;

  if (!requireAuth()) return;
  bindLogout();

  let allProducts = [];
  let editMode = false;

  const formSection = document.getElementById('productFormSection');
  const tbody = document.getElementById('productsTableBody');
  if (!tbody) return;

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  async function loadProducts() {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-row">Loading…</td></tr>';

    try {
      const res = await adminFetch('/admin/products');
      const grouped = await res.json();

      allProducts = [];
      for (const [group, items] of Object.entries(grouped)) {
        items.forEach(p => {
          p.group_name = p.group_name || group;
          allProducts.push(p);
        });
      }
      allProducts.sort((a, b) => b.id - a.id);

      renderTable(allProducts);
      const countEl = document.getElementById('productCount');
      if (countEl) {
        countEl.textContent = `${allProducts.length} product${allProducts.length !== 1 ? 's' : ''} in database`;
      }
    } catch (err) {
      if (err.message !== 'Session expired') {
        tbody.innerHTML = '<tr><td colspan="8" class="error-row">⚠️ Failed to load products. Check that the API is running.</td></tr>';
        console.error(err);
      }
    }
  }

  function renderTable(products) {
    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No products found. Add one above!</td></tr>';
      return;
    }

    tbody.innerHTML = products.map(p => `
      <tr>
        <td><span class="id-badge">#${p.id}</span></td>
        <td class="img-cell">
          <img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.src='https://via.placeholder.com/60x45?text=No+Img'">
        </td>
        <td class="name-cell">${esc(p.name)}</td>
        <td><span class="group-tag group-${esc(p.group_name)}">${esc(capitalize(p.group_name))}</span></td>
        <td>${esc(p.category || '—')}</td>
        <td class="price-cell">₹${Number(p.price).toLocaleString('en-IN')}</td>
        <td><span class="badge-tag badge-${esc(p.badge || '')}">${esc(p.badge || '—')}</span></td>
        <td class="actions-cell">
          <button type="button" class="btn-edit" data-id="${p.id}">✏️ Edit</button>
          <button type="button" class="btn-del" data-id="${p.id}">🗑 Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-del').forEach(btn =>
      btn.addEventListener('click', () => deleteProduct(btn.dataset.id))
    );
    tbody.querySelectorAll('.btn-edit').forEach(btn =>
      btn.addEventListener('click', () => openEditForm(btn.dataset.id))
    );
  }

  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderTable(allProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.group_name || '').toLowerCase().includes(q)
    ));
  });

  document.getElementById('showAddFormBtn')?.addEventListener('click', () => {
    editMode = false;
    resetForm();
    document.getElementById('formTitle').textContent = 'Add New Product';
    document.getElementById('submitBtn').textContent = '💾 Save Product';
    formSection.style.display = 'block';
    formSection.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('cancelFormBtn')?.addEventListener('click', () => {
    formSection.style.display = 'none';
    resetForm();
  });

  document.getElementById('f_image')?.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    const preview = document.getElementById('imagePreview');
    const img = document.getElementById('previewImg');
    if (url) {
      img.src = url;
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
  });

  function resetForm() {
    document.getElementById('productForm').reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('imagePreview').style.display = 'none';
  }

  function openEditForm(id) {
    const p = allProducts.find(x => String(x.id) === String(id));
    if (!p) return;

    editMode = true;
    document.getElementById('editProductId').value = p.id;
    document.getElementById('f_name').value = p.name || '';
    document.getElementById('f_group_name').value = p.group_name || 'trending';
    document.getElementById('f_badge').value = p.badge || '';
    document.getElementById('f_price').value = p.price || '';
    document.getElementById('f_original_price').value = p.original_price || '';
    document.getElementById('f_save').value = p.save || '';
    document.getElementById('f_reviews').value = p.reviews || 0;
    document.getElementById('f_age').value = p.age || '';
    document.getElementById('f_age_group').value = p.age_group || '';
    document.getElementById('f_category').value = p.category || '';
    document.getElementById('f_type').value = p.type || 'Single Products';
    document.getElementById('f_theme').value = p.theme || '';
    document.getElementById('f_launch_date').value = p.launch_date ? p.launch_date.split('T')[0] : '';
    document.getElementById('f_sales').value = p.sales || 0;
    document.getElementById('f_offer').value = p.offer || '';
    document.getElementById('f_image').value = p.image || '';

    const skills = Array.isArray(p.skills) ? p.skills.join(', ') : (p.skills || '');
    document.getElementById('f_skills').value = skills;

    if (p.image) {
      document.getElementById('previewImg').src = p.image;
      document.getElementById('imagePreview').style.display = 'block';
    }

    document.getElementById('formTitle').textContent = 'Edit Product';
    document.getElementById('submitBtn').textContent = '💾 Update Product';
    formSection.style.display = 'block';
    formSection.scrollIntoView({ behavior: 'smooth' });
  }

  document.getElementById('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const skillsRaw = document.getElementById('f_skills').value.trim();
    const payload = {
      name: document.getElementById('f_name').value.trim(),
      group_name: document.getElementById('f_group_name').value,
      badge: document.getElementById('f_badge').value,
      price: document.getElementById('f_price').value,
      original_price: document.getElementById('f_original_price').value || document.getElementById('f_price').value,
      save: document.getElementById('f_save').value || '0%',
      reviews: document.getElementById('f_reviews').value || 0,
      age: document.getElementById('f_age').value.trim(),
      age_group: document.getElementById('f_age_group').value,
      category: document.getElementById('f_category').value,
      type: document.getElementById('f_type').value,
      theme: document.getElementById('f_theme').value,
      launch_date: document.getElementById('f_launch_date').value || new Date().toISOString().split('T')[0],
      sales: document.getElementById('f_sales').value || 0,
      offer: document.getElementById('f_offer').value.trim() || 'Buy any 2 | Get FLAT 10% OFF',
      image: document.getElementById('f_image').value.trim(),
      skills: skillsRaw
    };

    const editId = document.getElementById('editProductId').value;
    const path = editMode ? `/admin/products/${editId}` : '/admin/products';

    try {
      const res = await adminFetch(path, {
        method: editMode ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(editMode ? '✅ Product updated!' : '✅ Product added!', 'success');
        formSection.style.display = 'none';
        resetForm();
        loadProducts();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save product', 'error');
      }
    } catch (err) {
      if (err.message !== 'Session expired') {
        showToast('Network error. Check your connection.', 'error');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = editMode ? '💾 Update Product' : '💾 Save Product';
    }
  });

  // ── Delete Confirmation Modal ────────────────────────────────────────────
  let _pendingDeleteId = null;
  const deleteModal   = document.getElementById('deleteModal');
  const deleteCancelBtn  = document.getElementById('deleteCancelBtn');
  const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');

  function openDeleteModal(id) {
    _pendingDeleteId = id;
    deleteModal.classList.add('open');
    deleteModal.style.display = '';
  }

  function closeDeleteModal() {
    _pendingDeleteId = null;
    deleteModal.classList.remove('open');
    deleteModal.style.display = 'none';
  }

  deleteCancelBtn?.addEventListener('click', closeDeleteModal);
  deleteModal?.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  deleteConfirmBtn?.addEventListener('click', async () => {
    if (!_pendingDeleteId) return;
    const id = _pendingDeleteId;
    closeDeleteModal();

    try {
      const res = await adminFetch(`/admin/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('🗑 Product deleted', 'success');
        loadProducts();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete', 'error');
      }
    } catch (err) {
      if (err.message !== 'Session expired') showToast('Network error', 'error');
    }
  });

  function deleteProduct(id) {
    openDeleteModal(id);
  }

  loadProducts();
})();
