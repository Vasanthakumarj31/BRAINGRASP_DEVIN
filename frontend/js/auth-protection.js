/* ============================================================
   auth-protection.js – BrainyGrasp Page Protection System
   Protects checkout and other protected pages from unauthorized access
   ============================================================ */

// ── Page Protection ───────────────────────────────────────────────────────
function protectPage() {
    // Check if user is authenticated
    if (!window.AuthUnified?.isAuthenticated()) {
        // Save current page for redirect after login
        const currentPage = window.location.pathname + window.location.search;
        localStorage.setItem('redirectAfterLogin', currentPage);
        
        // Redirect to login with message
        alert("Please sign in to access this page.");
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// ── Initialize Protection ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Wait for AuthUnified to be available
    const checkAuth = () => {
        if (window.AuthUnified) {
            protectPage();
        } else {
            // If AuthUnified not loaded yet, wait a bit and check again
            setTimeout(checkAuth, 100);
        }
    };
    
    checkAuth();
});

// ── Export for use in other scripts ───────────────────────────────────────
window.AuthProtection = {
    protectPage
};
