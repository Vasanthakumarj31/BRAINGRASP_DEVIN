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

document.addEventListener('DOMContentLoaded', () => {
  renderCartPage();
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
      // Show payment modal with options
      const overlay = document.getElementById('paymentModalOverlay');
      if (!overlay) {
        // fallback: go to COD page
        window.location.href = 'checkout_cod.html';
        return;
      }
      overlay.style.display = 'flex';
      overlay.setAttribute('aria-hidden','false');

      const close = document.getElementById('pmClose');
      const payBtn = document.getElementById('payWithRzp');
      const codBtn = document.getElementById('payWithCOD');

      function hideModal(){ overlay.style.display='none'; overlay.setAttribute('aria-hidden','true'); }

      close && close.addEventListener('click', hideModal, { once:true });
      overlay.addEventListener('click', (ev)=>{ if(ev.target===overlay) hideModal(); }, { once:true });

      if (codBtn) codBtn.addEventListener('click', () => {
        hideModal();
        window.location.href = 'checkout_cod.html';
      }, { once:true });

      if (payBtn) payBtn.addEventListener('click', async () => {
        hideModal();
        try {
          // Use Razorpay Checkout to open payment window. Replace key with your own.
          const amount = getCartTotal() * 100; // paise
          const options = {
            key: 'rzp_test_XXXXXXXXXXXX',
            amount: amount,
            currency: 'INR',
            name: 'BrainyGrasp',
            description: 'Order payment',
            handler: function (response){
              // On successful payment, show confirmation and clear cart
              alert('Payment successful. Payment id: ' + (response.razorpay_payment_id||''));
              // optional: call backend to record payment/order here
              clearCart();
              renderCartPage();
              window.location.href = 'index.html';
            },
            modal: { escape: true },
            prefill: { name: getUser()?.name || '', email: getUser()?.email || '', contact: getUser()?.phone || '' }
          };

          if (typeof Razorpay === 'undefined') {
            alert('Razorpay SDK not loaded. Ensure checkout.js is included.');
            return;
          }
          const rzp = new Razorpay(options);
          rzp.open();
        } catch (err) {
          console.error('Razorpay init error', err);
          alert('Unable to open payment gateway. Try Cash on Delivery.');
        }
      }, { once:true });
    });
  }
});
