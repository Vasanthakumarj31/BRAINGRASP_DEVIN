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
      
      // Scroll down to the products area accounting for sticky nav
      const shopArea = document.getElementById('shopLayout');
      if (shopArea) {
        const headerOffset = 80;
        const elementPosition = shopArea.getBoundingClientRect().top;
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

// === Discovery Sliders ===
function initDiscoverySliders() {
  renderProducts('youMayAlsoLikeGrid', products.bestsellers);
  renderProducts('recentlyViewedGrid', products.newlaunches);
}

