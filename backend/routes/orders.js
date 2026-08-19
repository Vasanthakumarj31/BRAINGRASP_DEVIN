/**
 * routes/orders.js — BrainyGrasp
 * ─────────────────────────────────────────────────────────────────────────────
 * Customer order & address endpoints (all require user authentication).
 *
 * Endpoints:
 *   POST /api/addresses    — Save a new delivery address
 *   POST /api/orders       — Place an order (COD or post-Razorpay)
 *   GET  /api/orders       — Fetch user's order history (Redis-cached, 1 h)
 */

'use strict';

const express   = require('express');
const router    = express.Router();
const pool      = require('../db');
const { getCached, setCache, deleteCache, CACHE_KEYS, TTL } = require('../redisClient');
const { authenticateToken } = require('../middleware/auth');
const shiprocket = require('../shiprocketService');

// ── POST /api/addresses ───────────────────────────────────────────────────────
router.post('/api/addresses', authenticateToken, async (req, res) => {
  const { full_name, phone, line1, city, state, pincode } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO addresses (user_id, full_name, phone, line1, city, state, pincode)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [req.user.id, full_name, phone, line1, city, state, pincode]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Address save error:', err);
    res.status(500).json({ error: 'Failed to save address' });
  }
});

// ── POST /api/orders ──────────────────────────────────────────────────────────
// Place order (COD or post-Razorpay). Handles affiliate commission in a transaction,
// then asynchronously books Shiprocket (non-fatal if Shiprocket is unavailable).
router.post('/api/orders', authenticateToken, async (req, res) => {
  const {
    address_id, items, subtotal, total,
    payment_method = 'cod', payment_id = null, affiliate_ref = null,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Resolve affiliate referral ─────────────────────────────────────────
    let resolvedAffiliateId = null;
    let commPct = 20.00;
    const cleanRef = affiliate_ref && typeof affiliate_ref === 'string'
      ? affiliate_ref.trim() : null;

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

    // ── Insert order ───────────────────────────────────────────────────────
    const result = await client.query(`
      INSERT INTO orders (user_id, address_id, items, subtotal, total, status, payment_method, payment_id, affiliate_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
    `, [
      req.user.id, address_id, JSON.stringify(items), subtotal, total,
      payment_method === 'razorpay' ? 'Paid' : 'Placed',
      payment_method, payment_id, resolvedAffiliateId,
    ]);

    const orderId = result.rows[0].id;

    // ── Affiliate commission ───────────────────────────────────────────────
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
              total_earned    = affiliate_wallets.total_earned    + $2,
              updated_at      = NOW()
        `, [resolvedAffiliateId, commAmount]);

        await client.query(`
          INSERT INTO wallet_transactions (affiliate_id, transaction_type, amount, description, reference_id)
          VALUES ($1, 'COMMISSION', $2, $3, $4)
        `, [resolvedAffiliateId, commAmount, `Commission from Order #${orderId}`, commRes.rows[0].id]);
      }
    }

    // ── Clear cart ─────────────────────────────────────────────────────────
    await client.query("UPDATE users SET cart = '[]' WHERE id = $1", [req.user.id]);
    await client.query('COMMIT');

    // ── Invalidate caches (outside transaction) ────────────────────────────
    await deleteCache(CACHE_KEYS.USER_CART(req.user.id)).catch(() => {});
    await deleteCache(CACHE_KEYS.USER_ORDERS(req.user.id)).catch(() => {});

    // ── Shiprocket (non-fatal async push) ──────────────────────────────────
    setImmediate(async () => {
      try {
        const [addrRes, userRes] = await Promise.all([
          pool.query('SELECT * FROM addresses WHERE id=$1', [address_id]),
          pool.query('SELECT name, email, phone FROM users WHERE id=$1', [req.user.id]),
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
        await deleteCache(CACHE_KEYS.USER_ORDERS(req.user.id)).catch(() => {});
        console.log(`✅ Shiprocket shipment booked for order #${orderId}: AWB ${awb}`);
      } catch (srErr) {
        console.error(`⚠️  Shiprocket push failed for order #${orderId}:`, srErr.message);
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

// ── GET /api/orders ───────────────────────────────────────────────────────────
// BUG FIX: Added a.state, a.pincode to the SELECT so the dashboard address
// section no longer shows "Coimbatore, undefined - undefined".
router.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const cachedOrders = await getCached(CACHE_KEYS.USER_ORDERS(req.user.id));
    if (cachedOrders) {
      return res.json(cachedOrders);
    }

    const result = await pool.query(`
      SELECT o.*,
             a.full_name, a.line1, a.line2,
             a.city,      a.state, a.pincode
      FROM orders o
      LEFT JOIN addresses a ON o.address_id = a.id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
    `, [req.user.id]);

    await setCache(CACHE_KEYS.USER_ORDERS(req.user.id), result.rows, TTL.USER_ORDERS);
    res.json(result.rows);
  } catch (err) {
    console.error('Orders fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

module.exports = router;
