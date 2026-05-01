/* === KEEP YOUR RENDERING FUNCTIONS AS THEY ARE === */
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

/* === MODIFIED EVENT LISTENER === */
document.addEventListener('DOMContentLoaded', () => {
  renderCartPage();

  // Handling removal (Existing logic)
  document.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.cart-item-remove');
    if (removeBtn && typeof removeFromCart === 'function') {
      removeFromCart(parseInt(removeBtn.dataset.id, 10));
      renderCartPage();
    }
  });

  const checkoutBtn = document.getElementById('cartPageCheckout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', (e) => {
      e.preventDefault();

      // 1. SECURITY CHECK: Is user signed in?
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        // User is a guest. Save intent and redirect to login.
        localStorage.setItem('redirectAfterLogin', 'cart.html'); 
        alert("Please sign in to place your order.");
        window.location.href = 'login.html';
        return;
      }

      // 2. IF SIGNED IN: Show payment modal (Your original logic)
      const overlay = document.getElementById('paymentModalOverlay');
      if (!overlay) {
        window.location.href = 'checkout_cod.html';
        return;
      }
      
      overlay.style.display = 'flex';
      overlay.setAttribute('aria-hidden','false');

      // ... rest of your Razorpay/COD logic remains the same ...
      const close = document.getElementById('pmClose');
      const payBtn = document.getElementById('payWithRzp');
      const codBtn = document.getElementById('payWithCOD');

      function hideModal(){ overlay.style.display='none'; overlay.setAttribute('aria-hidden','true'); }

      close && close.addEventListener('click', hideModal, { once:true });
      
      if (codBtn) codBtn.addEventListener('click', () => {
        hideModal();
        window.location.href = 'checkout_cod.html';
      }, { once:true });

      if (payBtn) payBtn.addEventListener('click', async () => {
        hideModal();
        // Razorpay logic here...
        // amount = getCartTotal() * 100 etc.
      });
    });
  }
});