const nodemailer = require('nodemailer');

// Email configuration
const emailTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || 'vasanthvasanth4863@gmail.com',
    pass: process.env.EMAIL_PASS || 'fbeasjllademsduj'
  }
});

// Send OTP via Email
async function sendOTPEmail(email, otp) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'brainygrasp@gmail.com',
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
              <span style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 5px;">${otp}</span>
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

    const result = await emailTransporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${email}:`, result.messageId);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send OTP email to ${email}:`, error);
    return false;
  }
}

// Send OTP via SMS (using Twilio)
async function sendOTPSMS(phone, otp) {
  try {
    // For demo purposes, we'll log the OTP instead of sending real SMS
    // In production, you would use Twilio or another SMS service
    
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
    
    console.log(`📱 OTP SMS would be sent to ${phone}: ${otp}`);
    console.log(`📱 SMS Content: Your BrainyGrasp OTP is: ${otp}. Valid for 10 minutes.`);
    
    // For now, return true (simulating successful SMS send)
    return true;
  } catch (error) {
    console.error(`❌ Failed to send OTP SMS to ${phone}:`, error);
    return false;
  }
}

// Main OTP sending function
async function sendOTP(method, value, otp) {
  try {
    let success = false;
    
    if (method === 'email') {
      success = await sendOTPEmail(value, otp);
    } else if (method === 'phone') {
      success = await sendOTPSMS(value, otp);
    } else {
      console.error(`❌ Unsupported method: ${method}`);
      return false;
    }
    
    return success;
  } catch (error) {
    console.error(`❌ Error sending OTP:`, error);
    return false;
  }
}

module.exports = {
  sendOTP,
  sendOTPEmail,
  sendOTPSMS
};
