const http = require('http');

// Get demo OTP for email
function getDemoOTP(method, value) {
  const postData = JSON.stringify({ method, value });
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/request-otp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🔢 Getting Demo OTPs...\n');

  try {
    // Get OTP for email
    const emailResult = await getDemoOTP('email', 'test@example.com');
    console.log('📧 Email OTP:');
    console.log(`   Success: ${emailResult.success}`);
    console.log(`   Demo OTP: ${emailResult.otp_demo}`);
    console.log(`   Message: ${emailResult.message || 'N/A'}\n`);

    // Get OTP for phone
    const phoneResult = await getDemoOTP('phone', '9876543210');
    console.log('📱 Phone OTP:');
    console.log(`   Success: ${phoneResult.success}`);
    console.log(`   Demo OTP: ${phoneResult.otp_demo}`);
    console.log(`   Message: ${phoneResult.message || 'N/A'}\n`);

    console.log('✅ Use these OTPs to sign in!');
    console.log('📝 Instructions:');
    console.log('   1. Go to http://localhost:5501/login.html');
    console.log('   2. Enter your email or phone number');
    console.log('   3. Click "Send OTP"');
    console.log('   4. Enter the demo OTP shown above');
    console.log('   5. Click "Verify & Continue"');

  } catch (error) {
    console.error('❌ Error getting demo OTP:', error.message);
  }
}

main();
