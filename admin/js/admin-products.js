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

  // ── Image URL Helper & Validation ─────────────────────────────────────────
  function validateImageUrl(url) {
    if (!url) return { valid: false, message: 'Image URL is required' };
    const trimmed = url.trim();

    if (trimmed.includes('photos.google.com') || trimmed.includes('photos.app.goo.gl')) {
      return {
        valid: false,
        isGooglePhotos: true,
        message: 'Google Photos web sharing links are not direct image files. Please enter a direct image URL (e.g. ending in .jpg, .png, .webp or from a direct image host).'
      };
    }

    if (trimmed.includes('drive.google.com/file/d/')) {
      return {
        valid: false,
        message: 'Google Drive view links are not direct image files. Please enter a direct image URL.'
      };
    }

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
      return { valid: false, message: 'Please enter a valid HTTP/HTTPS image URL.' };
    }

    return { valid: true };
  }

  function handleImagePreview(url) {
    const preview = document.getElementById('imagePreview');
    const img = document.getElementById('previewImg');
    const warning = document.getElementById('imageWarning');

    if (!url) {
      if (warning) warning.style.display = 'none';
      if (preview) preview.style.display = 'none';
      return;
    }

    const validation = validateImageUrl(url);
    if (!validation.valid) {
      if (warning) {
        warning.textContent = `⚠️ ${validation.message}`;
        warning.style.display = 'block';
      }
      if (preview) preview.style.display = 'none';
    } else {
      if (warning) warning.style.display = 'none';
      if (img) {
        img.onerror = () => {
          if (warning) {
            warning.textContent = '⚠️ Image failed to load. Please verify the URL is a direct, publicly accessible image.';
            warning.style.display = 'block';
          }
          if (preview) preview.style.display = 'none';
        };
        img.onload = () => {
          if (warning) warning.style.display = 'none';
          if (preview) preview.style.display = 'block';
        };
        img.src = url;
      }
    }
  }

  // ── Load Products API Flow ────────────────────────────────────────────────
  async function loadProducts() {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-row">Loading…</td></tr>';

    try {
      const res = await adminFetch('/admin/products');
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch products (HTTP ${res.status})`);
      }

      const grouped = await res.json();
      allProducts = [];

      if (Array.isArray(grouped)) {
        allProducts = grouped;
      } else if (grouped && typeof grouped === 'object') {
        for (const [group, items] of Object.entries(grouped)) {
          if (Array.isArray(items)) {
            items.forEach(p => {
              p.group_name = p.group_name || group;
              allProducts.push(p);
            });
          }
        }
      }

      allProducts.sort((a, b) => b.id - a.id);
      renderTable(allProducts);

      const countEl = document.getElementById('productCount');
      if (countEl) {
        countEl.textContent = `${allProducts.length} product${allProducts.length !== 1 ? 's' : ''} in database`;
      }
    } catch (err) {
      if (err.message !== 'Session expired') {
        console.error('Error loading products:', err);
        tbody.innerHTML = `<tr><td colspan="8" class="error-row">⚠️ Failed to load products: ${esc(err.message)}</td></tr>`;
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
          <img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2245%22 viewBox=%220 0 60 45%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%231c2333%22/><text x=%2250%25%22 y=%2250%25%22 fill=%22%2364748b%22 font-size=%2210%22 text-anchor=%22middle%22 dy=%22.3em%22>No Image</text></svg>'">
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

  // ── Search & Form Toggle Listeners ────────────────────────────────────────
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
    handleImagePreview(e.target.value.trim());
  });

  function resetForm() {
    document.getElementById('productForm').reset();
    document.getElementById('editProductId').value = '';
    const warning = document.getElementById('imageWarning');
    if (warning) warning.style.display = 'none';
    const preview = document.getElementById('imagePreview');
    if (preview) preview.style.display = 'none';
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

    handleImagePreview(p.image || '');

    document.getElementById('formTitle').textContent = 'Edit Product';
    document.getElementById('submitBtn').textContent = '💾 Update Product';
    formSection.style.display = 'block';
    formSection.scrollIntoView({ behavior: 'smooth' });
  }

  // ── Create & Update Product Flow ──────────────────────────────────────────
  document.getElementById('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('f_name').value.trim();
    const group_name = document.getElementById('f_group_name').value;
    const priceStr = document.getElementById('f_price').value.trim();
    const image = document.getElementById('f_image').value.trim();

    if (!name) {
      showToast('⚠️ Please enter a product name', 'error');
      document.getElementById('f_name').focus();
      return;
    }

    const price = Number(priceStr);
    if (!priceStr || isNaN(price) || price <= 0) {
      showToast('⚠️ Please enter a valid positive price', 'error');
      document.getElementById('f_price').focus();
      return;
    }

    const imgValidation = validateImageUrl(image);
    if (!imgValidation.valid) {
      showToast(`⚠️ ${imgValidation.message}`, 'error');
      const warning = document.getElementById('imageWarning');
      if (warning) {
        warning.textContent = `⚠️ ${imgValidation.message}`;
        warning.style.display = 'block';
      }
      document.getElementById('f_image').focus();
      return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const origPriceStr = document.getElementById('f_original_price').value.trim();
    const origPrice = origPriceStr ? Number(origPriceStr) : price;

    const payload = {
      name,
      group_name,
      badge: document.getElementById('f_badge').value,
      price,
      original_price: isNaN(origPrice) ? price : origPrice,
      save: document.getElementById('f_save').value.trim() || '0%',
      reviews: Number(document.getElementById('f_reviews').value || 0),
      age: document.getElementById('f_age').value.trim(),
      age_group: document.getElementById('f_age_group').value,
      category: document.getElementById('f_category').value,
      type: document.getElementById('f_type').value,
      theme: document.getElementById('f_theme').value,
      launch_date: document.getElementById('f_launch_date').value || new Date().toISOString().split('T')[0],
      sales: Number(document.getElementById('f_sales').value || 0),
      offer: document.getElementById('f_offer').value.trim() || 'Buy any 2 | Get FLAT 10% OFF',
      image,
      skills: document.getElementById('f_skills').value.trim()
    };

    const editId = document.getElementById('editProductId').value;
    const path = editMode ? `/admin/products/${editId}` : '/admin/products';

    try {
      const res = await adminFetch(path, {
        method: editMode ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(editMode ? '✅ Product updated successfully!' : '✅ Product created successfully!', 'success');
        formSection.style.display = 'none';
        resetForm();
        await loadProducts();
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || `Failed to save product (HTTP ${res.status})`;
        console.error('Product save backend error:', errData);
        showToast(`❌ ${errMsg}`, 'error');
      }
    } catch (err) {
      if (err.message !== 'Session expired') {
        console.error('Product save network error:', err);
        showToast(`❌ Error: ${err.message}`, 'error');
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
    if (deleteModal) {
      deleteModal.classList.add('open');
      deleteModal.style.display = '';
    }
  }

  function closeDeleteModal() {
    _pendingDeleteId = null;
    if (deleteModal) {
      deleteModal.classList.remove('open');
      deleteModal.style.display = 'none';
    }
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
        showToast('🗑 Product deleted successfully', 'success');
        await loadProducts();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to delete product', 'error');
      }
    } catch (err) {
      if (err.message !== 'Session expired') {
        console.error('Product delete error:', err);
        showToast('Network error during deletion', 'error');
      }
    }
  });

  function deleteProduct(id) {
    openDeleteModal(id);
  }

  loadProducts();
})();
