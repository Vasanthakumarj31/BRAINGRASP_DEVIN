/**
 * routes/admin.js — BrainyGrasp
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin panel API endpoints.
 *
 * All routes require a valid admin JWT (role === 'admin').
 *
 * Endpoints:
 *   POST /api/admin/login
 *   GET  /api/admin/products
 *   POST /api/admin/products
 *   PUT  /api/admin/products/:id
 *   DELETE /api/admin/products/:id
 *   GET  /api/admin/dashboard
 *   GET  /api/admin/orders
 *   GET  /api/admin/orders/:id
 *   PUT  /api/admin/orders/:id/status
 *   POST /api/admin/orders/:id/push-shiprocket
 *   POST /api/admin/orders/:id/refresh-tracking
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const pool     = require('../db');
const { deleteCache, clearCachePattern, CACHE_KEYS } = require('../redisClient');
const shiprocket = require('../shiprocketService');

const SECRET_KEY = process.env.JWT_SECRET;

// ── Admin Auth Middleware ─────────────────────────────────────────────────────
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

// ── Startup guard: require admin credentials ─────────────────────────────────
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
  throw new Error(
    '❌ Missing required env vars: ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env'
  );
}

// ── POST /api/admin/login ─────────────────────────────────────────────────────
router.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const ADMIN_USER = process.env.ADMIN_USERNAME || '';
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || '';

  const matches = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  };

  if (!username || !password || !matches(username, ADMIN_USER) || !matches(password, ADMIN_PASS)) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const token = jwt.sign({ role: 'admin', username }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ token });
});

// ── GET /api/admin/products ───────────────────────────────────────────────────
router.get('/api/admin/products', authenticateAdmin, async (req, res) => {
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

// ── Helper ────────────────────────────────────────────────────────────────────
function parseSkills(skills) {
  if (Array.isArray(skills)) return JSON.stringify(skills);
  if (typeof skills === 'string' && skills.trim()) {
    return JSON.stringify(skills.split(',').map(s => s.trim()).filter(Boolean));
  }
  return '[]';
}

function rejectGooglePhotos(image, res) {
  if (
    typeof image === 'string' &&
    (image.includes('photos.google.com') || image.includes('photos.app.goo.gl'))
  ) {
    res.status(400).json({
      error: 'Google Photos web sharing links are not direct image files. Please enter a direct image URL.',
    });
    return true;
  }
  return false;
}

// ── POST /api/admin/products ──────────────────────────────────────────────────
router.post('/api/admin/products', authenticateAdmin, async (req, res) => {
  const {
    name, group_name, price, original_price, save, age, age_group,
    badge, image, category, skills, theme, type, launch_date, sales, reviews, offer,
  } = req.body;

  if (!name || !group_name || price === undefined || price === null || !image) {
    return res.status(400).json({ error: 'name, group_name, price, and image are required' });
  }

  const parsedPrice = parseInt(price);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'Price must be a valid positive number' });
  }

  if (rejectGooglePhotos(image, res)) return;

  try {
    const result = await pool.query(`
      INSERT INTO products
        (name, group_name, price, original_price, save, age, age_group,
         badge, image, category, skills, theme, type, launch_date, sales, reviews, offer)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *
    `, [
      name, group_name, parsedPrice,
      parseInt(original_price || price) || parsedPrice,
      save || '0%', age || null, age_group || null,
      badge || null, image, category || null,
      parseSkills(skills), theme || null, type || 'Single Products',
      launch_date || new Date().toISOString().split('T')[0],
      parseInt(sales || 0) || 0, parseInt(reviews || 0) || 0,
      offer || 'Buy any 2 | Get FLAT 10% OFF',
    ]);

    await clearCachePattern('products*').catch(() => {});
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Admin add product error:', err);
    res.status(500).json({ error: err.message || 'Failed to add product' });
  }
});

// ── PUT /api/admin/products/:id ───────────────────────────────────────────────
router.put('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    name, group_name, price, original_price, save, age, age_group,
    badge, image, category, skills, theme, type, launch_date, sales, reviews, offer,
  } = req.body;

  const parsedPrice = parseInt(price);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'Price must be a valid positive number' });
  }

  if (rejectGooglePhotos(image, res)) return;

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
      name, group_name, parsedPrice,
      parseInt(original_price || price) || parsedPrice,
      save || '0%', age || null, age_group || null,
      badge || null, image, category || null,
      parseSkills(skills), theme || null, type || 'Single Products',
      launch_date || null,
      parseInt(sales || 0) || 0, parseInt(reviews || 0) || 0,
      offer || 'Buy any 2 | Get FLAT 10% OFF',
      parseInt(id),
    ]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    await clearCachePattern('products*').catch(() => {});
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin update product error:', err);
    res.status(500).json({ error: err.message || 'Failed to update product' });
  }
});

// ── DELETE /api/admin/products/:id ────────────────────────────────────────────
router.delete('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
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

// ── GET /api/admin/dashboard ──────────────────────────────────────────────────
router.get('/api/admin/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const [
      productsRes, ordersCountRes, revenueRes,
      confirmedRes, pendingRes, deliveredRes,
      usersWithCartRes, recentOrdersRes,
      topSellingRes, lowSellingRes, cartItemsRes, totalUsersRes,
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
      pool.query('SELECT COUNT(*) FROM users'),
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
        totalUsers:      parseInt(totalUsersRes.rows[0].count),
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

// ── GET /api/admin/orders ─────────────────────────────────────────────────────
router.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
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
        `SELECT COUNT(*) FROM orders o LEFT JOIN users u ON o.user_id = u.id ${whereClause}`,
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
         LEFT JOIN users     u ON o.user_id     = u.id
         LEFT JOIN addresses a ON o.address_id  = a.id
         ${whereClause}
         ORDER BY o.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
    ]);

    res.json({ orders: ordersRes.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error('Admin orders list error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ── GET /api/admin/orders/:id ─────────────────────────────────────────────────
router.get('/api/admin/orders/:id', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*,
             u.name  AS customer_name,
             u.email AS customer_email,
             a.full_name AS addr_name,
             a.phone     AS addr_phone,
             a.line1, a.city, a.state, a.pincode
      FROM orders o
      LEFT JOIN users     u ON o.user_id    = u.id
      LEFT JOIN addresses a ON o.address_id = a.id
      WHERE o.id = $1
    `, [parseInt(req.params.id)]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin order detail error:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ── PUT /api/admin/orders/:id/status ─────────────────────────────────────────
router.put('/api/admin/orders/:id/status', authenticateAdmin, async (req, res) => {
  const { status, expected_delivery, delivery_date, admin_note } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });

  try {
    const result = await pool.query(`
      UPDATE orders
      SET status=$1, expected_delivery=$2, delivery_date=$3, admin_note=$4
      WHERE id=$5
      RETURNING id, user_id, status, expected_delivery, delivery_date, admin_note
    `, [status, expected_delivery || null, delivery_date || null, admin_note || null, parseInt(req.params.id)]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const updated = result.rows[0];
    if (updated.user_id) {
      await deleteCache(CACHE_KEYS.USER_ORDERS(updated.user_id)).catch(() => {});
    }

    // ── Reverse affiliate commission on cancellation ───────────────────────
    if (status.toLowerCase() === 'cancelled') {
      const commCheck = await pool.query(
        "SELECT * FROM commissions WHERE order_id=$1 AND status='APPROVED'",
        [parseInt(req.params.id)]
      );
      if (commCheck.rows.length > 0) {
        const comm = commCheck.rows[0];
        await pool.query("UPDATE commissions SET status='CANCELLED' WHERE id=$1", [comm.id]);
        await pool.query(`
          UPDATE affiliate_wallets
          SET current_balance = GREATEST(0, current_balance - $1),
              total_earned    = GREATEST(0, total_earned    - $1),
              updated_at      = NOW()
          WHERE affiliate_id = $2
        `, [comm.commission_amount, comm.affiliate_id]);
        await pool.query(`
          INSERT INTO wallet_transactions (affiliate_id, transaction_type, amount, description, reference_id)
          VALUES ($1, 'REVERSAL', $2, $3, $4)
        `, [comm.affiliate_id, -comm.commission_amount,
            `Commission reversed for cancelled Order #${req.params.id}`, comm.id]);
      }
    }

    res.json({ success: true, order: updated });
  } catch (err) {
    console.error('Admin order status update error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ── POST /api/admin/orders/:id/push-shiprocket ────────────────────────────────
router.post('/api/admin/orders/:id/push-shiprocket', authenticateAdmin, async (req, res) => {
  const orderId = parseInt(req.params.id);
  try {
    const orderRes = await pool.query(`
      SELECT o.*, a.full_name, a.line1, a.line2, a.city, a.state, a.pincode, a.phone AS addr_phone,
             u.name AS user_name, u.email AS user_email, u.phone AS user_phone
      FROM orders o
      LEFT JOIN addresses a ON o.address_id = a.id
      LEFT JOIN users     u ON o.user_id    = u.id
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

// ── POST /api/admin/orders/:id/refresh-tracking ───────────────────────────────
router.post('/api/admin/orders/:id/refresh-tracking', authenticateAdmin, async (req, res) => {
  const orderId = parseInt(req.params.id);
  try {
    const orderRes = await pool.query(
      'SELECT id, user_id, awb_number FROM orders WHERE id = $1', [orderId]
    );
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orderRes.rows[0];
    if (!order.awb_number) {
      return res.status(400).json({ error: 'No AWB assigned to this order yet.' });
    }

    const tracking = await shiprocket.getTracking(order.awb_number);

    const updateParams = [
      tracking.srStatus || null,
      tracking.estimatedDelivery || null,
      tracking.courierName || null,
    ];
    let updateSql = `
      UPDATE orders
      SET tracking_status    = COALESCE($1, tracking_status),
          estimated_delivery = COALESCE($2, estimated_delivery),
          courier_name       = COALESCE(NULLIF($3, ''), courier_name)
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
      tracking_status:    tracking.srStatus,
      status:             tracking.currentStatus,
      estimated_delivery: tracking.estimatedDelivery,
      courier_name:       tracking.courierName,
    });
  } catch (err) {
    console.error('Admin refresh-tracking error:', err);
    res.status(500).json({ error: err.message || 'Failed to refresh tracking status' });
  }
});

module.exports = router;
module.exports.authenticateAdmin = authenticateAdmin;
