/* ============================================================
   auth-unified.js – BrainyGrasp Unified Authentication System
   Handles: Checkout intent detection, OTP flow, cart sync, redirects
   ============================================================ */

const API_BASE = (window.BG_CONFIG && window.BG_CONFIG.API_BASE) || '';

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

// ── Inline Error Display (replaces alert()) ───────────────────────────────
/**
 * Show an error message inline in the form.
 * @param {string} elementId - ID of the error container element
 * @param {string} message   - Human-readable error text
 */
function showAuthError(elementId, message) {
    let el = document.getElementById(elementId);
    if (!el) {
        // Create a floating error banner if the target element doesn't exist
        el = document.createElement('div');
        el.id = elementId;
        el.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b;
            padding: 12px 20px; border-radius: 10px; font-family: 'Nunito', sans-serif;
            font-size: 14px; font-weight: 600; z-index: 10000;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1); max-width: 90%;
        `;
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.display = 'block';
    // Auto-hide after 5 seconds
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.style.display = 'none'; }, 5000);
}

// ── Logout Confirmation Modal (replaces confirm()) ────────────────────────
function showLogoutConfirmModal() {
    const existing = document.getElementById('logoutConfirmModal');
    if (existing) { existing.style.display = 'flex'; return; }

    const modalHTML = `
        <div id="logoutConfirmModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%;
             background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
             z-index: 9999; backdrop-filter: blur(4px);">
            <div style="background: white; padding: 30px; border-radius: 20px; max-width: 380px; width: 90%;
                 text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2); font-family: 'Nunito', sans-serif;">
                <div style="background: #fee2e2; width: 60px; height: 60px; border-radius: 50%; display: flex;
                     align-items: center; justify-content: center; margin: 0 auto 20px;">
                    <i class="fas fa-sign-out-alt" style="font-size: 24px; color: #dc2626;"></i>
                </div>
                <h3 style="font-family: 'Fredoka', sans-serif; font-size: 22px; color: #1e1e1e;
                     margin: 0 0 10px 0;">Sign Out?</h3>
                <p style="color: #666; margin: 0 0 25px 0; font-size: 15px; line-height: 1.5;">
                    Your cart will be cleared. Are you sure you want to sign out?
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button onclick="document.getElementById('logoutConfirmModal').style.display='none'"
                        style="flex: 1; padding: 12px; border-radius: 10px; border: 1px solid #ddd;
                               background: white; color: #333; font-weight: bold; font-size: 15px; cursor: pointer;">
                        Cancel
                    </button>
                    <button onclick="(function(){ clearAuth(); clearLocalCart(); window.location.href='index.html'; })()"
                        style="flex: 1; padding: 12px; border-radius: 10px; border: none;
                               background: linear-gradient(135deg, #ef4444, #dc2626);
                               color: white; font-weight: bold; font-size: 15px; cursor: pointer;
                               box-shadow: 0 4px 15px rgba(220,38,38,0.3);">
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ── Checkout Intent Detection ────────────────────────────────────────────
/**
 * Intercept checkout clicks and verify authentication
 */
function initCheckoutProtection() {
    // Protect all checkout buttons and links
    document.addEventListener('click', (e) => {
        const checkoutLink = e.target.closest('a[href*="checkout"], button[data-action="checkout"], .btn-checkout, #cartPageCheckout, #sidebarCheckoutBtn');

        if (checkoutLink) {
            e.preventDefault();

            // 1. Check if cart is empty FIRST
            const cart = (typeof getCart === 'function') ? getCart() : getLocalCart();
            if (!cart || cart.length === 0) {
                showAuthError('cartEmptyNotice', 'Your cart is empty. Add items before checking out.');
                return;
            }

            // 2. Check auth status
            if (!isAuthenticated()) {
                // Save redirect intent
                const targetUrl = checkoutLink.href || checkoutLink.dataset.href || 'checkout_cod.html';
                localStorage.setItem('redirectAfterLogin', targetUrl);

                // Show custom login prompt modal with required message
                let authModal = document.getElementById('authUnifiedModal');
                if (!authModal) {
                    const modalHTML = `
                        <div id="authUnifiedModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999; backdrop-filter: blur(4px);">
                            <div style="background: white; padding: 30px; border-radius: 20px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2); font-family: 'Nunito', sans-serif;">
                                <div style="background: #e0e7ff; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                                    <i class="fas fa-lock" style="font-size: 24px; color: #4f46e5;"></i>
                                </div>
                                <h3 style="font-family: 'Fredoka', sans-serif; font-size: 24px; color: #1e1e1e; margin-bottom: 10px; margin-top: 0;">Sign in Required</h3>
                                <p style="color: #666; margin-bottom: 25px; font-size: 16px; line-height: 1.5; margin-top: 0;">Please sign in to checkout your cart items.</p>
                                <div style="display: flex; gap: 15px; justify-content: center;">
                                    <button onclick="document.getElementById('authUnifiedModal').style.display='none'" style="flex: 1; padding: 12px; border-radius: 10px; border: 1px solid #ddd; background: white; color: #333; font-weight: bold; font-size: 16px; cursor: pointer;">Cancel</button>
                                    <button onclick="window.location.href='login.html'" style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-weight: bold; font-size: 16px; cursor: pointer; box-shadow: 0 4px 15px rgba(102,126,234,0.3);">Sign In</button>
                                </div>
                            </div>
                        </div>
                    `;
                    document.body.insertAdjacentHTML('beforeend', modalHTML);
                    authModal = document.getElementById('authUnifiedModal');
                }
                authModal.style.display = 'flex';
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
    const verifyBtn = document.getElementById('verifyOTPBtn');
    if (verifyBtn && verifyBtn.disabled) return;

    const otpBoxes = document.querySelectorAll('.otp-box');
    const otp = Array.from(otpBoxes).map(b => b.value).join('');
    const email = document.getElementById('emailInput').value;

    if (otp.length < 6) {
        showAuthError('otpError', 'Please enter the full 6-digit OTP.');
        return;
    }

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
                let redirectPath = localStorage.getItem('redirectAfterLogin');
                
                // ── BUG FIX: Handle stale localStorage values from before the fix
                if (redirectPath === 'dashboard.html' || (redirectPath && redirectPath.endsWith('/dashboard.html'))) {
                    redirectPath = 'dashboard-new.html';
                }

                if (!profileData.profile_completed) {
                    // First-time user: save where they eventually want to land
                    // after completing their profile (checkout or dashboard)
                    localStorage.setItem('postProfileRedirect', redirectPath || 'dashboard-new.html');
                    localStorage.removeItem('redirectAfterLogin');
                    // Use replace() — removes login.html from browser history so
                    // pressing Back from profile-setup skips over login entirely.
                    window.location.replace('profile-setup.html');
                } else if (redirectPath) {
                    // Returning user: go to their saved intent (checkout, etc.)
                    localStorage.removeItem('redirectAfterLogin');
                    // Use replace() — same reason: login page should not sit in
                    // the history stack once the user is authenticated.
                    window.location.replace(redirectPath);
                } else {
                    // Returning user: default → dashboard
                    window.location.replace('dashboard-new.html');
                }
            } catch (error) {
                console.error('Profile status check failed:', error);
                // Fallback: use data.user from the JWT response
                let redirectPath = localStorage.getItem('redirectAfterLogin');
                if (redirectPath === 'dashboard.html' || (redirectPath && redirectPath.endsWith('/dashboard.html'))) {
                    redirectPath = 'dashboard-new.html';
                }
                if (!data.user.profile_completed) {
                    localStorage.setItem('postProfileRedirect', redirectPath || 'dashboard-new.html');
                    localStorage.removeItem('redirectAfterLogin');
                    window.location.replace('profile-setup.html');
                } else if (redirectPath) {
                    localStorage.removeItem('redirectAfterLogin');
                    window.location.replace(redirectPath);
                } else {
                    window.location.replace('dashboard-new.html');
                }
            }
        } else {
            showAuthError('otpError', data.error || 'Invalid OTP. Please try again.');
            if (verifyBtn) {
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify & Continue';
            }
        }
    } catch (err) {
        console.error("❌ Verification Error:", err);
        showAuthError('otpError', 'Server connection failed. Please try again.');
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify & Continue';
        }
    }
}

// ── Enhanced Cart UI Sync ───────────────────────────────────────────────
// Reads from localStorage for instant UI response. localStorage is always
// up-to-date because addToCart / removeFromCart / updateQuantityInCart
// update it synchronously before calling this function. The DB is kept in
// sync separately via the fire-and-forget syncCartToDB() call.
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

    // Update header auth button (syncAuthHeader in common.js)
    if (typeof syncAuthHeader === 'function') {
        syncAuthHeader();
    } else if (typeof window.syncAuthHeader === 'function') {
        window.syncAuthHeader();
    }
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
            return true;
        } else {
            showAuthError('otpRequestError', data.error || 'Failed to send OTP');
            return false;
        }
    } catch (err) {
        console.error("❌ OTP request error:", err);
        showAuthError('otpRequestError', 'Server connection failed. Please try again.');
        return false;
    }
}

// ── Initialization ────────────────────────────────────────────────────────

/**
 * resetLoginUI() — Restore the login form to a clean, idle state.
 * Called on bfcache restore (pageshow) and on page load when the user is
 * already authenticated, to ensure no stale "Verifying..." / "Sending..."
 * state is ever visible.
 */
function resetLoginUI() {
    // Reset Verify button
    const verifyBtn = document.getElementById('verifyOTPBtn');
    if (verifyBtn) {
        verifyBtn.disabled    = false;
        verifyBtn.textContent = 'Verify & Continue';
    }
    // Reset Send OTP button
    const requestBtn = document.getElementById('requestOTPBtn');
    if (requestBtn) {
        requestBtn.disabled    = false;
        requestBtn.textContent = 'Send OTP';
    }
    // Reset Resend button
    const resendBtn = document.getElementById('resendOTP');
    if (resendBtn) {
        resendBtn.disabled    = false;
        resendBtn.textContent = 'Resend OTP';
    }
    // Reset form back to Step 1 (email entry) so the OTP digit boxes
    // with stale values are hidden and the user sees a fresh email field.
    const step1 = document.getElementById('authStep1');
    const step2 = document.getElementById('authStep2');
    if (step1) step1.style.display = '';
    if (step2) step2.style.display = 'none';
    // Clear any stale OTP digits
    document.querySelectorAll('.otp-box').forEach(b => { b.value = ''; });
    // Hide any lingering error messages
    ['authError', 'otpError', 'otpRequestError'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // ── Early auth guard (login.html only) ───────────────────────────────
    // If the user is already authenticated when login.html loads (e.g. they
    // typed the URL directly, or the page was pre-fetched), redirect them to
    // the dashboard immediately — they should never see the sign-in form.
    if (document.getElementById('requestOTPBtn') && isAuthenticated()) {
        window.location.replace('dashboard-new.html');
        return; // stop all further DOMContentLoaded setup
    }

    // Initialize checkout protection
    initCheckoutProtection();

    // Sync global UI
    syncGlobalUI();

    // Helper for requesting OTP
    async function handleRequestOTP() {
        const requestBtn = document.getElementById('requestOTPBtn');
        if (requestBtn && requestBtn.disabled) return;

        const method = 'email';
        const emailInput = document.getElementById('emailInput');
        const value = emailInput ? emailInput.value.trim() : '';

        if (!value) {
            showAuthError('otpRequestError', 'Please enter your email address');
            return;
        }

        if (requestBtn) {
            requestBtn.disabled = true;
            requestBtn.textContent = 'Sending...';
        }

        const success = await requestOTP(method, value);

        if (requestBtn) {
            requestBtn.disabled = false;
            requestBtn.textContent = 'Send OTP';
        }

        if (success) {
            // Show OTP input section
            const authStep1 = document.getElementById('authStep1');
            const authStep2 = document.getElementById('authStep2');
            if (authStep1 && authStep2) {
                authStep1.style.display = 'none';
                authStep2.style.display = 'block';
                // Populate the email confirmation label
                const emailDisplay = document.getElementById('otpEmailDisplay');
                if (emailDisplay) emailDisplay.textContent = value;
                // Focus first OTP box
                const firstBox = document.querySelector('.otp-box');
                if (firstBox) firstBox.focus();
            }
        }
    }

    // Attach OTP verification handler
    const verifyBtn = document.getElementById('verifyOTPBtn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleVerifyOTP();
        });
    }

    // Attach OTP request handler (button click)
    const requestBtn = document.getElementById('requestOTPBtn');
    if (requestBtn) {
        requestBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleRequestOTP();
        });
    }

    // Logout handlers — custom modal instead of blocking confirm()
    const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutQuickBtn, [data-action="logout"]');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            showLogoutConfirmModal();
        });
    });

    // Auto-focus first OTP box
    const firstOTPBox = document.querySelector('.otp-box');
    if (firstOTPBox) {
        firstOTPBox.focus();
    }

    // OTP box auto-advance & Enter key submit handler
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
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleVerifyOTP();
            }
        });
    });

    // Form submit listener & Enter key handler for email step
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const step1 = document.getElementById('authStep1');
            const step2 = document.getElementById('authStep2');

            if (step1 && step1.style.display !== 'none') {
                handleRequestOTP();
            } else if (step2 && step2.style.display !== 'none') {
                handleVerifyOTP();
            }
        });
    }

    const emailInput = document.getElementById('emailInput');
    if (emailInput) {
        emailInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleRequestOTP();
            }
        });
    }

    // Resend OTP handler
    const resendBtn = document.getElementById('resendOTP');
    if (resendBtn) {
        resendBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const value = document.getElementById('emailInput')?.value;
            if (!value) return;
            resendBtn.disabled = true;
            resendBtn.textContent = 'Sending...';
            await requestOTP('email', value);
            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend OTP';
            // Clear OTP boxes for fresh entry
            document.querySelectorAll('.otp-box').forEach(b => { b.value = ''; });
            const firstBox = document.querySelector('.otp-box');
            if (firstBox) firstBox.focus();
        });
    }
});

// ── bfcache / Back-Forward Navigation Guard (login.html only) ────────────
// The browser's back-forward cache (bfcache) can restore a page from memory
// without re-running DOMContentLoaded. The 'pageshow' event fires in BOTH
// cases; when event.persisted is true the page was restored from bfcache.
//
// Without this handler, pressing Back from the dashboard would restore the
// login page with the button frozen in "Verifying..." state (the DOM
// snapshot was taken mid-request). This handler:
//   1. Always resets all loading states so the form is never frozen.
//   2. If the user is already authenticated (token still in localStorage),
//      replaces the login history entry with dashboard — they never see the
//      form at all.
window.addEventListener('pageshow', (event) => {
    // Only act on login.html (guard by presence of the OTP request button)
    if (!document.getElementById('requestOTPBtn')) return;

    if (event.persisted) {
        // Page was restored from bfcache — always reset UI first
        resetLoginUI();

        // If the user completed login before pressing Back, send them forward
        if (isAuthenticated()) {
            window.location.replace('dashboard-new.html');
        }
    }
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
    handleVerifyOTP,
    showAuthError,
    showLogoutConfirmModal
};
