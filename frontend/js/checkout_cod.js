/**
 * BrainyGrasp - Checkout Logic
 * Handles address persistence and order creation via PostgreSQL backend.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const itemsWrap = document.getElementById('codItems');
    const msg = document.getElementById('codMsg');
    const token = localStorage.getItem('bg_token');
    const API_BASE = (window.BG_CONFIG && window.BG_CONFIG.API_BASE) || 'http://localhost:3000';

    // 1. SECURITY GATE: Ensure user is logged in
    if (!token) {
        localStorage.setItem('redirectAfterLogin', 'checkout_cod.html');
        window.location.href = 'login.html';
        return;
    }

    // ── Fix 7: Load cart from DB for logged-in users ──────────────────────
    let activeCart = [];

    async function loadCart() {
        try {
            const res = await fetch(`${API_BASE}/api/cart`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const dbCart = await res.json();
                if (dbCart && dbCart.length > 0) {
                    // Use DB cart (authoritative for logged-in users)
                    activeCart = dbCart;
                    // Keep localStorage in sync
                    localStorage.setItem('bg_cart', JSON.stringify(dbCart));
                    return;
                }
            }
        } catch (err) {
            console.warn('Could not load DB cart, falling back to localStorage:', err);
        }
        // Fallback to localStorage (offline / API error)
        activeCart = typeof getCart === 'function' ? getCart() : [];
    }

    /**
     * Renders the current cart items in the checkout summary
     */
    function renderCheckoutSummary() {
        if (!activeCart || activeCart.length === 0) {
            itemsWrap.innerHTML = '<p class="muted">Your cart is empty.</p>';
            return;
        }

        itemsWrap.innerHTML = activeCart.map(item => `
            <div class="checkout-summary-item" style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px;">
                <span>${item.name} (x${item.quantity || 1})</span>
                <span>₹${item.price * (item.quantity || 1)}</span>
            </div>
        `).join('');

        const total = activeCart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        itemsWrap.innerHTML += `
            <div style="margin-top:16px; padding-top:8px; border-top:1px solid #ddd; font-weight:bold; display:flex; justify-content:space-between;">
                <span>TOTAL AMOUNT:</span>
                <span>₹${total}</span>
            </div>
        `;
    }

    /**
     * Pre-fills the user's basic details from the database
     */
    async function prefillUserInformation() {
        try {
            const res = await fetch(`${API_BASE}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const user = await res.json();
                if (user.name) document.getElementById('codName').value = user.name;
                if (user.phone) document.getElementById('codPhone').value = user.phone;
                if (user.address) document.getElementById('codLine1').value = user.address;
                if (user.city) document.getElementById('codCity').value = user.city;
                if (user.state) document.getElementById('codState').value = user.state;
                if (user.pincode) document.getElementById('codPincode').value = user.pincode;
                localStorage.setItem('bg_user', JSON.stringify(user));
            }
        } catch (err) {
            console.warn('Could not prefill user data:', err);
        }
    }

    // Initialize Page — load DB cart first, then render
    await loadCart();
    renderCheckoutSummary();
    prefillUserInformation();

    // 2. ORDER PLACEMENT LOGIC
    const placeOrderBtn = document.getElementById('codPlaceOrder');
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', async () => {
            // Collect Form Values
            const name = document.getElementById('codName').value.trim();
            const phone = document.getElementById('codPhone').value.trim();
            const line1 = document.getElementById('codLine1').value.trim();
            const city = document.getElementById('codCity').value.trim();
            const state = document.getElementById('codState').value.trim();
            const pincode = document.getElementById('codPincode').value.trim();

            // Basic Validation
            if (!name || !phone || !line1 || !city || !state || !pincode) {
                msg.style.color = '#c53030';
                msg.textContent = '⚠️ Please fill all delivery information fields.';
                return;
            }

            if (!activeCart || activeCart.length === 0) {
                msg.style.color = '#c53030';
                msg.textContent = '⚠️ Your cart is empty. Please add items before placing an order.';
                return;
            }

            // Disable button to prevent double orders
            placeOrderBtn.disabled = true;
            placeOrderBtn.textContent = 'Processing...';

            try {
                // STEP 1: Save Address to PostgreSQL
                const adrRes = await fetch(`${API_BASE}/api/addresses`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        full_name: name, phone, line1, city, state, pincode, is_default: false
                    })
                });

                if (!adrRes.ok) throw new Error('Address synchronization failed');
                const adr = await adrRes.json();

                // STEP 2: Create Order Linked to Address (use DB cart items)
                const total = activeCart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

                const orderRes = await fetch(`${API_BASE}/api/orders`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        address_id: adr.id,
                        items: activeCart,
                        subtotal: total,
                        total: total
                    })
                });

                if (!orderRes.ok) throw new Error('Order creation failed');
                const order = await orderRes.json();

                // SUCCESS STATE
                msg.style.color = '#2d8a4e';
                msg.innerHTML = `🎉 Order placed successfully! ID: <strong>#${order.id}</strong>`;

                // Cleanup — clearCart covers both localStorage + DB
                if (typeof clearCart === 'function') clearCart();
                activeCart = [];

                // Redirect to Dashboard after 3 seconds
                setTimeout(() => {
                    window.location.href = 'dashboard-new.html';
                }, 3000);

            } catch (err) {
                console.error('Checkout Process Error:', err);
                msg.style.color = '#c53030';
                msg.textContent = '❌ Error placing order. Please check your connection and try again.';
                placeOrderBtn.disabled = false;
                placeOrderBtn.textContent = 'Place Order (COD)';
            }
        });
    }
});