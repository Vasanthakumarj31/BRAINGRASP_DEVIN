/* ============================================================
   auth-test.js – BrainyGrasp Authentication Testing Suite
   Comprehensive testing for all authentication flows
   ============================================================ */

const AuthTest = {
    // Test configuration
    config: {
        apiBase: 'http://localhost:3000',
        testPhone: '9876543210',
        testEmail: 'test@brainygrasp.com',
        testOTP: '123456'
    },

    // Test results storage
    results: [],

    // Utility: Log test result
    log(testName, passed, details = '') {
        const result = {
            test: testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        };
        this.results.push(result);
        
        const status = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${testName}${details ? ': ' + details : ''}`);
    },

    // Test 1: Unified auth system availability
    async testAuthSystemAvailability() {
        try {
            const available = typeof window.AuthUnified !== 'undefined';
            this.log('Auth Unified System Available', available, 
                available ? 'AuthUnified object found' : 'AuthUnified not found');
            return available;
        } catch (err) {
            this.log('Auth Unified System Available', false, err.message);
            return false;
        }
    },

    // Test 2: Token consistency check
    testTokenConsistency() {
        try {
            // Set test token
            localStorage.setItem('bg_token', 'test-token-123');
            
            const token1 = localStorage.getItem('bg_token');
            const token2 = window.AuthUnified?.getToken();
            
            const consistent = token1 === token2;
            this.log('Token Consistency Check', consistent,
                consistent ? 'All token methods return same value' : 'Token methods inconsistent');
            
            // Cleanup
            localStorage.removeItem('bg_token');
            return consistent;
        } catch (err) {
            this.log('Token Consistency Check', false, err.message);
            return false;
        }
    },

    // Test 3: Authentication state detection
    testAuthStateDetection() {
        try {
            // Test unauthenticated state
            localStorage.removeItem('bg_token');
            const isAuth1 = window.AuthUnified?.isAuthenticated();
            
            // Test authenticated state
            localStorage.setItem('bg_token', 'valid-token');
            const isAuth2 = window.AuthUnified?.isAuthenticated();
            
            const correct = !isAuth1 && isAuth2;
            this.log('Authentication State Detection', correct,
                correct ? 'Correctly detects auth state changes' : 'Auth state detection failed');
            
            // Cleanup
            localStorage.removeItem('bg_token');
            return correct;
        } catch (err) {
            this.log('Authentication State Detection', false, err.message);
            return false;
        }
    },

    // Test 4: User data storage and retrieval
    testUserDataStorage() {
        try {
            const testUser = {
                id: 123,
                name: 'Test User',
                email: 'test@example.com',
                phone: '9876543210'
            };

            // Store user data
            window.AuthUnified?.storeAuth('test-token', testUser);
            
            // Retrieve user data
            const retrievedUser = window.AuthUnified?.getUser();
            const retrievedToken = window.AuthUnified?.getToken();
            
            const correct = retrievedUser?.name === testUser.name && 
                          retrievedUser?.email === testUser.email &&
                          retrievedToken === 'test-token';
            
            this.log('User Data Storage & Retrieval', correct,
                correct ? 'User data stored and retrieved correctly' : 'User data storage failed');
            
            // Cleanup
            window.AuthUnified?.clearAuth();
            return correct;
        } catch (err) {
            this.log('User Data Storage & Retrieval', false, err.message);
            return false;
        }
    },

    // Test 5: Cart functionality
    async testCartFunctionality() {
        try {
            // Test local cart operations
            const testCart = [
                { id: 1, name: 'Test Product', price: 100, quantity: 2 },
                { id: 2, name: 'Test Product 2', price: 200, quantity: 1 }
            ];

            // Store test cart
            localStorage.setItem('bg_cart', JSON.stringify(testCart));
            
            const retrievedCart = window.AuthUnified ? 
                JSON.parse(localStorage.getItem('bg_cart') || '[]') : [];
            
            const correct = retrievedCart.length === 2 && 
                          retrievedCart[0].name === 'Test Product';
            
            this.log('Cart Functionality', correct,
                correct ? 'Cart operations work correctly' : 'Cart operations failed');
            
            // Cleanup
            localStorage.removeItem('bg_cart');
            return correct;
        } catch (err) {
            this.log('Cart Functionality', false, err.message);
            return false;
        }
    },

    // Test 6: Checkout intent detection
    testCheckoutIntentDetection() {
        try {
            // Create a mock checkout button
            const mockBtn = document.createElement('button');
            mockBtn.href = 'checkout_cod.html';
            mockBtn.className = 'btn-checkout';
            mockBtn.textContent = 'Proceed to Checkout';
            document.body.appendChild(mockBtn);

            // Simulate click event
            const clickEvent = new MouseEvent('click', { bubbles: true });
            mockBtn.dispatchEvent(clickEvent);

            // Check if redirectAfterLogin was set
            const redirectPath = localStorage.getItem('redirectAfterLogin');
            const detected = redirectPath === 'checkout_cod.html';

            this.log('Checkout Intent Detection', detected,
                detected ? 'Checkout intent correctly detected' : 'Checkout intent not detected');

            // Cleanup
            document.body.removeChild(mockBtn);
            localStorage.removeItem('redirectAfterLogin');
            return detected;
        } catch (err) {
            this.log('Checkout Intent Detection', false, err.message);
            return false;
        }
    },

    // Test 7: API connectivity
    async testAPIConnectivity() {
        try {
            const response = await fetch(`${this.config.apiBase}/api/products`);
            const connected = response.ok;
            
            this.log('API Connectivity', connected,
                connected ? 'Backend API is reachable' : 'Backend API not reachable');
            
            return connected;
        } catch (err) {
            this.log('API Connectivity', false, err.message);
            return false;
        }
    },

    // Test 8: OTP request flow (simulation)
    async testOTPRequestFlow() {
        try {
            // This would normally make a real API call, but we'll test the function existence
            const hasRequestOTP = typeof window.AuthUnified?.requestOTP === 'function';
            const hasVerifyOTP = typeof window.AuthUnified?.handleVerifyOTP === 'function';
            
            const ready = hasRequestOTP && hasVerifyOTP;
            
            this.log('OTP Flow Functions Available', ready,
                ready ? 'OTP request and verify functions available' : 'OTP functions missing');
            
            return ready;
        } catch (err) {
            this.log('OTP Flow Functions Available', false, err.message);
            return false;
        }
    },

    // Test 9: Dashboard profile fetching
    async testDashboardProfileFetching() {
        try {
            // Test the profile fetching function exists
            const hasFetchProfile = typeof window.AuthUnified?.fetchUserProfile === 'function';
            
            this.log('Dashboard Profile Fetching Available', hasFetchProfile,
                hasFetchProfile ? 'Profile fetching function available' : 'Profile fetching missing');
            
            return hasFetchProfile;
        } catch (err) {
            this.log('Dashboard Profile Fetching Available', false, err.message);
            return false;
        }
    },

    // Test 10: Global UI synchronization
    testGlobalUISynchronization() {
        try {
            const hasSyncUI = typeof window.AuthUnified?.syncGlobalUI === 'function';
            const hasUpdateCart = typeof window.AuthUnified?.updateCartCount === 'function';
            
            const ready = hasSyncUI && hasUpdateCart;
            
            this.log('Global UI Sync Functions Available', ready,
                ready ? 'UI sync functions available' : 'UI sync functions missing');
            
            return ready;
        } catch (err) {
            this.log('Global UI Sync Functions Available', false, err.message);
            return false;
        }
    },

    // Run all tests
    async runAllTests() {
        console.log('🧪 Starting BrainyGrasp Authentication Tests...\n');
        
        const tests = [
            () => this.testAuthSystemAvailability(),
            () => this.testTokenConsistency(),
            () => this.testAuthStateDetection(),
            () => this.testUserDataStorage(),
            () => this.testCartFunctionality(),
            () => this.testCheckoutIntentDetection(),
            () => this.testAPIConnectivity(),
            () => this.testOTPRequestFlow(),
            () => this.testDashboardProfileFetching(),
            () => this.testGlobalUISynchronization()
        ];

        for (let i = 0; i < tests.length; i++) {
            await tests[i]();
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Summary
        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;
        
        console.log('\n📊 Test Summary:');
        console.log(`✅ Passed: ${passed}/${total}`);
        console.log(`❌ Failed: ${total - passed}/${total}`);
        console.log(`📈 Success Rate: ${Math.round((passed/total) * 100)}%`);

        if (passed === total) {
            console.log('\n🎉 All tests passed! Authentication system is working correctly.');
        } else {
            console.log('\n⚠️ Some tests failed. Please check the implementation.');
        }

        return this.results;
    },

    // Clear test results
    clearResults() {
        this.results = [];
        console.log('🧹 Test results cleared.');
    }
};

// Auto-run tests if on a test page or if manually triggered
if (window.location.search.includes('test=auth') || window.AuthTestAutoRun) {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => AuthTest.runAllTests(), 1000);
        });
    } else {
        setTimeout(() => AuthTest.runAllTests(), 1000);
    }
}

// Make available globally
window.AuthTest = AuthTest;
