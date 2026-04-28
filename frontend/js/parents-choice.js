// Parents Choice Page Logic

document.addEventListener('DOMContentLoaded', () => {
  const pcGrid = document.getElementById('pcProductsGrid');
  if (!pcGrid) return;

  // We will display all trending and bestsellers on this page by default
  const allProducts = [...products.trending, ...products.bestsellers, ...products.bundles];
  const uniqueProducts = Array.from(new Map(allProducts.map(item => [item.id, item])).values());
  
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

  const countEl = document.getElementById('pcResultsCount');

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

  createCheckboxes('pcFilterCategories', categoriesList, 'categories');
  createCheckboxes('pcFilterSkills', skillsList, 'skills');
  createCheckboxes('pcFilterThemes', themesList, 'themes');

  function renderPCProducts(list) {
    if (list.length === 0) {
      pcGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;">
          <h3>No products match your filters.</h3>
          <p>Try adjusting your criteria or clear filters.</p>
        </div>
      `;
      if (countEl) countEl.textContent = '0 Products';
      return;
    }
    
    // We can use the existing renderProducts function
    renderProducts('pcProductsGrid', list);
    if (countEl) countEl.textContent = `${list.length} Products`;
  }

  function applyFiltersAndSort() {
    let filtered = uniqueProducts;

    // 1. Age Pills Filter
    if (currentFilters.ageGroup) {
      filtered = filtered.filter(p => p.ageGroup === currentFilters.ageGroup);
    }

    // 2. Sidebar Array Filters
    const selectedCategories = Array.from(document.querySelectorAll('#pcFilterCategories input:checked')).map(cb => cb.value);
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(p => selectedCategories.includes(p.category));
    }

    const selectedSkills = Array.from(document.querySelectorAll('#pcFilterSkills input:checked')).map(cb => cb.value);
    if (selectedSkills.length > 0) {
      filtered = filtered.filter(p => p.skills && p.skills.some(s => selectedSkills.includes(s)));
    }

    const selectedThemes = Array.from(document.querySelectorAll('#pcFilterThemes input:checked')).map(cb => cb.value);
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

    renderPCProducts(filtered);
  }

  // Event Listeners for Filters
  
  // Age Pills
  const agePills = document.querySelectorAll('.pc-age-pills .age-pill');
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

  // Sidebar Checkboxes
  const checkboxes = document.querySelectorAll('#pcFilterSidebar .filter-checkbox input');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      applyFiltersAndSort();
    });
  });

  // Sort Dropdown
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      applyFiltersAndSort();
    });
  }

  // Price Apply
  const priceApplyBtn = document.getElementById('pcPriceApply');
  if (priceApplyBtn) {
    priceApplyBtn.addEventListener('click', () => {
      const min = document.getElementById('pcPriceMin').value;
      const max = document.getElementById('pcPriceMax').value;
      currentFilters.minPrice = min ? parseInt(min) : null;
      currentFilters.maxPrice = max ? parseInt(max) : null;
      applyFiltersAndSort();
    });
  }

  // Mobile Filter
  const mobileBtn = document.getElementById('pcMobileFilterBtn');
  const sidebar = document.getElementById('pcFilterSidebar');
  const closeBtn = document.getElementById('pcFilterCloseBtn');
  
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

  
  function applyHashFilter() {
    const hash = window.location.hash;
    
    // Clear all existing category checkboxes
    document.querySelectorAll('#pcFilterCategories input').forEach(cb => cb.checked = false);

    let catToCheck = null;
    if (hash === '#foil' || hash === '#poke' || hash === '#snip') catToCheck = 'Arts & Crafts';
    if (hash === '#piece' || hash === '#sand') catToCheck = 'Puzzles & Pretend';
    
    if (catToCheck) {
      const cb = document.querySelector(`#pcFilterCategories input[value="${catToCheck}"]`);
      if (cb) cb.checked = true;
      
      // Update Title
      const title = document.querySelector('.pc-title');
      if(title) {
         let lineName = hash === '#foil' ? 'Foil Fun' : 
                        hash === '#poke' ? 'Poke-In Art' : 
                        hash === '#snip' ? 'Snip, Snip!' : 
                        hash === '#piece' ? 'Piece & Play' : 'Sandeezy';
         title.textContent = "Parents' Choice: " + lineName;
      }
    } else {
      const title = document.querySelector('.pc-title');
      if(title) title.textContent = "Parents' Choice";
    }
    
    applyFiltersAndSort();
  }

  // Handle hash changes if clicked from within the same page
  window.addEventListener('hashchange', applyHashFilter);

  // Initial Render
  applyHashFilter();
});
