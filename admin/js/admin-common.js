/**
 * BrainGrasp Admin — Shared utilities (auth, API, formatting)
 */
(function () {
  const TOKEN_KEY = 'adminToken';

  function apiBase() {
    return (window.BG_ADMIN_CONFIG && window.BG_ADMIN_CONFIG.API_BASE) || '';
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function isLoginPage() {
    return window.location.pathname.includes('login');
  }

  function requireAuth() {
    if (!getToken() && !isLoginPage()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  function redirectIfAuthenticated() {
    if (getToken() && isLoginPage()) {
      window.location.href = 'dashboard.html';
    }
  }

  function bindLogout(buttonId) {
    const btn = document.getElementById(buttonId || 'logoutBtn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      clearToken();
      window.location.href = 'login.html';
    });
  }

  function showToast(msg, type, toastId) {
    const el = document.getElementById(toastId || 'toast');
    if (!el) return;
    el.textContent = msg;
    const isErr = type === 'error' || type === 'err';
    el.className = isErr ? 'toast show toast-error err' : 'toast show toast-success ok';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
      el.className = 'toast';
    }, 3500);
  }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(n) {
    if (n === null || n === undefined) return '0';
    return Number(n).toLocaleString('en-IN');
  }

  function fmtRupee(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN');
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function animNum(el, target, prefix) {
    if (!el) return;
    let v = 0;
    const step = Math.max(target / 40, 1);
    const timer = setInterval(() => {
      v += step;
      if (v >= target) { v = target; clearInterval(timer); }
      el.textContent = (prefix || '') + Math.floor(v).toLocaleString('en-IN');
    }, 16);
  }

  /**
   * Authenticated fetch against /api/admin/* endpoints.
   * @param {string} path - e.g. '/admin/dashboard' (no /api prefix needed)
   */
  async function adminFetch(path, options) {
    const opts = options || {};
    const headers = Object.assign({}, opts.headers || {});
    const token = getToken();

    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (opts.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const url = `${apiBase()}/api${path.startsWith('/') ? path : '/' + path}`;
    const res = await fetch(url, Object.assign({}, opts, { headers }));

    if (res.status === 401 || res.status === 403) {
      clearToken();
      window.location.href = 'login.html';
      throw new Error('Session expired');
    }

    return res;
  }

  /** Public fetch for login (no auth header). */
  async function publicFetch(path, options) {
    const opts = options || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const url = `${apiBase()}/api${path.startsWith('/') ? path : '/' + path}`;
    return fetch(url, Object.assign({}, opts, { headers }));
  }

  window.AdminApp = {
    apiBase,
    getToken,
    setToken,
    clearToken,
    isLoginPage,
    requireAuth,
    redirectIfAuthenticated,
    bindLogout,
    showToast,
    esc,
    fmt,
    fmtRupee,
    fmtDate,
    animNum,
    adminFetch,
    publicFetch
  };
})();
