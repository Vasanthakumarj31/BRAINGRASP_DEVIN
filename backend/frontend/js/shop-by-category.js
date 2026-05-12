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
  const titleEl = document.getElementById('categoryDynamicTitle');
  const subtitleEl = document.getElementById('categoryDynamicSubtitle');
  const countEl = document.getElementById('categoryResultsCount');

  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('category');
  if (catParam) {
    currentFilters.category = catParam;
    if (titleEl) titleEl.textContent = `${catParam} Sets for Kids`;
    if (subtitleEl) subtitleEl.textContent = `Explore our curated collection of ${catParam.toLowerCase()}`;
  }

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

  const catParamBox = urlParams.get('category');
  if (catParamBox) {
    const targetCb = document.querySelector(`#catFilterCategories input[value="${catParamBox}"]`);
    if(targetCb) targetCb.checked = true;
  }


  function renderGrid() {
    grid.innerHTML = currentProducts.map(createProductCard).join('');
    countEl.textContent = `${currentProducts.length} Products`;
  }

  function applyFiltersAndSort() {
    let filtered = uniqueProducts;

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
      titleEl.textContent = `${cat} Sets for Kids`;
      subtitleEl.textContent = `Explore our curated collection of ${cat.toLowerCase()}`;
      
      // Clear sidebar checkboxes if category selected from top
      document.querySelectorAll('#catFilterSidebar input[type="checkbox"]').forEach(cb => cb.checked = false);
      const targetCb = document.querySelector(`#catFilterCategories input[value="${cat}"]`);
      if(targetCb) targetCb.checked = true;
      
      applyFiltersAndSort();
      // If we're not already on the shop-by-category page, navigate there so user lands on dedicated products page
      const currentFile = window.location.pathname.split('/').pop();
      if (currentFile !== 'shop-by-category.html') {
        // close any open navigation/popup UI before redirecting
        const nav = document.getElementById('mainNav');
        if (nav && nav.classList.contains('active')) nav.classList.remove('active');
        const sidebar = document.getElementById('catFilterSidebar');
        if (sidebar && sidebar.classList.contains('active')) {
          sidebar.classList.remove('active');
          document.body.style.overflow = '';
        }
        // redirect to the shop page with category query so it initializes with the chosen category
        const targetUrl = `shop-by-category.html?category=${encodeURIComponent(cat)}`;
        window.location.href = targetUrl;
        return;
      }
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
      
      // Scroll down to the products area accounting for sticky nav
      const shopArea = document.getElementById('shopByCategory');
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

  applyFiltersAndSort();
}

document.addEventListener('productsUpdated', () => {
  initShopByCategory();
});

