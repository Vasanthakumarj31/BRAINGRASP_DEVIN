// Temporary SMTP diagnostic — run: node smtp-test.js
// Delete this file after fixing the issue.
require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('--- SMTP Diagnostic ---');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 'NOT SET');
console.log('Expected: 16 characters for a Google App Password');
console.log('');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((err, ok) => {
  if (err) {
    console.log('❌ SMTP FAILED');
    console.log('   Error code:     ', err.code);
    console.log('   Response code:  ', err.responseCode);
    console.log('   Message:        ', err.message);
    console.log('');

    if (err.responseCode === 535 || String(err.message).includes('535')) {
      console.log('🔎 DIAGNOSIS: Google rejected the App Password.');
      console.log('');
      console.log('HOW TO FIX:');
      console.log('1. Go to https://myaccount.google.com/security');
      console.log('2. Make sure 2-Step Verification is ENABLED.');
      console.log('3. Go to https://myaccount.google.com/apppasswords');
      console.log('4. Create a new App Password for "Mail" / "Other (custom name)".');
      console.log('5. Copy the 16-char password (no spaces).');
      console.log('6. Paste it into backend/.env as EMAIL_PASS=<16-char-password>');
      console.log('7. Restart the server: npm restart');
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.log('🔎 DIAGNOSIS: Cannot reach smtp.gmail.com — check network/firewall.');
    } else if (err.code === 'EAUTH') {
      console.log('🔎 DIAGNOSIS: Authentication failed — invalid email or App Password.');
    }
  } else {
    console.log('✅ SMTP connection verified — credentials are correct!');
    console.log('   The OTP email service is working properly.');
  }
  process.exit(0);
});
