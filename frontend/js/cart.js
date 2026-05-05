/* ============================================================
   cart.js – BrainyGrasp Cart Page Module (Simplified)
   Uses unified auth system for checkout protection
   ============================================================ */

// ── Cart Rendering ────────────────────────────────────────────────────────
function renderCartPage() {
  if (typeof getCart !== 'function') return;
  const itemsWrap = document.getElementById('cartPageItems');
  const empty = document.getElementById('cartPageEmpty');
  const totalEl = document.getElementById('cartPageTotal');
  if (!itemsWrap || !empty || !totalEl) return;

  const cart = getCart();
  if (!cart.length) {
    empty.style.display = 'flex';
    itemsWrap.innerHTML = '';
    totalEl.innerHTML = '&#8377;0';
    return;
  }

  empty.style.display = 'none';
  itemsWrap.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div>
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">&#8377;${item.price} x ${item.quantity}</div>
      </div>
      <button type="button" class="cart-item-remove" data-id="${item.id}" aria-label="Remove item">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
  totalEl.innerHTML = `&#8377;${getCartTotal()}`;
}

// ── Event Listeners ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Render cart on page load
  renderCartPage();

  // Handle item removal
  document.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.cart-item-remove');
    if (removeBtn && typeof removeFromCart === 'function') {
      removeFromCart(parseInt(removeBtn.dataset.id, 10));
      renderCartPage();
    }
  });

  // Checkout button - Now handled by unified auth system
  // The checkout intent detection is automatically handled by auth-unified.js
  // No additional logic needed here
});