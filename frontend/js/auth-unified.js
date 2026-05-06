/* ============================================================
   auth-unified.js – BrainyGrasp Unified Authentication System
   Handles: Checkout intent detection, OTP flow, cart sync, redirects
   ============================================================ */

const API_BASE = (window.BG_CONFIG && window.BG_CONFIG.API_BASE) || 'http://localhost:3000';

// ── Auth Helpers ──────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('bg_token'); }
function getUser() {
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

// ── Checkout Intent Detection ────────────────────────────────────────────
/**
 * Intercept checkout clicks and verify authentication
 */
function initCheckoutProtection() {
    // Protect all checkout buttons and links
    document.addEventListener('click', (e) => {
        const checkoutLink = e.target.closest('a[href*="checkout"], button[data-action="checkout"], .btn-checkout, #cartPageCheckout');
        
        if (checkoutLink) {
            e.preventDefault();
            
            if (!isAuthenticated()) {
                // Save redirect intent
                const targetUrl = checkoutLink.href || checkoutLink.dataset.href || 'checkout_cod.html';
                localStorage.setItem('redirectAfterLogin', targetUrl);
                
                // Show login prompt
                if (confirm("Please sign in to proceed with checkout. Continue to login?")) {
                    window.location.href = 'login.html';
                }
                return;
            }
            
            // User is authenticated, proceed to checkout
            const targetUrl = checkoutLink.href || 'checkout_cod.html';
            window.location.href = targetUrl;
        }
    });
}

// ── Cart Helpers ──────────────────────────────────────────────────────────
function getLocalCart() {
    try { return JSON.parse(localStorage.getItem('bg_cart')) || []; }
    catch { return []; }
}

function clearLocalCart() {
    localStorage.removeItem('bg_cart');
}

// ── Cart Migration: Guest -> Database & Load DB cart into localStorage ───
async function syncCartOnLogin() {
    const token = getToken();
    const guestCart = getLocalCart();

    if (!token) return;

    try {
        // Step 1: Fetch existing DB cart
        let dbCart = [];
        try {
            const fetchRes = await fetch(`${API_BASE}/api/cart`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (fetchRes.ok) {
                dbCart = await fetchRes.json() || [];
            }
        } catch (err) {
            console.warn('⚠️ Could not fetch existing DB cart:', err);
        }

        // Step 2: Merge guest cart into DB cart (avoid duplicates)
        if (guestCart.length > 0) {
            const merged = [...dbCart];
            guestCart.forEach(guestItem => {
                const existing = merged.find(i => i.id === guestItem.id);
                if (existing) {
                    existing.quantity = (existing.quantity || 1) + (guestItem.quantity || 1);
                } else {
                    merged.push(guestItem);
                }
            });
            dbCart = merged;

            // Sync merged cart to DB
            const syncRes = await fetch(`${API_BASE}/api/cart/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ items: dbCart })
            });

            if (syncRes.ok) {
                console.log('✅ Guest cart merged & synced to database');
            } else {
                console.error('❌ Cart sync failed:', await syncRes.text());
            }
        }

        // Step 3: Always load authoritative DB cart into localStorage
        localStorage.setItem('bg_cart', JSON.stringify(dbCart));
        console.log('✅ DB cart loaded into localStorage:', dbCart.length, 'items');
        return true;
    } catch (err) {
        console.error('❌ Cart migration error:', err);
        return false;
    }
}

// ── Enhanced OTP Verification ────────────────────────────────────────────
async function handleVerifyOTP() {
    const otpBoxes = document.querySelectorAll('.otp-box');
    const otp = Array.from(otpBoxes).map(b => b.value).join('');
    const email = document.getElementById('emailInput').value;

    if (otp.length < 6) {
        alert("Please enter the full 6-digit OTP.");
        return;
    }

    const verifyBtn = document.getElementById('verifyOTPBtn');
    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';
    }

    try {
        const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        
        const data = await res.json();
        
        if (data.token && data.user) {
            // 1. Store JWT + user in localStorage
            storeAuth(data.token, data.user);
            
            // 2. Migrate guest cart → database
            await syncCartOnLogin();
            
            // 3. Update UI
            if (typeof updateCartCount === 'function') {
                await updateCartCount();
            }
            
            // 4. Check if profile is completed
            try {
                const profileResponse = await fetch(`${API_BASE}/api/auth/profile-status`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${data.token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const profileData = await profileResponse.json();
                
                // 5. Smart Redirect based on profile completion
                const redirectPath = localStorage.getItem('redirectAfterLogin');
                
                if (!profileData.profile_completed) {
                    // First-time user: save where they eventually want to land
                    // after completing their profile (checkout or dashboard)
                    localStorage.setItem('postProfileRedirect', redirectPath || 'dashboard.html');
                    localStorage.removeItem('redirectAfterLogin');
                    window.location.href = 'profile-setup.html';
                } else if (redirectPath) {
                    // Returning user: go to their saved intent (checkout, etc.)
                    localStorage.removeItem('redirectAfterLogin');
                    window.location.href = redirectPath;
                } else {
                    // Returning user: default → dashboard
                    window.location.href = 'dashboard-new.html';
                }
            } catch (error) {
                console.error('Profile status check failed:', error);
                // Fallback: use data.user from the JWT response
                const redirectPath = localStorage.getItem('redirectAfterLogin');
                if (!data.user.profile_completed) {
                    localStorage.setItem('postProfileRedirect', redirectPath || 'dashboard.html');
                    localStorage.removeItem('redirectAfterLogin');
                    window.location.href = 'profile-setup.html';
                } else if (redirectPath) {
                    localStorage.removeItem('redirectAfterLogin');
                    window.location.href = redirectPath;
                } else {
                    window.location.href = 'dashboard-new.html';
                }
            }
        } else {
            alert(data.error || "Invalid OTP. Please try again.");
            if (verifyBtn) {
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify & Continue';
            }
        }
    } catch (err) {
        console.error("❌ Verification Error:", err);
        alert("Server connection failed. Please try again.");
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify & Continue';
        }
    }
}

// ── Enhanced Cart UI Sync ───────────────────────────────────────────────
// Always reads from localStorage for instant UI response. localStorage is
// kept up-to-date by addToCart / removeFromCart / updateQuantityInCart
// (which also fire syncCartToDB in the background).
function updateCartCount() {
    const cart = getLocalCart();

    const totalCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

    // Update Badge Count
    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = totalCount;
        el.style.display = totalCount > 0 ? 'flex' : 'none';
    });

    // Update Sidebar Total
    const sidebarTotal = document.getElementById('sidebarTotal');
    if (sidebarTotal) {
        sidebarTotal.innerHTML = `&#8377;${totalPrice}`;
    }

    // Render Cart Sidebar
    if (typeof renderCartSidebar === 'function') {
        renderCartSidebar();
    }
}

// ── Enhanced Dashboard Profile Fetching ───────────────────────────────────
async function fetchUserProfile() {
    const token = getToken();
    if (!token) return null;

    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const user = await response.json();
            // Update local storage with fresh data
            localStorage.setItem('bg_user', JSON.stringify(user));
            return user;
        } else if (response.status === 401 || response.status === 403) {
            // Token expired, clear auth and redirect to login
            clearAuth();
            window.location.href = 'login.html';
            return null;
        }
    } catch (err) {
        console.error("❌ Profile fetch error:", err);
    }
    
    // Fallback to cached user data
    return getUser();
}

// ── Global UI Synchronization ───────────────────────────────────────────
function syncGlobalUI() {
    // Update user display elements
    const user = getUser();
    if (user) {
        document.querySelectorAll('[data-user-name]').forEach(el => {
            el.textContent = user.name || 'User';
        });
        document.querySelectorAll('[data-user-email]').forEach(el => {
            el.textContent = user.email || '';
        });
        document.querySelectorAll('[data-user-phone]').forEach(el => {
            el.textContent = user.phone || '';
        });
    }

    // Update authentication state UI
    const authElements = document.querySelectorAll('[data-auth-required]');
    authElements.forEach(el => {
        if (isAuthenticated()) {
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    });

    // Update cart counts
    updateCartCount();
}

// ── OTP Request Handler ───────────────────────────────────────────────────
async function requestOTP(method, value) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: value })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ OTP sent successfully');
            if (data.otp_demo) {
                console.log(`🔢 Demo OTP: ${data.otp_demo}`);
            }
            return true;
        } else {
            alert(data.error || "Failed to send OTP");
            return false;
        }
    } catch (err) {
        console.error("❌ OTP request error:", err);
        alert("Server connection failed");
        return false;
    }
}

// ── Initialization ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Initialize checkout protection
    initCheckoutProtection();
    
    // Sync global UI
    syncGlobalUI();
    
    // Attach OTP verification handler
    const verifyBtn = document.getElementById('verifyOTPBtn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleVerifyOTP();
        });
    }

    // Attach OTP request handlers
    const requestBtn = document.getElementById('requestOTPBtn');
    if (requestBtn) {
        requestBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const method = 'email';
            const value = document.getElementById('emailInput').value;
            
            if (!value) {
                alert('Please enter your email address');
                return;
            }
            
            requestBtn.disabled = true;
            requestBtn.textContent = 'Sending...';
            
            const success = await requestOTP(method, value);
            
            requestBtn.disabled = false;
            requestBtn.textContent = 'Send OTP';
            
            if (success) {
                // Show OTP input section
                const authStep1 = document.getElementById('authStep1');
                const authStep2 = document.getElementById('authStep2');
                if (authStep1 && authStep2) {
                    authStep1.style.display = 'none';
                    authStep2.style.display = 'block';
                }
            }
        });
    }

    // Logout handlers
    const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutQuickBtn, [data-action="logout"]');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to logout?")) {
                clearAuth();
                clearLocalCart();
                window.location.href = 'index.html';
            }
        });
    });

    // Email-only authentication - no tab switching needed

    // Auto-focus first OTP box
    const firstOTPBox = document.querySelector('.otp-box');
    if (firstOTPBox) {
        firstOTPBox.focus();
    }

    // OTP box auto-advance
    const otpBoxes = document.querySelectorAll('.otp-box');
    otpBoxes.forEach((box, index) => {
        box.addEventListener('input', (e) => {
            if (e.target.value && index < otpBoxes.length - 1) {
                otpBoxes[index + 1].focus();
            }
        });
        
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpBoxes[index - 1].focus();
            }
        });
    });
});

// ── Export for use in other scripts ───────────────────────────────────────
window.AuthUnified = {
    getToken,
    getUser,
    isAuthenticated,
    storeAuth,
    clearAuth,
    syncCartOnLogin,
    updateCartCount,
    fetchUserProfile,
    syncGlobalUI,
    requestOTP,
    handleVerifyOTP
};
