require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { sendOTP } = require('./otpService');
const { initRedis, getCached, setCache, deleteCache, clearCachePattern, CACHE_KEYS, TTL } = require('./redisClient');
const bcrypt = require('bcryptjs');

// ── Rate Limiting ─────────────────────────────────────────────────────────────
// Guard OTP endpoint: max 5 requests per IP per 15 minutes
let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch {
  // express-rate-limit not installed — skip rate limiting (run: npm install express-rate-limit)
  console.warn('⚠️  express-rate-limit not found. OTP endpoint is unprotected. Run: npm install express-rate-limit');
  rateLimit = null;
}
const otpLimiter = rateLimit
  ? rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
      message: { error: 'Too many OTP requests from this IP. Please wait 15 minutes.' } })
  : (req, res, next) => next(); // no-op fallback

// Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ── Startup validation ────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  throw new Error('❌ Missing required env var: JWT_SECRET must be set in .env');
}
const SECRET_KEY = process.env.JWT_SECRET;
const app = express();
const port = process.env.PORT || 3000;

// ── Trust Proxy (required on Render/Heroku behind a load balancer) ──────────
// Fixes express-rate-limit ERR_ERL_UNEXPECTED_X_FORWARDED_FOR error
app.set('trust proxy', 1);

// ── Middleware ──────────────────────────────────────────────────────────────
// CORS: allow origins listed in ALLOWED_ORIGINS env var (comma-separated).
// In development (ALLOWED_ORIGINS not set), all origins are allowed so that
// local file:// and localhost work out of the box.
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null; // null = allow all (dev mode only)

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (!ALLOWED_ORIGINS) {
    // Dev mode — no restriction
    res.header('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    // Known, explicitly allowed origin
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else if (origin) {
    // ── BUG FIX: Unknown origin — reject with 403 instead of echoing it back.
    // Echoing an unknown origin would effectively whitelist every domain.
    if (req.method === 'OPTIONS') {
      // Respond to preflight so the browser receives a proper rejection
      // rather than a network-level error.
      res.header('Access-Control-Allow-Origin', 'null');
      return res.status(403).end();
    }
    return res.status(403).json({ error: 'CORS: Origin not allowed.' });
  }
  // For same-origin requests (no Origin header) fall through normally.

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});
app.use(express.json());

// ── Database Connection ─────────────────────────────────────────────────────
// DB_PASSWORD is required — no insecure fallback
if (!process.env.DB_PASSWORD) {
  throw new Error('❌ Missing required env var: DB_PASSWORD must be set in .env');
}
// Support DATABASE_URL (Neon/Supabase) or individual DB_* vars (local Docker)
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new Pool({
      user:     process.env.DB_USER     || 'postgres',
      host:     process.env.DB_HOST     || 'localhost',
      database: process.env.DB_NAME     || 'brainygras',
      password: process.env.DB_PASSWORD,
      port:     parseInt(process.env.DB_PORT) || 5432,
    });


// ── Database Initialization (Tables) ────────────────────────────────────────
async function initDB() {
  let client;
  try {
    client = await pool.connect();
    console.log("Connected to PostgreSQL. Initializing tables...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY, group_name VARCHAR(50), name VARCHAR(255),
        age VARCHAR(50), age_group VARCHAR(50), price INTEGER, original_price INTEGER,
        save VARCHAR(20), reviews INTEGER, badge VARCHAR(50), image TEXT, offer TEXT,
        category VARCHAR(100), skills JSONB, theme VARCHAR(100), type VARCHAR(100),
        launch_date DATE, sales INTEGER
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(150) UNIQUE,
        phone VARCHAR(20) UNIQUE,
        gender VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        pincode VARCHAR(10),
        country VARCHAR(100),
        profile_completed BOOLEAN DEFAULT FALSE,
        otp VARCHAR(10),
        otp_expires TIMESTAMP,
        cart JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        full_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        line1 VARCHAR(255) NOT NULL,
        line2 VARCHAR(255),
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        pincode VARCHAR(10) NOT NULL,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        address_id INTEGER REFERENCES addresses(id),
        items JSONB NOT NULL,
        subtotal INTEGER NOT NULL,
        total INTEGER NOT NULL,
        payment_method VARCHAR(20) DEFAULT 'cod',
        payment_id VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Placed',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add payment columns if table already exists (migration)
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cod'`).catch(() => {});
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id VARCHAR(100)`).catch(() => {});

    // Add admin-management columns for orders (migration)
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS expected_delivery DATE`).catch(() => {});
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE`).catch(() => {});
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_note TEXT`).catch(() => {});

    // ── Affiliate System: extend existing tables ──────────────────────────────
    await client.query(`ALTER TABLE users  ADD COLUMN IF NOT EXISTS role          VARCHAR(20)  DEFAULT 'CUSTOMER'`).catch(() => {});
    await client.query(`ALTER TABLE users  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`).catch(() => {});
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_id  INTEGER`).catch(() => {});

    await client.query(`
      CREATE TABLE IF NOT EXISTS affiliates (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
        affiliate_code  VARCHAR(20) UNIQUE NOT NULL,
        commission_pct  NUMERIC(5,2) DEFAULT 20.00,
        status          VARCHAR(20)  DEFAULT 'ACTIVE',
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS affiliate_clicks (
        id            SERIAL PRIMARY KEY,
        affiliate_id  INTEGER REFERENCES affiliates(id) ON DELETE CASCADE,
        ip_address    VARCHAR(45),
        session_id    VARCHAR(100),
        page_url      TEXT,
        clicked_at    TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS commissions (
        id                SERIAL PRIMARY KEY,
        affiliate_id      INTEGER REFERENCES affiliates(id) ON DELETE CASCADE,
        order_id          INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        order_amount      INTEGER NOT NULL,
        commission_pct    NUMERIC(5,2) NOT NULL,
        commission_amount INTEGER NOT NULL,
        status            VARCHAR(20) DEFAULT 'APPROVED',
        created_at        TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_order ON commissions(order_id)`).catch(() => {});
    await client.query(`
      CREATE TABLE IF NOT EXISTS affiliate_wallets (
        id               SERIAL PRIMARY KEY,
        affiliate_id     INTEGER UNIQUE REFERENCES affiliates(id) ON DELETE CASCADE,
        current_balance  INTEGER DEFAULT 0,
        total_earned     INTEGER DEFAULT 0,
        updated_at       TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id                SERIAL PRIMARY KEY,
        affiliate_id      INTEGER REFERENCES affiliates(id) ON DELETE CASCADE,
        transaction_type  VARCHAR(20) NOT NULL,
        amount            INTEGER NOT NULL,
        description       TEXT,
        reference_id      INTEGER,
        created_at        TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS affiliate_payouts (
        id                SERIAL PRIMARY KEY,
        affiliate_id      INTEGER REFERENCES affiliates(id) ON DELETE CASCADE,
        amount            INTEGER NOT NULL,
        status            VARCHAR(20) DEFAULT 'PAID',
        payment_reference VARCHAR(100),
        admin_note        TEXT,
        paid_at           TIMESTAMP DEFAULT NOW(),
        created_at        TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS affiliate_settings (
        id          SERIAL PRIMARY KEY,
        payout_day  INTEGER DEFAULT 1
      )
    `);
    await client.query(`INSERT INTO affiliate_settings (id, payout_day) VALUES (1, 1) ON CONFLICT (id) DO NOTHING`).catch(() => {});

  } catch (err) {
    console.error('DB init error:', err);
  } finally {
    if (client) client.release();
  }
}

// ── Database Initialization with Retry ──────────────────────────────────────
// Retries up to 5 times with exponential back-off (2s, 4s, 8s, 16s, 32s).
// This replaces the fragile setTimeout(initDB, 2000) pattern.
async function initDBWithRetry(retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await initDB();
      return; // success
    } catch (err) {
      const wait = Math.pow(2, attempt) * 1000;
      console.error(`DB init attempt ${attempt} failed. Retrying in ${wait / 1000}s…`, err.message);
      if (attempt < retries) await new Promise(r => setTimeout(r, wait));
    }
  }
  console.error('❌ DB init failed after all retries. Tables may not be ready.');
}

// ── Phone Normalization Helper ───────────────────────────────────────────────
// Strips all non-digit characters, removes leading country code (+91/0),
// and returns a 10-digit number string, or null for empty input.
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  // Strip leading 91 (India country code) if 12 digits total, or leading 0 if 11 digits
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

// Initialize both DB and Redis on startup
(async () => {
  await initDBWithRetry();
  await initRedis();
})();

// ── Auth Middleware ─────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Access Denied" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid Token" });
    req.user = user;
    next();
  });
}

// ── Affiliate Auth Middleware ───────────────────────────────────────────────
function authenticateAffiliate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Affiliate access denied' });
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err || decoded.role !== 'affiliate') {
      return res.status(403).json({ error: 'Affiliate access required' });
    }
    req.affiliate = decoded;
    next();
  });
}

// ── User Authentication Endpoints ───────────────────────────────────────────

// Handle preflight requests for auth endpoints
app.options('/api/auth/request-otp', cors());
app.options('/api/auth/verify-otp', cors());

// 1. Request OTP (Email Only) — rate-limited to 5 req / 15 min per IP
app.post('/api/auth/request-otp', otpLimiter, cors(), async (req, res) => {
  console.log('📧 Received OTP request for email:', req.body.email);
  
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  try {
    console.log('💾 Storing OTP in cache...');
    
    // Store OTP in Redis with 10-minute expiry
    const redisOtpData = { email, otp, expires: expires.toISOString() };
    await setCache(CACHE_KEYS.OTP(email), redisOtpData, TTL.OTP);
    
    // Also store in database for fallback.
    // Before inserting, clean up any orphaned (no email) rows that share a phone
    // number with this user to prevent false phone-uniqueness conflicts later.
    await pool.query(`
      INSERT INTO users (email, otp, otp_expires)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET otp=$2, otp_expires=$3
    `, [email, otp, expires]);
    
    console.log('✅ OTP stored in Redis and database');

    console.log('📧 Sending OTP to user email...');
    // Send OTP to user's email
    const otpSent = await sendOTP('email', email, otp);
    
    console.log('📧 sendOTP result:', otpSent);
    
    if (!otpSent) {
      console.log('❌ OTP service failed');
      return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }

    console.log('✅ OTP sent successfully');
    // Real OTP delivery - no demo OTP returned
    console.log(`🔐 OTP sent to email: ${email}`);
    res.json({ 
      success: true, 
      message: 'OTP sent to your email'
    });
  } catch (err) {
    console.error('❌ OTP request error:', err);
    console.error('❌ Error stack:', err.stack);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', cors(), async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

  try {
    // Try to get OTP from Redis cache first (faster)
    const cachedOTP = await getCached(CACHE_KEYS.OTP(email));
    
    let otpData = cachedOTP;
    
    // Fallback to database if not in cache
    if (!otpData) {
      const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
      // Return the same error regardless of whether the email exists (prevents email enumeration)
      if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid or expired OTP' });
      
      const user = result.rows[0];
      if (!user.otp || new Date() > new Date(user.otp_expires)) {
        return res.status(401).json({ error: 'Invalid or expired OTP' });
      }
      
      otpData = { email: user.email, otp: user.otp, expires: user.otp_expires };
    }
    
    // Verify OTP
    if (otpData.otp !== otp || new Date() > new Date(otpData.expires)) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }
    
    // Get user from database
    const userResult = await pool.query('SELECT id, name, email, phone FROM users WHERE email=$1', [email]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'Invalid or expired OTP' });
    
    const user = userResult.rows[0];
    
    // Clear OTP from both Redis and database
    await deleteCache(CACHE_KEYS.OTP(email));
    await pool.query('UPDATE users SET otp=NULL, otp_expires=NULL WHERE id=$1', [user.id]);
    
    // Generate JWT
    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, email: user.email } });
  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Debug OTP endpoint removed for security.
// Use direct DB inspection during local development only.

// 3. Get User Profile (For Dashboard)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    // Try cache first
    const cachedProfile = await getCached(CACHE_KEYS.USER_PROFILE(req.user.id));
    if (cachedProfile) {
      return res.json(cachedProfile);
    }
    
    // Fetch from database
    const result = await pool.query('SELECT id, name, email, phone, gender, address, city, state, pincode, country, profile_completed, created_at FROM users WHERE id=$1', [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const profile = result.rows[0];
    
    // Cache the profile
    await setCache(CACHE_KEYS.USER_PROFILE(req.user.id), profile, TTL.USER_PROFILE);
    
    res.json(profile);
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// 4. Save User Profile
app.post('/api/auth/profile', authenticateToken, async (req, res) => {
  const { name, gender, phone, address, city, state, pincode, country } = req.body;
  
  try {
    // Validate required fields
    if (!name || !gender || !phone || !address || !city || !state || !pincode) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Get current user's phone number
    const currentUser = await pool.query('SELECT phone FROM users WHERE id=$1', [req.user.id]);
    const currentPhone = currentUser.rows[0]?.phone;
    
    // Only check phone uniqueness if it's different from current phone
    if (phone !== currentPhone) {
      const phoneCheck = await pool.query('SELECT id FROM users WHERE phone=$1 AND id != $2', [phone, req.user.id]);
      if (phoneCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Phone number is already in use by another account' });
      }
    }

    // Update user profile
    const result = await pool.query(`
      UPDATE users 
      SET name=$1, gender=$2, phone=$3, address=$4, city=$5, state=$6, pincode=$7, country=$8, profile_completed=TRUE, updated_at=NOW()
      WHERE id=$9
      RETURNING id, name, email, phone, gender, address, city, state, pincode, country, profile_completed
    `, [name, gender, phone, address, city, state, pincode, country || 'India', req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Invalidate cache for this user
    await deleteCache(CACHE_KEYS.USER_PROFILE(req.user.id));

    res.json({ 
      success: true, 
      message: 'Profile saved successfully',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Profile save error:', err);
    if (err.code === '23505') {
      // Unique constraint violation
      res.status(400).json({ error: 'Phone number is already in use by another account' });
    } else {
      res.status(500).json({ error: 'Failed to save profile' });
    }
  }
});

// 5. Check if Profile is Completed
app.get('/api/auth/profile-status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT profile_completed FROM users WHERE id=$1', [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Handle case where profile_completed column doesn't exist
    const profileCompleted = result.rows[0].profile_completed !== undefined ? 
      result.rows[0].profile_completed : false;

    res.json({ 
      profile_completed: profileCompleted 
    });
  } catch (err) {
    console.error('Profile status error:', err);
    // If column doesn't exist, assume profile is not completed
    if (err.message && err.message.includes('column')) {
      res.json({ 
        profile_completed: false 
      });
    } else {
      res.status(500).json({ error: 'Server Error' });
    }
  }
});

// ── Cart & Orders ───────────────────────────────────────────────────────────

// 4. Sync Cart (Guest -> Database)
app.post('/api/cart/sync', authenticateToken, async (req, res) => {
  const { items } = req.body;
  try {
    await pool.query('UPDATE users SET cart = $1 WHERE id = $2', [JSON.stringify(items), req.user.id]);
    
    // Update cache as well
    await setCache(CACHE_KEYS.USER_CART(req.user.id), items, TTL.USER_CART);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Cart sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// 5. Get User Cart
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    // Try cache first for faster response
    const cachedCart = await getCached(CACHE_KEYS.USER_CART(req.user.id));
    if (cachedCart) {
      return res.json(cachedCart);
    }
    
    // Fallback to database
    const result = await pool.query('SELECT cart FROM users WHERE id = $1', [req.user.id]);
    const cart = result.rows[0]?.cart || [];
    
    // Cache the cart
    await setCache(CACHE_KEYS.USER_CART(req.user.id), cart, TTL.USER_CART);
    
    res.json(cart);
  } catch (err) {
    console.error('Cart fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// 6. Save Address
app.post('/api/addresses', authenticateToken, async (req, res) => {
  const { full_name, phone, line1, city, state, pincode } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO addresses (user_id, full_name, phone, line1, city, state, pincode)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [req.user.id, full_name, phone, line1, city, state, pincode]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save address' });
  }
});

// 6. Place Order (COD or post-Razorpay)
app.post('/api/orders', authenticateToken, async (req, res) => {
  const { address_id, items, subtotal, total, payment_method = 'cod', payment_id = null, affiliate_ref = null } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let resolvedAffiliateId = null;
    let commPct = 20.00;
    if (affiliate_ref) {
      const affCheck = await client.query("SELECT id, commission_pct, status FROM affiliates WHERE affiliate_code=$1 AND status='ACTIVE'", [affiliate_ref.trim()]);
      if (affCheck.rows.length > 0) {
        resolvedAffiliateId = affCheck.rows[0].id;
        commPct = parseFloat(affCheck.rows[0].commission_pct) || 20.00;
      }
    }

    const result = await client.query(`
      INSERT INTO orders (user_id, address_id, items, subtotal, total, status, payment_method, payment_id, affiliate_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
    `, [
      req.user.id, address_id, JSON.stringify(items), subtotal, total,
      payment_method === 'razorpay' ? 'Paid' : 'Placed',
      payment_method,
      payment_id,
      resolvedAffiliateId
    ]);

    const orderId = result.rows[0].id;

    // Process affiliate commission if order came via valid active affiliate
    if (resolvedAffiliateId) {
      const commAmount = Math.round((total * commPct) / 100);
      const commRes = await client.query(`
        INSERT INTO commissions (affiliate_id, order_id, order_amount, commission_pct, commission_amount, status)
        VALUES ($1, $2, $3, $4, $5, 'APPROVED')
        ON CONFLICT (order_id) DO NOTHING
        RETURNING id
      `, [resolvedAffiliateId, orderId, total, commPct, commAmount]);

      if (commRes.rows.length > 0) {
        await client.query(`
          INSERT INTO affiliate_wallets (affiliate_id, current_balance, total_earned)
          VALUES ($1, $2, $2)
          ON CONFLICT (affiliate_id) DO UPDATE
          SET current_balance = affiliate_wallets.current_balance + $2,
              total_earned    = affiliate_wallets.total_earned + $2,
              updated_at      = NOW()
        `, [resolvedAffiliateId, commAmount]);

        await client.query(`
          INSERT INTO wallet_transactions (affiliate_id, transaction_type, amount, description, reference_id)
          VALUES ($1, 'COMMISSION', $2, $3, $4)
        `, [resolvedAffiliateId, commAmount, `Commission from Order #${orderId}`, commRes.rows[0].id]);
      }
    }
    
    // Clear user's cart in DB after successful order
    await client.query("UPDATE users SET cart = '[]' WHERE id = $1", [req.user.id]);
    
    await client.query('COMMIT');

    // Invalidate caches outside transaction
    await deleteCache(CACHE_KEYS.USER_CART(req.user.id)).catch(() => {});
    await deleteCache(CACHE_KEYS.USER_ORDERS(req.user.id)).catch(() => {});
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Order error:', err);
    res.status(500).json({ error: 'Failed to place order' });
  } finally {
    client.release();
  }
});

// ── Razorpay Payment Endpoints ───────────────────────────────────────────────

// Create Razorpay Order
app.post('/api/payment/create-order', authenticateToken, async (req, res) => {
  const { amount } = req.body; // amount in rupees
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  try {
    const options = {
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency: 'INR',
      receipt: `receipt_${req.user.id}_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    res.json({ 
      orderId: order.id, 
      amount: order.amount, 
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Razorpay create order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Verify Razorpay Payment Signature
app.post('/api/payment/verify', authenticateToken, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature === razorpay_signature) {
    res.json({ success: true, payment_id: razorpay_payment_id });
  } else {
    res.status(400).json({ success: false, error: 'Payment verification failed' });
  }
});

// 7. Get All Products (For Frontend)
app.get('/api/products', async (req, res) => {
  try {
    // Try cache first for instant response
    const cachedProducts = await getCached(CACHE_KEYS.ALL_PRODUCTS);
    if (cachedProducts && cachedProducts.length > 0) {
      return res.json(cachedProducts);
    }
    
    // Fetch from database
    const result = await pool.query(`SELECT * FROM products ORDER BY sales DESC`);
    
    // Cache the result for 1 hour
    if (result.rows.length > 0) {
      await setCache(CACHE_KEYS.ALL_PRODUCTS, result.rows, TTL.PRODUCTS);
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error('Product fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// 7a. Search Products (used by search.js)
app.get('/api/products/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }
  try {
    const cacheKey = CACHE_KEYS.PRODUCT_SEARCH(q);
    
    // Try cache first
    const cachedResults = await getCached(cacheKey);
    if (cachedResults) {
      return res.json({ products: cachedResults });
    }
    
    // Fetch from database
    const escapedQ = q.trim().replace(/[%_\\]/g, '\\$&');
    const pattern = `%${escapedQ}%`;
    const result = await pool.query(`
      SELECT id, name, category, price, original_price, image, badge, age, sales
      FROM products
      WHERE name       ILIKE $1
         OR category   ILIKE $1
         OR theme      ILIKE $1
         OR group_name ILIKE $1
      ORDER BY sales DESC
      LIMIT 20
    `, [pattern]);
    
    // Cache the search results for 30 minutes
    await setCache(cacheKey, result.rows, TTL.PRODUCT_SEARCH);
    
    res.json({ products: result.rows });
  } catch (err) {
    console.error('Product search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 7b. Search Categories (used by search.js)
app.get('/api/categories/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }
  try {
    const cacheKey = CACHE_KEYS.CATEGORY_SEARCH(q);
    
    // Try cache first
    const cachedResults = await getCached(cacheKey);
    if (cachedResults) {
      return res.json({ categories: cachedResults });
    }
    
    // Fetch from database
    const pattern = `%${q.trim()}%`;
    const result = await pool.query(`
      SELECT category AS name, COUNT(*) AS product_count
      FROM products
      WHERE category ILIKE $1
      GROUP BY category
      ORDER BY product_count DESC
      LIMIT 10
    `, [pattern]);
    
    // Cache the search results for 30 minutes
    await setCache(cacheKey, result.rows, TTL.PRODUCT_SEARCH);
    
    res.json({ categories: result.rows });
  } catch (err) {
    console.error('Category search error:', err);
    res.status(500).json({ error: 'Category search failed' });
  }
});


// 8. Get Orders (For Dashboard)
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    // Try cache first
    const cachedOrders = await getCached(CACHE_KEYS.USER_ORDERS(req.user.id));
    if (cachedOrders) {
      return res.json(cachedOrders);
    }
    
    // Fetch from database
    const result = await pool.query(`
      SELECT o.*, a.full_name, a.line1, a.city 
      FROM orders o 
      LEFT JOIN addresses a ON o.address_id = a.id 
      WHERE o.user_id = $1 ORDER BY o.created_at DESC
    `, [req.user.id]);
    
    // Cache the orders for 1 hour
    await setCache(CACHE_KEYS.USER_ORDERS(req.user.id), result.rows, TTL.USER_ORDERS);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Orders fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ── Server-Side Protected Checkout Route ────────────────────────────────────
// Blocks direct URL/unauthenticated access to checkout page & API
app.get(['/checkout', '/checkout_cod.html', '/checkout.html'], (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    if (req.accepts('html')) {
      return res.redirect('/login.html?redirect=checkout_cod.html');
    }
    return res.status(401).json({ error: 'Access Denied: Unauthenticated user cannot access checkout.' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      if (req.accepts('html')) {
        return res.redirect('/login.html?redirect=checkout_cod.html');
      }
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }
    
    const frontendDir = path.join(__dirname, '..', 'frontend');
    res.sendFile(path.join(frontendDir, 'checkout_cod.html'));
  });
});

// Serve static frontend files
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// ═══════════════════════════════════════════════════════════════════════════
// ── ADMIN API ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// ── Admin Auth Middleware ──────────────────────────────────────────────────
// Verifies that the JWT was signed with role === 'admin'.
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Admin access denied — no token' });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err || decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  });
}

// ── A1. Admin Login ────────────────────────────────────────────────────────
// Credentials MUST be set via env vars (ADMIN_USERNAME / ADMIN_PASSWORD).
// ── BUG FIX: Removed insecure fallback defaults ('admin'/'admin123').
// The server will refuse to start if these vars are missing (see startup check below).
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
  throw new Error(
    '❌ Missing required env vars: ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env'
  );
}

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  // Read from env at request time so that hot-reloaded env changes are picked up.
  const ADMIN_USER = process.env.ADMIN_USERNAME || '';
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || '';

  const matches = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  };

  if (!username || !password || !matches(username, ADMIN_USER) || !matches(password, ADMIN_PASS)) {
    // Uniform error message — don't reveal which field is wrong.
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const token = jwt.sign({ role: 'admin', username }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ token });
});

// ── A2. Admin Products — Grouped (read) ───────────────────────────────────
// Returns products grouped by group_name: { trending:[…], bestsellers:[…] }
app.get('/api/admin/products', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    const grouped = {};
    result.rows.forEach(p => {
      const g = p.group_name || 'other';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(p);
    });
    res.json(grouped);
  } catch (err) {
    console.error('Admin products fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ── Helper: parse skills field ─────────────────────────────────────────────
function parseSkills(skills) {
  if (Array.isArray(skills)) return JSON.stringify(skills);
  if (typeof skills === 'string' && skills.trim()) {
    return JSON.stringify(skills.split(',').map(s => s.trim()).filter(Boolean));
  }
  return '[]';
}

// ── A3. Add Product ────────────────────────────────────────────────────────
app.post('/api/admin/products', authenticateAdmin, async (req, res) => {
  const {
    name, group_name, price, original_price, save, age, age_group,
    badge, image, category, skills, theme, type, launch_date,
    sales, reviews, offer
  } = req.body;

  if (!name || !group_name || !price || !image) {
    return res.status(400).json({ error: 'name, group_name, price, and image are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO products
        (name, group_name, price, original_price, save, age, age_group,
         badge, image, category, skills, theme, type, launch_date,
         sales, reviews, offer)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *
    `, [
      name, group_name, parseInt(price),
      parseInt(original_price || price),
      save || '0%', age || null, age_group || null,
      badge || null, image, category || null,
      parseSkills(skills), theme || null, type || 'Single Products',
      launch_date || new Date().toISOString().split('T')[0],
      parseInt(sales || 0), parseInt(reviews || 0),
      offer || 'Buy any 2 | Get FLAT 10% OFF'
    ]);

    // Invalidate product caches
    await clearCachePattern('products*').catch(() => {});
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Admin add product error:', err);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// ── A4. Edit Product ───────────────────────────────────────────────────────
app.put('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    name, group_name, price, original_price, save, age, age_group,
    badge, image, category, skills, theme, type, launch_date,
    sales, reviews, offer
  } = req.body;

  try {
    const result = await pool.query(`
      UPDATE products SET
        name=$1, group_name=$2, price=$3, original_price=$4, save=$5,
        age=$6, age_group=$7, badge=$8, image=$9, category=$10,
        skills=$11, theme=$12, type=$13, launch_date=$14,
        sales=$15, reviews=$16, offer=$17
      WHERE id=$18
      RETURNING *
    `, [
      name, group_name, parseInt(price),
      parseInt(original_price || price),
      save || '0%', age || null, age_group || null,
      badge || null, image, category || null,
      parseSkills(skills), theme || null, type || 'Single Products',
      launch_date || null,
      parseInt(sales || 0), parseInt(reviews || 0),
      offer || 'Buy any 2 | Get FLAT 10% OFF',
      parseInt(id)
    ]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    await clearCachePattern('products*').catch(() => {});
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin update product error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// ── A5. Delete Product ─────────────────────────────────────────────────────
app.delete('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM products WHERE id=$1 RETURNING id', [parseInt(id)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    await clearCachePattern('products*').catch(() => {});
    res.json({ success: true, deleted_id: result.rows[0].id });
  } catch (err) {
    console.error('Admin delete product error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ── A6. Dashboard KPIs ─────────────────────────────────────────────────────
app.get('/api/admin/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const [
      productsRes, ordersCountRes, revenueRes,
      confirmedRes, pendingRes, deliveredRes,
      usersWithCartRes, recentOrdersRes,
      topSellingRes, lowSellingRes, cartItemsRes, totalUsersRes
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM products'),
      pool.query('SELECT COUNT(*) FROM orders'),
      pool.query("SELECT COALESCE(SUM(total),0) AS total FROM orders WHERE LOWER(status) != 'cancelled'"),
      pool.query("SELECT COUNT(*) FROM orders WHERE LOWER(status) = 'confirmed'"),
      pool.query("SELECT COUNT(*) FROM orders WHERE LOWER(status) IN ('placed','shipped')"),
      pool.query("SELECT COUNT(*) FROM orders WHERE LOWER(status) = 'delivered'"),
      pool.query("SELECT COUNT(*) FROM users WHERE jsonb_array_length(COALESCE(cart,'[]'::jsonb)) > 0"),
      pool.query(`
        SELECT o.id, o.total, o.status, o.created_at,
               u.name AS customer_name, u.email AS customer_email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC LIMIT 10
      `),
      pool.query(
        'SELECT id, name, image, category, COALESCE(sales,0) AS sales FROM products ORDER BY sales DESC NULLS LAST LIMIT 5'
      ),
      pool.query(
        'SELECT id, name, image, category, COALESCE(sales,0) AS sales FROM products ORDER BY sales ASC NULLS FIRST LIMIT 5'
      ),
      pool.query(`
        SELECT COALESCE(SUM(
          (SELECT COALESCE(SUM((item->>'quantity')::int), 0)
           FROM jsonb_array_elements(COALESCE(cart,'[]'::jsonb)) AS item)
        ), 0) AS total_items FROM users
      `),
      pool.query('SELECT COUNT(*) FROM users')
    ]);

    res.json({
      kpis: {
        totalProducts:   parseInt(productsRes.rows[0].count),
        totalOrders:     parseInt(ordersCountRes.rows[0].count),
        totalRevenue:    parseInt(revenueRes.rows[0].total),
        confirmed:       parseInt(confirmedRes.rows[0].count),
        deliveryPending: parseInt(pendingRes.rows[0].count),
        delivered:       parseInt(deliveredRes.rows[0].count),
        usersWithCart:   parseInt(usersWithCartRes.rows[0].count),
        cartItems:       parseInt(cartItemsRes.rows[0].total_items || 0),
        totalUsers:      parseInt(totalUsersRes.rows[0].count)
      },
      recentOrders: recentOrdersRes.rows,
      topSelling:   topSellingRes.rows,
      lowSelling:   lowSellingRes.rows,
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// ── A7. Orders — Paginated List ────────────────────────────────────────────
app.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const { status, search } = req.query;

  try {
    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (status && status !== 'all') {
      conditions.push(`LOWER(o.status) = $${idx++}`);
      params.push(status.toLowerCase());
    }
    if (search && search.trim()) {
      conditions.push(
        `(u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR o.id::text = $${idx})`
      );
      params.push(`%${search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [countRes, ordersRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         ${whereClause}`,
        params
      ),
      pool.query(
        `SELECT o.*,
                u.name  AS customer_name,
                u.email AS customer_email,
                a.full_name AS addr_name,
                a.phone     AS addr_phone,
                a.line1, a.city, a.state, a.pincode
         FROM orders o
         LEFT JOIN users    u ON o.user_id     = u.id
         LEFT JOIN addresses a ON o.address_id = a.id
         ${whereClause}
         ORDER BY o.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      )
    ]);

    res.json({ orders: ordersRes.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error('Admin orders list error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ── A8. Order Detail ───────────────────────────────────────────────────────
app.get('/api/admin/orders/:id', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*,
             u.name  AS customer_name,
             u.email AS customer_email,
             a.full_name AS addr_name,
             a.phone     AS addr_phone,
             a.line1, a.city, a.state, a.pincode
      FROM orders o
      LEFT JOIN users    u ON o.user_id     = u.id
      LEFT JOIN addresses a ON o.address_id = a.id
      WHERE o.id = $1
    `, [parseInt(req.params.id)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin order detail error:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ── A9. Update Order Status ────────────────────────────────────────────────
app.put('/api/admin/orders/:id/status', authenticateAdmin, async (req, res) => {
  const { status, expected_delivery, delivery_date, admin_note } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });

  try {
    const result = await pool.query(`
      UPDATE orders
      SET status=$1, expected_delivery=$2, delivery_date=$3, admin_note=$4
      WHERE id=$5
      RETURNING id, user_id, status, expected_delivery, delivery_date, admin_note
    `, [status, expected_delivery || null, delivery_date || null, admin_note || null, parseInt(req.params.id)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updated = result.rows[0];
    if (updated.user_id) {
      await deleteCache(CACHE_KEYS.USER_ORDERS(updated.user_id)).catch(() => {});
    }

    // Reverse affiliate commission if order status changed to Cancelled
    if (status.toLowerCase() === 'cancelled') {
      const commCheck = await pool.query("SELECT * FROM commissions WHERE order_id=$1 AND status='APPROVED'", [parseInt(req.params.id)]);
      if (commCheck.rows.length > 0) {
        const comm = commCheck.rows[0];
        await pool.query("UPDATE commissions SET status='CANCELLED' WHERE id=$1", [comm.id]);
        await pool.query(`
          UPDATE affiliate_wallets
          SET current_balance = GREATEST(0, current_balance - $1),
              total_earned    = GREATEST(0, total_earned - $1),
              updated_at      = NOW()
          WHERE affiliate_id = $2
        `, [comm.commission_amount, comm.affiliate_id]);
        await pool.query(`
          INSERT INTO wallet_transactions (affiliate_id, transaction_type, amount, description, reference_id)
          VALUES ($1, 'REVERSAL', $2, $3, $4)
        `, [comm.affiliate_id, -comm.commission_amount, `Commission reversed for cancelled Order #${req.params.id}`, comm.id]);
      }
    }

    res.json({ success: true, order: updated });
  } catch (err) {
    console.error('Admin order status update error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ── AFFILIATE SYSTEM API ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Helper: Calculate next payout date & remaining days based on configured payout_day
async function getPayoutConfig() {
  try {
    const res = await pool.query('SELECT payout_day FROM affiliate_settings WHERE id=1');
    const payoutDay = res.rows[0]?.payout_day || 1;
    
    const now = new Date();
    let day = parseInt(payoutDay) || 1;
    if (day < 1) day = 1;
    if (day > 28) day = 28;

    let nextPayout = new Date(now.getFullYear(), now.getMonth(), day);
    if (nextPayout <= now) {
      nextPayout = new Date(now.getFullYear(), now.getMonth() + 1, day);
    }
    const diffMs = nextPayout.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    return {
      payoutDay: day,
      nextPayoutDate: nextPayout.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      nextPayoutIso: nextPayout.toISOString().split('T')[0],
      daysRemaining
    };
  } catch (err) {
    return { payoutDay: 1, nextPayoutDate: '1st of next month', daysRemaining: 0 };
  }
}

// 1. Referral Track Endpoint (Public)
app.get('/api/affiliate/track', async (req, res) => {
  const { ref } = req.query;
  if (!ref) return res.status(400).json({ error: 'Referral code is required' });

  try {
    const aff = await pool.query("SELECT id FROM affiliates WHERE affiliate_code=$1 AND status='ACTIVE'", [ref.trim()]);
    if (aff.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or inactive affiliate code' });
    }

    const affiliateId = aff.rows[0].id;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    
    await pool.query(`
      INSERT INTO affiliate_clicks (affiliate_id, ip_address, session_id, page_url)
      VALUES ($1, $2, $3, $4)
    `, [affiliateId, String(ip).split(',')[0].trim(), req.headers['user-agent'] || 'browser', req.headers['referer'] || '/']);

    res.json({ success: true, message: 'Click tracked successfully' });
  } catch (err) {
    console.error('Affiliate click track error:', err);
    res.status(500).json({ error: 'Tracking failed' });
  }
});

// 2. Affiliate Login
app.post('/api/affiliate/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    const userRes = await pool.query("SELECT * FROM users WHERE email=$1 AND role='AFFILIATE'", [email.trim().toLowerCase()]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid affiliate credentials' });
    }

    const user = userRes.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid affiliate credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid affiliate credentials' });
    }

    const affRes = await pool.query('SELECT * FROM affiliates WHERE user_id=$1', [user.id]);
    if (affRes.rows.length === 0) {
      return res.status(404).json({ error: 'Affiliate record not found' });
    }

    const aff = affRes.rows[0];
    if (aff.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is inactive. Contact admin.' });
    }

    const token = jwt.sign({
      id: user.id,
      affiliate_id: aff.id,
      affiliate_code: aff.affiliate_code,
      role: 'affiliate'
    }, SECRET_KEY, { expiresIn: '7d' });

    res.json({
      token,
      affiliate: {
        id: aff.id,
        code: aff.affiliate_code,
        name: user.name,
        email: user.email,
        phone: user.phone,
        commission_pct: aff.commission_pct
      }
    });
  } catch (err) {
    console.error('Affiliate login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 3. Get Current Affiliate Profile & Dashboard Data
app.get('/api/affiliate/stats', authenticateAffiliate, async (req, res) => {
  const affId = req.affiliate.affiliate_id;
  try {
    const [clicksRes, salesRes, walletRes, affRes, userRes, payoutConfig] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM affiliate_clicks WHERE affiliate_id=$1', [affId]),
      pool.query("SELECT COUNT(*), COALESCE(SUM(order_amount),0) AS total_sales_val FROM commissions WHERE affiliate_id=$1 AND status!='CANCELLED'", [affId]),
      pool.query('SELECT current_balance, total_earned FROM affiliate_wallets WHERE affiliate_id=$1', [affId]),
      pool.query('SELECT affiliate_code, commission_pct, status, created_at FROM affiliates WHERE id=$1', [affId]),
      pool.query('SELECT name, email, phone FROM users WHERE id=$1', [req.affiliate.id]),
      getPayoutConfig()
    ]);

    const aff = affRes.rows[0] || {};
    const usr = userRes.rows[0] || {};
    const wlt = walletRes.rows[0] || { current_balance: 0, total_earned: 0 };

    let affCode = aff.affiliate_code;
    if (!affCode) {
      affCode = 'AFF' + String(affId).padStart(3, '0');
      await pool.query('UPDATE affiliates SET affiliate_code=$1 WHERE id=$2', [affCode, affId]).catch(() => {});
    }

    res.json({
      affiliate: {
        id: affId,
        code: affCode,
        commission_pct: parseFloat(aff.commission_pct || 20),
        status: aff.status || 'ACTIVE',
        name: usr.name,
        email: usr.email,
        phone: usr.phone,
        created_at: aff.created_at
      },
      stats: {
        totalClicks: parseInt(clicksRes.rows[0].count || 0),
        totalSalesCount: parseInt(salesRes.rows[0].count || 0),
        totalSalesValue: parseInt(salesRes.rows[0].total_sales_val || 0),
        totalEarned: parseInt(wlt.total_earned || 0),
        currentWalletBalance: parseInt(wlt.current_balance || 0),
        nextPayoutDate: payoutConfig.nextPayoutDate,
        daysRemaining: payoutConfig.daysRemaining
      }
    });
  } catch (err) {
    console.error('Affiliate stats error:', err);
    res.status(500).json({ error: 'Failed to fetch affiliate stats' });
  }
});

// 4. Get Affiliate Commissions List
app.get('/api/affiliate/commissions', authenticateAffiliate, async (req, res) => {
  const affId = req.affiliate.affiliate_id;
  try {
    const result = await pool.query(`
      SELECT c.*, o.status AS order_status, o.total AS order_total, o.created_at AS order_date
      FROM commissions c
      LEFT JOIN orders o ON c.order_id = o.id
      WHERE c.affiliate_id = $1
      ORDER BY c.created_at DESC
    `, [affId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Affiliate commissions fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch commissions' });
  }
});

// 5. Get Affiliate Payouts History
app.get('/api/affiliate/payouts', authenticateAffiliate, async (req, res) => {
  const affId = req.affiliate.affiliate_id;
  try {
    const result = await pool.query(`
      SELECT * FROM affiliate_payouts
      WHERE affiliate_id = $1
      ORDER BY paid_at DESC
    `, [affId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Affiliate payouts fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch payout history' });
  }
});

// 6. Get Payout Date Config
app.get('/api/affiliate/payout-config', async (req, res) => {
  const cfg = await getPayoutConfig();
  res.json(cfg);
});

// ═══════════════════════════════════════════════════════════════════════════
// ── ADMIN AFFILIATE MANAGEMENT APIs ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// A10. Create Affiliate Account (Admin)
app.post('/api/admin/affiliates', authenticateAdmin, async (req, res) => {
  const { name, email, password, phone, commission_pct = 20 } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await client.query('SELECT id, role FROM users WHERE email=$1', [cleanEmail]);
    let userId;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Normalize the submitted phone number (strips country code, whitespace, dashes)
    const cleanPhone = normalizePhone(phone) || null;

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      // Check if user is ALREADY an affiliate
      const existingAff = await client.query('SELECT id FROM affiliates WHERE user_id=$1', [userId]);
      if (existingAff.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'An affiliate account with this email already exists' });
      }

      // User exists as a customer/other role -> promote to AFFILIATE, update details & password.
      // When updating phone, check uniqueness only against other fully-registered users
      // (skip orphaned rows that have no email and profile_completed=false).
      if (cleanPhone) {
        const phoneConflict = await client.query(`
          SELECT id FROM users 
          WHERE phone = $1 
            AND id != $2 
            AND email IS NOT NULL 
            AND profile_completed = true
        `, [cleanPhone, userId]);
        if (phoneConflict.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'This phone number is already registered to another account' });
        }
      }

      await client.query(`
        UPDATE users 
        SET name = $1, 
            phone = COALESCE($2, phone), 
            role = 'AFFILIATE', 
            password_hash = $3 
        WHERE id = $4
      `, [name.trim(), cleanPhone, passwordHash, userId]);

    } else {
      // New user record. Check phone uniqueness only against real accounts.
      if (cleanPhone) {
        const phoneConflict = await client.query(`
          SELECT id FROM users 
          WHERE phone = $1 
            AND email IS NOT NULL 
            AND profile_completed = true
        `, [cleanPhone]);
        if (phoneConflict.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'This phone number is already registered to another account' });
        }
        // Remove orphaned rows with this phone so INSERT doesn't hit the UNIQUE constraint
        await client.query(`DELETE FROM users WHERE phone = $1 AND email IS NULL AND profile_completed = false`, [cleanPhone]);
      }

      const userRes = await client.query(`
        INSERT INTO users (name, email, phone, role, password_hash)
        VALUES ($1, $2, $3, 'AFFILIATE', $4)
        RETURNING id, name, email, phone
      `, [name.trim(), cleanEmail, cleanPhone, passwordHash]);

      userId = userRes.rows[0].id;
    }

    // Insert affiliate with generated code
    const affInsert = await client.query(`
      INSERT INTO affiliates (user_id, affiliate_code, commission_pct, status)
      VALUES ($1, 'TEMP', $2, 'ACTIVE')
      RETURNING id
    `, [userId, parseFloat(commission_pct) || 20.00]);

    const affId = affInsert.rows[0].id;
    const affCode = 'AFF' + String(affId).padStart(3, '0');

    await client.query('UPDATE affiliates SET affiliate_code=$1 WHERE id=$2', [affCode, affId]);

    // Initialize wallet
    await client.query(`
      INSERT INTO affiliate_wallets (affiliate_id, current_balance, total_earned)
      VALUES ($1, 0, 0)
      ON CONFLICT (affiliate_id) DO NOTHING
    `, [affId]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Affiliate created successfully',
      affiliate: {
        id: affId,
        user_id: userId,
        name,
        email: cleanEmail,
        phone,
        affiliate_code: affCode,
        commission_pct: parseFloat(commission_pct) || 20.00,
        status: 'ACTIVE'
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Admin create affiliate error:', err);
    if (err.code === '23505') {
      if (err.constraint === 'users_phone_key') {
        return res.status(400).json({ error: 'This phone number is already registered to another account' });
      }
      if (err.constraint === 'users_email_key') {
        return res.status(400).json({ error: 'This email address is already registered to another account' });
      }
    }
    res.status(500).json({ error: err.message || 'Failed to create affiliate account' });
  } finally {
    client.release();
  }
});

// A11. Get All Affiliates (Admin)
app.get('/api/admin/affiliates', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.id, a.user_id, a.affiliate_code, a.commission_pct, a.status, a.created_at,
        u.name, u.email, u.phone,
        COALESCE(w.current_balance, 0) AS current_balance,
        COALESCE(w.total_earned, 0) AS total_earned,
        (SELECT COUNT(*) FROM affiliate_clicks WHERE affiliate_id = a.id) AS total_clicks,
        (SELECT COUNT(*) FROM commissions WHERE affiliate_id = a.id AND status!='CANCELLED') AS total_sales
      FROM affiliates a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN affiliate_wallets w ON a.id = w.affiliate_id
      ORDER BY a.id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Admin list affiliates error:', err);
    res.status(500).json({ error: 'Failed to fetch affiliates' });
  }
});

// A12. Update Affiliate (Admin)
app.put('/api/admin/affiliates/:id', authenticateAdmin, async (req, res) => {
  const affId = parseInt(req.params.id);
  const { name, phone, commission_pct, status } = req.body;

  try {
    const affRes = await pool.query('SELECT user_id FROM affiliates WHERE id=$1', [affId]);
    if (affRes.rows.length === 0) return res.status(404).json({ error: 'Affiliate not found' });

    const userId = affRes.rows[0].user_id;

    if (name || phone !== undefined) {
      await pool.query('UPDATE users SET name=COALESCE($1, name), phone=COALESCE($2, phone) WHERE id=$3', [name, phone, userId]);
    }

    if (commission_pct !== undefined || status !== undefined) {
      await pool.query(`
        UPDATE affiliates 
        SET commission_pct = COALESCE($1, commission_pct),
            status         = COALESCE($2, status),
            updated_at     = NOW()
        WHERE id = $3
      `, [commission_pct !== undefined ? parseFloat(commission_pct) : null, status || null, affId]);
    }

    res.json({ success: true, message: 'Affiliate updated successfully' });
  } catch (err) {
    console.error('Admin update affiliate error:', err);
    res.status(500).json({ error: 'Failed to update affiliate' });
  }
});

// A13. Get Monthly Payouts Overview (Admin)
app.get('/api/admin/affiliate-wallets', authenticateAdmin, async (req, res) => {
  try {
    const [payoutConfig, walletsRes] = await Promise.all([
      getPayoutConfig(),
      pool.query(`
        SELECT 
          a.id AS affiliate_id, a.affiliate_code, a.status AS affiliate_status,
          u.name, u.email, u.phone,
          COALESCE(w.current_balance, 0) AS current_balance,
          COALESCE(w.total_earned, 0) AS total_earned,
          (SELECT MAX(paid_at) FROM affiliate_payouts WHERE affiliate_id = a.id) AS last_payout_date
        FROM affiliates a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN affiliate_wallets w ON a.id = w.affiliate_id
        ORDER BY w.current_balance DESC, a.id ASC
      `)
    ]);

    res.json({
      payoutConfig,
      affiliates: walletsRes.rows
    });
  } catch (err) {
    console.error('Admin affiliate wallets error:', err);
    res.status(500).json({ error: 'Failed to fetch payout wallets' });
  }
});

// A14. Mark Affiliate As Paid (Admin Manual Payout)
app.post('/api/admin/affiliate-payouts/:affiliateId', authenticateAdmin, async (req, res) => {
  const affId = parseInt(req.params.affiliateId);
  const { payment_reference, admin_note } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const walletRes = await client.query('SELECT current_balance FROM affiliate_wallets WHERE affiliate_id=$1 FOR UPDATE', [affId]);
    if (walletRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Affiliate wallet not found' });
    }

    const currentBalance = parseInt(walletRes.rows[0].current_balance || 0);
    if (currentBalance <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Wallet balance is ₹0. Nothing to payout.' });
    }

    // 1. Create payout record
    const payoutRes = await client.query(`
      INSERT INTO affiliate_payouts (affiliate_id, amount, status, payment_reference, admin_note, paid_at)
      VALUES ($1, $2, 'PAID', $3, $4, NOW())
      RETURNING id, amount, paid_at
    `, [affId, currentBalance, payment_reference || null, admin_note || null]);

    const payout = payoutRes.rows[0];

    // 2. Log transaction
    await client.query(`
      INSERT INTO wallet_transactions (affiliate_id, transaction_type, amount, description, reference_id)
      VALUES ($1, 'PAYOUT', $2, $3, $4)
    `, [affId, currentBalance, `Monthly payout recorded by admin`, payout.id]);

    // 3. Reset wallet balance to 0 (total_earned remains unchanged)
    await client.query(`
      UPDATE affiliate_wallets
      SET current_balance = 0, updated_at = NOW()
      WHERE affiliate_id = $1
    `, [affId]);

    // 4. Update status of approved commissions to PAID
    await client.query(`
      UPDATE commissions
      SET status = 'PAID'
      WHERE affiliate_id = $1 AND status = 'APPROVED'
    `, [affId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Successfully paid ₹${currentBalance} to affiliate and reset wallet to ₹0`,
      payout
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Admin mark payout paid error:', err);
    res.status(500).json({ error: 'Failed to process payout' });
  } finally {
    client.release();
  }
});

// A15. Get All Payment History (Admin)
app.get('/api/admin/affiliate-payouts', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, a.affiliate_code, u.name AS affiliate_name, u.email AS affiliate_email
      FROM affiliate_payouts p
      JOIN affiliates a ON p.affiliate_id = a.id
      JOIN users u ON a.user_id = u.id
      ORDER BY p.paid_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Admin payout history error:', err);
    res.status(500).json({ error: 'Failed to fetch payout history' });
  }
});

// A16. Get / Update Payout Settings (Admin)
app.get('/api/admin/affiliate-settings', authenticateAdmin, async (req, res) => {
  const cfg = await getPayoutConfig();
  res.json(cfg);
});

app.put('/api/admin/affiliate-settings', authenticateAdmin, async (req, res) => {
  const { payout_day } = req.body;
  let day = parseInt(payout_day);
  if (isNaN(day) || day < 1 || day > 28) {
    return res.status(400).json({ error: 'Payout day must be a number between 1 and 28' });
  }
  try {
    await pool.query('UPDATE affiliate_settings SET payout_day=$1 WHERE id=1', [day]);
    const updatedCfg = await getPayoutConfig();
    res.json({ success: true, message: `Monthly payout day updated to ${day}st/th`, config: updatedCfg });
  } catch (err) {
    console.error('Update affiliate settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ── Startup ─────────────────────────────────────────────────────────────────
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 BrainyGrasp API running on http://localhost:${port}`);
  console.log(`🌐 Accessible from network devices at http://0.0.0.0:${port}`);
});
