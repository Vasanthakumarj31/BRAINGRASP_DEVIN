'use strict';

let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch {
  console.warn('⚠️ express-rate-limit not found. OTP endpoint is unprotected. Run: npm install express-rate-limit');
  rateLimit = null;
}

const otpLimiter = rateLimit
  ? rateLimit({ 
      windowMs: 15 * 60 * 1000, 
      max: 20, 
      standardHeaders: true, 
      legacyHeaders: false,
      skip: (req) => {
        const ip = req.ip || req.socket?.remoteAddress || '';
        return process.env.NODE_ENV !== 'production' || 
               ip === '127.0.0.1' || 
               ip === '::1' || 
               ip === '::ffff:127.0.0.1' || 
               ip.includes('127.0.0.1');
      },
      message: { error: 'Too many OTP requests from this IP. Please wait 15 minutes.' } 
    })
  : (req, res, next) => next(); // no-op fallback

module.exports = {
  otpLimiter
};
