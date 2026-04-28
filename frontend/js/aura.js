// Aura Discovery Dashboard JavaScript
const API_BASE = 'http://localhost:3000';

// AI Tools data - mock data for Aura Discovery
const aiToolsData = [
  {
    id: 101,
    name: "Aura Math Wizard",
    description: "AI-powered math learning companion",
    age: "6-9 Years",
    ageGroup: "6+",
    price: 899,
    originalPrice: 999,
    save: "10%",
    reviews: 234,
    badge: "ai-powered",
    image: "https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?w=400&h=300&fit=crop",
    category: "Learning Products",
    skills: ["Logical Reasoning", "Focus & Attention"],
    theme: "AI",
    type: "AI Tools"
  },
  {
    id: 102,
    name: "Aura Reading Buddy",
    description: "Personalized reading assistant with AI",
    age: "4-8 Years",
    ageGroup: "3+",
    price: 749,
    originalPrice: 849,
    save: "12%",
    reviews: 189,
    badge: "ai-powered",
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop",
    category: "Learning Products",
    skills: ["Social & Communication", "Focus & Attention"],
    theme: "AI",
    type: "AI Tools"
  },
  {
    id: 103,
    name: "Aura STEM Lab",
    description: "Virtual science experiments with AI guidance",
    age: "8-12 Years",
    ageGroup: "8+",
    price: 1299,
    originalPrice: 1499,
    save: "13%",
    reviews: 312,
    badge: "ai-powered",
    image: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop",
    category: "STEM Toys",
    skills: ["Logical Reasoning", "Creativity"],
    theme: "Science",
    type: "AI Tools"
  },
  {
    id: 104,
    name: "Aura Art Studio",
    description: "AI-generated art prompts and lessons",
    age: "5-10 Years",
    ageGroup: "5+",
    price: 649,
    originalPrice: 749,
    save: "13%",
    reviews: 156,
    badge: "new",
    image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=300&fit=crop",
    category: "Arts & Crafts",
    skills: ["Creativity", "Fine Motor"],
    theme: "Magic",
    type: "AI Tools"
  },
  {
    id: 105,
    name: "Aura Language Coach",
    description: "Interactive language learning with AI",
    age: "6-12 Years",
    ageGroup: "6+",
    price: 999,
    originalPrice: 1199,
    save: "17%",
    reviews: 278,
    badge: "ai-powered",
    image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&h=300&fit=crop",
    category: "Learning Products",
    skills: ["Social & Communication", "Focus & Attention"],
    theme: "Classics",
    type: "AI Tools"
  },
  {
    id: 106,
    name: "Aura Puzzle Master",
    description: "Adaptive puzzle difficulty with AI",
    age: "4-10 Years",
    ageGroup: "4+",
    price: 549,
    originalPrice: 649,
    save: "15%",
    reviews: 198,
    badge: "ai-powered",
    image: "https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=400&h=300&fit=crop",
    category: "Puzzles & Pretend",
    skills: ["Logical Reasoning", "Focus & Attention"],
    theme: "Classics",
    type: "AI Tools"
  },
  {
    id: 107,
    name: "Aura Memory Game",
    description: "Cognitive training with AI adaptation",
    age: "3-8 Years",
    ageGroup: "3+",
    price: 449,
    originalPrice: 499,
    save: "10%",
    reviews: 145,
    badge: "new",
    image: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=400&h=300&fit=crop",
    category: "Learning Products",
    skills: ["Focus & Attention", "Memory"],
    theme: "Animals",
    type: "AI Tools"
  },
  {
    id: 108,
    name: "Aura Coding Bot",
    description: "Learn coding basics with friendly AI",
    age: "7-12 Years",
    ageGroup: "7+",
    price: 1499,
    originalPrice: 1799,
    save: "17%",
    reviews: 423,
    badge: "bestseller",
    image: "https://images.unsplash.com/photo-1529220502050-f15e43e15270?w=400&h=300&fit=crop",
    category: "STEM Toys",
    skills: ["Logical Reasoning", "Creativity"],
    theme: "Technology",
    type: "AI Tools"
  }
];

// State
let currentTools = [];
let userWatchlist = [];
let userCart = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadTools();
  initAuth();
  initCart();
  initFilters();
  loadWatchlist();
});

// Load AI Tools
function loadTools() {
  currentTools = aiToolsData;
  renderTools(currentTools);
}

// Render tools to grid
function renderTools(tools) {
  const grid = document.getElementById('auraTools');
  if (!grid) return;

  grid.innerHTML = tools.map(tool => createToolCard(tool)).join('');
  attachToolEvents();
}

// Create tool card HTML
function createToolCard(tool) {
  const isWatched = userWatchlist.includes(tool.id);
  const inCart = userCart.some(item => item.id === tool.id);

  return `
    <div class="aura-tool-card" data-id="${tool.id}">
      <div class="aura-tool-image">
        <img src="${tool.image}" alt="${tool.name}">
        <span class="aura-tool-badge ${tool.badge}">${tool.badge}</span>
        <button class="aura-watch-btn ${isWatched ? 'watching' : ''}" data-id="${tool.id}" title="${isWatched ? 'Remove from watchlist' : 'Add to watchlist'}">
          <i class="fas fa-${isWatched ? 'eye' : 'eye-slash'}"></i>
        </button>
      </div>
      <div class="aura-tool-content">
        <h3 class="aura-tool-name">${tool.name}</h3>
        <p class="aura-tool-age"><i class="fas fa-child"></i> ${tool.age}</p>
        <div class="aura-tool-skills">
          ${tool.skills.map(skill => `<span class="aura-skill-tag">${skill}</span>`).join('')}
        </div>
        <div class="aura-tool-footer">
          <div class="aura-tool-price">
            <span class="aura-current-price">₹${tool.price}</span>
            <span class="aura-original-price">₹${tool.originalPrice}</span>
            <span class="aura-save-badge">Save ${tool.save}</span>
          </div>
          <button class="aura-add-cart-btn ${inCart ? 'added' : ''}" data-id="${tool.id}">
            ${inCart ? '<i class="fas fa-check"></i> Added' : '<i class="fas fa-cart-plus"></i> Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  `;
}

// Attach event listeners to tool cards
function attachToolEvents() {
  // Watch buttons
  document.querySelectorAll('.aura-watch-btn').forEach(btn => {
    btn.addEventListener('click', handleWatchToggle);
  });

  // Add to cart buttons
  document.querySelectorAll('.aura-add-cart-btn').forEach(btn => {
    btn.addEventListener('click', handleAddToCart);
  });
}

// Handle watch toggle
async function handleWatchToggle(e) {
  const btn = e.currentTarget;
  const toolId = parseInt(btn.dataset.id);
  const isLoggedIn = isAuthenticated();

  if (!isLoggedIn) {
    // Store redirect URL
    sessionStorage.setItem('redirectAfterLogin', 'aura.html');
    window.location.href = 'login.html';
    return;
  }

  try {
    if (userWatchlist.includes(toolId)) {
      // Remove from watchlist
      const response = await fetch(`${API_BASE}/api/watchlist/${toolId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.ok) {
        userWatchlist = userWatchlist.filter(id => id !== toolId);
        showToast('Removed from watchlist');
      }
    } else {
      // Add to watchlist
      const response = await fetch(`${API_BASE}/api/watchlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ tool_id: toolId })
      });
      if (response.ok) {
        userWatchlist.push(toolId);
        showToast('Added to watchlist');
      }
    }
    renderTools(currentTools);
    renderWatchlist();
  } catch (err) {
    console.error('Watchlist error:', err);
    // Fallback to local storage
    localStorage.setItem('watchlist', JSON.stringify(userWatchlist));
    showToast('Added to watchlist (offline)');
    renderTools(currentTools);
  }
}

// Handle add to cart
function handleAddToCart(e) {
  const btn = e.currentTarget;
  const toolId = parseInt(btn.dataset.id);
  const tool = currentTools.find(t => t.id === toolId);

  if (!tool) return;

  const existing = userCart.find(item => item.id === toolId);
  if (existing) {
    userCart = userCart.filter(item => item.id !== toolId);
    showToast('Removed from cart');
  } else {
    userCart.push({
      id: tool.id,
      name: tool.name,
      price: tool.price,
      image: tool.image,
      quantity: 1
    });
    showToast('Added to cart');
  }

  auraSaveCart();
  updateCartUI();
  renderTools(currentTools);
}

// Initialize filters
function initFilters() {
  const searchInput = document.getElementById('auraSearch');
  const ageFilter = document.getElementById('ageFilter');
  const skillFilter = document.getElementById('skillFilter');

  if (searchInput) {
    searchInput.addEventListener('input', filterTools);
  }
  if (ageFilter) {
    ageFilter.addEventListener('change', filterTools);
  }
  if (skillFilter) {
    skillFilter.addEventListener('change', filterTools);
  }
}

// Filter tools
function filterTools() {
  const search = document.getElementById('auraSearch')?.value.toLowerCase() || '';
  const age = document.getElementById('ageFilter')?.value || '';
  const skill = document.getElementById('skillFilter')?.value || '';

  let filtered = aiToolsData;

  if (search) {
    filtered = filtered.filter(tool =>
      tool.name.toLowerCase().includes(search) ||
      tool.description.toLowerCase().includes(search)
    );
  }

  if (age) {
    filtered = filtered.filter(tool => tool.age.includes(age));
  }

  if (skill) {
    filtered = filtered.filter(tool => tool.skills.includes(skill));
  }

  currentTools = filtered;
  renderTools(filtered);
}

// Load watchlist from server
async function loadWatchlist() {
  if (!isAuthenticated()) {
    // Load from local storage
    const stored = localStorage.getItem('watchlist');
    if (stored) {
      userWatchlist = JSON.parse(stored);
    }
    renderWatchlist();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/watchlist`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (response.ok) {
      const data = await response.json();
      userWatchlist = data.map(item => item.tool_id);
      renderWatchlist();
    }
  } catch (err) {
    console.error('Failed to load watchlist:', err);
    // Fallback to local storage
    const stored = localStorage.getItem('watchlist');
    if (stored) {
      userWatchlist = JSON.parse(stored);
    }
    renderWatchlist();
  }
}

// Render watchlist
function renderWatchlist() {
  const section = document.getElementById('watchlistSection');
  const grid = document.getElementById('watchlistGrid');

  if (!section || !grid) return;

  if (userWatchlist.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  const watchedTools = aiToolsData.filter(tool => userWatchlist.includes(tool.id));
  grid.innerHTML = watchedTools.map(tool => createToolCard(tool)).join('');
  attachToolEvents();
}

// Cart functions
function initCart() {
  auraLoadCart();
  updateCartUI();

  const cartBtn = document.getElementById('cartBtn');
  const cartClose = document.getElementById('cartClose');
  const cartOverlay = document.getElementById('cartOverlay');

  if (cartBtn) cartBtn.addEventListener('click', toggleCart);
  if (cartClose) cartClose.addEventListener('click', toggleCart);
  if (cartOverlay) cartOverlay.addEventListener('click', toggleCart);
}

function auraLoadCart() {
  // Use auth.js cart helpers
  userCart = getCart();
}

function auraSaveCart() {
  // Use auth.js cart helpers - pass the userCart array
  saveCart(userCart);
}

function updateCartUI() {
  // Use auth.js cart update
  updateCartCount();
  
  const cartItems = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');

  if (cartItems) {
    cartItems.innerHTML = userCart.map(item => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <p>₹${item.price} x ${item.quantity}</p>
        </div>
        <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');

    cartItems.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        userCart = userCart.filter(item => item.id !== id);
        auraSaveCart();
        updateCartUI();
        renderTools(currentTools);
      });
    });
  }

  if (cartTotal) {
    cartTotal.textContent = `₹${getCartTotal()}`;
  }
}

function toggleCart() {
  const sidebar = document.getElementById('cartSidebar');
  const overlay = document.getElementById('cartOverlay');

  if (sidebar && overlay) {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  }
}

// Auth functions
function initAuth() {
  updateAuthUI();
}

function updateAuthUI() {
  const userBtn = document.getElementById('userBtn');
  if (!userBtn) return;

  if (isAuthenticated()) {
    const user = getUser();
    userBtn.href = 'dashboard.html';
    userBtn.innerHTML = `<i class="fas fa-user-circle"></i>`;
  } else {
    userBtn.href = 'login.html';
    userBtn.innerHTML = `<i class="fas fa-user"></i>`;
  }
}

// Toast notification
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}