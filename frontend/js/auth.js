/* ============================================================
   auth.js – BrainyGrasp Authentication & Cart Sync Module
   ============================================================ */

const API_BASE = 'http://localhost:3000';

// ── Auth Helpers ──────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('bg_token'); }
function getUser()   {
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

// ── Cart Helpers ──────────────────────────────────────────────────────────
function getLocalCart() {
    try { return JSON.parse(localStorage.getItem('bg_cart')) || []; }
    catch { return []; }
}

function clearLocalCart() {
    localStorage.removeItem('bg_cart');
}

// ── UI REFRESH ENGINE ─────────────────────────────────────────────────────
/**
 * Updates the badge count and sidebar total.
 * Checks Database if logged in, otherwise checks LocalStorage.
 */
async function updateCartCount() {
    const token = getToken();
    let cart = [];

    if (token) {
        // Fetch from PostgreSQL
        try {
            const response = await fetch(`${API_BASE}/api/cart`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                cart = await response.json();
            }
        } catch (err) {
            console.error("Failed to fetch database cart:", err);
        }
    } else {
        // Fetch from LocalStorage
        cart = getLocalCart();
    }

    const totalCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

    // 1. Update Badge Count (Header icons)
    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = totalCount;
        el.style.display = totalCount > 0 ? 'flex' : 'none';
    });

    // 2. Update Sidebar Total
    const sidebarTotal = document.getElementById('sidebarTotal');
    if (sidebarTotal) {
        sidebarTotal.innerHTML = `&#8377;${totalPrice}`;
    }

    // 3. Render the list inside the sidebar
    renderCartSidebar(cart);
}

/**
 * Dynamically builds the HTML for the cart sidebar.
 */
function renderCartSidebar(cart) {
    const container = document.getElementById('cartItems');
    if (!container) return;

    if (!cart || cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart-msg">
                <i class="fas fa-shopping-bag"></i>
                <p>No Products in the Cart</p>
            </div>`;
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.image || 'assets/placeholder.png'}" alt="${item.name}">
            <div class="item-details">
                <h4>${item.name}</h4>
                <p>&#8377;${item.price} x ${item.quantity || 1}</p>
            </div>
            <button class="remove-item" onclick="handleRemove(${item.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

// ── THE SYNC BRIDGE: Guest -> PostgreSQL ───────────────────────────────────
/**
 * Moves items from browser storage to the database upon login.
 */
async function syncCartOnLogin() {
    const token = getToken();
    const guestCart = getLocalCart();
    
    if (!token || guestCart.length === 0) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/cart/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ items: guestCart })
        });
        
        if (response.ok) {
            console.log('Guest cart successfully synced to PostgreSQL.');
            clearLocalCart(); // Wipe local storage to rely on DB
        }
    } catch (err) {
        console.error('Cart migration failed:', err);
    }
}

// ── OTP & Login Logic ───────────────────────────────────────────────────
/**
 * Handles the verification of the 6-digit OTP and subsequent redirection.
 */
async function handleVerifyOTP() {
    const otpBoxes = document.querySelectorAll('.otp-box');
    const otp = Array.from(otpBoxes).map(b => b.value).join('');
    
    const activeTab = document.querySelector('.auth-tab.active');
    const method = activeTab ? activeTab.dataset.method : 'phone';
    const value = method === 'phone' ? 
                  document.getElementById('phoneInput').value : 
                  document.getElementById('emailInput').value;

    if (otp.length < 6) return alert("Please enter the full 6-digit OTP.");

    const verifyBtn = document.getElementById('verifyOTPBtn');
    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';
    }

    try {
        const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method, value, otp })
        });
        
        const data = await res.json();
        
        if (data.token) {
            storeAuth(data.token, data.user);
            
            // 1. Migrate items from LocalStorage to Database
            await syncCartOnLogin(); 
            
            // 2. REFRESH UI: Immediately fetch from DB and update sidebar
            await updateCartCount(); 

            // 3. Handle Smart Redirect
            const nextPath = localStorage.getItem('redirectAfterLogin');
            if (nextPath) {
                localStorage.removeItem('redirectAfterLogin');
                window.location.href = nextPath; 
            } else {
                window.location.href = 'index.html';
            }
        } else {
            alert(data.error || "Invalid OTP. Please try again.");
            if (verifyBtn) {
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify & Continue';
            }
        }
    } catch (err) {
        console.error("Verification Error:", err);
        alert("Server connection failed.");
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify & Continue';
        }
    }
}

// ── Initialization ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Refresh UI on every page load to keep counts in sync
    updateCartCount();

    // Attach listener to Verify button
    const verifyBtn = document.getElementById('verifyOTPBtn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleVerifyOTP();
        });
    }

    // Logout logic
    const logoutBtn = document.getElementById('logoutBtn') || document.getElementById('logoutQuickBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            clearAuth();
            clearLocalCart();
            window.location.href = 'index.html';
        });
    }
});