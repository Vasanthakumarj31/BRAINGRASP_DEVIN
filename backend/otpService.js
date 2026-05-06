require('dotenv').config();
const nodemailer = require('nodemailer');

// ── Startup validation ────────────────────────────────────────────────────
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  throw new Error(
    '❌ Missing required env vars: EMAIL_USER and EMAIL_PASS must be set in .env'
  );
}

// ── Transporter factory (nodemailer v8 best practice) ─────────────────────
// Creates a fresh SMTP transporter per send — avoids stale connection issues
// in long-running Node.js server processes.
function createEmailTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,        // STARTTLS on port 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: true  // Enforce valid TLS certificate
    }
  });
}

// ── Send OTP via Email ────────────────────────────────────────────────────
async function sendOTPEmail(email, otp) {
  const transporter = createEmailTransporter();

  const mailOptions = {
    from: `"BrainyGrasp" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'BrainyGrasp - Your One-Time Password (OTP)',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 32px;">BrainyGrasp</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Educational Toys for Every Child</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
          <h2 style="color: #333; margin: 0 0 10px 0;">Your OTP Code</h2>
          <div style="background: white; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="color: #666; margin: 0; line-height: 1.5;">
            This OTP is valid for <strong>10 minutes</strong>. Please do not share this code with anyone.
          </p>
        </div>
        
        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>If you didn't request this OTP, please ignore this email.</p>
          <p>© 2026 BrainyGrasp. All rights reserved.</p>
        </div>
      </div>
    `
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${email}: ${result.messageId}`);
    // Close the transporter connection cleanly after send
    transporter.close();
    return true;
  } catch (error) {
    console.error(`❌ Failed to send OTP email to ${email}`);
    console.error(`   Code:    ${error.code}`);
    console.error(`   Response:${error.responseCode} ${error.response}`);
    console.error(`   Message: ${error.message}`);
    transporter.close();
    return false;
  }
}

// ── Send OTP via SMS (Twilio — stub) ─────────────────────────────────────
async function sendOTPSMS(phone, otp) {
  try {
    // Uncomment and configure Twilio for real SMS:
    /*
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: `Your BrainyGrasp OTP is: ${otp}. Valid for 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
    */
    console.log(`📱 [SMS stub] OTP for ${phone}: ${otp}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send OTP SMS to ${phone}:`, error.message);
    return false;
  }
}

// ── Main OTP dispatcher ───────────────────────────────────────────────────
async function sendOTP(method, value, otp) {
  if (method === 'email') {
    return sendOTPEmail(value, otp);
  } else if (method === 'phone') {
    return sendOTPSMS(value, otp);
  }
  console.error(`❌ Unsupported OTP method: ${method}`);
  return false;
}

module.exports = {
  sendOTP,
  sendOTPEmail,
  sendOTPSMS
};
