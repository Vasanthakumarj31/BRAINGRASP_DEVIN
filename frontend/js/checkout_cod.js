/**
 * BrainyGrasp - Checkout Logic
 * Handles address persistence and order creation via PostgreSQL backend.
 */

document.addEventListener('DOMContentLoaded', () => {
    const itemsWrap = document.getElementById('codItems');
    const msg = document.getElementById('codMsg');
    const token = localStorage.getItem('authToken');

    // 1. SECURITY GATE: Ensure user is logged in
    if (!token) {
        alert("Session expired. Please log in again.");
        window.location.href = 'login.html?redirect=checkout';
        return;
    }

    /**
     * Renders the current cart items in the checkout summary
     */
    function renderCheckoutSummary() {
        // Assumes getCart() and getCartTotal() are defined in common.js
        const cart = typeof getCart === 'function' ? getCart() : [];
        
        if (!cart || cart.length === 0) {
            itemsWrap.innerHTML = '<p class="muted">Your cart is empty.</p>';
            return;
        }

        itemsWrap.innerHTML = cart.map(item => `
            <div class="checkout-summary-item" style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px;">
                <span>${item.name} (x${item.quantity})</span>
                <span>₹${item.price * item.quantity}</span>
            </div>
        `).join('');

        const total = typeof getCartTotal === 'function' ? getCartTotal() : 0;
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
            const res = await fetch('http://localhost:3000/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const user = await res.json();
                if (user.name) document.getElementById('codName').value = user.name;
                if (user.phone) document.getElementById('codPhone').value = user.phone;
                // Note: Add logic here to fetch and prefill the last saved address if needed
            }
        } catch (err) {
            console.warn("Could not prefill user data:", err);
        }
    }

    // Initialize Page
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

            // Disable button to prevent double orders
            placeOrderBtn.disabled = true;
            placeOrderBtn.textContent = "Processing...";

            try {
                // STEP 1: Save Address to PostgreSQL
                const adrRes = await fetch('http://localhost:3000/api/addresses', {
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

                // STEP 2: Create Order Linked to Address
                const cart = getCart();
                const total = getCartTotal();
                
                const orderRes = await fetch('http://localhost:3000/api/orders', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ 
                        address_id: adr.id, 
                        items: cart, 
                        subtotal: total, 
                        total: total 
                    })
                });

                if (!orderRes.ok) throw new Error('Order creation failed');
                const order = await orderRes.json();

                // SUCCESS STATE
                msg.style.color = '#2d8a4e';
                msg.innerHTML = `🎉 Order placed successfully! ID: <strong>#${order.id}</strong>`;
                
                // Cleanup
                if (typeof clearCart === 'function') clearCart();
                
                // Redirect to Dashboard after 3 seconds to show the new order
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 3000);

            } catch (err) {
                console.error("Checkout Process Error:", err);
                msg.style.color = '#c53030';
                msg.textContent = '❌ Error placing order. Please check your connection and try again.';
                placeOrderBtn.disabled = false;
                placeOrderBtn.textContent = "Place Order (COD)";
            }
        });
    }
});