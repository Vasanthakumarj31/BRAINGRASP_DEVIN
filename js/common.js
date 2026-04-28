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
      btn.innerHTML = '<i class="fas fa-check"></i> Added!';
      btn.style.background = '#10B981';
      
      // Update cart count
      const countEl = document.querySelector('.cart-count');
      countEl.textContent = parseInt(countEl.textContent) + 1;
      countEl.style.transform = 'scale(1.3)';
      setTimeout(() => countEl.style.transform = 'scale(1)', 200);
      
      setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-shopping-bag"></i> Add to Cart';
        btn.style.background = '';
      }, 1500);
    }
  });
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

  function openQuickView(productInfo) {
    document.getElementById('quickviewImg').src = productInfo.image;
    document.getElementById('quickviewName').textContent = productInfo.name;
    document.getElementById('quickviewPrice').innerHTML = `&#8377;${productInfo.price}`;
    document.getElementById('quickviewOriginal').innerHTML = `&#8377;${productInfo.originalPrice}`;
    document.getElementById('quickviewSave').textContent = `Save ${productInfo.save}`;
    document.getElementById('quickviewBadge').textContent = productInfo.badgeText;
    document.getElementById('quickviewBadge').className = `quickview-badge ${productInfo.badgeClass}`;
    
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
      
      openQuickView({
        name: name,
        image: image,
        price: priceText,
        originalPrice: originalPriceText,
        save: saveText,
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
  if(typeof initShopByAge === 'function') initShopByAge();
  if(typeof initShopByCategory === 'function') initShopByCategory();
  if(typeof initDiscoverySliders === 'function') initDiscoverySliders();
  
  if(typeof initScrollAnimations === 'function') setTimeout(initScrollAnimations, 100);
});
