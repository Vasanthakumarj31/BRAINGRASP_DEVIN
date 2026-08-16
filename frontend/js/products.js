/* BrainGrasp — Dynamic Products Management (DB Single Source of Truth) */

// Global products structure initialized empty — ZERO hardcoded fallback products
let products = {
  trending: [],
  bestsellers: [],
  newlaunches: [],
  bundles: []
};

// Expose on window object
window.products = products;

// === Create Product Card HTML ===
function createProductCard(product) {
  if (!product) return '';

  const price = Number(product.price) || 0;
  const origPriceVal = product.originalPrice !== undefined ? product.originalPrice : product.original_price;
  const originalPrice = Number(origPriceVal) || price;
  const saveText = product.save || '0%';
  
  const badgeClass = product.badge === 'bestseller' ? 'badge-yellow' : product.badge === 'new' ? 'badge-blue' : 'badge-green';
  const badgeText = product.badge === 'bestseller' ? 'Bestseller' : product.badge === 'new' ? 'New Launch' : product.badge ? product.badge : 'Featured';
  
  const reviews = Number(product.reviews) || 0;
  const reviewsHTML = reviews >= 0 
    ? `<div class="product-reviews">
        <div class="stars">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star-half-alt"></i>
        </div>
        <span class="review-count">${reviews} reviews</span>
       </div>` 
    : '';

  const ageText = product.age || product.ageGroup || '3+ Years';

  return `
    <div class="product-card advanced-card" data-id="${product.id}" data-age="${product.ageGroup || ''}" data-category="${product.category || ''}" data-skills='${JSON.stringify(product.skills || [])}' data-theme="${product.theme || ''}" data-type="${product.type || ''}" data-price="${price}" data-date="${product.launchDate || ''}" data-sales="${product.sales || 0}">
      ${product.badge ? `<span class="adv-badge ${badgeClass}">${badgeText}</span>` : ''}
      <div class="product-share">
        <button class="share-btn"><i class="fas fa-share-alt"></i></button>
      </div>
      <div class="product-image">
        <img src="${product.image || 'https://via.placeholder.com/400x300?text=No+Image'}" alt="${product.name || 'Product'}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'">
      </div>
      <div class="product-info">
        <div class="product-age-pill">Ages: ${ageText}</div>
        <h3 class="product-name">${product.name || 'Product'}</h3>
        
        <div class="product-price-row">
          <span class="price-current">&#8377;${price.toLocaleString('en-IN')}</span>
          ${originalPrice > price ? `<span class="price-original">&#8377;${originalPrice.toLocaleString('en-IN')}</span>` : ''}
          ${saveText && saveText !== '0%' ? `<span class="price-save">Save ${saveText}</span>` : ''}
        </div>
        
        ${reviewsHTML}
        
        <div class="promo-box">
          ${product.offer || 'Buy any 2 | Get FLAT 10% OFF'}<br>
          <span class="promo-code">Use Code: BYOB10</span>
        </div>
        
        <button class="add-to-cart-btn btn-peach"><i class="fas fa-shopping-bag"></i> Add to Cart</button>
      </div>
    </div>
  `;
}

// === Render Products ===
function renderProducts(gridId, productList, errorMessage) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  if (errorMessage) {
    grid.innerHTML = `
      <div class="products-status-box error-status" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #ef4444; background: rgba(239, 68, 68, 0.05); border-radius: 12px; border: 1px dashed rgba(239, 68, 68, 0.2); width: 100%;">
        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 12px; display: block;"></i>
        <p style="font-size: 1.1rem; font-weight: 600; margin: 0;">${errorMessage}</p>
      </div>
    `;
    return;
  }

  if (!productList || productList.length === 0) {
    grid.innerHTML = `
      <div class="products-status-box empty-status" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #64748b; background: rgba(255, 255, 255, 0.02); border-radius: 12px; border: 1px dashed rgba(255, 255, 255, 0.1); width: 100%;">
        <i class="fas fa-box-open" style="font-size: 2rem; margin-bottom: 12px; display: block; color: #94a3b8;"></i>
        <p style="font-size: 1.1rem; font-weight: 600; margin: 0;">No products available.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = productList.map(createProductCard).join('');
}

// === Render All Visible Grids ===
function renderAllGrids() {
  const trendingGrid = document.getElementById('trendingGrid');
  if (trendingGrid) {
    const activeTab = trendingGrid.closest('.section')?.querySelector('.tab-btn.active');
    if (activeTab && typeof activeTab.click === 'function') {
      activeTab.click();
    } else {
      renderProducts('trendingGrid', products.trending);
    }
  }

  const handpickedGrid = document.getElementById('handpickedGrid');
  if (handpickedGrid) {
    const activeTab = handpickedGrid.closest('.section')?.querySelector('.tab-btn.active');
    if (activeTab && typeof activeTab.click === 'function') {
      activeTab.click();
    } else {
      renderProducts('handpickedGrid', products.bestsellers);
    }
  }

  if (document.getElementById('youMayAlsoLikeGrid')) {
    renderProducts('youMayAlsoLikeGrid', products.bestsellers);
  }
  if (document.getElementById('recentlyViewedGrid')) {
    renderProducts('recentlyViewedGrid', products.newlaunches);
  }
}

function renderAllGridsError(msg) {
  ['trendingGrid', 'handpickedGrid', 'youMayAlsoLikeGrid', 'recentlyViewedGrid', 'shopByAgeGrid', 'shopByCategoryGrid', 'colProductsGrid', 'pcProductsGrid', 'giftResultGrid'].forEach(id => {
    if (document.getElementById(id)) {
      renderProducts(id, [], msg);
    }
  });
}

// === Normalize DB row (snake_case) → frontend object (camelCase) ===
// PostgreSQL returns column names in snake_case; the sort/filter logic
// throughout the frontend expects camelCase. This single mapping is the
// source of truth — fix field names HERE, not scattered across every page.
function normalizeProduct(p) {
  return {
    ...p,
    // price/originalPrice — DB stores as INTEGER, ensure numeric
    price:         Number(p.price)          || 0,
    originalPrice: Number(p.original_price !== undefined ? p.original_price : (p.originalPrice || p.price)) || Number(p.price) || 0,
    // snake_case → camelCase mappings that sort/filter functions depend on
    ageGroup:      p.age_group   || p.ageGroup   || null,
    launchDate:    p.launch_date || p.launchDate  || null,
    groupName:     p.group_name  || p.groupName   || null,
    sales:         Number(p.sales)   || 0,
    reviews:       Number(p.reviews) || 0,
  };
}

// === Fetch from DB Backend ONLY ===
async function fetchProductsFromDB() {
  try {
    const apiBase = (window.BG_CONFIG && window.BG_CONFIG.API_BASE) || 'http://localhost:3000';
    let res;

    try {
      res = await fetch(`${apiBase}/api/products`);
    } catch (e1) {
      try {
        res = await fetch('/api/products');
      } catch (e2) {
        res = await fetch('http://localhost:3000/api/products');
      }
    }
    
    if (!res || !res.ok) {
      throw new Error(`API returned status ${res ? res.status : 'failed'}`);
    }
    
    const rawData = await res.json();

    // Normalize every product row to camelCase immediately after fetch
    const data = Array.isArray(rawData) ? rawData.map(normalizeProduct) : rawData;

    if (Array.isArray(data)) {
      const trending = data.filter(p => p.group_name === 'trending'  || p.groupName === 'trending');
      const bestsellers = data.filter(p => p.group_name === 'bestsellers' || p.groupName === 'bestsellers');
      const newlaunches = data.filter(p => p.group_name === 'newlaunches' || p.groupName === 'newlaunches' || p.badge === 'new');
      const bundles = data.filter(p => p.group_name === 'bundles' || p.groupName === 'bundles' || p.type === 'Bundles');

      products.trending = trending.length > 0 ? trending : data;
      products.bestsellers = bestsellers.length > 0 ? bestsellers : data;
      products.newlaunches = newlaunches.length > 0 ? newlaunches : data;
      products.bundles = bundles.length > 0 ? bundles : data;
    } else if (data && typeof data === 'object') {
      const norm = (arr) => Array.isArray(arr) ? arr.map(normalizeProduct) : [];
      products.trending = norm(data.trending).length > 0 ? norm(data.trending) : (Object.values(data).flat().map(normalizeProduct) || []);
      products.bestsellers = norm(data.bestsellers).length > 0 ? norm(data.bestsellers) : products.trending;
      products.newlaunches = norm(data.newlaunches).length > 0 ? norm(data.newlaunches) : products.trending;
      products.bundles = norm(data.bundles).length > 0 ? norm(data.bundles) : products.trending;
    } else {
      products.trending = [];
      products.bestsellers = [];
      products.newlaunches = [];
      products.bundles = [];
    }

    window.products = products;

    // Render updated products to visible grids
    renderAllGrids();

    // Dispatch event so other pages (shop-by-age, collections, etc) can re-render
    document.dispatchEvent(new CustomEvent('productsUpdated', { detail: { success: true, products } }));

  } catch (err) {
    console.error('Failed to load products from Database API:', err);

    // Reset products to empty — NEVER USE FALLBACK OR HARDCODED DATA
    products.trending = [];
    products.bestsellers = [];
    products.newlaunches = [];
    products.bundles = [];
    window.products = products;

    renderAllGridsError("Unable to load products. Please try again.");

    document.dispatchEvent(new CustomEvent('productsUpdated', { detail: { success: false, error: err.message } }));
  }
}

// Call fetch on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(fetchProductsFromDB, 50);
});
