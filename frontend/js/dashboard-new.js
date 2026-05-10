/* ============================================================
   dashboard-new.js – Dashboard Logic
   ============================================================ */

const API_BASE = (window.BG_CONFIG && window.BG_CONFIG.API_BASE) || 'http://localhost:3000';

// 1. Initial Load & Auth check
const checkAuth = () => {
    if (!localStorage.getItem('bg_token')) window.location.href = 'login.html';
};

async function loadData() {
    try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('bg_token')}` }
        });
        const user = await res.json();
        
        // Update dashboard header with user's first name
        const dashTitle = document.getElementById('dashboardWelcomeTitle');
        const dashSub = document.getElementById('dashboardWelcomeSub');
        if (dashTitle && user.name) dashTitle.textContent = `Welcome back, ${user.name.split(' ')[0]}! 👋`;
        if (dashSub) dashSub.textContent = `Here's your account overview – ${user.email}`;

        // Update UI
        document.getElementById('profileName').textContent = user.name || 'User';
        document.getElementById('profileEmail').textContent = user.email;
        document.getElementById('profilePhone').textContent = user.phone || 'Not set';
        document.getElementById('profileCity').textContent = user.city || 'Not set';
        document.getElementById('profileState').textContent = user.state || 'Not set';
        document.getElementById('profileAvatar').textContent = user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : 'U';

        // Completion percentage
        const fields = [user.name, user.phone, user.city, user.state, user.address, user.gender, user.pincode];
        const filled = fields.filter(f => f && f.trim() !== '').length;
        document.getElementById('profileCompletion').textContent = `${Math.round((filled/7)*100)}%`;

        // Days active
        if (user.created_at) {
            const days = Math.floor((Date.now() - new Date(user.created_at)) / 86400000);
            const daysEl = document.getElementById('daysActive');
            if (daysEl) daysEl.textContent = days;
        }

        // Activity List
        document.getElementById('activityList').innerHTML = `
            <div class="activity-item">
                <small style="color: #f5576c; font-weight: 800;">JUST NOW</small>
                <div style="font-weight: 600;">Signed in to BrainyGrasp Dashboard</div>
            </div>
            ${user.profile_completed ? `<div class="activity-item">
                <small style="color: #667eea; font-weight: 800;">EARLIER</small>
                <div style="font-weight: 600;">Profile completed</div>
            </div>` : ''}
            <div class="activity-item">
                <small style="color: #00b894; font-weight: 800;">${user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN') : 'Recently'}</small>
                <div style="font-weight: 600;">Account created</div>
            </div>
        `;

        localStorage.setItem('bg_user', JSON.stringify(user));
    } catch (err) {
        console.error("Data fetch failed", err);
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
            method: 'POST',
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
            await loadData();           // Refresh all dashboard fields
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
    // We already have a custom modal logic, but dashboard uses standard confirm. Let's upgrade it to not use confirm.
    // Instead of doing another modal right here, let's just make it sign out nicely. We'll show a toast.
    // However, keeping standard confirm is okay for logout, or we can just log them out directly. Let's log them out directly on click.
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
