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
const shiprocket = require('./shiprocketService');
const shiprocketRouter = require('./routes/shiprocket');
const affiliateRouter  = require('./routes/affiliate');
const authRouter       = require('./routes/auth');

// â”€â”€ Rate Limiting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Guard OTP endpoint: max 5 requests per IP per 15 minutes
let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch {
  // express-rate-limit not installed â€” skip rate limiting (run: npm install express-rate-limit)
  console.warn('âš ï¸  express-rate-limit not found. OTP endpoint is unprotected. Run: npm install express-rate-limit');
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

// Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// â”€â”€ Startup validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if (!process.env.JWT_SECRET) {
  throw new Error('âŒ Missing required env var: JWT_SECRET must be set in .env');
}
const SECRET_KEY = process.env.JWT_SECRET;
const app = express();
const port = process.env.PORT || 3000;

// â”€â”€ Trust Proxy (required on Render/Heroku behind a load balancer) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Fixes express-rate-limit ERR_ERL_UNEXPECTED_X_FORWARDED_FOR error
app.set('trust proxy', 1);

// â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CORS: allow origins listed in ALLOWED_ORIGINS env var (comma-separated).
// In development (ALLOWED_ORIGINS not set), all origins are allowed so that
// local file:// and localhost work out of the box.
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null; // null = allow all (dev mode only)

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (!ALLOWED_ORIGINS) {
    // Dev mode â€” no restriction
    res.header('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    // Known, explicitly allowed origin
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else if (origin) {
    // â”€â”€ BUG FIX: Unknown origin â€” reject with 403 instead of echoing it back.
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
app.use('/api/webhooks', shiprocketRouter);
app.use('/', affiliateRouter);  // ← All /api/affiliate/* and /api/admin/affiliate* routes
app.use('/', authRouter);       // ← All /api/auth/* routes

// ── Serve Static Frontend & Admin Files ───────────────────────────────────────────────────────
const frontendPath = path.join(__dirname, '..', 'frontend');
const adminPath = path.join(__dirname, '..', 'admin');

// ── Protected pages: prevent browser/proxy caching ────────────────────────
// These routes must be registered BEFORE express.static so the no-store
// header is set on every response, ensuring logout clears the browser cache.
const PROTECTED_PAGES = [
  'dashboard-new.html',
  'profile-setup.html',
  'checkout_cod.html',
];
const noCacheHeaders = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};
PROTECTED_PAGES.forEach(page => {
  app.get(`/${page}`, noCacheHeaders, (req, res) => {
    res.sendFile(path.join(frontendPath, page));
  });
});

app.use(express.static(frontendPath));
app.use('/admin', express.static(adminPath));
app.use('/affiliate', express.static(path.join(frontendPath, 'affiliate')));

// Root route -> send frontend index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// â”€â”€ Database Connection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DB_PASSWORD is required â€” no insecure fallback
if (!process.env.DB_PASSWORD) {
  throw new Error('âŒ Missing required env var: DB_PASSWORD must be set in .env');
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


// â”€â”€ Database Initialization (Tables) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Shiprocket shipment columns (migration) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_id       VARCHAR(100)`).catch(() => {});
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS awb_number        VARCHAR(100)`).catch(() => {});
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_status   VARCHAR(50)`).catch(() => {});
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery DATE`).catch(() => {});
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name      VARCHAR(100)`).catch(() => {});

    // â”€â”€ Affiliate System: extend existing tables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Database Initialization with Retry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Retries up to 5 times with exponential back-off (2s, 4s, 8s, 16s, 32s).
// This replaces the fragile setTimeout(initDB, 2000) pattern.
async function initDBWithRetry(retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await initDB();
      return; // success
    } catch (err) {
      const wait = Math.pow(2, attempt) * 1000;
      console.error(`DB init attempt ${attempt} failed. Retrying in ${wait / 1000}sâ€¦`, err.message);
      if (attempt < retries) await new Promise(r => setTimeout(r, wait));
    }
  }
  console.error('â Œ DB init failed after all retries. Tables may not be ready.');
}

// â”€â”€ Phone Normalization Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Auth Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Affiliate Auth Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
// All auth routes (/api/auth/*) are handled in routes/auth.js and mounted via authRouter.


// â”€â”€ Cart & Orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    const cleanRef = affiliate_ref && typeof affiliate_ref === 'string' ? affiliate_ref.trim() : null;
    if (cleanRef && cleanRef !== 'null' && cleanRef !== 'undefined' && cleanRef.length > 0) {
      const affCheck = await client.query(
        "SELECT id, commission_pct, status FROM affiliates WHERE UPPER(affiliate_code) = UPPER($1) AND status = 'ACTIVE'",
        [cleanRef]
      );
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

    // â”€â”€ Push to Shiprocket (outside DB transaction â€” non-fatal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // If Shiprocket is unavailable the order is still placed successfully.
    // Admin can retry via POST /api/admin/orders/:id/push-shiprocket.
    setImmediate(async () => {
      try {
        // Fetch address + user for the Shiprocket payload
        const [addrRes, userRes] = await Promise.all([
          pool.query('SELECT * FROM addresses WHERE id=$1', [address_id]),
          pool.query('SELECT name, email, phone FROM users WHERE id=$1', [req.user.id])
        ]);
        const address  = addrRes.rows[0];
        const user     = userRes.rows[0];
        const orderRow = { id: orderId, created_at: new Date(), subtotal, total, payment_method };

        const { shipmentId, awb, courierName } = await shiprocket.bookShipment(
          orderRow, address, user, items
        );

        await pool.query(
          'UPDATE orders SET shipment_id=$1, awb_number=$2, courier_name=$3, tracking_status=$4 WHERE id=$5',
          [shipmentId, awb, courierName, 'Confirmed', orderId]
        );
        // Bust the cache again so the dashboard shows the AWB immediately
        await deleteCache(CACHE_KEYS.USER_ORDERS(req.user.id)).catch(() => {});
        console.log(`âœ… Shiprocket shipment booked for order #${orderId}: AWB ${awb}`);
      } catch (srErr) {
        // Non-fatal â€” log and move on; admin retry route can re-push
        console.error(`âš ï¸  Shiprocket push failed for order #${orderId}:`, srErr.message);
      }
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Order error:', err);
    res.status(500).json({ error: 'Failed to place order' });
  } finally {
    client.release();
  }
});

// â”€â”€ Admin: manually push a specific order to Shiprocket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Used when the automatic push failed (Shiprocket was down, no AWB yet).
app.post('/api/admin/orders/:id/push-shiprocket', authenticateAdmin, async (req, res) => {
  const orderId = parseInt(req.params.id);
  try {
    const orderRes = await pool.query(`
      SELECT o.*, a.full_name, a.line1, a.line2, a.city, a.state, a.pincode, a.phone AS addr_phone,
             u.name AS user_name, u.email AS user_email, u.phone AS user_phone
      FROM orders o
      LEFT JOIN addresses a ON o.address_id = a.id
      LEFT JOIN users u     ON o.user_id    = u.id
      WHERE o.id = $1
    `, [orderId]);

    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const o = orderRes.rows[0];
    if (o.awb_number) {
      return res.status(400).json({ error: `Order already has AWB: ${o.awb_number}` });
    }

    const address  = { full_name: o.full_name, line1: o.line1, line2: o.line2, city: o.city, state: o.state, pincode: o.pincode, phone: o.addr_phone };
    const user     = { name: o.user_name, email: o.user_email, phone: o.user_phone };
    const items    = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
    const orderRow = { id: o.id, created_at: o.created_at, subtotal: o.subtotal, total: o.total, payment_method: o.payment_method };

    const { shipmentId, awb, courierName } = await shiprocket.bookShipment(orderRow, address, user, items);

    await pool.query(
      'UPDATE orders SET shipment_id=$1, awb_number=$2, courier_name=$3, tracking_status=$4 WHERE id=$5',
      [shipmentId, awb, courierName, 'Confirmed', orderId]
    );
    await deleteCache(CACHE_KEYS.USER_ORDERS(o.user_id)).catch(() => {});

    res.json({ success: true, shipmentId, awb, courierName });
  } catch (err) {
    console.error('Admin push-shiprocket error:', err);
    res.status(500).json({ error: err.message || 'Shiprocket push failed' });
  }
});

// â”€â”€ Admin: refresh tracking status directly from Shiprocket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/admin/orders/:id/refresh-tracking', authenticateAdmin, async (req, res) => {
  const orderId = parseInt(req.params.id);
  try {
    const orderRes = await pool.query(
      'SELECT id, user_id, awb_number FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRes.rows[0];
    if (!order.awb_number) {
      return res.status(400).json({ error: 'No AWB assigned to this order yet.' });
    }

    const tracking = await shiprocket.getTracking(order.awb_number);

    const updateParams = [
      tracking.srStatus || null,
      tracking.estimatedDelivery || null,
      tracking.courierName || null
    ];
    let updateSql = `
      UPDATE orders
      SET tracking_status   = COALESCE($1, tracking_status),
          estimated_delivery = COALESCE($2, estimated_delivery),
          courier_name      = COALESCE(NULLIF($3, ''), courier_name)
    `;

    if (tracking.currentStatus) {
      updateSql += `, status = $4 WHERE id = $5`;
      updateParams.push(tracking.currentStatus, orderId);
    } else {
      updateSql += ` WHERE id = $4`;
      updateParams.push(orderId);
    }

    await pool.query(updateSql, updateParams);

    if (order.user_id) {
      await deleteCache(CACHE_KEYS.USER_ORDERS(order.user_id)).catch(() => {});
    }

    res.json({
      success: true,
      tracking_status: tracking.srStatus,
      status: tracking.currentStatus,
      estimated_delivery: tracking.estimatedDelivery,
      courier_name: tracking.courierName
    });
  } catch (err) {
    console.error('Admin refresh-tracking error:', err);
    res.status(500).json({ error: err.message || 'Failed to refresh tracking status' });
  }
});

// â”€â”€ Razorpay Payment Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Server-Side Protected Checkout Route â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â”€â”€ ADMIN API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Admin Auth Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Verifies that the JWT was signed with role === 'admin'.
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Admin access denied â€” no token' });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err || decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  });
}

// â”€â”€ A1. Admin Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Credentials MUST be set via env vars (ADMIN_USERNAME / ADMIN_PASSWORD).
// â”€â”€ BUG FIX: Removed insecure fallback defaults ('admin'/'admin123').
// The server will refuse to start if these vars are missing (see startup check below).
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
  throw new Error(
    'âŒ Missing required env vars: ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env'
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
    // Uniform error message â€” don't reveal which field is wrong.
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const token = jwt.sign({ role: 'admin', username }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ token });
});

// â”€â”€ A2. Admin Products â€” Grouped (read) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Returns products grouped by group_name: { trending:[â€¦], bestsellers:[â€¦] }
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

// â”€â”€ Helper: parse skills field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function parseSkills(skills) {
  if (Array.isArray(skills)) return JSON.stringify(skills);
  if (typeof skills === 'string' && skills.trim()) {
    return JSON.stringify(skills.split(',').map(s => s.trim()).filter(Boolean));
  }
  return '[]';
}

// â”€â”€ A3. Add Product â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ A4. Edit Product â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ A5. Delete Product â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ A6. Dashboard KPIs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ A7. Orders â€” Paginated List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ A8. Order Detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ A9. Update Order Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Affiliate System API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// All affiliate routes (partner + admin) are now in routes/affiliate.js
// and mounted via: app.use('/', affiliateRouter)

// Helper retained here for legacy internal use (e.g., admin order routes)
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

// â”€â”€ (Affiliate API routes moved to routes/affiliate.js) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// The following routes are handled by affiliateRouter:
//   GET  /api/affiliate/track
//   POST /api/affiliate/login
//   GET  /api/affiliate/stats
//   GET  /api/affiliate/commissions
//   GET  /api/affiliate/payouts
//   GET  /api/affiliate/payout-config
//   POST /api/admin/affiliates
//   GET  /api/admin/affiliates
//   PUT  /api/admin/affiliates/:id
//   GET  /api/admin/affiliate-wallets
//   POST /api/admin/affiliate-payouts/:affiliateId
//   GET  /api/admin/affiliate-payouts
//   GET  /api/admin/affiliate-settings
//   PUT  /api/admin/affiliate-settings
// â”€â”€ Startup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.listen(port, '0.0.0.0', () => {
  console.log(`ðŸš€ BrainyGrasp API running on http://localhost:${port}`);
  console.log(`ðŸŒ Accessible from network devices at http://0.0.0.0:${port}`);
});
