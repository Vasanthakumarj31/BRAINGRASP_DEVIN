// Collections Page Logic (Bestsellers & New Launches)

document.addEventListener('DOMContentLoaded', () => {
  const colGrid = document.getElementById('colProductsGrid');
  if (!colGrid) return;

  const urlParams = new URLSearchParams(window.location.search);
  let collectionType = urlParams.get('collection') || 'bestsellers';

  // Title elements
  const titleEl = document.getElementById('colDynamicTitle');
  const subtitleEl = document.getElementById('colDynamicSubtitle');

  let baseProducts = [];
  
    if (collectionType === 'newlaunches') {
    baseProducts = [...products.newlaunches];
    if(titleEl) titleEl.textContent = "New Launches";
    if(subtitleEl) subtitleEl.textContent = "Discover our latest and greatest educational toys and games.";
  } else if (collectionType === 'bundles') {
    baseProducts = [...products.bundles];
    if(titleEl) titleEl.textContent = "Bundles 20% Off";
    if(subtitleEl) subtitleEl.textContent = "Perfect sets for every occasion, bundled for extra savings!";
  } else if (collectionType === 'return') {
    baseProducts = [...products.trending.filter(p => p.price < 700), ...products.bestsellers.filter(p => p.price < 700)];
    if(titleEl) titleEl.textContent = "Return Gifts 25% Off";
    if(subtitleEl) subtitleEl.textContent = "Bulk return gifts for your kid's amazing birthday party.";
  } else if (collectionType === 'birthday') {
    baseProducts = [...products.bestsellers, ...products.newlaunches];
    if(titleEl) titleEl.textContent = "Birthday Gifts";
    if(subtitleEl) subtitleEl.textContent = "The perfect gifts to make their special day magical.";
  } else if (collectionType === 'gifting') {
    baseProducts = [...products.bundles, ...products.trending.filter(p => p.price < 700)];
    if(titleEl) titleEl.textContent = "Gifting";
    if(subtitleEl) subtitleEl.textContent = "Explore our wide range of gifting options for every occasion.";
  } else {
    // Default to bestsellers
    baseProducts = [...products.bestsellers];
    if(titleEl) titleEl.textContent = "Bestsellers";
    if(subtitleEl) subtitleEl.textContent = "Shop our most loved and highly rated products.";
  }

  const uniqueProducts = Array.from(new Map(baseProducts.map(item => [item.id, item])).values());
  
  let currentProducts = [...uniqueProducts];
  let currentFilters = {
    ageGroup: null,
    categories: [],
    skills: [],
    themes: [],
    minPrice: null,
    maxPrice: null
  };
  let currentSort = 'default';

  const countEl = document.getElementById('colResultsCount');

  // Populate Dynamic Sidebar Checkboxes
  const categoriesList = [...new Set(uniqueProducts.map(p => p.category).filter(Boolean))];
  const skillsList = [...new Set(uniqueProducts.flatMap(p => p.skills || []))];
  const themesList = [...new Set(uniqueProducts.map(p => p.theme).filter(Boolean))];

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

  createCheckboxes('colFilterCategories', categoriesList, 'categories');
  createCheckboxes('colFilterSkills', skillsList, 'skills');
  createCheckboxes('colFilterThemes', themesList, 'themes');

  function renderColProducts(list) {
    if (list.length === 0) {
      colGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;">
          <h3>No products match your filters.</h3>
          <p>Try adjusting your criteria or clear filters.</p>
        </div>
      `;
      if (countEl) countEl.textContent = '0 Products';
      return;
    }
    
    renderProducts('colProductsGrid', list);
    if (countEl) countEl.textContent = `${list.length} Products`;
  }

  function applyFiltersAndSort() {
    let filtered = uniqueProducts;

    // 1. Age Pills Filter
    if (currentFilters.ageGroup) {
      filtered = filtered.filter(p => p.ageGroup === currentFilters.ageGroup);
    }

    // 2. Sidebar Array Filters
    const selectedCategories = Array.from(document.querySelectorAll('#colFilterCategories input:checked')).map(cb => cb.value);
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(p => selectedCategories.includes(p.category));
    }

    const selectedSkills = Array.from(document.querySelectorAll('#colFilterSkills input:checked')).map(cb => cb.value);
    if (selectedSkills.length > 0) {
      filtered = filtered.filter(p => p.skills && p.skills.some(s => selectedSkills.includes(s)));
    }

    const selectedThemes = Array.from(document.querySelectorAll('#colFilterThemes input:checked')).map(cb => cb.value);
    if (selectedThemes.length > 0) {
      filtered = filtered.filter(p => selectedThemes.includes(p.theme));
    }

    // 3. Price Filter
    if (currentFilters.minPrice !== null) {
      filtered = filtered.filter(p => p.price >= currentFilters.minPrice);
    }
    if (currentFilters.maxPrice !== null) {
      filtered = filtered.filter(p => p.price <= currentFilters.maxPrice);
    }

    // 4. Sort
    if (currentSort === 'price-low') filtered.sort((a, b) => a.price - b.price);
    else if (currentSort === 'price-high') filtered.sort((a, b) => b.price - a.price);
    else if (currentSort === 'newest') filtered.sort((a, b) => new Date(b.launchDate) - new Date(a.launchDate));
    else if (currentSort === 'oldest') filtered.sort((a, b) => new Date(a.launchDate) - new Date(b.launchDate));
    else if (currentSort === 'bestsellers') filtered.sort((a, b) => (b.sales || 0) - (a.sales || 0));

    renderColProducts(filtered);
  }

  // Event Listeners for Filters
  
  // Age Pills
  const agePills = document.querySelectorAll('#colAgePills .age-pill');
  if(agePills.length > 0) {
      agePills.forEach(pill => {
        pill.addEventListener('click', () => {
          const isActive = pill.classList.contains('active');
          agePills.forEach(p => p.classList.remove('active'));
          
          if (!isActive) {
            pill.classList.add('active');
            currentFilters.ageGroup = pill.getAttribute('data-age');
          } else {
            currentFilters.ageGroup = null;
          }
          applyFiltersAndSort();
        });
      });
  }

  // Sidebar Checkboxes
  const checkboxes = document.querySelectorAll('#colFilterSidebar .filter-checkbox input');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      applyFiltersAndSort();
    });
  });

  // Sort Dropdown
  const sortSelect = document.getElementById('colSortBySelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      applyFiltersAndSort();
    });
  }

  // Price Apply
  const priceApplyBtn = document.getElementById('colPriceApply');
  if (priceApplyBtn) {
    priceApplyBtn.addEventListener('click', () => {
      const min = document.getElementById('colPriceMin').value;
      const max = document.getElementById('colPriceMax').value;
      currentFilters.minPrice = min ? parseInt(min) : null;
      currentFilters.maxPrice = max ? parseInt(max) : null;
      applyFiltersAndSort();
    });
  }

  // Mobile Filter
  const mobileBtn = document.getElementById('colMobileFilterBtn');
  const sidebar = document.getElementById('colFilterSidebar');
  const closeBtn = document.getElementById('colFilterCloseBtn');
  
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        sidebar.classList.remove('active');
        document.body.style.overflow = '';
      });
    }
  }

  // Initial Render
  renderColProducts(currentProducts);
});
