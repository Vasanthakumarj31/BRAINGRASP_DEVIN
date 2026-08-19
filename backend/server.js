/**
 * server.js — BrainyGrasp API Entry Point
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsible for:
 *   1. Startup validation of required environment variables
 *   2. Express app setup (CORS, body parsing, trust proxy)
 *   3. Database & Redis initialization (with retry)
 *   4. Mounting all route modules
 *   5. Serving static frontend / admin / affiliate files
 *   6. Starting the HTTP server
 *
 * Route modules (routes/):
 *   auth.js       — POST /api/auth/request-otp, verify-otp, profile, me
 *   cart.js       — GET/POST /api/cart, /api/cart/sync
 *   orders.js     — POST /api/addresses, POST/GET /api/orders
 *   products.js   — GET /api/products, /api/products/search, /api/categories/search
 *   payment.js    — POST /api/payment/create-order, /api/payment/verify
 *   admin.js      — All /api/admin/* endpoints
 *   affiliate.js  — All /api/affiliate/* and /api/admin/affiliate* endpoints
 *   shiprocket.js — POST /api/webhooks/shiprocket
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ── Startup validation ────────────────────────────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'DB_PASSWORD', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`❌ Missing required env var: ${key} must be set in .env`);
  }
}

const express = require('express');
const { initRedis } = require('./redisClient');
const pool    = require('./db'); // shared pool — imported here so DB is ready before routers load

// ── Route modules ─────────────────────────────────────────────────────────────
const shiprocketRouter = require('./routes/shiprocket');
const affiliateRouter  = require('./routes/affiliate');
const authRouter       = require('./routes/auth');
const cartRouter       = require('./routes/cart');
const ordersRouter     = require('./routes/orders');
const productsRouter   = require('./routes/products');
const paymentRouter    = require('./routes/payment');
const adminRouter      = require('./routes/admin');

const app  = express();
const port = process.env.PORT || 3000;

// ── Trust proxy (Render / Heroku load balancers) ──────────────────────────────
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow origins listed in ALLOWED_ORIGINS (comma-separated).
// When not set (local dev), all origins are allowed.
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null;

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (!ALLOWED_ORIGINS) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else if (origin) {
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Origin', 'null');
      return res.status(403).end();
    }
    return res.status(403).json({ error: 'CORS: Origin not allowed.' });
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

app.use(express.json());

// ── Route mounting ────────────────────────────────────────────────────────────
app.use('/', shiprocketRouter);
app.use('/', affiliateRouter);
app.use('/', authRouter);
app.use('/', cartRouter);
app.use('/', ordersRouter);
app.use('/', productsRouter);
app.use('/', paymentRouter);
app.use('/', adminRouter);

// ── Static files ──────────────────────────────────────────────────────────────
const frontendPath = path.join(__dirname, '..', 'frontend');
const adminPath    = path.join(__dirname, '..', 'admin');

// Protected pages — no-store cache headers so logout clears browser cache
const PROTECTED_PAGES   = ['dashboard-new.html', 'profile-setup.html', 'checkout_cod.html'];
const noCacheHeaders    = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma',  'no-cache');
  res.setHeader('Expires', '0');
  next();
};
PROTECTED_PAGES.forEach(page => {
  app.get(`/${page}`, noCacheHeaders, (req, res) =>
    res.sendFile(path.join(frontendPath, page))
  );
});

// Server-side checkout auth guard
const jwt        = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET;
app.get(['/checkout', '/checkout_cod.html', '/checkout.html'], (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    if (req.accepts('html')) return res.redirect('/login.html?redirect=checkout_cod.html');
    return res.status(401).json({ error: 'Access Denied: Unauthenticated user cannot access checkout.' });
  }

  jwt.verify(token, SECRET_KEY, (err) => {
    if (err) {
      if (req.accepts('html')) return res.redirect('/login.html?redirect=checkout_cod.html');
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }
    res.sendFile(path.join(frontendPath, 'checkout_cod.html'));
  });
});

// Static directories (frontend mounted once — duplicate removed)
app.use(express.static(frontendPath));
app.use('/admin',     express.static(adminPath));
app.use('/affiliate', express.static(path.join(frontendPath, 'affiliate')));

// Root → index.html
app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

// ── Database initialization ───────────────────────────────────────────────────
async function initDB() {
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to PostgreSQL. Initializing tables…');

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

    // Migration columns
    const migrations = [
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cod'`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id VARCHAR(100)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS expected_delivery DATE`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_note TEXT`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_id VARCHAR(100)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS awb_number VARCHAR(100)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_status VARCHAR(50)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery DATE`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name VARCHAR(100)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_id INTEGER`,
      `ALTER TABLE users  ADD COLUMN IF NOT EXISTS role          VARCHAR(20)  DEFAULT 'CUSTOMER'`,
      `ALTER TABLE users  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`,
    ];
    for (const sql of migrations) {
      await client.query(sql).catch(() => {});
    }

    // Affiliate tables
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
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_order ON commissions(order_id)`
    ).catch(() => {});
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
        id         SERIAL PRIMARY KEY,
        payout_day INTEGER DEFAULT 1
      )
    `);
    await client.query(
      `INSERT INTO affiliate_settings (id, payout_day) VALUES (1, 1) ON CONFLICT (id) DO NOTHING`
    ).catch(() => {});

  } catch (err) {
    console.error('DB init error:', err);
    throw err;
  } finally {
    if (client) client.release();
  }
}

// Retry with exponential back-off (2 s, 4 s, 8 s, 16 s, 32 s)
async function initDBWithRetry(retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await initDB();
      return;
    } catch (err) {
      const wait = Math.pow(2, attempt) * 1000;
      console.error(`DB init attempt ${attempt} failed. Retrying in ${wait / 1000}s…`, err.message);
      if (attempt < retries) await new Promise(r => setTimeout(r, wait));
    }
  }
  console.error('⌛ DB init failed after all retries. Tables may not be ready.');
}

// ── Phone normalisation helper (used by auth route) ───────────────────────────
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0'))  return digits.slice(1);
  return digits;
}

// ── Start ─────────────────────────────────────────────────────────────────────
(async () => {
  await initDBWithRetry();
  await initRedis();
})();

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 BrainyGrasp API running on http://localhost:${port}`);
  console.log(`🌐 Accessible from network devices at http://0.0.0.0:${port}`);
});
