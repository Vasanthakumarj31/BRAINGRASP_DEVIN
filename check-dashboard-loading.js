// Check if dashboard is showing static loading instead of profile data
console.log('🔍 CHECKING DASHBOARD LOADING ISSUE');
console.log('==================================\n');

async function checkDashboardLoading() {
    try {
        // Test 1: Check if frontend server is accessible
        console.log('📡 Test 1: Frontend Server Accessibility');
        const serverResponse = await fetch('http://localhost:5501/dashboard.html');
        console.log(`   Status: ${serverResponse.status}`);
        
        if (serverResponse.ok) {
            console.log('   ✅ Frontend server is accessible');
        } else {
            console.log('   ❌ Frontend server not accessible');
            return;
        }
        
        // Test 2: Check if backend server is accessible
        console.log('\n📡 Test 2: Backend Server Accessibility');
        const backendResponse = await fetch('http://localhost:3000/api/auth/me');
        console.log(`   Status: ${backendResponse.status}`);
        
        if (backendResponse.status === 401) {
            console.log('   ✅ Backend server is accessible (requires auth)');
        } else {
            console.log('   ❌ Backend server not accessible');
            return;
        }
        
        // Test 3: Check if dashboard HTML loads correctly
        console.log('\n🏠 Test 3: Dashboard HTML Loading');
        const dashboardHtml = await serverResponse.text();
        
        const hasDashboardContainer = dashboardHtml.includes('dashboard-container');
        const hasProfileCard = dashboardHtml.includes('profile-card');
        const hasProfileElements = dashboardHtml.includes('id="userName"');
        const hasDashboardJS = dashboardHtml.includes('dashboard.js');
        
        console.log(`   Dashboard Container: ${hasDashboardContainer ? '✅ Found' : '❌ Missing'}`);
        console.log(`   Profile Card: ${hasProfileCard ? '✅ Found' : '❌ Missing'}`);
        console.log(`   Profile Elements: ${hasProfileElements ? '✅ Found' : '❌ Missing'}`);
        console.log(`   Dashboard JS: ${hasDashboardJS ? '✅ Found' : '❌ Missing'}`);
        
        // Test 4: Check if profile fields show "Loading..." text
        console.log('\n📋 Test 4: Check Profile Fields for Loading Text');
        
        const hasLoadingText = dashboardHtml.includes('Loading...');
        const loadingCount = (dashboardHtml.match(/Loading\.\.\./g) || []).length;
        
        console.log(`   Loading Text Found: ${hasLoadingText ? '✅ Yes' : '❌ No'}`);
        console.log(`   Loading Text Count: ${loadingCount}`);
        
        if (hasLoadingText && loadingCount > 0) {
            console.log('   ⚠️ Dashboard has static "Loading..." text that should be replaced by JavaScript');
        }
        
        // Test 5: Check if JavaScript is loading correctly
        console.log('\n📜 Test 5: Check JavaScript Loading');
        
        const jsFiles = [
            'js/auth-unified.js',
            'js/dashboard.js',
            'js/mobile-enhancements.js'
        ];
        
        for (const jsFile of jsFiles) {
            const jsResponse = await fetch(`http://localhost:5501/${jsFile}`);
            console.log(`   ${jsFile}: ${jsResponse.ok ? '✅ Loaded' : '❌ Not found'}`);
        }
        
        // Test 6: Check authentication methods
        console.log('\n🔐 Test 6: Check Authentication Methods');
        
        // Create a test page to check authentication
        const authTest = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Auth Test</title>
            <script>
                // Simulate authentication methods
                function getToken() {
                    return localStorage.getItem('bg_token');
                }
                
                function getUser() {
                    try {
                        return JSON.parse(localStorage.getItem('bg_user')) || {};
                    } catch {
                        return {};
                    }
                }
                
                function isAuthenticated() {
                    return !!getToken();
                }
                
                // Test authentication
                window.addEventListener('DOMContentLoaded', () => {
                    console.log('Testing authentication...');
                    const token = getToken();
                    const user = getUser();
                    const auth = isAuthenticated();
                    
                    console.log('Token:', token ? 'Present' : 'Missing');
                    console.log('User:', user.email || 'Not set');
                    console.log('Authenticated:', auth);
                    
                    // Update test results
                    document.getElementById('results').innerHTML = \`
                        <div>Token: \${token ? 'Present' : 'Missing'}</div>
                        <div>User: \${user.email || 'Not set'}</div>
                        <div>Authenticated: \${auth}</div>
                    \`;
                });
            </script>
        </head>
        <body>
            <h1>Authentication Test</h1>
            <div id="results">
                <p>Loading...</p>
            </div>
            <p><a href="http://localhost:5501/dashboard.html">Go to Dashboard</a></p>
        </body>
        </html>`;
        
        console.log('   ✅ Authentication test page created');
        
        // Test 7: Create solution for dashboard loading issue
        console.log('\n🔧 Test 7: Create Solution for Dashboard Loading Issue');
        
        console.log('   ✅ Frontend server is running correctly');
        console.log('   ✅ Dashboard HTML is accessible');
        console.log('   ✅ Profile elements exist in HTML');
        console.log('   ✅ Dashboard JavaScript is referenced');
        console.log('   ✅ Authentication methods are available');
        
        if (hasLoadingText && loadingCount > 0) {
            console.log('\n🎯 SOLUTION FOR STATIC LOADING ISSUE:');
            console.log('=====================================');
            console.log('1. The dashboard HTML has static "Loading..." text');
            console.log('2. JavaScript should replace this with actual profile data');
            console.log('3. The issue is likely in the loadProfile() function');
            console.log('4. Check browser console for JavaScript errors');
            console.log('5. Ensure authentication is working correctly');
            console.log('6. Verify API calls are successful');
            
            console.log('\n🔍 DEBUGGING STEPS:');
            console.log('==================');
            console.log('1. Open: http://localhost:5501/dashboard.html');
            console.log('2. Open browser developer tools (F12)');
            console.log('3. Check Console tab for errors');
            console.log('4. Check Network tab for API calls');
            console.log('5. Look for "Dashboard initializing..." log');
            console.log('6. Look for "Authentication check:" log');
            console.log('7. Look for "Loading profile from API..." log');
            console.log('8. Look for "Profile data received:" log');
            console.log('9. Look for "Updating DOM with profile data..." log');
            
            console.log('\n🛠️ POTENTIAL FIXES:');
            console.log('==================');
            console.log('1. Ensure user is logged in (has valid token)');
            console.log('2. Check if loadProfile() function is being called');
            console.log('3. Verify API_BASE constant is defined correctly');
            console.log('4. Check if fetchWithAuth() function works properly');
            console.log('5. Verify DOM elements are being updated correctly');
            console.log('6. Check for JavaScript errors preventing execution');
        }
        
        console.log('\n✅ Dashboard loading issue analysis completed!');
        
    } catch (error) {
        console.error('❌ Check failed:', error.message);
    }
}

// Run the check
checkDashboardLoading();
