/* ============================================================
   modern-search.js – BrainyGrasp Modern Search System
   Handles: Dropdown search overlay, live API autocomplete, highlighting
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const searchOverlay = document.getElementById('modernSearchOverlay');
    const searchClose = document.getElementById('modernSearchClose');
    const searchInput = document.getElementById('modernSearchInput');
    const suggestionsArea = document.getElementById('modernSearchSuggestions');
    const resultsArea = document.getElementById('modernSearchResults');

    if (!searchBtn || !searchOverlay || !searchClose || !searchInput) return;

    const API_BASE = (window.BG_CONFIG && window.BG_CONFIG.API_BASE) || 'http://localhost:3000';

    // Search state
    const searchState = {
        isOpen: false,
        query: '',
        controller: null  // AbortController for in-flight requests
    };

    // Open Search
    searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        searchState.isOpen = true;
        searchOverlay.classList.add('active');
        setTimeout(() => searchInput.focus(), 100);
    });

    // Close Search
    function closeSearch() {
        searchState.isOpen = false;
        searchOverlay.classList.remove('active');
        searchInput.value = '';
        if (resultsArea) resultsArea.innerHTML = '';
        if (suggestionsArea) suggestionsArea.style.display = 'block';
        // Cancel any pending fetch
        if (searchState.controller) {
            searchState.controller.abort();
            searchState.controller = null;
        }
    }

    searchClose.addEventListener('click', closeSearch);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchState.isOpen) {
            closeSearch();
        }
    });

    // ── Highlight matched text ──────────────────────────────────────────────
    function highlightMatch(text, query) {
        if (!query) return escapeHTML(text);
        const safe = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${safe})`, 'gi');
        return escapeHTML(text).replace(
            new RegExp(`(${safe.replace(/&/g,'&amp;').replace(/</g,'&lt;')})`, 'gi'),
            '<span class="search-highlight">$1</span>'
        );
    }

    // XSS-safe — use shared version if common.js loaded it, else local copy
    function escapeHTML(str) {
        if (typeof window.escapeHTML === 'function') return window.escapeHTML(str);
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    // ── Render states ───────────────────────────────────────────────────────
    function showLoading() {
        if (!resultsArea) return;
        resultsArea.innerHTML = `
            <div style="text-align:center; padding: 30px; width:100%; grid-column: 1 / -1;">
                <div style="display:inline-block; width:32px; height:32px; border:3px solid #e0e7ff;
                     border-top-color:#667eea; border-radius:50%; animation:spin 0.7s linear infinite;"></div>
                <p style="color:#666; font-family:'Nunito',sans-serif; margin-top:12px;">Searching...</p>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        `;
    }

    function showNoResults(query) {
        if (!resultsArea) return;
        resultsArea.innerHTML = `
            <div style="text-align:center; padding: 20px; width:100%; grid-column: 1 / -1;">
                <i class="fas fa-search" style="font-size: 2rem; color: #d1d1e0; margin-bottom: 10px;"></i>
                <p style="color: #666; font-family: 'Nunito', sans-serif;">
                    No products found for "<strong>${escapeHTML(query)}</strong>"
                </p>
            </div>
        `;
    }

    function showError() {
        if (!resultsArea) return;
        resultsArea.innerHTML = `
            <div style="text-align:center; padding: 20px; width:100%; grid-column: 1 / -1;">
                <i class="fas fa-wifi" style="font-size: 2rem; color: #d1d1e0; margin-bottom: 10px;"></i>
                <p style="color: #666; font-family: 'Nunito', sans-serif;">
                    Could not connect to server. Please try again.
                </p>
            </div>
        `;
    }

    // ── Live API Search ─────────────────────────────────────────────────────
    async function performSearch(query) {
        if (!resultsArea || !suggestionsArea) return;

        if (query.length < 2) {
            resultsArea.innerHTML = '';
            suggestionsArea.style.display = 'block';
            return;
        }

        suggestionsArea.style.display = 'none';
        showLoading();

        // Cancel previous in-flight request
        if (searchState.controller) searchState.controller.abort();
        searchState.controller = new AbortController();

        try {
            const res = await fetch(
                `${API_BASE}/api/products/search?q=${encodeURIComponent(query)}`,
                { signal: searchState.controller.signal }
            );

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const products = data.products || [];

            if (products.length === 0) {
                showNoResults(query);
                return;
            }

            resultsArea.innerHTML = products.map(item => `
                <a href="collections.html" class="search-result-card">
                    <img src="${escapeHTML(item.image || '')}"
                         alt="${escapeHTML(item.name)}"
                         class="search-result-img"
                         onerror="this.src='images/placeholder.png'">
                    <div class="search-result-info">
                        <h5>${highlightMatch(item.name, query)}</h5>
                        <p>&#8377;${item.price}
                            ${item.original_price && item.original_price > item.price
                                ? `<span style="text-decoration:line-through; color:#999; font-size:0.85em; margin-left:4px;">&#8377;${item.original_price}</span>`
                                : ''}
                        </p>
                        ${item.badge ? `<span style="font-size:0.75em; color:#667eea; font-weight:600;">${escapeHTML(item.badge)}</span>` : ''}
                    </div>
                </a>
            `).join('');

        } catch (err) {
            if (err.name === 'AbortError') return; // Request was intentionally cancelled
            console.error('Search API error:', err);
            showError();
        }
    }

    // ── Debounce ─────────────────────────────────────────────────────────────
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Handle Input
    searchInput.addEventListener('input', debounce((e) => {
        performSearch(e.target.value.trim());
    }, 300));

    // Handle tags click
    document.querySelectorAll('.search-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            const term = e.target.textContent;
            searchInput.value = term;
            performSearch(term);
        });
    });
});
