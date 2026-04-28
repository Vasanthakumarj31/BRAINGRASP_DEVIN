let products = {
  trending: [
    {
      id: 1, name: "Brain Builder Puzzle Set", age: "3-7 Years", ageGroup: "3+",
      price: 649, originalPrice: 699, save: "7%", reviews: 423,
      badge: "bestseller", image: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Puzzles & Pretend", skills: ["Logical Reasoning", "Focus & Attention"], theme: "Animals", type: "Single Products", launchDate: "2025-01-15", sales: 1500
    },
    {
      id: 2, name: "STEM Explorer Kit | Science Experiments", age: "6-12 Years", ageGroup: "6+",
      price: 899, originalPrice: 999, save: "10%", reviews: 287,
      badge: "bestseller", image: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Learning Products", skills: ["Logical Reasoning", "Fine Motor"], theme: "Science", type: "Single Products", launchDate: "2025-05-20", sales: 1200
    },
    {
      id: 3, name: "Baby Sensory Touch & Feel Book", age: "0-24 Months", ageGroup: "0-3",
      price: 549, originalPrice: 599, save: "8%", reviews: 512,
      badge: "bestseller", image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Infant Toys", skills: ["Sensory Development", "Focus & Attention"], theme: "Animals", type: "Single Products", launchDate: "2024-11-10", sales: 2000
    },
    {
      id: 4, name: "Sparkle Art Studio | Mess-Free Craft Kit", age: "3-7 Years", ageGroup: "3+",
      price: 749, originalPrice: 799, save: "6%", reviews: 345,
      badge: "new", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Arts & Crafts", skills: ["Fine Motor", "Creativity"], theme: "Magic", type: "Single Products", launchDate: "2026-02-01", sales: 500
    },
    {
      id: 5, name: "Word Wizard | Vocabulary Flash Cards", age: "8+ Years", ageGroup: "8+",
      price: 354, originalPrice: 374, save: "5%", reviews: 665,
      badge: "bestseller", image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Learning Products", skills: ["Social & Communication", "Focus & Attention"], theme: "Classics", type: "Single Products", launchDate: "2024-08-25", sales: 2500
    },
    {
      id: 6, name: "Ocean Adventures Floor Puzzle", age: "3-6 Years", ageGroup: "3+",
      price: 499, originalPrice: 549, save: "9%", reviews: 198,
      badge: "new", image: "https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Puzzles & Pretend", skills: ["Logical Reasoning", "Focus & Attention"], theme: "Ocean", type: "Single Products", launchDate: "2026-03-15", sales: 300
    },
    {
      id: 7, name: "Number Ninjas | Math Learning Game", age: "6-10 Years", ageGroup: "6+",
      price: 599, originalPrice: 649, save: "8%", reviews: 312,
      badge: "bestseller", image: "https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Card & Board Games", skills: ["Logical Reasoning", "Focus & Attention"], theme: "Classics", type: "Single Products", launchDate: "2025-09-10", sales: 1100
    },
    {
      id: 8, name: "High Contrast Baby Flash Cards", age: "0-12 Months", ageGroup: "0-3",
      price: 349, originalPrice: 399, save: "13%", reviews: 478,
      badge: "bestseller", image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Infant Toys", skills: ["Sensory Development", "Focus & Attention"], theme: "Animals", type: "Single Products", launchDate: "2024-12-05", sales: 1800
    },
  ],
  bestsellers: [
    {
      id: 9, name: "BrainQuiz Family Card Game", age: "8+ Years", ageGroup: "8+",
      price: 449, originalPrice: 499, save: "10%", reviews: 892,
      badge: "bestseller", image: "https://images.unsplash.com/photo-1632501641765-e568d28b0015?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Card & Board Games", skills: ["Logical Reasoning", "Social & Communication"], theme: "Classics", type: "Single Products", launchDate: "2023-10-10", sales: 5000
    },
    {
      id: 10, name: "Magnetic Discovery Board", age: "3-8 Years", ageGroup: "3+",
      price: 799, originalPrice: 899, save: "11%", reviews: 567,
      badge: "bestseller", image: "https://images.unsplash.com/photo-1560421683-6856ea585c78?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Learning Products", skills: ["Fine Motor", "Creativity"], theme: "Classics", type: "Single Products", launchDate: "2024-05-15", sales: 2200
    },
    {
      id: 11, name: "Sensory Rainbow Stacker", age: "1-3 Years", ageGroup: "0-3",
      price: 649, originalPrice: 699, save: "7%", reviews: 734,
      badge: "bestseller", image: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Infant Toys", skills: ["Sensory Development", "Fine Motor"], theme: "Rainbow", type: "Single Products", launchDate: "2024-02-20", sales: 3100
    },
    {
      id: 12, name: "Creative Origami Adventure Kit", age: "6+ Years", ageGroup: "6+",
      price: 399, originalPrice: 449, save: "11%", reviews: 423,
      badge: "bestseller", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Arts & Crafts", skills: ["Fine Motor", "Focus & Attention"], theme: "Animals", type: "Single Products", launchDate: "2025-07-08", sales: 1600
    },
  ],
  newlaunches: [
    {
      id: 13, name: "Chess Champions | Beginner Chess Kit", age: "4+ Years", ageGroup: "3+",
      price: 569, originalPrice: 599, save: "5%", reviews: 0,
      badge: "new", image: "https://images.unsplash.com/photo-1529220502050-f15e43e15270?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Card & Board Games", skills: ["Logical Reasoning", "Focus & Attention"], theme: "Classics", type: "Single Products", launchDate: "2026-04-01", sales: 50
    },
    {
      id: 14, name: "Handwriting Hero Practice Kit", age: "4-7 Years", ageGroup: "3+",
      price: 759, originalPrice: 799, save: "5%", reviews: 0,
      badge: "new", image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Learning Products", skills: ["Fine Motor", "Focus & Attention"], theme: "Classics", type: "Single Products", launchDate: "2026-04-10", sales: 80
    },
    {
      id: 15, name: "Space Explorer 3D Art Kit", age: "5-10 Years", ageGroup: "6+",
      price: 664, originalPrice: 699, save: "5%", reviews: 0,
      badge: "new", image: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Arts & Crafts", skills: ["Creativity", "Fine Motor"], theme: "Space", type: "Single Products", launchDate: "2026-03-25", sales: 120
    },
    {
      id: 16, name: "Dino Discovery Sand Play Set", age: "3-7 Years", ageGroup: "3+",
      price: 549, originalPrice: 599, save: "8%", reviews: 0,
      badge: "new", image: "https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=400&h=300&fit=crop",
      offer: "Buy any 2 | Get FLAT 10% OFF",
      category: "Puzzles & Pretend", skills: ["Sensory Development", "Creativity"], theme: "Dinosaurs", type: "Single Products", launchDate: "2026-03-28", sales: 90
    },
  ],
  bundles: [
    {
      id: 17, name: "Vocabulary Champions Bundle", age: "8+ Years", ageGroup: "8+",
      price: 953, originalPrice: 1122, save: "15%", reviews: 234,
      badge: "bundle", image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop",
      offer: "BUNDLE DEAL - 15% OFF",
      category: "Learning Products", skills: ["Social & Communication", "Focus & Attention"], theme: "Classics", type: "Bundles", launchDate: "2025-11-01", sales: 600
    },
    {
      id: 18, name: "Baby Essentials Starter Bundle", age: "0-18 Months", ageGroup: "0-3",
      price: 1601, originalPrice: 1779, save: "10%", reviews: 156,
      badge: "bundle", image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&h=300&fit=crop",
      offer: "BUNDLE DEAL - 10% OFF",
      category: "Infant Toys", skills: ["Sensory Development", "Fine Motor"], theme: "Animals", type: "Bundles", launchDate: "2025-10-15", sales: 800
    },
    {
      id: 19, name: "Creative Colors Sticker Bundle", age: "3-7 Years", ageGroup: "3+",
      price: 1403, originalPrice: 1650, save: "15%", reviews: 312,
      badge: "bundle", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=300&fit=crop",
      offer: "BUNDLE DEAL - 15% OFF",
      category: "Arts & Crafts", skills: ["Creativity", "Fine Motor"], theme: "Classics", type: "Bundles", launchDate: "2025-08-20", sales: 450
    },
    {
      id: 20, name: "Touch & Tickle Time Bundle", age: "0-3 Years", ageGroup: "0-3",
      price: 1956, originalPrice: 2249, save: "13%", reviews: 189,
      badge: "bundle", image: "https://images.unsplash.com/photo-1587654780291-39c9404d7dd0?w=400&h=300&fit=crop",
      offer: "BUNDLE DEAL - 13% OFF",
      category: "Infant Toys", skills: ["Sensory Development", "Social & Communication"], theme: "Animals", type: "Bundles", launchDate: "2026-01-10", sales: 300
    },
  ]
};
 
// === Create Product Card HTML ===
function createProductCard(product) {
  const badgeClass = product.badge === 'bestseller' ? 'badge-yellow' : 'badge-blue';
  const badgeText = product.badge === 'bestseller' ? 'Bestseller' : 'Perfect Gift';
  
  const reviewsHTML = product.reviews >= 0 
    ? `<div class="product-reviews">
        <div class="stars">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star-half-alt"></i>
        </div>
        <span class="review-count">${product.reviews || 0} reviews</span>
       </div>` 
    : '';
 
  return `
    <div class="product-card advanced-card" data-id="${product.id}" data-age="${product.ageGroup}" data-category="${product.category || ''}" data-skills='${JSON.stringify(product.skills || [])}' data-theme="${product.theme || ''}" data-type="${product.type || ''}" data-price="${product.price}" data-date="${product.launchDate || ''}" data-sales="${product.sales || 0}">
      <span class="adv-badge ${badgeClass}">${badgeText}</span>
      <div class="product-share">
        <button class="share-btn"><i class="fas fa-share-alt"></i></button>
      </div>
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
      </div>
      <div class="product-info">
        <div class="product-age-pill">Ages: ${product.age}</div>
        <h3 class="product-name">${product.name}</h3>
        
        <div class="product-price-row">
          <span class="price-current">&#8377;${product.price.toLocaleString()}</span>
          <span class="price-original">&#8377;${product.originalPrice.toLocaleString()}</span>
          <span class="price-save">Save ${product.save}</span>
        </div>
        
        ${reviewsHTML}
        
        <div class="promo-box">
          Buy any 2 | Get FLAT 10% OFF<br>
          <span class="promo-code">Use Code: BYOB10</span>
        </div>
        
        <button class="add-to-cart-btn btn-peach">Add to Cart</button>
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

// === Fetch from DB Backend ===
async function fetchProductsFromDB() {
  try {
    const res = await fetch('http://localhost:3000/api/products');
    if (!res.ok) throw new Error('API response was not ok');
    const data = await res.json();
    
    // Overwrite the products data with fresh data from database
    products = data;
    
    // Re-render visible grids if they exist
    const trendingGrid = document.getElementById('trendingGrid');
    if (trendingGrid) {
      const activeTab = trendingGrid.closest('.section')?.querySelector('.tab-btn.active');
      if (activeTab) activeTab.click(); // Trigger the tab click to re-render
      else renderProducts('trendingGrid', products.trending);
    }
    
    const handpickedGrid = document.getElementById('handpickedGrid');
    if (handpickedGrid) {
      const activeTab = handpickedGrid.closest('.section')?.querySelector('.tab-btn.active');
      if (activeTab) activeTab.click();
      else renderProducts('handpickedGrid', products.bestsellers);
    }
    
    // Re-render you may also like
    if (document.getElementById('youMayAlsoLikeGrid')) {
      renderProducts('youMayAlsoLikeGrid', products.bestsellers);
    }
    if (document.getElementById('recentlyViewedGrid')) {
      renderProducts('recentlyViewedGrid', products.newlaunches);
    }
    
    // Dispatch event so other pages (collections, etc) can re-render if needed
    document.dispatchEvent(new Event('productsUpdated'));
  } catch (err) {
    console.error('Failed to load from DB, using fallback data:', err);
  }
}

// Call fetch on load
window.addEventListener('DOMContentLoaded', () => {
  // Add a small delay to let other DOMContentLoaded scripts run first and setup UI
  setTimeout(fetchProductsFromDB, 100);
});
 
