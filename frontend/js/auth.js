/* ============================================================
   auth.js – BrainyGrasp Authentication Module
   Handles: OTP login, JWT storage, UI state, checkout guard
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

// ── Checkout Guard ─────────────────────────────────────────────────────────
function initCheckoutGuard() {
  const checkoutBtn = document.querySelector('.btn-checkout');
  if (!checkoutBtn) return;
  checkoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isAuthenticated()) {
      const cartOverlay = document.getElementById('cartOverlay');
      const cartSidebar = document.getElementById('cartSidebar');
      if (cartOverlay) cartOverlay.classList.remove('active');
      if (cartSidebar) cartSidebar.classList.remove('active');
      document.body.style.overflow = '';
      window.location.href = 'login.html?redirect=checkout';
    } else {
      window.location.href = 'checkout.html';
    }
  });
}

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

  // Tab toggle
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMethod = tab.dataset.method;
      phoneWrap.style.display = currentMethod === 'phone' ? 'block' : 'none';
      emailWrap.style.display = currentMethod === 'email' ? 'block' : 'none';
    });
  });

  // OTP box auto-advance
  otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g,'').slice(0,1);
      if (box.value && idx < otpBoxes.length - 1) otpBoxes[idx+1].focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) otpBoxes[idx-1].focus();
    });
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
    setTimeout(() => errorEl.style.display = 'none', 4000);
  }

  function startTimer(seconds) {
    clearInterval(timerInterval);
    resendBtn.style.display = 'none';
    timerEl.style.display   = 'block';
    let remaining = seconds;
    timerEl.textContent = `Resend OTP in ${remaining}s`;
    timerInterval = setInterval(() => {
      remaining--;
      timerEl.textContent = `Resend OTP in ${remaining}s`;
      if (remaining <= 0) {
        clearInterval(timerInterval);
        timerEl.style.display   = 'none';
        resendBtn.style.display = 'inline-block';
      }
    }, 1000);
  }

  async function doSendOTP() {
    const v = currentMethod === 'phone' ? phoneInput.value.trim() : emailInput.value.trim();
    if (!v) { showError('Please enter your ' + (currentMethod === 'phone' ? 'phone number' : 'email')); return; }
    currentValue = v;

    sendOTPBtn.disabled = true;
    sendOTPBtn.textContent = 'Sending…';
    try {
      const data = await requestOTP(currentMethod, currentValue);
      if (data.error) { showError(data.error); sendOTPBtn.disabled = false; sendOTPBtn.textContent = 'Send OTP'; return; }
      demoOTP = data.otp_demo || '';
      if (demoEl) { demoEl.textContent = `Demo OTP: ${demoOTP}`; demoEl.style.display = 'block'; }
      step1.style.display = 'none';
      step2.style.display = 'block';
      startTimer(60);
      otpBoxes[0].focus();
      otpRequested = true;
    } catch (err) {
      showError('Network error. Please try again.');
    }
    sendOTPBtn.disabled = false;
    sendOTPBtn.textContent = 'Send OTP';
  }

  sendOTPBtn.addEventListener('click', doSendOTP);
  resendBtn.addEventListener('click', doSendOTP);

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
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      window.location.href = redirect === 'checkout' ? 'checkout.html' : 'index.html';
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
  initCheckoutGuard();
  initLoginPage();

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
});
