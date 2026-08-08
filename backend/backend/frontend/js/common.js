// === Announcement Bar Slider ===

function initAnnouncementSlider() {

  const slides = document.querySelectorAll('.announcement-slide');

  if (!slides.length) return;

  let current = 0;

  setInterval(() => {

    slides[current].classList.remove('active');

    current = (current + 1) % slides.length;

    slides[current].classList.add('active');

  }, 3000);

}

// === Search ===

// Full search implementation is in modern-search.js

// === Cart Sidebar (UPDATED) ===

function initCart(retryCount = 0) {

  const cartBtn = document.getElementById('cartBtn');

  const cartOverlay = document.getElementById('cartOverlay');

  const cartSidebar = document.getElementById('cartSidebar');

  const cartClose = document.getElementById('cartClose');

  if (!cartBtn || !cartOverlay || !cartSidebar || !cartClose) {

    if (retryCount < 5) {

      // Retry up to 5 times (max 2.5 s) in case elements load slightly later

      setTimeout(() => initCart(retryCount + 1), 500);

    } else {

      console.warn('initCart: Cart elements not found on this page — skipping initialization.');

    }

    return;

  }

  function openCart() {

    // TRIGGER UI UPDATE ON OPEN

    if (typeof updateCartCount === 'function') updateCartCount();

    if (typeof renderCartSidebar === 'function') renderCartSidebar();

    cartOverlay.classList.add('active');

    cartSidebar.classList.add('active');

    document.body.style.overflow = 'hidden';

  }

  function closeCart() {

    cartOverlay.classList.remove('active');

    cartSidebar.classList.remove('active');

    document.body.style.overflow = '';

  }

  cartBtn.addEventListener('click', openCart);

  cartOverlay.addEventListener('click', closeCart);

  cartClose.addEventListener('click', closeCart);

}

// === Mobile Menu ===

function initMobileMenu() {

  const menuBtn = document.getElementById('mobileMenuBtn');

  const nav = document.getElementById('mainNav');

  const overlay = document.getElementById('mobileOverlay');

  if (!menuBtn || !nav) return;

  function openMenu() {

    nav.classList.add('active');

    if (overlay) overlay.classList.add('active');

    document.body.style.overflow = 'hidden';

  }

  function closeMenu() {

    nav.classList.remove('active');

    if (overlay) overlay.classList.remove('active');

    document.body.style.overflow = '';

  }

  menuBtn.addEventListener('click', openMenu);

  if (overlay) overlay.addEventListener('click', closeMenu);

  document.querySelectorAll('.nav-item.has-mega .nav-link').forEach(link => {

    link.addEventListener('click', (e) => {

      if (window.innerWidth <= 768) {

        e.preventDefault();

        link.closest('.nav-item').classList.toggle('open');

      }

    });

  });

}

// === Sticky Header ===

function initStickyHeader() {

  const header = document.getElementById('mainHeader');

  if (!header) return;

  window.addEventListener('scroll', () => {

    if (window.scrollY > 100) {

      header.classList.add('scrolled');

    } else {

      header.classList.remove('scrolled');

    }

  });

}

// === Back to Top ===

function initBackToTop() {

  const btn = document.getElementById('backToTop');

  if (!btn) return;

  window.addEventListener('scroll', () => {

    if (window.scrollY > 500) {

      btn.classList.add('visible');

    } else {

      btn.classList.remove('visible');

    }

  });

  btn.addEventListener('click', () => {

    window.scrollTo({ top: 0, behavior: 'smooth' });

  });

}

// === Essential Cart Functions ===

function getCart() {
  try {
    return JSON.parse(localStorage.getItem('bg_cart')) || [];
  } catch (e) {
    return [];
  }
}

// Sync current localStorage cart to the DB (for logged-in users)
function syncCartToDB() {
  const token = localStorage.getItem('bg_token');
  if (!token) return;
  const apiBase = (window.BG_CONFIG && window.BG_CONFIG.API_BASE) || 'http://localhost:3000';
  const cart = getCart();
  fetch(`${apiBase}/api/cart/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ items: cart })
  }).catch(err => console.error('\u274c Failed to sync cart to DB:', err));
}
window.syncCartToDB = syncCartToDB;

function addToCart(item) {
  const cart = getCart();
  const existingItem = cart.find(cartItem => cartItem.id === item.id);

  if (existingItem) {
    existingItem.quantity = (existingItem.quantity || 1) + 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }

  localStorage.setItem('bg_cart', JSON.stringify(cart));

  // Sync to DB if user is logged in
  syncCartToDB();

  // Update cart count / UI
  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }
}

function removeFromCart(itemId) {
  let cart = getCart();
  cart = cart.filter(item => item.id !== itemId);
  localStorage.setItem('bg_cart', JSON.stringify(cart));

  // Sync to DB if user is logged in
  syncCartToDB();

  // Update cart count / UI
  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }
}

function getCartTotal() {
  const cart = getCart();
  return cart.reduce((total, item) => total + (item.price * (item.quantity || 1)), 0);
}

// ── Update quantity of an item in the cart (delta = +1 or -1) ──
function updateQuantityInCart(itemId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === itemId);
  if (!item) return;
  item.quantity = Math.max(1, (item.quantity || 1) + delta);
  localStorage.setItem('bg_cart', JSON.stringify(cart));
  syncCartToDB();
  if (typeof updateCartCount === 'function') updateCartCount();
}

// Make functions globally available
window.getCart = getCart;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.getCartTotal = getCartTotal;
window.updateQuantityInCart = updateQuantityInCart;

// === escapeHTML — shared XSS-safe string encoder ===
// Shared XSS-safe string encoder; available to all pages that load common.js
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
window.escapeHTML = escapeHTML;

// === Clear Cart ===
function clearCart() {
  localStorage.removeItem('bg_cart');

  // Also sync empty cart to DB if user is logged in
  const token = localStorage.getItem('bg_token');
  if (token) {
    const apiBase = (window.BG_CONFIG && window.BG_CONFIG.API_BASE) || 'http://localhost:3000';
    fetch(`${apiBase}/api/cart/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ items: [] })
    }).catch(err => console.error('❌ Failed to clear DB cart:', err));
  }

  if (typeof updateCartCount === 'function') updateCartCount();
}
window.clearCart = clearCart;

// === Cart Count Update (local fallback only) ===

// Guard: auth-unified.js defines the full DB-aware version and should take priority.

// This version is only used when auth-unified.js is NOT loaded on the page.

if (typeof updateCartCount === 'undefined') {

  window.updateCartCount = function updateCartCount() {

    const cart = getCart();

    const totalItems = cart.reduce((total, item) => total + (item.quantity || 1), 0);

    // Update all cart count elements

    const countEls = document.querySelectorAll('.cart-count');

    countEls.forEach(el => {

      el.textContent = totalItems;

      // Hide badge when cart is empty

      el.style.display = totalItems > 0 ? 'flex' : 'none';

      // Add animation

      el.style.transform = 'scale(1.2)';

      setTimeout(() => el.style.transform = 'scale(1)', 200);

    });

    // Update cart sidebar if open

    const cartSidebar = document.getElementById('cartSidebar');

    if (cartSidebar && cartSidebar.classList.contains('active')) {

      renderCartSidebar();

    }

  };

}

// === Render Cart Sidebar ===

function renderCartSidebar() {

  const cart = getCart();

  const cartItems = document.getElementById('cartItems');

  const cartTotal = document.getElementById('cartTotal');

  const cartEmpty = document.getElementById('cartEmpty');

  if (!cartItems) return;

  // Update item count label
  const countLabel = document.getElementById('cartItemCount');
  if (countLabel) {
    const totalQty = cart.reduce((s, i) => s + (i.quantity || 1), 0);
    countLabel.textContent = totalQty;
  }

  // Update free shipping bar
  const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  const SHIPPING_THRESHOLD = 999;
  const shippingFill = document.getElementById('shippingBarFill');
  const shippingMsg  = document.getElementById('shippingBarMsg');
  if (shippingFill && shippingMsg) {
    const pct = Math.min((total / SHIPPING_THRESHOLD) * 100, 100);
    shippingFill.style.width = pct + '%';
    if (total >= SHIPPING_THRESHOLD) {
      shippingMsg.innerHTML = '<strong>🎉 You unlocked FREE shipping!</strong>';
    } else {
      const left = SHIPPING_THRESHOLD - total;
      shippingMsg.innerHTML = `Add <strong>₹${left}</strong> more for FREE shipping!`;
    }
  }

  if (cart.length === 0) {

    if (cartEmpty) cartEmpty.style.display = 'flex';

    cartItems.innerHTML = '';

    if (cartTotal) cartTotal.textContent = '₹0';

  } else {

    if (cartEmpty) cartEmpty.style.display = 'none';

    cartItems.innerHTML = cart.map(item => `

      <div class="cart-item">

        ${item.image
          ? `<img class="cart-item-img" src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <div class="cart-item-img-placeholder" style="${item.image ? 'display:none' : ''}">🧸</div>

        <div class="cart-item-body">

          <div class="cart-item-name">${escapeHTML(item.name)}</div>

          <div class="cart-item-price">₹${item.price}</div>

          <div class="cart-item-actions">
            <button class="quantity-btn minus" data-id="${item.id}">−</button>
            <span class="quantity">${item.quantity || 1}</span>
            <button class="quantity-btn plus" data-id="${item.id}">+</button>
            <button class="remove-btn" data-id="${item.id}" title="Remove">×</button>
          </div>

        </div>

      </div>

    `).join('');

    if (cartTotal) cartTotal.textContent = `₹${total}`;

  }

}

// === Cart Sidebar Button Handlers ===
// Delegated listener for +/−/× buttons rendered inside #cartItems by renderCartSidebar().
// Must be initialised once — handles all dynamically rendered buttons.

function initCartSidebarActions() {

  document.addEventListener('click', function (e) {

    // ── Quantity minus ─────────────────────────────────────────────────

    const minusBtn = e.target.closest('#cartItems .quantity-btn.minus');

    if (minusBtn) {

      const id = parseInt(minusBtn.dataset.id, 10);

      if (!isNaN(id) && typeof updateQuantityInCart === 'function') updateQuantityInCart(id, -1);

      if (typeof renderCartSidebar === 'function') renderCartSidebar();

      return;

    }

    // ── Quantity plus ──────────────────────────────────────────────────

    const plusBtn = e.target.closest('#cartItems .quantity-btn.plus');

    if (plusBtn) {

      const id = parseInt(plusBtn.dataset.id, 10);

      if (!isNaN(id) && typeof updateQuantityInCart === 'function') updateQuantityInCart(id, +1);

      if (typeof renderCartSidebar === 'function') renderCartSidebar();

      return;

    }

    // ── Remove item ────────────────────────────────────────────────────

    const removeBtn = e.target.closest('#cartItems .remove-btn');

    if (removeBtn) {

      const id = parseInt(removeBtn.dataset.id, 10);

      if (!isNaN(id) && typeof removeFromCart === 'function') removeFromCart(id);

      if (typeof renderCartSidebar === 'function') renderCartSidebar();

      return;

    }

  });

}

// === Add to Cart Animation (UPDATED) ===

function initAddToCart() {

  document.addEventListener('click', (e) => {

    if (e.target.closest('.add-to-cart-btn')) {

      const btn = e.target.closest('.add-to-cart-btn');

      // visual feedback

      const originalHTML = btn.innerHTML;

      const originalBg = btn.style.background || '';

      btn.innerHTML = '<i class="fas fa-check"></i> Added!';

      btn.style.background = '#10B981';

      try {

        const card = btn.closest('.product-card');

        let item = null;

        if (card) {

          const id = parseInt(card.dataset.id) || null;

          const name = card.querySelector('.product-name')?.textContent || '';

          const priceAttr = card.dataset.price || card.querySelector('.price-current')?.textContent || '';

          const price = parseInt(String(priceAttr).replace(/\D/g, '')) || 0;

          // Capture image from the card
          const imgEl = card.querySelector('.product-image img, img');
          const image = imgEl ? imgEl.src : '';

          if (id && price > 0) {
            item = { id, name, price, image };
          } else if (id && price === 0) {
            console.warn(`addToCart: product id=${id} has no valid price. Check data-price attribute.`);
          }

        }

        // Add to storage via helper

        if (typeof addToCart === 'function' && item) {

          addToCart(item);

        } else {

          // Fallback UI update

          const countEls = document.querySelectorAll('.cart-count');

          countEls.forEach(el => {

            const n = parseInt(el.textContent) || 0;

            el.textContent = n + 1;

            el.style.transform = 'scale(1.3)';

            setTimeout(() => el.style.transform = 'scale(1)', 200);

          });

        }

        // REFRESH UI IMMEDIATELY

        if (typeof updateCartCount === 'function') updateCartCount();

      } catch (err) {

        console.error('add-to-cart failed', err);

      }

      setTimeout(() => {

        btn.innerHTML = originalHTML || '<i class="fas fa-shopping-bag"></i> Add to Cart';

        btn.style.background = originalBg;

        // Update counters again after animation duration

        if (typeof updateCartCount === 'function') updateCartCount();

      }, 1500);

    }

  });

}

function initCommerceRoutes() {

  // View Cart button → cart.html
  document.querySelectorAll('.btn-view-cart, .btn-view-cart-modern').forEach(btn => {

    btn.addEventListener('click', () => {

      window.location.href = 'cart.html';

    });

  });

  // Secure Checkout button → checkout_cod.html
  const checkoutBtn = document.getElementById('sidebarCheckoutBtn');

  if (checkoutBtn) {

    checkoutBtn.addEventListener('click', () => {

      const cart = typeof getCart === 'function' ? getCart() : [];

      if (!cart.length) return; // don't navigate with empty cart

      window.location.href = 'checkout_cod.html';

    });

  }

}

function initGlobalLinks() {

  document.querySelectorAll('a.logo, a.footer-logo').forEach(link => {

    if (link.getAttribute('href') === '/') link.setAttribute('href', 'index.html');

  });

  document.querySelectorAll('a.whatsapp-btn, a.whatsapp-float, a.footer-whatsapp').forEach(link => {

    if (link.getAttribute('href') === '#') {

      link.setAttribute('href', 'https://wa.me/919999999999');

      link.setAttribute('target', '_blank');

      link.setAttribute('rel', 'noopener noreferrer');

    }

  });

  document.querySelectorAll('a[href="#help"]').forEach(link => {

    link.setAttribute('href', 'faqs.html');

  });

  document.querySelectorAll('a[href="#"]').forEach(link => {

    const cls = link.className || '';

    if (cls.includes('btn') || cls.includes('shop') || cls.includes('blog-read-more')) {

      link.setAttribute('href', 'collections.html');

    }

  });

}

function initAccessibilityBasics() {

  document.querySelectorAll('button:not([type])').forEach(btn => {

    btn.setAttribute('type', 'button');

  });

  const labeledSelectors = [

    ['#mobileMenuBtn', 'Open menu'],

    ['#searchBtn', 'Open search'],

    ['#cartBtn', 'Open cart'],

    ['#cartClose', 'Close cart'],

    ['#searchClose', 'Close search'],

    ['#quickviewClose', 'Close quick view'],

    ['#backToTop', 'Back to top']

  ];

  labeledSelectors.forEach(([selector, label]) => {

    const el = document.querySelector(selector);

    if (el && !el.getAttribute('aria-label')) el.setAttribute('aria-label', label);

  });

}

function initSEOMeta() {

  const map = {

    'index.html': { title: 'BrainyGrasp | Learning Toys for Kids', desc: 'Shop educational toys for every age group at BrainyGrasp.' },

    'shop-by-age.html': { title: 'Shop By Age | BrainyGrasp', desc: 'Find age-appropriate toys from infants to 8+ years.' },

    'shop-by-category.html': { title: 'Shop By Category | BrainyGrasp', desc: 'Browse educational toys by category and learning goals.' },

    'collections.html': { title: 'Collections | BrainyGrasp', desc: 'Explore bestsellers, new launches, bundles, and gifting picks.' },

    'parents-choice.html': { title: 'Parents Choice | BrainyGrasp', desc: 'Curated educational toys most loved by parents.' },

    'gift-finder.html': { title: 'Gift Finder | BrainyGrasp', desc: 'Find the perfect educational gift in a few steps.' },

    'blogs.html': { title: 'BrainyGrasp Blog', desc: 'Guides and parenting ideas for playful learning.' },

    'faqs.html': { title: 'FAQs | BrainyGrasp', desc: 'Frequently asked questions about orders, products, and safety.' },

    'rewards.html': { title: 'Rewards | BrainyGrasp', desc: 'Earn and redeem points with BrainyGrasp rewards.' },

    'about.html': { title: 'About BrainyGrasp', desc: 'Learn our mission to make learning joyful and practical.' },

    'cart.html': { title: 'Your Cart | BrainyGrasp', desc: 'Review items in your cart before checkout.' },

  };

  const file = window.location.pathname.split('/').pop() || 'index.html';

  const data = map[file];

  if (!data) return;

  document.title = data.title;

  let desc = document.querySelector('meta[name="description"]');

  if (!desc) {

    desc = document.createElement('meta');

    desc.setAttribute('name', 'description');

    document.head.appendChild(desc);

  }

  desc.setAttribute('content', data.desc);

}

function initScrollAnimations() {

  const observer = new IntersectionObserver((entries) => {

    entries.forEach(entry => {

      if (entry.isIntersecting) {

        entry.target.classList.add('animate-in');

        observer.unobserve(entry.target);

      }

    });

  }, { threshold: 0.1 });

  document.querySelectorAll('.section-header, .product-card, .age-card, .blog-card, .testimonial-card').forEach(el => {

    observer.observe(el);

  });

}

function initImportantLinks() {

  const toggle = document.getElementById('importantLinksToggle');

  const content = document.getElementById('importantLinksContent');

  if (!toggle || !content) return;

  toggle.addEventListener('click', () => {

    toggle.classList.toggle('collapsed');

    content.classList.toggle('hidden');

  });

}

function initQuickView() {

  const modal = document.getElementById('quickviewModal');

  const overlay = document.getElementById('quickviewOverlay');

  const closeBtn = document.getElementById('quickviewClose');

  if (!modal) return;

  let currentQuickViewItem = null;

  function openQuickView(productInfo) {

    currentQuickViewItem = productInfo;

    document.getElementById('quickviewImg').src = productInfo.image;

    document.getElementById('quickviewName').textContent = productInfo.name;

    document.getElementById('quickviewPrice').innerHTML = `&#8377;${productInfo.price}`;

    document.getElementById('quickviewOriginal').innerHTML = `&#8377;${productInfo.originalPrice}`;

    document.getElementById('quickviewSave').textContent = `Save ${productInfo.save}`;

    document.getElementById('quickviewBadge').textContent = productInfo.badgeText;

    document.getElementById('quickviewBadge').className = `quickview-badge ${productInfo.badgeClass}`;

    const ageEl = document.getElementById('quickviewAge');

    const reviewsEl = document.getElementById('quickviewReviews');

    if (ageEl) ageEl.textContent = `Ages: ${productInfo.age || '3+ Years'}`;

    if (reviewsEl) {

      const countEl = reviewsEl.querySelector('.review-count');

      if (countEl) countEl.textContent = `${productInfo.reviews || 0} reviews`;

    }

    document.getElementById('quickviewQty').value = 1;

    modal.classList.add('active');

    overlay.classList.add('active');

    document.body.style.overflow = 'hidden';

  }

  function closeQuickView() {

    modal.classList.remove('active');

    overlay.classList.remove('active');

    document.body.style.overflow = '';

  }

  closeBtn.addEventListener('click', closeQuickView);

  overlay.addEventListener('click', closeQuickView);

  document.addEventListener('click', (e) => {

    const card = e.target.closest('.product-card');

    if (e.target.closest('.product-image') && card) {

      const name = card.querySelector('.product-name').textContent;

      const image = card.querySelector('img').src;

      const priceText = card.querySelector('.price-current').textContent.replace('₹', '');

      const originalPriceText = card.querySelector('.price-original').textContent.replace('₹', '');

      const saveText = card.querySelector('.price-save').textContent.replace('Save ', '');

      const badge = card.querySelector('.product-badge');

      const age = card.querySelector('.product-age-pill')?.textContent.replace('Ages: ', '') || card.dataset.age || '3+ Years';

      const id = parseInt(card.dataset.id, 10) || Date.now();

      const reviewsText = card.querySelector('.review-count')?.textContent || '0 reviews';

      const reviews = parseInt(reviewsText.replace(/\D/g, ''), 10) || 0;

      openQuickView({

        id,

        name: name,

        image: image,

        price: priceText,

        originalPrice: originalPriceText,

        save: saveText,

        age,

        reviews,

        badgeText: badge ? badge.textContent : 'Bestseller',

        badgeClass: badge ? badge.classList[1] : 'badge-bestseller'

      });

    }

  });

  const qtyMinus = document.querySelector('.qty-minus');

  const qtyPlus = document.querySelector('.qty-plus');

  const qtyInput = document.getElementById('quickviewQty');

  if (qtyMinus && qtyPlus && qtyInput) {

    const newMinus = qtyMinus.cloneNode(true);

    const newPlus = qtyPlus.cloneNode(true);

    qtyMinus.parentNode.replaceChild(newMinus, qtyMinus);

    qtyPlus.parentNode.replaceChild(newPlus, qtyPlus);

    newMinus.addEventListener('click', () => {

      let val = parseInt(qtyInput.value);

      if (val > 1) qtyInput.value = val - 1;

    });

    newPlus.addEventListener('click', () => {

      let val = parseInt(qtyInput.value);

      if (val < 10) qtyInput.value = val + 1;

    });

  }

  const addBtn = document.getElementById('quickviewAddToCart');

  if (addBtn) {

    addBtn.addEventListener('click', () => {

      if (!currentQuickViewItem || typeof addToCart !== 'function') return;

      const qty = parseInt(document.getElementById('quickviewQty')?.value || '1', 10);

      const price = parseInt(String(currentQuickViewItem.price).replace(/\D/g, ''), 10) || 0;

      for (let i = 0; i < qty; i++) {

        addToCart({

          id: currentQuickViewItem.id,

          name: currentQuickViewItem.name,

          price

        });

      }

      closeQuickView();

    });

  }

}

function initShareDropdown() {

  document.addEventListener('click', (e) => {

    if (!e.target.closest('.product-share')) {

      document.querySelectorAll('.share-dropdown').forEach(d => d.classList.remove('active'));

    }

    if (e.target.closest('.share-btn')) {

      const btn = e.target.closest('.share-btn');

      const shareContainer = btn.closest('.product-share');

      let dropdown = shareContainer.querySelector('.share-dropdown');

      if (!dropdown) {

        dropdown = document.createElement('div');

        dropdown.className = 'share-dropdown active';

        dropdown.innerHTML = `

          <a href="#" class="share-link share-whatsapp"><i class="fab fa-whatsapp"></i></a>

          <a href="#" class="share-link share-facebook"><i class="fab fa-facebook-f"></i></a>

          <a href="#" class="share-link share-instagram"><i class="fab fa-instagram"></i></a>

          <button class="share-link share-copy"><i class="fas fa-link"></i></button>

        `;

        shareContainer.appendChild(dropdown);

      } else {

        dropdown.classList.toggle('active');

      }

    }

  });

}

document.addEventListener('DOMContentLoaded', () => {

  if (typeof initProductGrids === 'function') initProductGrids();

  initAnnouncementSlider();

  if (typeof initHeroSlider === 'function') initHeroSlider();

  if (typeof initTabs === 'function') initTabs();

  if (typeof initSearch === 'function') initSearch();

  initCart();

  initMobileMenu();

  initStickyHeader();

  initBackToTop();

  if (typeof initFAQ === 'function') initFAQ();

  if (typeof initAboutToggle === 'function') initAboutToggle();

  if (typeof initTestimonialsSlider === 'function') initTestimonialsSlider();

  initAddToCart();

  initCartSidebarActions(); // ← wire up sidebar +/−/× buttons

  if (typeof initGiftFinder === 'function') initGiftFinder();

  initImportantLinks();

  initQuickView();

  initShareDropdown();

  initCommerceRoutes();

  initGlobalLinks();

  initAccessibilityBasics();

  initSEOMeta();

  if (typeof initShopByAge === 'function') initShopByAge();

  if (typeof initShopByCategory === 'function') initShopByCategory();

  initMegaNavigation();

  if (typeof initDiscoverySliders === 'function') initDiscoverySliders();

  syncAuthHeader(); // Update header user button based on auth state

  setTimeout(initScrollAnimations, 100);

});

// === Auth Header Sync ===

// Updates #userBtn in the header to show user's name (→ dashboard) when logged in,

// or 'Sign In' (→ login.html) when logged out.

function syncAuthHeader() {

  const userBtn = document.getElementById('userBtn');

  if (!userBtn) return;

  const token = localStorage.getItem('bg_token');

  let user = null;

  try { user = JSON.parse(localStorage.getItem('bg_user')); } catch { }

  if (token && user) {

    // Logged in: show first name + dashboard link

    const firstName = (user.name || 'Account').split(' ')[0];

    userBtn.href = 'dashboard-new.html';

    userBtn.title = `Hi, ${firstName} – View Dashboard`;

    userBtn.setAttribute('aria-label', `My Account – ${firstName}`);

    userBtn.innerHTML = `

      <i class="fas fa-user-check" style="color:#FF6B35"></i>

      <span class="user-name-label" style="font-size:11px;font-weight:700;color:#FF6B35;display:block;line-height:1;margin-top:2px">${firstName}</span>

    `;

  } else {

    // Logged out: standard Sign In link

    userBtn.href = 'login.html';

    userBtn.title = 'Sign In';

    userBtn.setAttribute('aria-label', 'Sign In');

    userBtn.innerHTML = `<i class="fas fa-user"></i>`;

  }

}

function initMegaNavigation() {

  document.addEventListener('click', (e) => {

    const el = e.target.closest('.cat-mega-item, .parents-line-item, .mega-card, .mega-card a');

    if (!el) return;

    const anchor = el.tagName === 'A' ? el : el.closest('a');

    const href = anchor ? anchor.getAttribute('href') : null;

    if (!href) return;

    const nav = document.getElementById('mainNav'); if (nav && nav.classList.contains('active')) nav.classList.remove('active');

    const mobileOverlay = document.getElementById('mobileOverlay'); if (mobileOverlay && mobileOverlay.classList.contains('active')) mobileOverlay.classList.remove('active');

    const sidebar = document.getElementById('catFilterSidebar'); if (sidebar && sidebar.classList.contains('active')) sidebar.classList.remove('active');

    document.body.style.overflow = '';

    e.preventDefault();

    let targetUrl = href;

    try {

      const url = new URL(href, window.location.origin);

      if (url.pathname.endsWith('parents-choice.html') && url.hash) {

        const slug = url.hash.replace('#', '');

        const mapping = {

          foil: 'Foil Fun',

          piece: 'Piece & Play',

          poke: 'Poke-In Art',

          sand: 'Sandeezy',

          snip: 'Snip, Snip!'

        };

        if (mapping[slug]) {

          targetUrl = `shop-by-category.html?category=${encodeURIComponent(mapping[slug])}`;

        }

      }

    } catch (err) {

      targetUrl = href;

    }

    window.location.href = targetUrl;

  });

}