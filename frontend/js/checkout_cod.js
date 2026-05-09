/* ============================================================
   checkout_cod.js – BrainyGrasp Production Checkout
   Handles: Auth gate, cart load, profile prefill, COD + Razorpay
   ============================================================ */

const API_BASE = (window.BG_CONFIG && window.BG_CONFIG.API_BASE) || 'http://localhost:3000';

// ── State ─────────────────────────────────────────────────────
let activeCart  = [];
let activeTotal = 0;
let activeSubtotal = 0;
let shipping    = 0;
let promoDiscount = 0;
let currentTab  = 'profile'; // 'profile' | 'new'
let userProfile = null;

// ── Helpers ───────────────────────────────────────────────────
const esc = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function showMsg(text, type = 'error') {
  const el = document.getElementById('coMsg');
  el.className = type;
  el.textContent = text;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function clearMsg() {
  const el = document.getElementById('coMsg');
  el.style.display = 'none';
  el.textContent = '';
}

// ── Tab Switching ─────────────────────────────────────────────
window.switchTab = function(tab) {
  currentTab = tab;
  document.getElementById('tabProfile').classList.toggle('active', tab === 'profile');
  document.getElementById('tabNew').classList.toggle('active', tab === 'new');
  document.getElementById('profileAddrPanel').style.display = tab === 'profile' ? 'block' : 'none';
  document.getElementById('newAddrPanel').style.display    = tab === 'new'     ? 'block' : 'none';
};

// ── Collect Address from active tab ───────────────────────────
function getAddress() {
  if (currentTab === 'profile') {
    return {
      name   : document.getElementById('codName').value.trim(),
      phone  : document.getElementById('codPhone').value.trim(),
      line1  : document.getElementById('codLine1').value.trim(),
      city   : document.getElementById('codCity').value.trim(),
      state  : document.getElementById('codState').value.trim(),
      pincode: document.getElementById('codPincode').value.trim(),
    };
  } else {
    return {
      name   : document.getElementById('newName').value.trim(),
      phone  : document.getElementById('newPhone').value.trim(),
      line1  : document.getElementById('newLine1').value.trim(),
      city   : document.getElementById('newCity').value.trim(),
      state  : document.getElementById('newState').value.trim(),
      pincode: document.getElementById('newPincode').value.trim(),
    };
  }
}

function validateAddress(a) {
  if (!a.name || !a.phone || !a.line1 || !a.city || !a.state || !a.pincode) {
    showMsg('⚠️ Please fill all delivery address fields.');
    return false;
  }
  if (!/^\d{10}$/.test(a.phone)) {
    showMsg('⚠️ Enter a valid 10-digit phone number.');
    return false;
  }
  if (!/^\d{6}$/.test(a.pincode)) {
    showMsg('⚠️ Enter a valid 6-digit PIN code.');
    return false;
  }
  return true;
}

// ── Render Order Summary ───────────────────────────────────────
function renderSummary() {
  const wrap = document.getElementById('coItems');
  if (!activeCart || !activeCart.length) {
    wrap.innerHTML = `
      <div class="empty-cart">
        <i class="fas fa-shopping-bag"></i>
        <p>Your cart is empty.</p>
        <a href="index.html" style="color:var(--primary);font-weight:700">Continue Shopping</a>
      </div>`;
    document.getElementById('btnPlaceOrder').disabled = true;
    return false;
  }

  activeSubtotal = activeCart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  shipping = activeSubtotal >= 999 ? 0 : 60;
  activeTotal = activeSubtotal + shipping - promoDiscount;
  if (activeTotal < 0) activeTotal = 0;

  const itemsHTML = activeCart.map(item => `
    <div class="order-item-row">
      <div>
        <div class="oi-name">${esc(item.name)}</div>
        <div class="oi-qty">Qty: ${item.quantity || 1} × ₹${item.price}</div>
      </div>
      <div class="oi-price">₹${item.price * (item.quantity || 1)}</div>
    </div>`).join('');

  const shippingHTML = shipping === 0
    ? '<span class="free-ship">FREE</span>'
    : `₹${shipping}`;

  const discountRow = promoDiscount > 0
    ? `<div class="tot-row" style="color:var(--green)"><span>Promo Discount</span><span>− ₹${promoDiscount}</span></div>`
    : '';

  wrap.innerHTML = `
    ${itemsHTML}
    <div class="totals-block">
      <div class="tot-row"><span>Subtotal (${activeCart.length} item${activeCart.length > 1 ? 's' : ''})</span><span>₹${activeSubtotal}</span></div>
      <div class="tot-row"><span>Delivery</span><span>${shippingHTML}</span></div>
      ${discountRow}
      <div class="tot-row grand"><span>Total Payable</span><span style="color:var(--orange)">₹${activeTotal}</span></div>
    </div>`;

  return true;
}

// ── Promo Code (stub — extend with real API) ───────────────────
window.applyPromo = function() {
  const code   = document.getElementById('promoInput').value.trim().toUpperCase();
  const msgEl  = document.getElementById('promoMsg');
  const PROMOS = { 'BRAINY10': 10, 'BRAINY15': 15, 'FLAT50': 50 };

  if (!code) { msgEl.style.display = 'none'; return; }

  if (PROMOS[code]) {
    // percentage if ≤ 20, flat otherwise
    if (PROMOS[code] <= 20) {
      promoDiscount = Math.round(activeSubtotal * PROMOS[code] / 100);
      msgEl.textContent = `✅ ${PROMOS[code]}% off applied! You save ₹${promoDiscount}`;
    } else {
      promoDiscount = PROMOS[code];
      msgEl.textContent = `✅ Flat ₹${promoDiscount} off applied!`;
    }
    msgEl.style.color   = 'var(--green-dark)';
    msgEl.style.display = 'block';
  } else {
    promoDiscount = 0;
    msgEl.textContent   = '❌ Invalid promo code.';
    msgEl.style.color   = '#c53030';
    msgEl.style.display = 'block';
  }
  renderSummary();
};

// ── Profile Prefill ────────────────────────────────────────────
async function prefillProfile(token) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const u = await res.json();
    userProfile = u;
    localStorage.setItem('bg_user', JSON.stringify(u));

    // Banner
    const initial = (u.name || 'U')[0].toUpperCase();
    document.getElementById('profileInitial').textContent = initial;
    document.getElementById('profileName').textContent    = u.name  || 'Your Name';
    document.getElementById('profileEmail').textContent   = u.email || '';

    // Address fields
    const setVal = (id, val) => { if (val) { const el = document.getElementById(id); if (el) { el.value = val; el.classList.add('prefilled'); } } };
    setVal('codName',    u.name);
    setVal('codPhone',   u.phone);
    setVal('codLine1',   u.address);
    setVal('codCity',    u.city);
    setVal('codState',   u.state);
    setVal('codPincode', u.pincode);

  } catch (e) {
    console.warn('Profile prefill failed:', e);
    // Try from localStorage
    const cached = JSON.parse(localStorage.getItem('bg_user') || 'null');
    if (cached) {
      userProfile = cached;
      document.getElementById('profileInitial').textContent = (cached.name || 'U')[0].toUpperCase();
      document.getElementById('profileName').textContent    = cached.name  || 'User';
      document.getElementById('profileEmail').textContent   = cached.email || '';
    }
  }
}

// ── Load Cart (DB-first) ───────────────────────────────────────
async function loadCart(token) {
  try {
    const res = await fetch(`${API_BASE}/api/cart`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const db = await res.json();
      if (db && db.length > 0) {
        activeCart = db;
        localStorage.setItem('bg_cart', JSON.stringify(db));
        return;
      }
    }
  } catch (e) { console.warn('DB cart fallback:', e); }
  activeCart = typeof getCart === 'function' ? getCart() : [];
}

// ── Save Address → Create Order ────────────────────────────────
async function placeOrder(token, payMethod, paymentId = null) {
  const addr = getAddress();
  if (!validateAddress(addr)) return null;

  const btn = document.getElementById('btnPlaceOrder');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin spinner"></i> Processing…';

  try {
    // 1. Save address
    const aRes = await fetch(`${API_BASE}/api/addresses`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body   : JSON.stringify({
        full_name: addr.name, phone: addr.phone,
        line1: addr.line1, city: addr.city,
        state: addr.state, pincode: addr.pincode, is_default: false
      })
    });
    if (!aRes.ok) throw new Error('Failed to save delivery address.');
    const aData = await aRes.json();

    // 2. Place order
    const oRes = await fetch(`${API_BASE}/api/orders`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body   : JSON.stringify({
        address_id    : aData.id,
        items         : activeCart,
        subtotal      : activeSubtotal,
        total         : activeTotal,
        payment_method: payMethod,
        payment_id    : paymentId
      })
    });
    if (!oRes.ok) throw new Error('Failed to create order. Please try again.');
    const order = await oRes.json();

    // 3. Clear cart everywhere
    if (typeof clearCart === 'function') clearCart();
    localStorage.removeItem('bg_cart');
    activeCart = [];

    return order.id;

  } catch (err) {
    console.error('Order error:', err);
    showMsg('❌ ' + err.message);
    btn.disabled  = false;
    btn.innerHTML = currentPayMethod() === 'cod'
      ? '<i class="fas fa-check-circle"></i> Place Order (Cash on Delivery)'
      : '<i class="fas fa-bolt"></i> Pay Now with Razorpay';
    return null;
  }
}

function currentPayMethod() {
  return document.querySelector('input[name="payMethod"]:checked')?.value || 'cod';
}

// ── Success Overlay ────────────────────────────────────────────
function showSuccess(orderId, payNote) {
  document.getElementById('successOrderId').textContent  = `Order #${orderId}`;
  document.getElementById('successPayNote').textContent  = payNote;
  document.getElementById('successOverlay').style.display = 'flex';
  document.getElementById('stepConfirm').classList.add('active');
  // Animate progress bar then redirect
  requestAnimationFrame(() => {
    document.getElementById('redirectFill').style.width = '100%';
  });
  setTimeout(() => window.location.href = 'dashboard-new.html', 3200);
}

// ── Payment Method UI Toggle ───────────────────────────────────
function updatePayBtn() {
  const method = currentPayMethod();
  const btn    = document.getElementById('btnPlaceOrder');
  if (method === 'razorpay') {
    btn.className   = 'btn-place btn-rzp';
    btn.innerHTML   = '<i class="fas fa-bolt"></i> Pay Now with Razorpay';
    document.getElementById('codInfoBox').style.display = 'none';
    document.getElementById('rzpInfoBox').style.display = 'flex';
  } else {
    btn.className   = 'btn-place btn-cod';
    btn.innerHTML   = '<i class="fas fa-check-circle"></i> Place Order (Cash on Delivery)';
    document.getElementById('codInfoBox').style.display = 'flex';
    document.getElementById('rzpInfoBox').style.display = 'none';
  }
}

// ── Razorpay Flow ──────────────────────────────────────────────
async function startRazorpay(token) {
  const addr = getAddress();
  if (!validateAddress(addr)) return;

  const btn = document.getElementById('btnPlaceOrder');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin spinner"></i> Initializing Payment…';

  try {
    const rzpRes = await fetch(`${API_BASE}/api/payment/create-order`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body   : JSON.stringify({ amount: activeTotal })
    });
    const rzpOrder = await rzpRes.json();

    if (!rzpOrder.orderId) {
      showMsg('❌ Could not initialize payment. Please check Razorpay configuration.');
      btn.disabled  = false;
      btn.innerHTML = '<i class="fas fa-bolt"></i> Pay Now with Razorpay';
      return;
    }

    const options = {
      key         : rzpOrder.key,
      amount      : rzpOrder.amount,
      currency    : rzpOrder.currency,
      name        : 'BrainyGrasp',
      description : 'Educational Toys Purchase',
      image       : 'images/logo.jpg',
      order_id    : rzpOrder.orderId,
      prefill     : {
        name   : addr.name,
        contact: addr.phone,
        email  : userProfile?.email || ''
      },
      theme       : { color: '#667eea' },
      modal       : {
        ondismiss: () => {
          showMsg('Payment cancelled. You can try again.', 'info');
          btn.disabled  = false;
          btn.innerHTML = '<i class="fas fa-bolt"></i> Pay Now with Razorpay';
        }
      },
      handler: async (response) => {
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin spinner"></i> Verifying…';

        const verRes = await fetch(`${API_BASE}/api/payment/verify`, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body   : JSON.stringify({
            razorpay_order_id  : response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature : response.razorpay_signature
          })
        });
        const verify = await verRes.json();

        if (verify.success) {
          const orderId = await placeOrder(token, 'razorpay', verify.payment_id);
          if (orderId) showSuccess(orderId, '✅ Online payment successful! Order confirmed.');
        } else {
          showMsg('❌ Payment verification failed. Contact support with your payment ID.');
          btn.disabled  = false;
          btn.innerHTML = '<i class="fas fa-bolt"></i> Pay Now with Razorpay';
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (err) {
    console.error('Razorpay init error:', err);
    showMsg('❌ Payment initialization failed. Please try again.');
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-bolt"></i> Pay Now with Razorpay';
  }
}

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // 1. Auth gate
  const token = localStorage.getItem('bg_token');
  if (!token) {
    localStorage.setItem('redirectAfterLogin', 'checkout_cod.html');
    window.location.href = 'login.html';
    return;
  }

  // 2. Parallel load: profile + cart
  await Promise.all([
    prefillProfile(token),
    loadCart(token)
  ]);

  // 3. Render order summary
  const hasItems = renderSummary();
  if (!hasItems) return; // empty cart — button already disabled

  // 4. Payment method radio toggle
  document.querySelectorAll('input[name="payMethod"]').forEach(r => {
    r.addEventListener('change', () => { clearMsg(); updatePayBtn(); });
  });

  // 5. Place Order button
  document.getElementById('btnPlaceOrder').addEventListener('click', async () => {
    clearMsg();
    const method = currentPayMethod();

    if (method === 'cod') {
      const orderId = await placeOrder(token, 'cod');
      if (orderId) showSuccess(orderId, '🏠 Pay cash when your order arrives at your door.');
    } else {
      await startRazorpay(token);
    }
  });

  // 6. Live form validation feedback
  ['codPhone', 'newPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.style.borderColor = /^\d{10}$/.test(el.value) ? 'var(--green)' : '';
    });
  });
  ['codPincode', 'newPincode'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.style.borderColor = /^\d{6}$/.test(el.value) ? 'var(--green)' : '';
    });
  });
});