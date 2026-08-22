let products = window.products || {
  trending: [],
  bestsellers: [],
  newlaunches: [],
  bundles: []
};

// === Create Product Card HTML ===
function createProductCard(product) {
  const badgeClass = product.badge === 'bestseller' ? 'badge-bestseller' :
    product.badge === 'new' ? 'badge-new' : 'badge-bundle';
  const badgeText = product.badge === 'bestseller' ? 'Bestseller' :
    product.badge === 'new' ? 'New Launch' : 'Best Bundle';

  const reviewsHTML = product.reviews > 0
    ? `<div class="product-reviews">
        <div class="stars">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star-half-alt"></i>
        </div>
        <span class="review-count">${product.reviews} reviews</span>
       </div>`
    : '';

  return `
    <div class="product-card" data-id="${product.id}" data-age="${product.ageGroup}" data-category="${product.category || ''}" data-skills='${JSON.stringify(product.skills || [])}' data-theme="${product.theme || ''}" data-type="${product.type || ''}" data-price="${product.price}" data-date="${product.launchDate || ''}" data-sales="${product.sales || 0}">
      <span class="product-badge ${badgeClass}">${badgeText}</span>
      <div class="product-share">
        <button class="share-btn"><i class="fas fa-share-alt"></i></button>
      </div>
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        <div class="product-age-label">Ages: ${product.age}</div>
      </div>
      <div class="product-info">
        <h3 class="product-name">${product.name}</h3>
        ${reviewsHTML}
        <div class="product-price">
          <span class="price-original">&#8377;${product.originalPrice.toLocaleString()}</span>
          <span class="price-current">&#8377;${product.price.toLocaleString()}</span>
          <span class="price-save">Save ${product.save}</span>
        </div>
        <button class="add-to-cart-btn"><i class="fas fa-shopping-bag"></i> Add to Cart</button>
      </div>
    </div>
  `;
}

// === Render Products ===
function renderProducts(gridId, productList) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = productList.map(createProductCard).join('');
}

// === Initialize Product Grids ===
function initProductGrids() {
  renderProducts('trendingGrid', products.trending);
  renderProducts('handpickedGrid', products.bestsellers);
}

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

// === Hero Slider ===
function initHeroSlider() {
  const slides = document.querySelectorAll('.hero-slide');
  if (!slides.length) return;
  const dots = document.querySelectorAll('.hero-dot');
  const prevBtn = document.querySelector('.hero-prev');
  const nextBtn = document.querySelector('.hero-next');
  let current = 0;
  let autoSlide;

  function goToSlide(index) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = index;
    if (current < 0) current = slides.length - 1;
    if (current >= slides.length) current = 0;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function startAuto() {
    autoSlide = setInterval(() => goToSlide(current + 1), 5000);
  }

  function resetAuto() {
    clearInterval(autoSlide);
    startAuto();
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { goToSlide(i); resetAuto(); });
  });

  prevBtn.addEventListener('click', () => { goToSlide(current - 1); resetAuto(); });
  nextBtn.addEventListener('click', () => { goToSlide(current + 1); resetAuto(); });

  startAuto();
}

// === Tab Functionality ===
function initTabs() {
  document.querySelectorAll('.tab-bar').forEach(tabBar => {
    const section = tabBar.closest('.section');
    const gridId = section.querySelector('.products-grid')?.id;

    tabBar.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.dataset.tab;

        if (gridId === 'trendingGrid') {
          if (tab === 'all') {
            renderProducts('trendingGrid', products.trending);
          } else {
            const filtered = products.trending.filter(p => p.ageGroup === tab);
            renderProducts('trendingGrid', filtered.length > 0 ? filtered : products.trending);
          }
        } else if (gridId === 'handpickedGrid') {
          if (tab === 'bestsellers') renderProducts('handpickedGrid', products.bestsellers);
          else if (tab === 'newlaunches') renderProducts('handpickedGrid', products.newlaunches);
          else if (tab === 'bundles') renderProducts('handpickedGrid', products.bundles);
        }
      });
    });
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

  function openMenu() {
    nav.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    nav.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  menuBtn.addEventListener('click', openMenu);
  overlay.addEventListener('click', closeMenu);

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

// === FAQ Accordion ===
function initFAQ() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isActive = item.classList.contains('active');

      // Close all
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));

      // Open clicked if it wasn't active
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

// === About Toggle ===
function initAboutToggle() {
  const toggle = document.getElementById('aboutToggle');
  const content = document.getElementById('aboutContent');
  if (!toggle || !content) return;

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('collapsed');
    content.classList.toggle('hidden');
  });
}

// === Testimonials Slider ===
function initTestimonialsSlider() {
  const track = document.querySelector('.testimonial-track');
  if (!track) return;
  const prevBtn = document.querySelector('.testimonial-prev');
  const nextBtn = document.querySelector('.testimonial-next');
  let position = 0;
  const cardWidth = 370; // card width + gap

  function slide(direction) {
    const maxScroll = track.scrollWidth - track.parentElement.offsetWidth;
    position += direction * cardWidth;
    position = Math.max(-maxScroll, Math.min(0, position));
    track.style.transform = `translateX(${position}px)`;
  }

  prevBtn.addEventListener('click', () => slide(1));
  nextBtn.addEventListener('click', () => slide(-1));

  // Touch/drag support
  let startX, startPos;
  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startPos = position;
  });

  track.addEventListener('touchmove', (e) => {
    const diff = e.touches[0].clientX - startX;
    const maxScroll = track.scrollWidth - track.parentElement.offsetWidth;
    position = Math.max(-maxScroll, Math.min(0, startPos + diff));
    track.style.transform = `translateX(${position}px)`;
  });
}

// === Add to Cart Animation ===
// Note: initAddToCart function moved to common.js to avoid duplication

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

// === Gift Finder Wizard ===
function initGiftFinder() {
  const steps = document.querySelectorAll('.gift-finder-step');
  const progressFill = document.getElementById('giftProgressFill');
  const progressText = document.getElementById('giftProgressText');
  const resultDiv = document.getElementById('giftFinderResult');
  const resultGrid = document.getElementById('giftResultGrid');
  const restartBtn = document.getElementById('giftFinderRestart');

  if (!steps.length) return;

  let currentStep = 1;
  const totalSteps = steps.length;

  document.querySelectorAll('.gift-option').forEach(btn => {
    btn.addEventListener('click', function () {
      const parentStep = this.closest('.gift-finder-step');
      parentStep.querySelectorAll('.gift-option').forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');

      setTimeout(() => {
        parentStep.classList.remove('active');
        if (currentStep < totalSteps) {
          currentStep++;
          document.querySelector(`.gift-finder-step[data-step="${currentStep}"]`).classList.add('active');
          updateProgress();
        } else {
          showGiftResults();
        }
      }, 400);
    });
  });

  restartBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    resultDiv.style.display = 'none';
    currentStep = 1;
    steps.forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.gift-option').forEach(b => b.classList.remove('selected'));
    document.querySelector('.gift-finder-step[data-step="1"]').classList.add('active');
    document.querySelector('.gift-finder-progress').style.display = 'block';
    updateProgress();
  });

  function updateProgress() {
    const percent = (currentStep / totalSteps) * 100;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `Step ${currentStep} of ${totalSteps}`;
  }

  function showGiftResults() {
    const shuffled = [...products.trending, ...products.bestsellers].sort(() => 0.5 - Math.random());
    const recommendations = shuffled.slice(0, 3);

    resultGrid.innerHTML = recommendations.map(createProductCard).join('');
    document.querySelector('.gift-finder-progress').style.display = 'none';
    resultDiv.style.display = 'block';
  }
}

// === Important Links Toggle ===
function initImportantLinks() {
  const toggle = document.getElementById('importantLinksToggle');
  const content = document.getElementById('importantLinksContent');

  if (!toggle || !content) return;

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

  if (!modal) return;

  function openQuickView(productInfo) {
    const imgEl = document.getElementById('quickviewImg');
    if (imgEl) imgEl.src = productInfo.image;

    const nameEl = document.getElementById('quickviewName');
    if (nameEl) nameEl.textContent = productInfo.name;

    const priceEl = document.getElementById('quickviewPrice');
    if (priceEl) priceEl.innerHTML = `&#8377;${productInfo.price}`;

    const originalEl = document.getElementById('quickviewOriginal');
    if (originalEl) {
      if (productInfo.originalPrice && productInfo.originalPrice !== productInfo.price) {
        originalEl.innerHTML = `&#8377;${productInfo.originalPrice}`;
        originalEl.style.display = '';
      } else {
        originalEl.innerHTML = '';
        originalEl.style.display = 'none';
      }
    }

    const saveEl = document.getElementById('quickviewSave');
    if (saveEl) {
      if (productInfo.save && productInfo.save !== '0%') {
        saveEl.textContent = `Save ${productInfo.save}`;
        saveEl.style.display = '';
      } else {
        saveEl.textContent = '';
        saveEl.style.display = 'none';
      }
    }

    const badgeEl = document.getElementById('quickviewBadge');
    if (badgeEl) {
      badgeEl.textContent = productInfo.badgeText;
      badgeEl.className = `quickview-badge ${productInfo.badgeClass}`;
    }

    const qtyEl = document.getElementById('quickviewQty');
    if (qtyEl) qtyEl.value = 1;

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
    if (card && !e.target.closest('.add-to-cart-btn') && !e.target.closest('.share-btn') && !e.target.closest('.share-dropdown')) {
      const nameEl = card.querySelector('.product-name');
      const name = nameEl ? nameEl.textContent.trim() : 'Product';

      const imgEl = card.querySelector('img');
      const image = imgEl ? imgEl.src : '';

      const priceEl = card.querySelector('.price-current');
      const priceText = priceEl ? priceEl.textContent.replace('₹', '').trim() : '0';

      const originalPriceEl = card.querySelector('.price-original');
      const originalPriceText = originalPriceEl ? originalPriceEl.textContent.replace('₹', '').trim() : priceText;

      const saveEl = card.querySelector('.price-save');
      const saveText = saveEl ? saveEl.textContent.replace('Save ', '').trim() : '0%';

      const badge = card.querySelector('.adv-badge') || card.querySelector('.product-badge');

      const age = card.querySelector('.product-age-pill')?.textContent.replace('Ages: ', '').trim() || card.dataset.age || '3+ Years';

      const id = parseInt(card.dataset.id, 10) || Date.now();

      openQuickView({
        id,
        name: name,
        image: image,
        price: priceText,
        originalPrice: originalPriceText,
        save: saveText,
        age,
        badgeText: badge ? badge.textContent.trim() : 'Bestseller',
        badgeClass: badge ? badge.classList[1] : 'badge-bestseller'
      });
    }
  });

  const qtyMinus = document.querySelector('.qty-minus');
  const qtyPlus = document.querySelector('.qty-plus');
  const qtyInput = document.getElementById('quickviewQty');

  if (qtyMinus && qtyPlus && qtyInput) {
    // Clear old event listeners by cloning
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

// === Shop By Age Filtering & Sorting ===
function initShopByAge() {
  const shopByAgeLink = document.querySelector('a[href="#shopByAge"]');
  if (shopByAgeLink) {
    shopByAgeLink.addEventListener('click', (e) => {
      e.preventDefault();
      const section = document.getElementById('shopByAge');
      if (section) {
        const headerOffset = 80;
        const elementPosition = section.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });

        // Close mobile menu if open
        const nav = document.getElementById('mainNav');
        if (nav && nav.classList.contains('active')) {
          nav.classList.remove('active');
        }
      }
    });
  }

  const grid = document.getElementById('shopByAgeGrid');
  if (!grid) return;

  const allProducts = [...products.trending, ...products.bestsellers, ...products.newlaunches];
  // Deduplicate by ID
  const uniqueProducts = Array.from(new Map(allProducts.map(item => [item.id, item])).values());

  let currentProducts = [...uniqueProducts];
  let currentFilters = {
    ageGroup: null,
    categories: [],
    skills: [],
    themes: [],
    types: []
  };
  let currentSort = 'default';

  // Render initial
  function renderShopByAge() {
    grid.innerHTML = currentProducts.map(createProductCard).join('');
    document.getElementById('shopByAgeCount').textContent = `${currentProducts.length} Products`;
  }

  function applyFiltersAndSort() {
    let filtered = uniqueProducts;

    if (currentFilters.ageGroup) {
      filtered = filtered.filter(p => p.ageGroup === currentFilters.ageGroup);
    }
    if (currentFilters.categories.length > 0) {
      filtered = filtered.filter(p => currentFilters.categories.includes(p.category));
    }
    if (currentFilters.skills.length > 0) {
      filtered = filtered.filter(p => p.skills && p.skills.some(s => currentFilters.skills.includes(s)));
    }
    if (currentFilters.themes.length > 0) {
      filtered = filtered.filter(p => currentFilters.themes.includes(p.theme));
    }
    if (currentFilters.types.length > 0) {
      filtered = filtered.filter(p => currentFilters.types.includes(p.type));
    }

    // Sort
    if (currentSort === 'price-low') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'price-high') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (currentSort === 'newest') {
      filtered.sort((a, b) => new Date(b.launchDate) - new Date(a.launchDate));
    } else if (currentSort === 'oldest') {
      filtered.sort((a, b) => new Date(a.launchDate) - new Date(b.launchDate));
    } else if (currentSort === 'bestsellers') {
      filtered.sort((a, b) => (b.sales || 0) - (a.sales || 0));
    }

    currentProducts = filtered;
    renderShopByAge();
  }

  // Age Bubbles
  const ageBubbles = document.querySelectorAll('.skillmatics-age-card');
  ageBubbles.forEach(bubble => {
    bubble.addEventListener('click', (e) => {
      e.preventDefault();
      const isActive = bubble.classList.contains('active');
      ageBubbles.forEach(b => b.classList.remove('active'));

      if (!isActive) {
        bubble.classList.add('active');
        const text = bubble.querySelector('.skillmatics-age-banner').textContent.trim();
        currentFilters.ageGroup = text === '0-3 Years' ? '0-3' : text === '3+ Years' ? '3+' : text === '6+ Years' ? '6+' : '8+';
      } else {
        currentFilters.ageGroup = null;
      }
      applyFiltersAndSort();

      // Scroll to shop section header accounting for sticky nav
      const section = bubble.closest('.shop-by-age');
      if (section) {
        const headerOffset = 80;
        const elementPosition = section.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // Sidebar Checkboxes
  const checkboxes = document.querySelectorAll('.filter-checkbox input');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const type = cb.dataset.filterType;
      const val = cb.value;
      if (cb.checked) {
        currentFilters[type].push(val);
      } else {
        currentFilters[type] = currentFilters[type].filter(v => v !== val);
      }
      applyFiltersAndSort();
    });
  });

  // Sort Dropdown
  const sortSelect = document.getElementById('sortBySelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      applyFiltersAndSort();
    });
  }

  // Filter Toggle Mobile
  const filterBtn = document.getElementById('mobileFilterBtn');
  const filterSidebar = document.getElementById('filterSidebar');
  const filterClose = document.getElementById('filterCloseBtn');

  if (filterBtn && filterSidebar) {
    filterBtn.addEventListener('click', () => {
      filterSidebar.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
    if (filterClose) {
      filterClose.addEventListener('click', () => {
        filterSidebar.classList.remove('active');
        document.body.style.overflow = '';
      });
    }
  }

  renderShopByAge();
}

// === Shop By Category Architecture ===
function initShopByCategory() {
  const grid = document.getElementById('shopByCategoryGrid');
  if (!grid) return;

  const allProducts = [...products.trending, ...products.bestsellers, ...products.newlaunches, ...products.bundles];
  const uniqueProducts = Array.from(new Map(allProducts.map(item => [item.id, item])).values());

  let currentProducts = [...uniqueProducts];
  let currentFilters = {
    category: null,
    ages: [],
    skills: [],
    themes: [],
    minPrice: null,
    maxPrice: null
  };
  let currentSort = 'default';
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('category');
  if (catParam) {
    currentFilters.category = catParam;
    if (titleEl) titleEl.textContent = `${catParam} Sets for Kids`;
    if (subtitleEl) subtitleEl.textContent = `Explore our curated collection of ${catParam.toLowerCase()}`;
  }


  const titleEl = document.getElementById('categoryDynamicTitle');
  const subtitleEl = document.getElementById('categoryDynamicSubtitle');
  const countEl = document.getElementById('categoryResultsCount');

  // Populate Dynamic Sidebar
  const categories = [...new Set(uniqueProducts.map(p => p.category).filter(Boolean))];
  const skills = [...new Set(uniqueProducts.flatMap(p => p.skills || []))];
  const themes = [...new Set(uniqueProducts.map(p => p.theme).filter(Boolean))];

  function createCheckboxes(containerId, items, filterType) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = items.map(item => `
      <label class="filter-checkbox">
        <input type="checkbox" value="${item}" data-filter-type="${filterType}">
        <span class="checkmark"></span> ${item}
      </label>
    `).join('');
  }

  createCheckboxes('catFilterCategories', categories, 'categoryList');
  createCheckboxes('catFilterSkills', skills, 'skills');
  createCheckboxes('catFilterThemes', themes, 'themes');

  function renderGrid() {
    grid.innerHTML = currentProducts.map(createProductCard).join('');
    countEl.textContent = `${currentProducts.length} Products`;
  }

  function applyFiltersAndSort() {
    let filtered = uniqueProducts;

    if (currentFilters.category) {
      filtered = filtered.filter(p => p.category === currentFilters.category);
    }

    // Sidebar array filters
    const selectedCategories = Array.from(document.querySelectorAll('#catFilterCategories input:checked')).map(cb => cb.value);
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(p => selectedCategories.includes(p.category));
    }

    const selectedSkills = Array.from(document.querySelectorAll('#catFilterSkills input:checked')).map(cb => cb.value);
    if (selectedSkills.length > 0) {
      filtered = filtered.filter(p => p.skills && p.skills.some(s => selectedSkills.includes(s)));
    }

    const selectedThemes = Array.from(document.querySelectorAll('#catFilterThemes input:checked')).map(cb => cb.value);
    if (selectedThemes.length > 0) {
      filtered = filtered.filter(p => selectedThemes.includes(p.theme));
    }

    // Age Pills
    if (currentFilters.ages.length > 0) {
      filtered = filtered.filter(p => currentFilters.ages.includes(p.ageGroup));
    }

    // Price
    if (currentFilters.minPrice !== null) {
      filtered = filtered.filter(p => p.price >= currentFilters.minPrice);
    }
    if (currentFilters.maxPrice !== null) {
      filtered = filtered.filter(p => p.price <= currentFilters.maxPrice);
    }

    // Sort
    if (currentSort === 'price-low') filtered.sort((a, b) => a.price - b.price);
    else if (currentSort === 'price-high') filtered.sort((a, b) => b.price - a.price);
    else if (currentSort === 'newest') filtered.sort((a, b) => new Date(b.launchDate) - new Date(a.launchDate));
    else if (currentSort === 'oldest') filtered.sort((a, b) => new Date(a.launchDate) - new Date(b.launchDate));
    else if (currentSort === 'bestsellers') filtered.sort((a, b) => (b.sales || 0) - (a.sales || 0));

    currentProducts = filtered;
    renderGrid();
  }

  // Mega Menu Links
  const megaItems = document.querySelectorAll('.cat-mega-item');
  megaItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = item.dataset.category;
      currentFilters.category = cat;
      titleEl.textContent = `${cat} Sets for Kids`;
      subtitleEl.textContent = `Explore our curated collection of ${cat.toLowerCase()}`;

      // Clear sidebar checkboxes if category selected from top
      document.querySelectorAll('#catFilterSidebar input[type="checkbox"]').forEach(cb => cb.checked = false);

      applyFiltersAndSort();
      const section = document.getElementById('shopByCategory');
      if (section) {
        const headerOffset = 80;
        const elementPosition = section.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }

      // Close nav
      const nav = document.getElementById('mainNav');
      if (nav && nav.classList.contains('active')) nav.classList.remove('active');
    });
  });

  // Shop By Category Nav Link smooth scroll
  const shopCatLink = document.querySelector('a[href="#shopByCategory"]');
  if (shopCatLink) {
    shopCatLink.addEventListener('click', (e) => {
      e.preventDefault();
      const section = document.getElementById('shopByCategory');
      if (section) {
        const headerOffset = 80;
        const elementPosition = section.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
      currentFilters.category = null;
      titleEl.textContent = `All Products`;
      applyFiltersAndSort();
    });
  }

  // Age Pills
  const agePills = document.querySelectorAll('.age-pill');
  agePills.forEach(pill => {
    pill.addEventListener('click', () => {
      const isActive = pill.classList.contains('active');
      agePills.forEach(p => p.classList.remove('active'));

      if (!isActive) {
        pill.classList.add('active');
        currentFilters.ages = [pill.dataset.age];
      } else {
        currentFilters.ages = [];
      }
      applyFiltersAndSort();
    });
  });

  // Sidebar Listeners
  document.getElementById('catFilterSidebar').addEventListener('change', applyFiltersAndSort);

  document.getElementById('catPriceApply').addEventListener('click', () => {
    const min = document.getElementById('catPriceMin').value;
    const max = document.getElementById('catPriceMax').value;
    currentFilters.minPrice = min ? parseInt(min) : null;
    currentFilters.maxPrice = max ? parseInt(max) : null;
    applyFiltersAndSort();
  });

  document.getElementById('catSortBySelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    applyFiltersAndSort();
  });

  // Mobile Filter
  const mobileBtn = document.getElementById('catMobileFilterBtn');
  const sidebar = document.getElementById('catFilterSidebar');
  const closeBtn = document.getElementById('catFilterCloseBtn');
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
    closeBtn.addEventListener('click', () => {
      sidebar.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  renderGrid();
}

// === Discovery Sliders ===
function initDiscoverySliders() {
  renderProducts('youMayAlsoLikeGrid', products.bestsellers);
  renderProducts('recentlyViewedGrid', products.newlaunches);
}

// === Share Dropdown ===
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

// === Initialize Everything ===
document.addEventListener('DOMContentLoaded', () => {
  initProductGrids();
  initAnnouncementSlider();
  initHeroSlider();
  initTabs();
  initSearch();
  initCart();
  initMobileMenu();
  initStickyHeader();
  initBackToTop();
  initFAQ();
  initAboutToggle();
  initTestimonialsSlider();
  // initAddToCart() - moved to common.js to avoid duplication
  initGiftFinder();
  initImportantLinks();
  initQuickView();
  initShareDropdown();
  initShopByAge();
  initShopByCategory();
  initDiscoverySliders();

  // Delay scroll animations to let content render
  setTimeout(initScrollAnimations, 100);
});

// === Essential Cart Functions ===
function getCart() {
  try {
    return JSON.parse(localStorage.getItem('bg_cart')) || [];
  } catch (e) {
    return [];
  }
}

function addToCart(item) {
  const cart = getCart();
  const existingItem = cart.find(cartItem => cartItem.id === item.id);

  if (existingItem) {
    existingItem.quantity = (existingItem.quantity || 1) + 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }

  localStorage.setItem('bg_cart', JSON.stringify(cart));

  // Update cart count if function exists
  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }
}

function removeFromCart(itemId) {
  let cart = getCart();
  cart = cart.filter(item => item.id !== itemId);
  localStorage.setItem('bg_cart', JSON.stringify(cart));

  // Update cart count if function exists
  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }
}

function getCartTotal() {
  const cart = getCart();
  return cart.reduce((total, item) => total + (item.price * (item.quantity || 1)), 0);
}

// Make functions globally available
window.getCart = getCart;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.getCartTotal = getCartTotal;