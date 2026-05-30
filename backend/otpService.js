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
    replyTo: 'brainygrasp@gmail.com',
    to: email,
    subject: 'BrainyGrasp — Your One-Time Password (OTP)',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4280ca 0%, #2d5fa0 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 32px; font-family: Arial, sans-serif;">brainy<span style="color:#ffc107;">grasp</span></h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Where Learning Meets Play!</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
          <h2 style="color: #1e1e2e; margin: 0 0 10px 0; font-size: 20px;">Your One-Time Password</h2>
          <p style="color: #555; margin: 0 0 20px 0; font-size: 14px;">Use this OTP to verify your identity on BrainyGrasp.</p>
          <div style="background: white; border: 2px dashed #4280ca; padding: 24px; border-radius: 10px; text-align: center; margin: 0 0 20px 0;">
            <span style="font-size: 40px; font-weight: bold; color: #4280ca; letter-spacing: 10px;">${otp}</span>
          </div>
          <p style="color: #666; margin: 0; line-height: 1.6; font-size: 14px;">
            This OTP is valid for <strong>10 minutes</strong>. Please do not share this code with anyone for security reasons.
          </p>
        </div>
        
        <div style="text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
          <p style="margin: 0 0 6px;">If you didn't request this OTP, please ignore this email.</p>
          <p style="margin: 0 0 6px;">For support, contact us at <a href="mailto:brainygrasp@gmail.com" style="color:#4280ca;">brainygrasp@gmail.com</a></p>
          <p style="margin: 0;">© 2026 BrainyGrasp Learning Pvt. Ltd. | 162, Tiruppur road, Kangayam-638701, Tamil Nadu</p>
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
