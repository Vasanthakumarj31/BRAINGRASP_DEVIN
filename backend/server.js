const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET_KEY = 'super_secret_brainygrasp_key';
const app = express();
const port = 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:4000', 'http://localhost:5500', 'http://localhost:5000', 'http://127.0.0.1:5500', 'http://127.0.0.1:5000', 'null', 'http://10.214.33.121:5500'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ── Database Connection ─────────────────────────────────────────────────────
// ── Database Connection ─────────────────────────────────────────────────────
const pool = new Pool({ 
    user: 'postgres', 
    host: 'localhost', 
    database: 'brainygras', 
    password: 'password', 
    port: 5432,
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
        otp VARCHAR(10),
        otp_expires TIMESTAMP,
        cart JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
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
        status VARCHAR(50) DEFAULT 'Placed',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

  } catch (err) {
    console.error('DB init error:', err);
  } finally {
    if (client) client.release();
  }
}

setTimeout(initDB, 2000);

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

// 1. Request OTP (Phone or Email)
app.post('/api/auth/request-otp', async (req, res) => {
  const { method, value } = req.body;
  if (!method || !value) return res.status(400).json({ error: 'Method and value required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  try {
    const field = method === 'phone' ? 'phone' : 'email';
    await pool.query(`
      INSERT INTO users (${field}, otp, otp_expires)
      VALUES ($1, $2, $3)
      ON CONFLICT (${field}) DO UPDATE SET otp=$2, otp_expires=$3
    `, [value, otp, expires]);

    res.json({ success: true, otp_demo: otp }); // In production, don't return the OTP here
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  const { method, value, otp } = req.body;
  const field = method === 'phone' ? 'phone' : 'email';

  try {
    const result = await pool.query(`SELECT * FROM users WHERE ${field}=$1`, [value]);
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

// 3. Get User Profile (For Dashboard)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, phone, created_at FROM users WHERE id=$1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
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

// 5. Save Address
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

// 6. Place Order
app.post('/api/orders', authenticateToken, async (req, res) => {
  const { address_id, items, subtotal, total } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO orders (user_id, address_id, items, subtotal, total, status)
      VALUES ($1, $2, $3, $4, $5, 'Placed') RETURNING id
    `, [req.user.id, address_id, JSON.stringify(items), subtotal, total]);
    
    // Optional: Clear user's cart in DB after successful order
    await pool.query('UPDATE users SET cart = \'[]\' WHERE id = $1', [req.user.id]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// 7. Get Orders (For Dashboard)
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, a.full_name, a.line1, a.city 
      FROM orders o 
      JOIN addresses a ON o.address_id = a.id 
      WHERE o.user_id = $1 ORDER BY o.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ── Startup ─────────────────────────────────────────────────────────────────
app.listen(port, () => console.log(`🚀 BrainyGrasp API running on http://localhost:${port}`));