require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { sendOTP } = require('./otpService');

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

// ── Middleware ──────────────────────────────────────────────────────────────
// CORS: allow origins listed in ALLOWED_ORIGINS env var (comma-separated).
// Falls back to '*' in development so local file:// and localhost work out of the box.
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : null; // null = allow all

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!ALLOWED_ORIGINS) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours

  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
  } else {
    next();
  }
});
app.use(express.json());

// ── Database Connection ─────────────────────────────────────────────────────
const pool = new Pool({
    user:     process.env.DB_USER     || 'postgres',
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'brainygras',
    password: process.env.DB_PASSWORD || 'password',
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
initDBWithRetry();

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

  console.log('🔢 Generated OTP:', otp);

  try {
    console.log('💾 Storing OTP in database...');
    // Store OTP in database
    await pool.query(`
      INSERT INTO users (email, otp, otp_expires)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET otp=$2, otp_expires=$3
    `, [email, otp, expires]);
    
    console.log('✅ OTP stored in database');

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
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];
    if (user.otp !== otp || new Date() > new Date(user.otp_expires)) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    // Clear OTP and generate JWT
    await pool.query('UPDATE users SET otp=NULL, otp_expires=NULL WHERE id=$1', [user.id]);
    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Debug OTP endpoint removed for security.
// Use direct DB inspection during local development only.

// 3. Get User Profile (For Dashboard)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, phone, gender, address, city, state, pincode, country, profile_completed, created_at FROM users WHERE id=$1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
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
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// 5. Get User Cart
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT cart FROM users WHERE id = $1', [req.user.id]);
    const cart = result.rows[0]?.cart || [];
    res.json(cart);
  } catch (err) {
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
  const { address_id, items, subtotal, total, payment_method = 'cod', payment_id = null } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO orders (user_id, address_id, items, subtotal, total, status, payment_method, payment_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, [
      req.user.id, address_id, JSON.stringify(items), subtotal, total,
      payment_method === 'razorpay' ? 'Paid' : 'Placed',
      payment_method,
      payment_id
    ]);
    
    // Clear user's cart in DB after successful order
    await pool.query("UPDATE users SET cart = '[]' WHERE id = $1", [req.user.id]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ error: 'Failed to place order' });
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
    const result = await pool.query(`SELECT * FROM products ORDER BY sales DESC`);
    res.json(result.rows);
  } catch (err) {
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
    const pattern = `%${q.trim()}%`;
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
    const pattern = `%${q.trim()}%`;
    const result = await pool.query(`
      SELECT category AS name, COUNT(*) AS product_count
      FROM products
      WHERE category ILIKE $1
      GROUP BY category
      ORDER BY product_count DESC
      LIMIT 10
    `, [pattern]);
    res.json({ categories: result.rows });
  } catch (err) {
    console.error('Category search error:', err);
    res.status(500).json({ error: 'Category search failed' });
  }
});


// 8. Get Orders (For Dashboard)
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, a.full_name, a.line1, a.city 
      FROM orders o 
      LEFT JOIN addresses a ON o.address_id = a.id 
      WHERE o.user_id = $1 ORDER BY o.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ── Startup ─────────────────────────────────────────────────────────────────
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 BrainyGrasp API running on http://localhost:${port}`);
  console.log(`🌐 Accessible from network devices at http://0.0.0.0:${port}`);
});