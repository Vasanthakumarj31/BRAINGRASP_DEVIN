/* ============================================================
   dashboard-new.js – Simplified Dashboard (Profile + Orders)
   ============================================================ */

const API_BASE = (window.BG_CONFIG && window.BG_CONFIG.API_BASE) || 'http://localhost:3000';

// 1. Initial Load & Auth check
const checkAuth = () => {
    if (!localStorage.getItem('bg_token')) window.location.href = 'login.html';
};

async function loadData() {
    try {
        const token = localStorage.getItem('bg_token');
        const res = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await res.json();
        
        // Update dashboard header with user's first name
        const dashTitle = document.getElementById('dashboardWelcomeTitle');
        const dashSub = document.getElementById('dashboardWelcomeSub');
        if (dashTitle && user.name) dashTitle.textContent = `Welcome back, ${user.name.split(' ')[0]}! 👋`;
        if (dashSub) dashSub.textContent = `Manage your profile and track your orders`;

        // Update profile UI
        document.getElementById('profileName').textContent = user.name || 'User';
        document.getElementById('profileEmail').textContent = user.email;
        document.getElementById('profilePhone').textContent = user.phone || 'Not set';
        document.getElementById('profileCity').textContent = user.city || 'Not set';
        document.getElementById('profileState').textContent = user.state || 'Not set';
        document.getElementById('profileAvatar').textContent = user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : 'U';

        localStorage.setItem('bg_user', JSON.stringify(user));

        // Load orders
        await loadOrders(token);
    } catch (err) {
        console.error("Data fetch failed", err);
        showToast('Failed to load profile', 'error');
    }
}

async function loadOrders(token) {
    try {
        const res = await fetch(`${API_BASE}/api/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to fetch orders');
        
        const orders = await res.json();
        
        // Separate orders by status
        const currentOrders = orders.filter(o => o.status && o.status !== 'Delivered');
        const historyOrders = orders.filter(o => o.status === 'Delivered' || !o.status);

        renderOrders(currentOrders, 'current');
        renderOrders(historyOrders, 'history');
    } catch (err) {
        console.error('Orders fetch error:', err);
        document.getElementById('currentOrdersList').innerHTML = '<p style="color:#999;">Unable to load orders. Please try again later.</p>';
        document.getElementById('historyOrdersList').innerHTML = '<p style="color:#999;">Unable to load order history. Please try again later.</p>';
    }
}

function renderOrders(orders, type) {
    const container = type === 'current' ? document.getElementById('currentOrdersList') : document.getElementById('historyOrdersList');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `<p style="color: var(--text-light); text-align: center; padding: 30px 0;">
            <i class="fas fa-inbox" style="font-size: 2rem; color: #ccc; display: block; margin-bottom: 10px;"></i>
            No ${type === 'current' ? 'current' : 'past'} orders yet.
        </p>`;
        return;
    }

    container.innerHTML = orders.map(order => {
        const items = order.items ? (typeof order.items === 'string' ? JSON.parse(order.items) : order.items) : [];
        const statusClass = getStatusClass(order.status);
        const statusText = order.status || 'Pending';
        const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
        
        return `
            <div class="order-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div class="order-id">
                            Order #${order.id}
                            <span class="order-status ${statusClass}">${statusText}</span>
                        </div>
                        <div class="order-date">
                            <i class="fas fa-calendar-alt"></i> ${orderDate}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.2rem; font-weight: 800; color: #333;">₹${order.total || 0}</div>
                        <div style="font-size: 0.8rem; color: #999;">${items.length} item${items.length !== 1 ? 's' : ''}</div>
                    </div>
                </div>
                
                <div class="order-items">
                    ${items.map(item => `
                        <div class="order-item-line">
                            ${item.name} <span style="color: #999;">x${item.quantity || 1}</span> - <strong>₹${item.price}</strong>
                        </div>
                    `).join('')}
                </div>

                ${order.full_name ? `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 0.85rem; color: #666;">
                    <i class="fas fa-map-marker-alt" style="color: #667eea;"></i>
                    <strong>${order.full_name}</strong><br>
                    ${order.line1}${order.line2 ? ', ' + order.line2 : ''}<br>
                    ${order.city}, ${order.state} - ${order.pincode}
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function getStatusClass(status) {
    if (!status) return 'status-placed';
    if (status === 'Delivered') return 'status-delivered';
    if (status === 'Shipped') return 'status-shipped';
    return 'status-placed';
}

function switchOrderTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.order-tab').forEach(btn => {
        btn.style.color = '#b2bec3';
        btn.style.borderBottom = 'none';
    });
    const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
    activeBtn.style.color = '#667eea';
    activeBtn.style.borderBottom = '3px solid #667eea';

    // Update sections
    if (tab === 'current') {
        document.getElementById('currentOrdersSection').style.display = 'block';
        document.getElementById('historyOrdersSection').style.display = 'none';
    } else {
        document.getElementById('currentOrdersSection').style.display = 'none';
        document.getElementById('historyOrdersSection').style.display = 'block';
    }
}

function switchOrderTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.order-tab').forEach(btn => {
        btn.style.color = '#b2bec3';
        btn.style.borderBottom = 'none';
    });
    const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
    activeBtn.style.color = '#667eea';
    activeBtn.style.borderBottom = '3px solid #667eea';

    // Update sections
    if (tab === 'current') {
        document.getElementById('currentOrdersSection').style.display = 'block';
        document.getElementById('historyOrdersSection').style.display = 'none';
    } else {
        document.getElementById('currentOrdersSection').style.display = 'none';
        document.getElementById('historyOrdersSection').style.display = 'block';
    }
}

// 2. Toast helper
function showToast(message, type = 'success') {
    const toast = document.getElementById('dashToast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// 3. Modal Controls
const modal = document.getElementById('profileEditModal');

const openModal = () => {
    const user = JSON.parse(localStorage.getItem('bg_user')) || {};

    // Pre-fill all fields
    document.getElementById('editName').value    = user.name    || '';
    document.getElementById('editPhone').value   = user.phone   || '';
    document.getElementById('editAddress').value = user.address || '';
    document.getElementById('editCity').value    = user.city    || '';
    document.getElementById('editState').value   = user.state   || '';
    document.getElementById('editPincode').value = user.pincode || '';

    // Set gender radio
    if (user.gender) {
        const radio = document.querySelector(`input[name="gender"][value="${user.gender}"]`);
        if (radio) radio.checked = true;
    }

    modal.style.display = 'flex';
    document.getElementById('editName').focus();
};

const closeModal = () => modal.style.display = 'none';

// Close on backdrop click
function handleModalBackdrop(e) {
    if (e.target === modal) closeModal();
}

// 4. Form Submission
document.getElementById('profileEditForm').onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('saveProfileBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const formData = Object.fromEntries(new FormData(e.target));

    try {
        const res = await fetch(`${API_BASE}/api/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('bg_token')}`
            },
            body: JSON.stringify(formData)
        });

        const data = await res.json();

        if (res.ok && data.success) {
            // Update cached user
            if (data.user) localStorage.setItem('bg_user', JSON.stringify(data.user));
            closeModal();
            await loadData();
            showToast('✅ Profile updated successfully!');
        } else {
            showToast(data.error || 'Update failed. Please try again.', 'error');
        }
    } catch (err) {
        console.error('Profile update error:', err);
        showToast('❌ Server error. Please try again.', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Changes';
    }
};

// Event Listeners
document.getElementById('editProfileBtn').onclick = openModal;
document.getElementById('refreshBtn').onclick = loadData;
document.getElementById('logoutBtn').onclick = () => {
    localStorage.removeItem('bg_token');
    localStorage.removeItem('bg_user');
    localStorage.removeItem('bg_cart');
    localStorage.removeItem('redirectAfterLogin');
    localStorage.removeItem('postProfileRedirect');
    window.location.href = 'index.html';
};

// Run
checkAuth();
loadData();
