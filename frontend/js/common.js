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
function initSearch() {
  const searchBtn = document.getElementById('searchBtn');
  const searchOverlay = document.getElementById('searchOverlay');
  const searchClose = document.getElementById('searchClose');
  const searchInput = document.getElementById('searchInput');
  if (!searchBtn || !searchOverlay || !searchClose || !searchInput) return;
 
  searchBtn.addEventListener('click', () => {
    searchOverlay.classList.toggle('active');
    if (searchOverlay.classList.contains('active')) {
      searchInput.focus();
    }
  });
 
  searchClose.addEventListener('click', () => {
    searchOverlay.classList.remove('active');
  });
}
 
// === Cart Sidebar ===
function initCart() {
  const cartBtn = document.getElementById('cartBtn');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartSidebar = document.getElementById('cartSidebar');
  const cartClose = document.getElementById('cartClose');
  if (!cartBtn || !cartOverlay || !cartSidebar || !cartClose) return;
 
  function openCart() {
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
    if(overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
 
  function closeMenu() {
    nav.classList.remove('active');
    if(overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
 
  menuBtn.addEventListener('click', openMenu);
  if(overlay) overlay.addEventListener('click', closeMenu);
 
  // Mobile mega menu toggle
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
 
// === Add to Cart Animation ===
function initAddToCart() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('.add-to-cart-btn')) {
      const btn = e.target.closest('.add-to-cart-btn');
      // visual feedback
      const originalHTML = btn.innerHTML;
      const originalBg = btn.style.background || '';
      btn.innerHTML = '<i class="fas fa-check"></i> Added!';
      btn.style.background = '#10B981';

      // Try to add item to cart via shared helper (falls back to simple count update)
      try {
        const card = btn.closest('.product-card');
        let item = null;
        if (card) {
          const id = parseInt(card.dataset.id) || null;
          const name = card.querySelector('.product-name')?.textContent || '';
          const priceAttr = card.dataset.price || card.querySelector('.price-current')?.textContent || '';
          const price = parseInt(String(priceAttr).replace(/\D/g, '')) || 0;
          if (id) item = { id, name, price };
        }

        if (typeof addToCart === 'function' && item) {
          addToCart(item);
        } else {
          // ensure UI updates even if helper absent
          const countEls = document.querySelectorAll('.cart-count');
          countEls.forEach(el => {
            const n = parseInt(el.textContent) || 0;
            el.textContent = n + 1;
            el.style.transform = 'scale(1.3)';
            setTimeout(() => el.style.transform = 'scale(1)', 200);
          });
        }
      } catch (err) {
        console.error('add-to-cart failed', err);
      }

      setTimeout(() => {
        btn.innerHTML = originalHTML || '<i class="fas fa-shopping-bag"></i> Add to Cart';
        btn.style.background = originalBg;
        // Update any central cart counters from storage
        if (typeof updateCartCount === 'function') updateCartCount();
      }, 1500);
    }
  });
}

function initCommerceRoutes() {
  document.querySelectorAll('.btn-view-cart').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = 'cart.html';
    });
  });
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
    // 'checkout.html' removed: Checkout page deprecated
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
 
// === Intersection Observer for Animations ===
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
 
// === Important Links Toggle ===
function initImportantLinks() {
  const toggle = document.getElementById('importantLinksToggle');
  const content = document.getElementById('importantLinksContent');
  
  if(!toggle || !content) return;

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('collapsed');
    content.classList.toggle('hidden');
  });
}

// === Quick View Modal ===
function initQuickView() {
  const modal = document.getElementById('quickviewModal');
  const overlay = document.getElementById('quickviewOverlay');
  const closeBtn = document.getElementById('quickviewClose');
  
  if(!modal) return;

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
    if(e.target.closest('.product-image') && card) {
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
  
  if(qtyMinus && qtyPlus && qtyInput) {
    // Clear old event listeners by cloning
    const newMinus = qtyMinus.cloneNode(true);
    const newPlus = qtyPlus.cloneNode(true);
    qtyMinus.parentNode.replaceChild(newMinus, qtyMinus);
    qtyPlus.parentNode.replaceChild(newPlus, qtyPlus);
    
    newMinus.addEventListener('click', () => {
      let val = parseInt(qtyInput.value);
      if(val > 1) qtyInput.value = val - 1;
    });
    newPlus.addEventListener('click', () => {
      let val = parseInt(qtyInput.value);
      if(val < 10) qtyInput.value = val + 1;
    });
  }

  // Theme selector logic (mock)
  const themeGrid = document.getElementById('quickviewThemeGrid');
  if (themeGrid) {
    themeGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.theme-btn');
      if (btn) {
        themeGrid.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // change main image (mocking)
        const newImgSrc = btn.querySelector('img').src;
        document.getElementById('quickviewImg').src = newImgSrc;
      }
    });
  }

  const addBtn = document.getElementById('quickviewAddToCart');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (!currentQuickViewItem || typeof addToCart !== 'function') return;
      const qty = parseInt(document.getElementById('quickviewQty')?.value || '1', 10);
      const price = parseInt(String(currentQuickViewItem.price).replace(/\D/g, ''), 10) || 0;
      addToCart({
        id: currentQuickViewItem.id,
        name: currentQuickViewItem.name,
        price
      });
      for (let i = 1; i < qty; i += 1) {
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

// === Share Dropdown ===
function initShareDropdown() {
  document.addEventListener('click', (e) => {
    if(!e.target.closest('.product-share')) {
      document.querySelectorAll('.share-dropdown').forEach(d => d.classList.remove('active'));
    }

    if (e.target.closest('.share-btn')) {
      const btn = e.target.closest('.share-btn');
      const shareContainer = btn.closest('.product-share');
      
      let dropdown = shareContainer.querySelector('.share-dropdown');
      if(!dropdown) {
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



// === Initialize Everything ===
document.addEventListener('DOMContentLoaded', () => {
  if(typeof initProductGrids === 'function') initProductGrids();
  if(typeof initAnnouncementSlider === 'function') initAnnouncementSlider();
  if(typeof initHeroSlider === 'function') initHeroSlider();
  if(typeof initTabs === 'function') initTabs();
  if(typeof initSearch === 'function') initSearch();
  if(typeof initCart === 'function') initCart();
  if(typeof initMobileMenu === 'function') initMobileMenu();
  if(typeof initStickyHeader === 'function') initStickyHeader();
  if(typeof initBackToTop === 'function') initBackToTop();
  if(typeof initFAQ === 'function') initFAQ();
  if(typeof initAboutToggle === 'function') initAboutToggle();
  if(typeof initTestimonialsSlider === 'function') initTestimonialsSlider();
  if(typeof initAddToCart === 'function') initAddToCart();
  if(typeof initGiftFinder === 'function') initGiftFinder();
  if(typeof initImportantLinks === 'function') initImportantLinks();
  if(typeof initQuickView === 'function') initQuickView();
  if(typeof initShareDropdown === 'function') initShareDropdown();
  if(typeof initCommerceRoutes === 'function') initCommerceRoutes();
  if(typeof initGlobalLinks === 'function') initGlobalLinks();
  if(typeof initAccessibilityBasics === 'function') initAccessibilityBasics();
  if(typeof initSEOMeta === 'function') initSEOMeta();
  if(typeof initShopByAge === 'function') initShopByAge();
  if(typeof initShopByCategory === 'function') initShopByCategory();
  if(typeof initMegaNavigation === 'function') initMegaNavigation();
  if(typeof initDiscoverySliders === 'function') initDiscoverySliders();
  
  if(typeof initScrollAnimations === 'function') setTimeout(initScrollAnimations, 100);
});

// Close popup/navigation and immediately navigate when user clicks any mega/popup item
function initMegaNavigation() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('.cat-mega-item, .parents-line-item, .mega-card, .mega-card a');
    if (!el) return;
    // Determine target href (support both <a> and non-anchor wrappers)
    const anchor = el.tagName === 'A' ? el : el.closest('a');
    const href = anchor ? anchor.getAttribute('href') : null;
    if (!href) return;

    // Close open navigation/popup UI
    const nav = document.getElementById('mainNav'); if (nav && nav.classList.contains('active')) nav.classList.remove('active');
    const mobileOverlay = document.getElementById('mobileOverlay'); if (mobileOverlay && mobileOverlay.classList.contains('active')) mobileOverlay.classList.remove('active');
    const sidebar = document.getElementById('catFilterSidebar'); if (sidebar && sidebar.classList.contains('active')) sidebar.classList.remove('active');
    document.body.style.overflow = '';

    // If this is a Parents' Choice popup anchor (parents-choice.html#slug),
    // map the fragment to a shop category and redirect to shop-by-category.
    e.preventDefault();
    let targetUrl = href;
    try {
      const url = new URL(href, window.location.origin);
      if (url.pathname.endsWith('parents-choice.html') && url.hash) {
        const slug = url.hash.replace('#','');
        const mapping = {
          foil: 'Foil Fun',
          piece: 'Piece & Play',
          poke: 'Poke-In Art',
          sand: 'Sandeezy',
          snip: 'Snip, Snip!'
        };
        if (mapping[slug]) {
          targetUrl = `shop-by-category.html?category=${encodeURIComponent(mapping[slug])}`;
        } else {
          // fallback: navigate to parents-choice anchor if unknown
          targetUrl = href;
        }
      }
    } catch (err) {
      targetUrl = href;
    }

    window.location.href = targetUrl;
  });
}
