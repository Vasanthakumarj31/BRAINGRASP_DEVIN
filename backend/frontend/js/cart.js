/* ============================================================
   cart.js – BrainyGrasp Cart Page Module
   Uses unified auth system for checkout protection
   ============================================================ */

const _cartPageAPIBase = (window.BG_CONFIG && window.BG_CONFIG.API_BASE) || 'http://localhost:3000';

// ── Refresh cart from DB if logged in, then render ──
async function loadAndRenderCartPage() {
  const token = localStorage.getItem('bg_token');
  if (token) {
    try {
      const res = await fetch(`${_cartPageAPIBase}/api/cart`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const dbCart = await res.json();
        if (dbCart && dbCart.length > 0) {
          localStorage.setItem('bg_cart', JSON.stringify(dbCart));
        }
      }
    } catch (err) {
      console.warn('Cart page: could not fetch DB cart, using localStorage:', err);
    }
  }
  renderCartPage();
}

// ── Cart Page Rendering ──
function renderCartPage() {
  if (typeof getCart !== 'function') {
    console.error('cart.js: getCart() not available – ensure common.js is loaded first.');
    return;
  }
  const itemsWrap = document.getElementById('cartPageItems');
  const empty     = document.getElementById('cartPageEmpty');
  const totalEl   = document.getElementById('cartPageTotal');
  if (!itemsWrap || !empty || !totalEl) return;

  const cart = getCart();
  if (!cart.length) {
    empty.style.display = 'flex';
    itemsWrap.innerHTML = '';
    totalEl.innerHTML = '&#8377;0';
    return;
  }

  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  empty.style.display = 'none';
  itemsWrap.innerHTML = cart.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <div class="cart-item-info">
        <div class="cart-item-name">${esc(item.name)}</div>
        <div class="cart-item-meta">&#8377;${item.price} each</div>
      </div>
      <div class="cart-item-controls">
        <button type="button" class="quantity-btn page-minus" data-id="${item.id}" aria-label="Decrease quantity">-</button>
        <span class="cart-item-qty">${item.quantity || 1}</span>
        <button type="button" class="quantity-btn page-plus"  data-id="${item.id}" aria-label="Increase quantity">+</button>
        <span class="cart-item-subtotal">&#8377;${item.price * (item.quantity || 1)}</span>
        <button type="button" class="cart-item-remove" data-id="${item.id}" aria-label="Remove item">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');

  if (typeof getCartTotal === 'function') {
    totalEl.innerHTML = `&#8377;${getCartTotal()}`;
  }
}

// ── Event Listeners ──
document.addEventListener('DOMContentLoaded', () => {

  // Load from DB (if logged in) then render
  loadAndRenderCartPage();

  // Delegated handler for quantity +/− and remove on the cart PAGE
  document.addEventListener('click', (e) => {

    // Quantity minus (cart page)
    const minusBtn = e.target.closest('.page-minus');
    if (minusBtn && typeof updateQuantityInCart === 'function') {
      updateQuantityInCart(parseInt(minusBtn.dataset.id, 10), -1);
      renderCartPage();
      return;
    }

    // Quantity plus (cart page)
    const plusBtn = e.target.closest('.page-plus');
    if (plusBtn && typeof updateQuantityInCart === 'function') {
      updateQuantityInCart(parseInt(plusBtn.dataset.id, 10), +1);
      renderCartPage();
      return;
    }

    // Remove item (cart page)
    const removeBtn = e.target.closest('.cart-item-remove');
    if (removeBtn && typeof removeFromCart === 'function') {
      removeFromCart(parseInt(removeBtn.dataset.id, 10));
      renderCartPage();
      return;
    }
  });

  // Checkout protection is handled automatically by auth-unified.js
});