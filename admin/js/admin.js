const API_URL = 'http://localhost:3000/api';

// Check Auth State
const token = localStorage.getItem('adminToken');
const path = window.location.pathname;
const isLoginPage = path.includes('login');

if (!token && !isLoginPage) {
    window.location.href = '/login.html';
} else if (token && isLoginPage) {
    window.location.href = '/index.html';
}


// --- Login Page Logic ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorDiv = document.getElementById('loginError');
        errorDiv.style.display = 'none';
        
        const username = loginForm.username.value;
        const password = loginForm.password.value;

        try {
            const res = await fetch(`${API_URL}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (res.ok) {
                localStorage.setItem('adminToken', data.token);
                window.location.href = 'index.html';
            } else {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.style.display = 'block';
            }
        } catch (err) {
            errorDiv.textContent = 'Network error. Is the backend running?';
            errorDiv.style.display = 'block';
        }
    });
}

// --- Dashboard Logic ---
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('adminToken');
        window.location.href = 'login.html';
    });
}

// Fetch and display products
const productsTableBody = document.querySelector('#productsTable tbody');
async function loadProducts() {
    if (!productsTableBody) return;
    try {
        const res = await fetch(`${API_URL}/products`);
        const data = await res.json();
        
        productsTableBody.innerHTML = '';
        
        // Data comes grouped (trending, bestsellers, etc). Flatten it for the table.
        let allProducts = [];
        for (const group in data) {
            // Re-attach the group name to each product for display
            data[group].forEach(p => {
                p.group_name = group;
                allProducts.push(p);
            });
        }
        
        // Sort by ID descending (newest first)
        allProducts.sort((a, b) => b.id - a.id);

        allProducts.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.id}</td>
                <td class="product-img-cell"><img src="${p.image}" alt="${p.name}"></td>
                <td>${p.name}</td>
                <td><span style="text-transform: capitalize;">${p.group_name}</span></td>
                <td>₹${p.price}</td>
                <td>
                    <button class="btn-danger delete-btn" data-id="${p.id}">Delete</button>
                </td>
            `;
            productsTableBody.appendChild(tr);
        });

        // Attach delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', deleteProduct);
        });
    } catch (err) {
        console.error('Failed to load products:', err);
    }
}

// Delete Product
async function deleteProduct(e) {
    const id = e.target.dataset.id;
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        const res = await fetch(`${API_URL}/products/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (res.ok) {
            loadProducts(); // Reload table
        } else {
            alert('Failed to delete product. Your session may have expired.');
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('adminToken');
                window.location.href = 'login.html';
            }
        }
    } catch (err) {
        console.error('Error deleting product', err);
    }
}

// Add Product Form
const showAddFormBtn = document.getElementById('showAddFormBtn');
const cancelAddBtn = document.getElementById('cancelAddBtn');
const addProductSection = document.getElementById('addProductSection');
const addProductForm = document.getElementById('addProductForm');

if (showAddFormBtn) {
    showAddFormBtn.addEventListener('click', () => {
        addProductSection.style.display = 'block';
        showAddFormBtn.style.display = 'none';
    });
}

if (cancelAddBtn) {
    cancelAddBtn.addEventListener('click', () => {
        addProductSection.style.display = 'none';
        showAddFormBtn.style.display = 'block';
        addProductForm.reset();
    });
}

if (addProductForm) {
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addProductForm);
        const productData = Object.fromEntries(formData.entries());
        
        // Add defaults for empty optional fields
        if (!productData.originalPrice) productData.originalPrice = productData.price;
        if (!productData.save) productData.save = "0%";
        productData.reviews = 0;
        productData.offer = "Buy any 2 | Get FLAT 10% OFF";
        productData.sales = 0;
        productData.launchDate = new Date().toISOString().split('T')[0];
        
        try {
            const res = await fetch(`${API_URL}/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(productData)
            });
            
            if (res.ok) {
                addProductForm.reset();
                addProductSection.style.display = 'none';
                showAddFormBtn.style.display = 'block';
                loadProducts(); // Reload table
            } else {
                alert('Failed to add product. Your session may have expired.');
            }
        } catch (err) {
            console.error('Error adding product', err);
        }
    });
}

// Initial load
if (!isLoginPage) {
    loadProducts();
}
