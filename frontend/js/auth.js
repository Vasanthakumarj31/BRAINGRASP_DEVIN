/* ============================================================
   auth.js – BrainyGrasp Authentication Module
   Handles: OTP login, JWT storage, UI state, checkout guard, cart
   ============================================================ */

const API_BASE = 'http://localhost:3000';

// ── Token Helpers ──────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('bg_token'); }
function getUser()  {
  try { return JSON.parse(localStorage.getItem('bg_user')); } catch { return null; }
}
function isAuthenticated() { return !!getToken(); }

function storeAuth(token, user) {
  localStorage.setItem('bg_token', token);
  localStorage.setItem('bg_user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('bg_token');
  localStorage.removeItem('bg_user');
}

// ── Cart Helpers ───────────────────────────────────────────────────────────
function getCart() {
  try { return JSON.parse(localStorage.getItem('bg_cart')) || []; }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem('bg_cart', JSON.stringify(cart));
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function addToCart(item) {
  const cart = getCart();
  const existing = cart.find(i => i.id === item.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  saveCart(cart);
  updateCartCount();
  return cart;
}

function removeFromCart(itemId) {
  let cart = getCart();
  cart = cart.filter(i => i.id !== itemId);
  saveCart(cart);
  updateCartCount();
  return cart;
}

function clearCart() {
  localStorage.removeItem('bg_cart');
  updateCartCount();
}

function getCartTotal() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function getCartCount() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function updateCartCount() {
  const count = getCartCount();
  const idEl = document.getElementById('cartCount');
  if (idEl) idEl.textContent = count;
  // update any elements using the .cart-count class as well
  document.querySelectorAll('.cart-count').forEach(el => el.textContent = count);
  renderCartSidebar();
}

function renderCartSidebar() {
  const sidebar = document.getElementById('cartSidebar');
  if (!sidebar) return;

  const cart = getCart();
  let cartItems = document.getElementById('cartItems');
  const emptyState = sidebar.querySelector('.cart-empty');
  const footer = sidebar.querySelector('.cart-footer');
  const totalEl =
    document.getElementById('cartTotal') ||
    sidebar.querySelector('.cart-total span:last-child');

  if (!cartItems) {
    cartItems = document.createElement('div');
    cartItems.id = 'cartItems';
    cartItems.className = 'cart-items';
    if (emptyState) {
      sidebar.insertBefore(cartItems, emptyState);
    } else if (footer) {
      sidebar.insertBefore(cartItems, footer);
    } else {
      sidebar.appendChild(cartItems);
    }
  }

  if (cart.length === 0) {
    cartItems.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    if (totalEl) totalEl.innerHTML = '&#8377;0';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  cartItems.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div>
        <div class="cart-item-name">${escapeHTML(item.name || 'Product')}</div>
        <div class="cart-item-meta">&#8377;${item.price} x ${item.quantity}</div>
      </div>
      <button class="cart-item-remove" data-id="${item.id}" aria-label="Remove item">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');

  if (totalEl) totalEl.innerHTML = `&#8377;${getCartTotal()}`;
}

// ── Cart Sync on Login ─────────────────────────────────────────
async function syncCartOnLogin() {
  if (!isAuthenticated()) return;
  
  const guestCart = getCart();
  if (guestCart.length === 0) return;
  
  try {
    // Sync cart to server
    const response = await fetch(`${API_BASE}/api/cart/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ items: guestCart })
    });
    
    if (response.ok) {
      // Clear local cart after sync
      clearCart();
    }
  } catch (err) {
    console.log('Cart sync failed, keeping local cart');
  }
}

// ── Header UI ──────────────────────────────────────────────────────────────
function updateAuthUI() {
  const btn = document.getElementById('userBtn');
  if (!btn) return;
  const user = getUser();
  if (user) {
    const initial = (user.name || user.phone || user.email || 'U')[0].toUpperCase();
    btn.innerHTML = `
      <div class="user-menu">
        <button class="user-avatar-btn" aria-haspopup="true" aria-expanded="false">
          <span class="user-avatar-initial">${initial}</span>
        </button>
        <div class="user-menu-dropdown" role="menu">
          <a href="dashboard.html" class="user-menu-link">My Account</a>
          <a href="#" id="logoutBtn" class="user-menu-link">Logout</a>
        </div>
      </div>
    `;
    btn.removeAttribute('href');
    btn.title = user.name || 'My Account';

    // Wire up menu interactions (use onclick to avoid duplicate listeners)
    const avatarBtn = btn.querySelector('.user-avatar-btn');
    const dropdown = btn.querySelector('.user-menu-dropdown');
    if (avatarBtn) {
      avatarBtn.onclick = (e) => {
        e.stopPropagation();
        // toggle
        const open = dropdown.style.display === 'block';
        // close other open menus
        document.querySelectorAll('.user-menu-dropdown').forEach(d => d.style.display = 'none');
        dropdown.style.display = open ? 'none' : 'block';
      };
    }

    // Close dropdown on outside click
    document.addEventListener('click', () => {
      if (dropdown) dropdown.style.display = 'none';
    });

    const logoutBtn = btn.querySelector('#logoutBtn');
    if (logoutBtn) logoutBtn.onclick = (e) => { e.preventDefault(); logout(); };
  } else {
    btn.innerHTML = '<i class="fas fa-user"></i>';
    btn.setAttribute('href', 'login.html');
    btn.title = 'Sign In';
  }
}

// ── OTP API Calls ──────────────────────────────────────────────────────────
async function requestOTP(method, value) {
  const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, value })
  });
  return res.json();
}

async function verifyOTP(method, value, otp) {
  const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, value, otp })
  });
  return res.json();
}

// ── Checkout Guard Removed ──────────────────────────────────────────────

// ── Login Page Logic ───────────────────────────────────────────────────────
function initLoginPage() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  let currentMethod = 'phone';
  let currentValue  = '';
  let otpRequested  = false;
  let demoOTP       = '';
  let timerInterval = null;

  const tabs       = document.querySelectorAll('.auth-tab');
  const phoneWrap  = document.getElementById('phoneWrap');
  const emailWrap  = document.getElementById('emailWrap');
  const phoneInput = document.getElementById('phoneInput');
  const emailInput = document.getElementById('emailInput');
  const step1      = document.getElementById('authStep1');
  const step2      = document.getElementById('authStep2');
  const sendOTPBtn = document.getElementById('sendOTPBtn');
  const verifyBtn  = document.getElementById('verifyOTPBtn');
  const resendBtn  = document.getElementById('resendOTP');
  const timerEl    = document.getElementById('otpTimer');
  const demoEl     = document.getElementById('demoOTPDisplay');
  const errorEl    = document.getElementById('authError');
  const otpBoxes   = document.querySelectorAll('.otp-box');

  // ... (rest of initLoginPage unchanged) ...

  verifyBtn.addEventListener('click', async () => {
    const otp = Array.from(otpBoxes).map(b => b.value).join('');
    if (otp.length < 6) { showError('Please enter the 6-digit OTP'); return; }

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying…';
    try {
      const data = await verifyOTP(currentMethod, currentValue, otp);
      if (data.error) { showError(data.error); verifyBtn.disabled = false; verifyBtn.textContent = 'Verify & Continue'; return; }
      storeAuth(data.token, data.user);
      updateAuthUI();
      // Sync any guest cart to the server then redirect
      try { await syncCartOnLogin(); } catch (e) { /* ignore sync errors */ }
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      // After OTP login, send user to checkout if requested, otherwise home
      window.location.href = redirect === 'checkout' ? 'checkout_cod.html' : 'index.html';
    } catch (err) {
      showError('Network error. Please try again.');
    }
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify & Continue';
  });
}



// ── Logout ─────────────────────────────────────────────────────────────────
function logout() {
  clearAuth();
  updateAuthUI();
  window.location.href = 'index.html';
}

// ── Init on every page ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  initLoginPage();
  updateCartCount(); // Initialize cart count on all pages
  renderCartSidebar();

  // Event delegation for sidebar item remove buttons
  document.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.cart-item-remove');
    if (!removeBtn) return;
    const itemId = parseInt(removeBtn.dataset.id, 10);
    if (!Number.isNaN(itemId)) removeFromCart(itemId);
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
});
