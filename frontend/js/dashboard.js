/* ============================================================
   dashboard.js – BrainyGrasp Dashboard Module
   Handles: User profile display, order history, quick actions
   ============================================================ */

const API_BASE = 'http://localhost:3000';

// ── User/Auth Helpers ──────────────────────────────────────────────────────────
// Note: Changed to match standard localStorage keys used in your auth.js
function getToken() { return localStorage.getItem('authToken'); }

function getUser() {
    try { 
        // Try to get user from storage, fallback to empty object
        return JSON.parse(localStorage.getItem('bg_user')) || {}; 
    } catch { 
        return {}; 
    }
}

function isAuthenticated() { return !!getToken(); }

function clearAuth() {
    localStorage.removeItem('authToken');
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
        if (res.status === 401 || res.status === 403) {
            clearAuth();
            window.location.href = 'login.html';
        }
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
    }
    return res.json();
}

// ── Load Profile ────────────────────────────────────────────────────────────
async function loadProfile() {
    const nameEl = document.getElementById('userName');
    const phoneEl = document.getElementById('userPhone');
    const emailEl = document.getElementById('userEmail');
    const createdEl = document.getElementById('userCreated');

    // 1. First, try to fetch fresh profile from server (Source of Truth)
    try {
        const user = await fetchWithAuth(`${API_BASE}/api/auth/me`);
        
        if (user) {
            if (nameEl) nameEl.textContent = user.name || 'Set your name';
            if (phoneEl) phoneEl.textContent = user.phone || 'Not set';
            if (emailEl) emailEl.textContent = user.email || 'Not set';
            if (createdEl) {
                createdEl.textContent = new Date(user.created_at).toLocaleDateString('en-IN');
            }
            // Update local storage to keep it in sync
            localStorage.setItem('bg_user', JSON.stringify(user));
        }
    } catch (err) {
        console.warn('Could not fetch fresh profile, using cache:', err.message);
        // Fallback to local storage if server is down
        const cachedUser = getUser();
        if (nameEl) nameEl.textContent = cachedUser.name || 'Unknown';
    }
}

// ── Order UI Helpers ──────────────────────────────────────────────────
function getStatusClass(status) {
    const s = (status || '').toLowerCase();
    if (s === 'delivered') return 'status-delivered';
    if (s === 'shipped') return 'status-shipped';
    if (s === 'processing') return 'status-processing';
    return 'status-placed';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { 
        day: 'numeric', month: 'short', year: 'numeric' 
    });
}

function formatPrice(amount) {
    return new Intl.NumberFormat('en-IN', { 
        style: 'currency', currency: 'INR', maximumFractionDigits: 0 
    }).format(amount || 0);
}

// ── Load Orders ─────────────────────────────────────────────────────
async function loadOrders() {
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;

    try {
        // Your server returns an array directly: [ {id:1...}, {id:2...} ]
        const orders = await fetchWithAuth(`${API_BASE}/api/orders`);

        if (!orders || orders.length === 0) {
            ordersList.innerHTML = `
                <div class="orders-empty" style="text-align:center; padding:40px;">
                    <i class="fas fa-box-open" style="font-size:40px; color:#ccc;"></i>
                    <p>No orders yet. Your cart is waiting!</p>
                    <a href="index.html" class="btn btn-primary">Start Shopping</a>
                </div>
            `;
            return;
        }

        ordersList.innerHTML = orders.map(order => {
            // Mapping items from the JSONB column in your Postgres DB
            const itemsHtml = (order.items || []).map(item => `
                <div class="order-item" style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:14px;">
                    <span>${item.name || 'Product'} <small>(x${item.quantity || 1})</small></span>
                    <span>${formatPrice(item.price)}</span>
                </div>
            `).join('');

            return `
                <div class="order-card" style="border:1px solid #edf2f7; border-radius:12px; padding:20px; margin-bottom:15px; background:#fff;">
                    <div class="order-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <div>
                            <span style="font-weight:700; color:#2d3748;">Order #${order.id}</span>
                            <div style="font-size:12px; color:#718096;">${formatDate(order.created_at)}</div>
                        </div>
                        <span class="status-badge ${getStatusClass(order.status)}" style="font-size:12px; font-weight:600; padding:4px 12px; border-radius:20px; background:#ebf8ff; color:#3182ce;">
                            ${order.status || 'Placed'}
                        </span>
                    </div>
                    <div class="order-items-box" style="background:#f7fafc; padding:12px; border-radius:8px; margin-bottom:15px;">
                        ${itemsHtml}
                    </div>
                    <div class="order-footer" style="display:flex; justify-content:space-between; align-items:center; font-weight:700;">
                        <span style="color:#4a5568;">Total Paid</span>
                        <span style="color:#0b74ff; font-size:18px;">${formatPrice(order.total)}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load orders:', err);
        ordersList.innerHTML = `<p style="color:red; text-align:center;">⚠️ Error loading orders.</p>`;
    }
}

// ── Quick Actions ────────────────────────────────────────────────────────
function initQuickActions() {
    // Scroll to orders
    document.getElementById('viewOrdersBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.orders-card')?.scrollIntoView({ behavior: 'smooth' });
    });

    // Refresh Orders
    document.getElementById('refreshOrdersBtn')?.addEventListener('click', () => {
        const list = document.getElementById('ordersList');
        if (list) list.innerHTML = '<div style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Refreshing...</div>';
        loadOrders();
    });

    // Logout
    document.getElementById('logoutQuickBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if(confirm("Are you sure you want to logout?")) {
            clearAuth();
            window.location.href = 'index.html';
        }
    });
}

// ── Initialization ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (isAuthenticated()) {
        loadProfile();
        loadOrders();
        initQuickActions();
    } else {
        // Not logged in: Show prompt
        const profileCard = document.querySelector('.profile-card .card-body');
        if (profileCard) {
            profileCard.innerHTML = `
                <div style="text-align:center; padding:20px;">
                    <p>Log in to view your profile and orders.</p>
                    <a href="login.html?redirect=dashboard" class="btn btn-primary">Sign In</a>
                </div>
            `;
        }
    }
});