/* ============================================================
   dashboard.js – BrainyGrasp Dashboard Module
   Handles: User profile display, order history, quick actions
   ============================================================ */

const API_BASE = (window.BG_CONFIG && window.BG_CONFIG.API_BASE) || 'http://localhost:3000';

// ── User/Auth Helpers ──────────────────────────────────────────────────────────
// Note: Changed to match standard localStorage keys used in your auth.js
function getToken() { return localStorage.getItem('bg_token'); }

function getUser() {
    try { 
        // Try to get user from storage, fallback to empty object
        return JSON.parse(localStorage.getItem('bg_user')) || {}; 
    } catch { 
        return {}; 
    }
}

function isAuthenticated() { return !!getToken(); }

function clearAuth() {
    localStorage.removeItem('bg_token');
    localStorage.removeItem('bg_user');
}

// ── API Helpers ──────────────────────────────────────────────────────────
async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers
        }
    });
    
    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            clearAuth();
            window.location.href = 'login.html';
        }
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
    }
    return res.json();
}

// ── Profile Editing ────────────────────────────────────────────────────────
function initProfileEditing() {
    const editBtn = document.getElementById('editProfileBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const profileForm = document.getElementById('profileForm');
    const profileInfo = document.getElementById('profileInfo');
    const profileEditForm = document.getElementById('profileEditForm');

    if (editBtn && cancelBtn && profileForm && profileInfo && profileEditForm) {
        // Show edit form
        editBtn.addEventListener('click', () => {
            showProfileEditForm();
        });

        // Hide edit form
        cancelBtn.addEventListener('click', () => {
            hideProfileEditForm();
        });

        // Handle form submission
        profileForm.addEventListener('submit', handleProfileSubmit);
    }
}

function showProfileEditForm() {
    const profileInfo = document.getElementById('profileInfo');
    const profileEditForm = document.getElementById('profileEditForm');
    
    // Hide profile info and show edit form
    profileInfo.style.display = 'none';
    profileEditForm.style.display = 'block';
    profileEditForm.classList.add('show');
    
    // Pre-fill form with current data
    preFillProfileForm();
}

function hideProfileEditForm() {
    const profileInfo = document.getElementById('profileInfo');
    const profileEditForm = document.getElementById('profileEditForm');
    
    // Show profile info and hide edit form
    profileInfo.style.display = 'block';
    profileEditForm.style.display = 'none';
    profileEditForm.classList.remove('show');
}

async function preFillProfileForm() {
    try {
        const user = await fetchWithAuth(`${API_BASE}/api/auth/me`);
        
        if (user) {
            // Fill form fields
            const nameInput = document.getElementById('editName');
            const phoneInput = document.getElementById('editPhone');
            const addressInput = document.getElementById('editAddress');
            const cityInput = document.getElementById('editCity');
            const stateInput = document.getElementById('editState');
            const pincodeInput = document.getElementById('editPincode');
            const countryInput = document.getElementById('editCountry');
            
            if (nameInput) nameInput.value = user.name || '';
            if (phoneInput) phoneInput.value = user.phone || '';
            if (addressInput) addressInput.value = user.address || '';
            if (cityInput) cityInput.value = user.city || '';
            if (stateInput) stateInput.value = user.state || '';
            if (pincodeInput) pincodeInput.value = user.pincode || '';
            if (countryInput) countryInput.value = user.country || 'India';
            
            // Set gender radio button
            if (user.gender) {
                const genderRadio = document.querySelector(`input[name="gender"][value="${user.gender}"]`);
                if (genderRadio) genderRadio.checked = true;
            }
        }
    } catch (error) {
        console.error('Failed to pre-fill profile form:', error);
    }
}

async function handleProfileSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const profileData = {
        name: formData.get('name'),
        gender: formData.get('gender'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        city: formData.get('city'),
        state: formData.get('state'),
        pincode: formData.get('pincode'),
        country: formData.get('country') || 'India'
    };
    
    // Validate required fields
    const requiredFields = ['name', 'gender', 'phone', 'address', 'city', 'state', 'pincode'];
    const missingFields = requiredFields.filter(field => !profileData[field]);
    
    if (missingFields.length > 0) {
        showProfileMessage('Please fill in all required fields', 'error');
        return;
    }
    
    // Show loading state
    const saveBtn = document.querySelector('.btn-save');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(profileData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            console.log('Profile saved successfully, reloading profile...');
            
            // Wait a moment for database to be fully updated
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Reload profile immediately after successful save
            try {
                await loadProfile();
                console.log('Profile reloaded successfully');
            } catch (error) {
                console.error('Error reloading profile:', error);
                // Try again after a short delay
                await new Promise(resolve => setTimeout(resolve, 1000));
                await loadProfile();
            }
            
            showPopup('success', 'Profile Saved!', 'Your profile information has been successfully saved to the database.', 'Awesome!', () => {
                // Hide edit form after popup is closed
                hideProfileEditForm();
            });
        } else {
            console.error('Profile save failed:', result);
            showProfileMessage(result.error || 'Failed to save profile', 'error');
        }
    } catch (error) {
        console.error('Profile save error:', error);
        showProfileMessage('Failed to save profile. Please try again.', 'error');
    } finally {
        // Restore button state
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

// ── Popup Notification System ─────────────────────────────────────────────────────
function showPopup(type, title, message, buttonText = 'OK', callback = null) {
    const popupContainer = document.getElementById('popupContainer');
    if (!popupContainer) return;

    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.className = `popup-overlay popup-${type}`;
    
    // Create popup modal
    const modal = document.createElement('div');
    modal.className = 'popup-modal';
    
    // Create popup icon
    const icon = document.createElement('div');
    icon.className = `popup-icon ${type}`;
    icon.innerHTML = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    
    // Create popup title
    const titleEl = document.createElement('h3');
    titleEl.className = 'popup-title';
    titleEl.textContent = title;
    
    // Create popup message
    const messageEl = document.createElement('p');
    messageEl.className = 'popup-message';
    messageEl.textContent = message;
    
    // Create popup button
    const button = document.createElement('button');
    button.className = 'popup-button';
    button.textContent = buttonText;
    button.onclick = () => {
        closePopup(overlay, callback);
    };
    
    // Assemble popup
    modal.appendChild(icon);
    modal.appendChild(titleEl);
    modal.appendChild(messageEl);
    modal.appendChild(button);
    overlay.appendChild(modal);
    
    // Add to container
    popupContainer.appendChild(overlay);
    
    // Show popup with animation
    setTimeout(() => {
        overlay.classList.add('show');
    }, 10);
    
    // Auto-close after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            closePopup(overlay, callback);
        }, 5000);
    }
}

function closePopup(overlay, callback) {
    if (!overlay) return;
    
    overlay.classList.remove('show');
    setTimeout(() => {
        overlay.remove();
        if (callback) callback();
    }, 300);
}

function showProfileMessage(message, type) {
    // Replace inline messages with popup notifications
    if (type === 'success') {
        showPopup('success', 'Success!', message, 'Great!');
    } else if (type === 'error') {
        showPopup('error', 'Error', message, 'Try Again');
    }
}

// ── Load Profile ────────────────────────────────────────────────────────────
async function loadProfile() {
    console.log('loadProfile() function called');
    
    // Wait for DOM to be ready
    if (document.readyState !== 'complete') {
        console.log('Waiting for DOM to be ready...');
        await new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve, { once: true });
            }
        });
    }
    
    const nameEl = document.getElementById('userName');
    const genderEl = document.getElementById('userGender');
    const phoneEl = document.getElementById('userPhone');
    const emailEl = document.getElementById('userEmail');
    const addressEl = document.getElementById('userAddress');
    const cityEl = document.getElementById('userCity');
    const stateEl = document.getElementById('userState');
    const pincodeEl = document.getElementById('userPincode');
    const countryEl = document.getElementById('userCountry');
    const createdEl = document.getElementById('userCreated');
    const profileStatusEl = document.getElementById('profileStatus');

    console.log('DOM elements found:', {
        nameEl: !!nameEl,
        phoneEl: !!phoneEl,
        emailEl: !!emailEl,
        addressEl: !!addressEl,
        cityEl: !!cityEl,
        stateEl: !!stateEl,
        pincodeEl: !!pincodeEl,
        countryEl: !!countryEl,
        createdEl: !!createdEl,
        profileStatusEl: !!profileStatusEl
    });

    try {
        console.log('Loading profile from API...');
        
        // Ensure DOM elements exist before proceeding
        if (!nameEl || !phoneEl || !emailEl) {
            console.error('Required DOM elements not found, retrying...');
            // Wait for DOM to be ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Re-get elements
            const retryNameEl = document.getElementById('userName');
            const retryPhoneEl = document.getElementById('userPhone');
            const retryEmailEl = document.getElementById('userEmail');
            
            if (!retryNameEl || !retryPhoneEl || !retryEmailEl) {
                throw new Error('Dashboard DOM elements not available');
            }
        }
        
        // Fetch complete user profile from API
        const user = await fetchWithAuth(`${API_BASE}/api/auth/me`);
        
        console.log('Profile data received:', user);
        
        if (user && user.id) {
            console.log('Updating DOM with profile data...');
            
            // Update all profile fields with validation
            const updates = [
                { el: document.getElementById('userName'), value: user.name || 'Not set', field: 'name' },
                { el: document.getElementById('userGender'), value: user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'Not set', field: 'gender' },
                { el: document.getElementById('userPhone'), value: user.phone || 'Not set', field: 'phone' },
                { el: document.getElementById('userEmail'), value: user.email || 'Not set', field: 'email' },
                { el: document.getElementById('userAddress'), value: user.address || 'Not set', field: 'address' },
                { el: document.getElementById('userCity'), value: user.city || 'Not set', field: 'city' },
                { el: document.getElementById('userState'), value: user.state || 'Not set', field: 'state' },
                { el: document.getElementById('userPincode'), value: user.pincode || 'Not set', field: 'pincode' },
                { el: document.getElementById('userCountry'), value: user.country || 'Not set', field: 'country' },
                { el: document.getElementById('userCreated'), value: user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN') : 'Unknown', field: 'created_at' }
            ];
            
            console.log('Updating DOM with profile data...');
            updates.forEach(update => {
                if (update.el) {
                    update.el.textContent = update.value;
                    console.log(`Updated ${update.field}:`, update.value);
                } else {
                    console.warn(`Element not found for field: ${update.field}`);
                }
            });
            
            // Force DOM update verification
            console.log('Verifying DOM updates...');
            const verificationUpdates = [
                { el: document.getElementById('userName'), value: user.name || 'Not set', field: 'name' },
                { el: document.getElementById('userPhone'), value: user.phone || 'Not set', field: 'phone' },
                { el: document.getElementById('userEmail'), value: user.email || 'Not set', field: 'email' },
                { el: document.getElementById('userAddress'), value: user.address || 'Not set', field: 'address' },
                { el: document.getElementById('userCity'), value: user.city || 'Not set', field: 'city' },
                { el: document.getElementById('userState'), value: user.state || 'Not set', field: 'state' },
                { el: document.getElementById('userPincode'), value: user.pincode || 'Not set', field: 'pincode' }
            ];
            
            verificationUpdates.forEach(update => {
                if (update.el) {
                    // Double-check the update
                    const currentValue = update.el.textContent;
                    if (currentValue !== update.value) {
                        console.warn(`DOM update failed for ${update.field}: expected "${update.value}", got "${currentValue}"`);
                        // Force update again
                        update.el.textContent = update.value;
                        console.log(`Force updated ${update.field}:`, update.value);
                    }
                }
            });
            
            // Update profile status
            const statusEl = document.getElementById('profileStatus');
            if (statusEl) {
                if (user.profile_completed) {
                    statusEl.textContent = '✅ Complete';
                    statusEl.className = 'profile-status complete';
                    console.log('Profile status: Complete');
                } else {
                    statusEl.textContent = '⚠️ Incomplete';
                    statusEl.className = 'profile-status incomplete';
                    console.log('Profile status: Incomplete');
                }
            } else {
                console.warn('Profile status element not found');
            }
            
            // Update localStorage user data
            localStorage.setItem('bg_user', JSON.stringify(user));
            console.log('Updated localStorage user data');
            
            // Verify updates were applied
            const verifyName = document.getElementById('userName')?.textContent;
            const verifyPhone = document.getElementById('userPhone')?.textContent;
            console.log('Verification - Name:', verifyName, 'Phone:', verifyPhone);
            
            if (verifyName === (user.name || 'Not set') && verifyPhone === (user.phone || 'Not set')) {
                console.log('✅ Profile loaded and DOM updated successfully');
            } else {
                console.warn('⚠️ DOM update verification failed');
            }
            
        } else {
            console.error('Invalid user data received from API:', user);
            throw new Error('Invalid user data from API');
        }
    } catch (error) {
        console.error('Failed to load profile:', error);
        
        // Fallback display with localStorage data
        const localUser = getUser();
        console.log('Using localStorage fallback:', localUser);
        
        const fallbackNameEl = document.getElementById('userName');
        const fallbackEmailEl = document.getElementById('userEmail');
        const fallbackStatusEl = document.getElementById('profileStatus');
        
        if (fallbackNameEl) fallbackNameEl.textContent = localUser.name || 'Unknown User';
        if (fallbackEmailEl) fallbackEmailEl.textContent = localUser.email || 'Not set';
        
        // Show error message for profile status
        if (fallbackStatusEl) {
            fallbackStatusEl.textContent = '❌ Error loading profile';
            fallbackStatusEl.className = 'profile-status error';
        }
        
        throw error; // Re-throw to let caller handle it
    }
}

// ── Order UI Helpers ──────────────────────────────────────────────────
function getStatusClass(status) {
    const s = (status || '').toLowerCase();
    if (s === 'delivered') return 'status-delivered';
    if (s === 'shipped') return 'status-shipped';
    if (s === 'processing') return 'status-processing';
    return 'status-placed';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { 
        day: 'numeric', month: 'short', year: 'numeric' 
    });
}

function formatPrice(amount) {
    return new Intl.NumberFormat('en-IN', { 
        style: 'currency', currency: 'INR', maximumFractionDigits: 0 
    }).format(amount || 0);
}

// ── Load Orders ─────────────────────────────────────────────────────
async function loadOrders() {
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;

    try {
        // Your server returns an array directly: [ {id:1...}, {id:2...} ]
        const orders = await fetchWithAuth(`${API_BASE}/api/orders`);

        if (!orders || orders.length === 0) {
            ordersList.innerHTML = `
                <div class="orders-empty" style="text-align:center; padding:40px;">
                    <i class="fas fa-box-open" style="font-size:40px; color:#ccc;"></i>
                    <p>No orders yet. Your cart is waiting!</p>
                    <a href="index.html" class="btn btn-primary">Start Shopping</a>
                </div>
            `;
            return;
        }

        ordersList.innerHTML = orders.map(order => {
            // Mapping items from the JSONB column in your Postgres DB
            const itemsHtml = (order.items || []).map(item => `
                <div class="order-item" style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:14px;">
                    <span>${item.name || 'Product'} <small>(x${item.quantity || 1})</small></span>
                    <span>${formatPrice(item.price)}</span>
                </div>
            `).join('');

            return `
                <div class="order-card" style="border:1px solid #edf2f7; border-radius:12px; padding:20px; margin-bottom:15px; background:#fff;">
                    <div class="order-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <div>
                            <span style="font-weight:700; color:#2d3748;">Order #${order.id}</span>
                            <div style="font-size:12px; color:#718096;">${formatDate(order.created_at)}</div>
                        </div>
                        <span class="status-badge ${getStatusClass(order.status)}" style="font-size:12px; font-weight:600; padding:4px 12px; border-radius:20px; background:#ebf8ff; color:#3182ce;">
                            ${order.status || 'Placed'}
                        </span>
                    </div>
                    <div class="order-items-box" style="background:#f7fafc; padding:12px; border-radius:8px; margin-bottom:15px;">
                        ${itemsHtml}
                    </div>
                    <div class="order-footer" style="display:flex; justify-content:space-between; align-items:center; font-weight:700;">
                        <span style="color:#4a5568;">Total Paid</span>
                        <span style="color:#0b74ff; font-size:18px;">${formatPrice(order.total)}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load orders:', err);
        ordersList.innerHTML = `<p style="color:red; text-align:center;">⚠️ Error loading orders.</p>`;
    }
}

// ── Quick Actions ────────────────────────────────────────────────────────
function initQuickActions() {
    // Scroll to orders
    document.getElementById('viewOrdersBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.orders-card')?.scrollIntoView({ behavior: 'smooth' });
    });

    // Refresh Orders
    document.getElementById('refreshOrdersBtn')?.addEventListener('click', () => {
        const list = document.getElementById('ordersList');
        if (list) list.innerHTML = '<div style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Refreshing...</div>';
        loadOrders();
    });

    // Logout
    document.getElementById('logoutQuickBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if(confirm("Are you sure you want to logout?")) {
            clearAuth();
            window.location.href = 'index.html';
        }
    });
}


// ── Initialization ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initializing...');
    
    // Check authentication using local methods
    const isAuth = isAuthenticated();
    console.log('Authentication check:', isAuth);
    
    if (isAuth) {
        console.log('User is authenticated, loading dashboard...');
        loadProfile();
        loadOrders();
        initQuickActions();        // Handles logout, refresh, and scroll-to-orders
        initProfileEditing();      // Handles edit form show/hide and profile save
    } else {
        console.log('User is not authenticated, showing login prompt...');
        // Not logged in: Show prompt
        const profileCard = document.querySelector('.profile-card .card-body');
        if (profileCard) {
            profileCard.innerHTML = `
                <div style="text-align:center; padding:20px;">
                    <p>Log in to view your profile and orders.</p>
                    <a href="login.html" class="btn btn-primary">Sign In</a>
                </div>
            `;
        }
    }
});