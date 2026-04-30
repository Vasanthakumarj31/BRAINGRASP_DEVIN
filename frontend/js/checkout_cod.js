document.addEventListener('DOMContentLoaded', () => {
  const itemsWrap = document.getElementById('codItems');
  const msg = document.getElementById('codMsg');
  function render() {
    const cart = getCart();
    if (!cart || cart.length === 0) {
      itemsWrap.innerHTML = '<p>No items in cart.</p>';
      return;
    }
    itemsWrap.innerHTML = cart.map(i => `<div>${i.name} - ₹${i.price} x ${i.quantity}</div>`).join('');
    const total = getCartTotal();
    itemsWrap.innerHTML += `<div style="margin-top:8px;font-weight:bold">TOTAL: ₹${total}</div>`;
  }
  render();

  const place = document.getElementById('codPlaceOrder');
  place.addEventListener('click', async () => {
    if (!isAuthenticated()) {
      window.location.href = 'login.html?redirect=checkout';
      return;
    }
    const name = document.getElementById('codName').value.trim();
    const phone = document.getElementById('codPhone').value.trim();
    const line1 = document.getElementById('codLine1').value.trim();
    const city = document.getElementById('codCity').value.trim();
    const state = document.getElementById('codState').value.trim();
    const pincode = document.getElementById('codPincode').value.trim();

    if (!name || !phone || !line1 || !city || !state || !pincode) {
      msg.style.color = 'red'; msg.textContent = 'Please fill all address fields.'; return;
    }

    try {
      // create address via backend to get address_id
      const token = getToken();
      const adrRes = await fetch('http://localhost:3000/api/addresses', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ full_name: name, phone, line1, city, state, pincode, is_default: false })
      });
      if (!adrRes.ok) throw new Error('Failed to save address');
      const adr = await adrRes.json();

      // place order
      const cart = getCart();
      const subtotal = getCartTotal();
      const orderRes = await fetch('http://localhost:3000/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ address_id: adr.id, items: cart, subtotal: subtotal, total: subtotal })
      });
      if (!orderRes.ok) throw new Error('Order placement failed');
      const order = await orderRes.json();
      msg.style.color = 'green'; msg.textContent = 'Order placed successfully. Order ID: ' + order.id;
      clearCart();
      setTimeout(() => { window.location.href = 'index.html'; }, 2500);
    } catch (err) {
      console.error(err);
      msg.style.color = 'red'; msg.textContent = 'Failed to place order. Ensure you are logged in.';
    }
  });
});
