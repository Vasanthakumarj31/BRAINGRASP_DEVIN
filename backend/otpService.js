require('dotenv').config();

// ── Startup validation ────────────────────────────────────────────────────
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  throw new Error(
    '❌ Missing required env vars: EMAIL_USER and EMAIL_PASS must be set in .env'
  );
}

// ── Email sender: Resend (production) or Nodemailer/Gmail (local dev) ────
const USE_RESEND = !!process.env.RESEND_API_KEY;

// ── Resend HTTP API sender ────────────────────────────────────────────────
async function sendViaResend(email, otp) {
  const FROM = process.env.EMAIL_FROM || 'BrainyGrasp <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: 'BrainyGrasp — Your One-Time Password (OTP)',
      html: buildEmailHTML(otp)
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ Resend API error: ${res.status} ${err}`);
    return false;
  }

  const data = await res.json();
  console.log(`✅ OTP email sent via Resend to ${email}: ${data.id}`);
  return true;
}

// ── Nodemailer SMTP sender (local dev fallback) ───────────────────────────
async function sendViaNodemailer(email, otp) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Use SSL/TLS on port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10000,
    socketTimeout: 10000
  });

  try {
    const result = await transporter.sendMail({
      from: `"BrainyGrasp" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to: email,
      subject: 'BrainyGrasp — Your One-Time Password (OTP)',
      html: buildEmailHTML(otp)
    });
    console.log(`✅ OTP email sent via Gmail SMTP to ${email}: ${result.messageId}`);
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

// ── Shared HTML email template ────────────────────────────────────────────
function buildEmailHTML(otp) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #4280ca 0%, #2d5fa0 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
        <h1 style="color: white; margin: 0; font-size: 32px;">brainy<span style="color:#ffc107;">grasp</span></h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Where Learning Meets Play!</p>
      </div>
      <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
        <h2 style="color: #1e1e2e; margin: 0 0 10px 0; font-size: 20px;">Your One-Time Password</h2>
        <p style="color: #555; margin: 0 0 20px 0; font-size: 14px;">Use this OTP to verify your identity on BrainyGrasp.</p>
        <div style="background: white; border: 2px dashed #4280ca; padding: 24px; border-radius: 10px; text-align: center; margin: 0 0 20px 0;">
          <span style="font-size: 40px; font-weight: bold; color: #4280ca; letter-spacing: 10px;">${otp}</span>
        </div>
        <p style="color: #666; margin: 0; line-height: 1.6; font-size: 14px;">
          This OTP is valid for <strong>10 minutes</strong>. Do not share this code with anyone.
        </p>
      </div>
      <div style="text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
        <p style="margin: 0 0 6px;">If you didn't request this OTP, please ignore this email.</p>
        <p style="margin: 0 0 6px;">Support: <a href="mailto:brainygrasp@gmail.com" style="color:#4280ca;">brainygrasp@gmail.com</a></p>
        <p style="margin: 0;">© 2026 BrainyGrasp Learning Pvt. Ltd.</p>
      </div>
    </div>
  `;
}

// ── Send OTP via Email ────────────────────────────────────────────────────
async function sendOTPEmail(email, otp) {
  if (USE_RESEND) {
    console.log('📨 Sending OTP via Resend API...');
    return sendViaResend(email, otp);
  }
  console.log('📨 Sending OTP via Gmail SMTP (local dev)...');
  return sendViaNodemailer(email, otp);
}

// ── Send OTP via SMS (Twilio — stub) ─────────────────────────────────────
async function sendOTPSMS(phone, otp) {
  try {
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


