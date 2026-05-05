/* ============================================================
   search.js – BrainyGrasp Search System
   Handles: Search overlay, autocomplete, product search, filtering
   ============================================================ */

const API_BASE = 'http://localhost:3000';

// Search state management
const searchState = {
    isOpen: false,
    query: '',
    results: [],
    categories: [],
    isLoading: false,
    searchHistory: [],
    popularSearches: [
        'puzzles',
        'art and craft',
        'learning toys',
        'board games',
        'stem toys',
        'toddler toys',
        'birthday gifts',
        'educational games'
    ]
};

// DOM elements
let searchOverlay, searchInput, searchClose, searchResults, searchSuggestions;

// Initialize search functionality
function initSearch() {
    // Get DOM elements
    searchOverlay = document.getElementById('searchOverlay');
    searchInput = document.getElementById('searchInput');
    searchClose = document.getElementById('searchClose');
    const searchBtn = document.getElementById('searchBtn');
    
    // Create search results container if it doesn't exist
    if (!document.getElementById('searchResults')) {
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'searchResults';
        resultsContainer.className = 'search-results';
        searchOverlay.querySelector('.container').appendChild(resultsContainer);
    }
    searchResults = document.getElementById('searchResults');
    
    // Load search history from localStorage
    loadSearchHistory();
    
    // Set up event listeners
    setupSearchEventListeners();
    
    console.log('🔍 Search system initialized');
}

// Set up search event listeners
function setupSearchEventListeners() {
    const searchBtn = document.getElementById('searchBtn');
    
    // Search button click
    if (searchBtn) {
        searchBtn.addEventListener('click', openSearch);
    }
    
    // Search overlay click to close
    if (searchOverlay) {
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) {
                closeSearch();
            }
        });
    }
    
    // Close button click
    if (searchClose) {
        searchClose.addEventListener('click', closeSearch);
    }
    
    // Search input events
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearchInput, 300));
        searchInput.addEventListener('keydown', handleSearchKeydown);
        searchInput.addEventListener('focus', handleSearchFocus);
    }
    
    // Escape key to close search
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchState.isOpen) {
            closeSearch();
        }
    });
}

// Open search overlay
function openSearch() {
    if (!searchOverlay || searchState.isOpen) return;
    
    searchState.isOpen = true;
    searchOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Focus input after animation
    setTimeout(() => {
        if (searchInput) {
            searchInput.focus();
        }
    }, 100);
    
    // Show initial suggestions
    showInitialSuggestions();
    
    console.log('🔍 Search overlay opened');
}

// Close search overlay
function closeSearch() {
    if (!searchOverlay || !searchState.isOpen) return;
    
    searchState.isOpen = false;
    searchOverlay.classList.remove('active');
    document.body.style.overflow = '';
    
    // Clear search
    if (searchInput) {
        searchInput.value = '';
    }
    searchState.query = '';
    searchState.results = [];
    
    // Clear results
    if (searchResults) {
        searchResults.innerHTML = '';
    }
    
    console.log('🔍 Search overlay closed');
}

// Handle search input
async function handleSearchInput(e) {
    const query = e.target.value.trim();
    searchState.query = query;
    
    if (query.length === 0) {
        showInitialSuggestions();
        return;
    }
    
    if (query.length < 2) {
        if (searchResults) {
            searchResults.innerHTML = '';
        }
        return;
    }
    
    searchState.isLoading = true;
    showLoadingState();
    
    try {
        // Search products
        const products = await searchProducts(query);
        const categories = await searchCategories(query);
        
        searchState.results = products;
        searchState.categories = categories;
        searchState.isLoading = false;
        
        displaySearchResults(products, categories, query);
        
        // Add to search history
        addToSearchHistory(query);
        
    } catch (error) {
        console.error('❌ Search error:', error);
        searchState.isLoading = false;
        showSearchError();
    }
}

// Handle search keyboard events
function handleSearchKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateResults('down');
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateResults('up');
    }
}

// Handle search focus
function handleSearchFocus() {
    if (searchState.query.length === 0) {
        showInitialSuggestions();
    }
}

// Search products from API
async function searchProducts(query) {
    try {
        const response = await fetch(`${API_BASE}/api/products/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error('Search failed');
        }
        
        const data = await response.json();
        return data.products || [];
    } catch (error) {
        console.error('❌ Product search error:', error);
        // Return mock data for demo
        return getMockProducts(query);
    }
}

// Search categories from API
async function searchCategories(query) {
    try {
        const response = await fetch(`${API_BASE}/api/categories/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error('Category search failed');
        }
        
        const data = await response.json();
        return data.categories || [];
    } catch (error) {
        console.error('❌ Category search error:', error);
        // Return mock data for demo
        return getMockCategories(query);
    }
}

// Display search results
function displaySearchResults(products, categories, query) {
    if (!searchResults) return;
    
    let html = '';
    
    // Show categories if found
    if (categories.length > 0) {
        html += `
            <div class="search-section">
                <h3 class="search-section-title">Categories</h3>
                <div class="search-categories">
                    ${categories.map(cat => `
                        <a href="shop-by-category.html?category=${encodeURIComponent(cat.name)}" class="search-category-item">
                            <div class="search-category-icon">
                                <img src="${cat.image || 'https://via.placeholder.com/40x40'}" alt="${cat.name}">
                            </div>
                            <div class="search-category-info">
                                <div class="search-category-name">${highlightMatch(cat.name, query)}</div>
                                <div class="search-category-count">${cat.product_count || 0} products</div>
                            </div>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Show products if found
    if (products.length > 0) {
        html += `
            <div class="search-section">
                <h3 class="search-section-title">Products</h3>
                <div class="search-products">
                    ${products.map(product => `
                        <a href="product-detail.html?id=${product.id}" class="search-product-item">
                            <div class="search-product-image">
                                <img src="${product.image || 'https://via.placeholder.com/60x60'}" alt="${product.name}">
                            </div>
                            <div class="search-product-info">
                                <div class="search-product-name">${highlightMatch(product.name, query)}</div>
                                <div class="search-product-category">${product.category || 'Toys'}</div>
                                <div class="search-product-price">₹${product.price || '0'}</div>
                            </div>
                            ${product.in_stock ? '<div class="search-product-badge in-stock">In Stock</div>' : '<div class="search-product-badge out-of-stock">Out of Stock</div>'}
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Show no results
    if (products.length === 0 && categories.length === 0) {
        html += `
            <div class="search-section">
                <div class="search-no-results">
                    <div class="search-no-results-icon">
                        <i class="fas fa-search"></i>
                    </div>
                    <h3>No results found for "${query}"</h3>
                    <p>Try searching for something else or browse our categories</p>
                    <div class="search-suggestions">
                        <h4>Popular searches:</h4>
                        <div class="search-suggestion-tags">
                            ${searchState.popularSearches.slice(0, 5).map(term => `
                                <button class="search-suggestion-tag" onclick="searchSuggestion('${term}')">${term}</button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Show view all results button
    if (products.length > 0) {
        html += `
            <div class="search-section">
                <a href="search-results.html?q=${encodeURIComponent(query)}" class="search-view-all">
                    View all results for "${query}" (${products.length} products)
                    <i class="fas fa-arrow-right"></i>
                </a>
            </div>
        `;
    }
    
    searchResults.innerHTML = html;
}

// Show initial suggestions
function showInitialSuggestions() {
    if (!searchResults) return;
    
    const recentSearches = searchState.searchHistory.slice(0, 5);
    
    let html = `
        <div class="search-section">
            <h3 class="search-section-title">Popular Searches</h3>
            <div class="search-suggestion-tags">
                ${searchState.popularSearches.map(term => `
                    <button class="search-suggestion-tag" onclick="searchSuggestion('${term}')">${term}</button>
                `).join('')}
            </div>
        </div>
    `;
    
    if (recentSearches.length > 0) {
        html += `
            <div class="search-section">
                <h3 class="search-section-title">Recent Searches</h3>
                <div class="search-recent">
                    ${recentSearches.map(term => `
                        <button class="search-recent-item" onclick="searchSuggestion('${term}')">
                            <i class="fas fa-clock"></i>
                            ${term}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    searchResults.innerHTML = html;
}

// Show loading state
function showLoadingState() {
    if (!searchResults) return;
    
    searchResults.innerHTML = `
        <div class="search-section">
            <div class="search-loading">
                <div class="search-spinner"></div>
                <p>Searching...</p>
            </div>
        </div>
    `;
}

// Show search error
function showSearchError() {
    if (!searchResults) return;
    
    searchResults.innerHTML = `
        <div class="search-section">
            <div class="search-error">
                <div class="search-error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Search Error</h3>
                <p>Something went wrong. Please try again.</p>
                <button class="search-retry-btn" onclick="handleSearchInput({ target: { value: searchState.query } })">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        </div>
    `;
}

// Highlight matching text
function highlightMatch(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// Search suggestion click
function searchSuggestion(term) {
    if (searchInput) {
        searchInput.value = term;
        searchState.query = term;
    }
    handleSearchInput({ target: { value: term } });
}

// Perform full search
function performSearch() {
    const query = searchState.query.trim();
    if (query.length === 0) return;
    
    // Add to search history
    addToSearchHistory(query);
    
    // Redirect to search results page
    window.location.href = `search-results.html?q=${encodeURIComponent(query)}`;
}

// Navigate search results with keyboard
function navigateResults(direction) {
    // Implementation for keyboard navigation
    // This would require tracking the current focused element
    console.log(`Navigating ${direction} through results`);
}

// Load search history from localStorage
function loadSearchHistory() {
    try {
        const history = localStorage.getItem('bg_search_history');
        searchState.searchHistory = history ? JSON.parse(history) : [];
    } catch (error) {
        console.error('❌ Failed to load search history:', error);
        searchState.searchHistory = [];
    }
}

// Add to search history
function addToSearchHistory(query) {
    if (!query || query.length < 2) return;
    
    // Remove existing entry
    searchState.searchHistory = searchState.searchHistory.filter(item => item !== query);
    
    // Add to beginning
    searchState.searchHistory.unshift(query);
    
    // Keep only last 10 searches
    searchState.searchHistory = searchState.searchHistory.slice(0, 10);
    
    // Save to localStorage
    try {
        localStorage.setItem('bg_search_history', JSON.stringify(searchState.searchHistory));
    } catch (error) {
        console.error('❌ Failed to save search history:', error);
    }
}

// Clear search history
function clearSearchHistory() {
    searchState.searchHistory = [];
    try {
        localStorage.removeItem('bg_search_history');
    } catch (error) {
        console.error('❌ Failed to clear search history:', error);
    }
}

// Mock data for demo purposes
function getMockProducts(query) {
    const mockProducts = [
        {
            id: 1,
            name: 'Educational Puzzle Set',
            category: 'Puzzles',
            price: 599,
            image: 'https://via.placeholder.com/60x60',
            in_stock: true
        },
        {
            id: 2,
            name: 'Art and Craft Kit',
            category: 'Arts & Crafts',
            price: 799,
            image: 'https://via.placeholder.com/60x60',
            in_stock: true
        },
        {
            id: 3,
            name: 'STEM Learning Robot',
            category: 'STEM Toys',
            price: 1299,
            image: 'https://via.placeholder.com/60x60',
            in_stock: false
        },
        {
            id: 4,
            name: 'Board Game Collection',
            category: 'Board Games',
            price: 999,
            image: 'https://via.placeholder.com/60x60',
            in_stock: true
        },
        {
            id: 5,
            name: 'Toddler Learning Blocks',
            category: 'Infant Toys',
            price: 499,
            image: 'https://via.placeholder.com/60x60',
            in_stock: true
        }
    ];
    
    // Filter by query
    return mockProducts.filter(product => 
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.category.toLowerCase().includes(query.toLowerCase())
    );
}

function getMockCategories(query) {
    const mockCategories = [
        {
            name: 'Arts & Crafts',
            image: 'https://via.placeholder.com/40x40',
            product_count: 45
        },
        {
            name: 'Puzzles & Games',
            image: 'https://via.placeholder.com/40x40',
            product_count: 32
        },
        {
            name: 'STEM Toys',
            image: 'https://via.placeholder.com/40x40',
            product_count: 28
        },
        {
            name: 'Learning Products',
            image: 'https://via.placeholder.com/40x40',
            product_count: 56
        }
    ];
    
    // Filter by query
    return mockCategories.filter(category => 
        category.name.toLowerCase().includes(query.toLowerCase())
    );
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
} else {
    initSearch();
}

// Export functions for global access
window.searchSuggestion = searchSuggestion;
window.clearSearchHistory = clearSearchHistory;
