/* ============================================================
   dashboard.js – BrainyGrasp Dashboard Module
   Handles: User profile display, order history, quick actions
   ============================================================ */

const API_BASE = 'http://localhost:3000';

// ── User/Auth Helpers ──────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('bg_token'); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('bg_user')); } catch { return null; }
}
function isAuthenticated() { return !!getToken(); }

function clearAuth() {
  localStorage.removeItem('bg_token');
  localStorage.removeItem('bg_user');
}

// ── API Helpers ──────────────────────────────────────────────────────────
async function fetchWithAuth(url, options = {}) {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ── Load Profile ────────────────────────────────────────────────────────────
async function loadProfile() {
  const user = getUser();
  if (!user) {
    window.location.href = 'login.html?redirect=dashboard';
    return;
  }

  // Populate profile fields
  const nameEl = document.getElementById('userName');
  const phoneEl = document.getElementById('userPhone');
  const emailEl = document.getElementById('userEmail');
  const createdEl = document.getElementById('userCreated');

  if (nameEl) nameEl.textContent = user.name || 'Not set';
  if (phoneEl) phoneEl.textContent = user.phone || user.email || 'Not set';
  if (emailEl) emailEl.textContent = user.email || 'Not provided';
  if (createdEl) {
    const created = user.created_at ? new Date(user.created_at).toLocaleDateString() : new Date().toLocaleDateString();
    createdEl.textContent = created;
  }

  // Also try to fetch fresh profile from server
  try {
    const data = await fetchWithAuth(`${API_BASE}/api/auth/me`);
    if (data.user) {
      if (nameEl) nameEl.textContent = data.user.name || 'Not set';
      if (phoneEl) phoneEl.textContent = data.user.phone || data.user.email || 'Not set';
      if (emailEl) emailEl.textContent = data.user.email || 'Not provided';
      if (createdEl) {
        const created = data.user.created_at ? new Date(data.user.created_at).toLocaleDateString() : new Date().toLocaleDateString();
        createdEl.textContent = created;
      }
      // Update localStorage with fresh data
      localStorage.setItem('bg_user', JSON.stringify(data.user));
    }
  } catch (err) {
    console.warn('Could not fetch fresh profile:', err.message);
  }
}

// ── Order Status Helpers ──────────────────────────────────────────────────
function getStatusClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'delivered') return 'status-delivered';
  if (s === 'shipped') return 'status-shipped';
  if (s === 'processing') return 'status-processing';
  return 'status-placed';
}

function getStatusLabel(status) {
  const s = (status || '').toLowerCase();
  if (s === 'delivered') return 'Delivered';
  if (s === 'shipped') return 'Shipped';
  if (s === 'processing') return 'Processing';
  return 'Order Placed';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPrice(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
}

// ── Load Orders ─────────────────────────────────────────────────────
async function loadOrders() {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;

  try {
    const data = await fetchWithAuth(`${API_BASE}/api/orders`);

    if (!data.orders || data.orders.length === 0) {
      ordersList.innerHTML = `
        <div class="orders-empty">
          <i class="fas fa-box-open"></i>
          <p>No orders yet. Start shopping!</p>
          <a href="index.html" class="btn btn-primary">Browse Products</a>
        </div>
      `;
      return;
    }

    ordersList.innerHTML = data.orders.map(order => {
      const itemsHtml = (order.items || []).map(item => `
        <div class="order-item">
          <span class="order-item-name">${item.name || 'Product'} x ${item.quantity || 1}</span>
          <span class="order-item-price">${formatPrice(item.price)}</span>
        </div>
      `).join('');

      return `
        <div class="order-card">
          <div class="order-header">
            <span class="order-id">Order #${order.id}</span>
            <span class="order-date">${formatDate(order.created_at)}</span>
            <span class="order-status ${getStatusClass(order.status)}">
              <i class="fas fa-circle"></i>
              ${getStatusLabel(order.status)}
            </span>
          </div>
          <div class="order-items">
            ${itemsHtml}
          </div>
          <div class="order-total">
            <span class="order-total-label">Total</span>
            <span class="order-total-amount">${formatPrice(order.total)}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load orders:', err);
    ordersList.innerHTML = `
      <div class="orders-empty">
        <i class="fas fa-exclamation-circle"></i>
        <p>Unable to load orders. Please try again.</p>
      </div>
    `;
  }
}

// ── Quick Actions ────────────────────────────────────────────────────────
function initQuickActions() {
  // View Orders button - scroll to orders section
  const viewOrdersBtn = document.getElementById('viewOrdersBtn');
  if (viewOrdersBtn) {
    viewOrdersBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const ordersCard = document.querySelector('.orders-card');
      if (ordersCard) {
        ordersCard.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Refresh Orders button
  const refreshBtn = document.getElementById('refreshOrdersBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const ordersList = document.getElementById('ordersList');
      if (ordersList) {
        ordersList.innerHTML = `
          <div class="orders-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Loading your orders...</span>
          </div>
        `;
      }
      loadOrders();
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logoutQuickBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearAuth();
      window.location.href = 'index.html';
    });
  }
}

// ── Auth Check ────────────────────────────────────────────────────────
function checkAuth() {
  if (!isAuthenticated()) {
    // Already not logged in - redirect to login
    // Don't redirect immediately, let the page load first
    const profileInfo = document.getElementById('profileInfo');
    if (profileInfo) {
      profileInfo.innerHTML = `
        <div class="profile-field">
          <label>Status</label>
          <span style="color: var(--danger)">Please <a href="login.html?redirect=dashboard">sign in</a> to view your profile.</span>
        </div>
      `;
    }
    return false;
  }
  return true;
}

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (checkAuth()) {
    loadProfile();
    loadOrders();
    initQuickActions();
  } else {
    // Show login prompt
    const actionsCard = document.querySelector('.actions-card');
    const quickActions = actionsCard?.querySelector('.quick-actions');
    if (quickActions) {
      quickActions.innerHTML = `
        <a href="login.html?redirect=dashboard" class="quick-action-btn">
          <i class="fas fa-sign-in-alt"></i>
          <span>Sign In to View Account</span>
        </a>
      `;
    }
  }
});