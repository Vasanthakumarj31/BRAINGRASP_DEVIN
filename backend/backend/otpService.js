require('dotenv').config();

// ── Shared HTML email template ────────────────────────────────────────────
function buildEmailHTML(otp) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #FF6B35 0%, #E85520 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
        <h1 style="color: white; margin: 0; font-size: 32px;">brainy<span style="color:#FFE66D;">grasp</span></h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Where Learning Meets Play!</p>
      </div>
      <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
        <h2 style="color: #1e1e2e; margin: 0 0 10px 0; font-size: 20px;">Your One-Time Password</h2>
        <p style="color: #555; margin: 0 0 20px 0; font-size: 14px;">Use this OTP to verify your identity on BrainyGrasp.</p>
        <div style="background: white; border: 2px dashed #FF6B35; padding: 24px; border-radius: 10px; text-align: center; margin: 0 0 20px 0;">
          <span style="font-size: 40px; font-weight: bold; color: #FF6B35; letter-spacing: 10px;">${otp}</span>
        </div>
        <p style="color: #666; margin: 0; line-height: 1.6; font-size: 14px;">
          This OTP is valid for <strong>10 minutes</strong>. Do not share this code with anyone.
        </p>
      </div>
      <div style="text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
        <p style="margin: 0 0 6px;">If you didn't request this OTP, please ignore this email.</p>
        <p style="margin: 0 0 6px;">Support: <a href="mailto:brainygrasp@gmail.com" style="color:#FF6B35;">brainygrasp@gmail.com</a></p>
        <p style="margin: 0;">© 2026 BrainyGrasp Learning Pvt. Ltd.</p>
      </div>
    </div>
  `;
}

// ── Resend HTTP API sender ────────────────────────────────────────────────
async function sendViaResend(email, otp) {
  if (!process.env.RESEND_API_KEY) return false;
  try {
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
      console.warn(`⚠️ Resend API failed (${res.status}): ${err}`);
      return false;
    }

    const data = await res.json();
    console.log(`✅ OTP email sent via Resend to ${email}: ${data.id}`);
    return true;
  } catch (err) {
    console.warn(`⚠️ Resend error: ${err.message}`);
    return false;
  }
}

// ── Nodemailer SMTP sender (Gmail fallback) ───────────────────────────────
async function sendViaNodemailer(email, otp) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return false;

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
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
    console.warn(`⚠️ Gmail SMTP failed to ${email}: ${error.message}`);
    transporter.close();
    return false;
  }
}

// ── Send OTP via Email (Multi-tier Fallback) ──────────────────────────────
async function sendOTPEmail(email, otp) {
  // Tier 1: Try Resend if configured
  if (process.env.RESEND_API_KEY) {
    console.log('📨 Trying Resend API for OTP delivery...');
    const resendSuccess = await sendViaResend(email, otp);
    if (resendSuccess) return true;
    console.log('🔄 Resend failed or unconfigured. Falling back to Gmail SMTP...');
  }

  // Tier 2: Try Gmail SMTP
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📨 Sending OTP via Gmail SMTP...');
    const nodemailerSuccess = await sendViaNodemailer(email, otp);
    if (nodemailerSuccess) return true;
    console.log('🔄 Gmail SMTP failed. Checking dev mode fallback...');
  }

  // Tier 3: Local Dev / Non-Production Fallback
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    console.log(`\n==================================================`);
    console.log(`🔑 [DEV OTP FALLBACK] OTP for ${email}: ${otp}`);
    console.log(`==================================================\n`);
    return true;
  }

  console.error(`❌ All OTP delivery methods failed for ${email}`);
  return false;
}

// ── Send OTP via SMS (Stub) ───────────────────────────────────────────────
async function sendOTPSMS(phone, otp) {
  try {
    console.log(`📱 [SMS stub] OTP delivery attempted for phone ending in ...${String(phone).slice(-3)}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send OTP SMS:`, error.message);
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
