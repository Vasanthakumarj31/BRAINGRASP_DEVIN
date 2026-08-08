/**
 * routes/shiprocket.js — BrainyGrasp
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles inbound Shiprocket tracking webhooks.
 *
 * Shiprocket webhook setup:
 *   1. In Shiprocket → Settings → API → Webhooks, add your endpoint URL:
 *      https://your-backend.onrender.com/api/webhooks/shiprocket?token=YOUR_SECRET
 *   2. Set SHIPROCKET_WEBHOOK_SECRET in .env to the same value you use above.
 *
 * Shiprocket does NOT sign webhook payloads with HMAC (unlike Razorpay).
 * We authenticate using the shared secret passed as a query parameter.
 *
 * Mount in server.js:
 *   const shiprocketRouter = require('./routes/shiprocket');
 *   app.use('/api/webhooks', shiprocketRouter);
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');
const { deleteCache, CACHE_KEYS } = require('../redisClient');
const { mapShiprocketStatus } = require('../shiprocketService');

// ── DB pool (re-uses the same env vars as server.js) ────────────────────────
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new Pool({
      user:     process.env.DB_USER     || 'postgres',
      host:     process.env.DB_HOST     || 'localhost',
      database: process.env.DB_NAME     || 'brainygras',
      password: process.env.DB_PASSWORD,
      port:     parseInt(process.env.DB_PORT) || 5432,
    });

// ── Webhook secret validation middleware ─────────────────────────────────────
function validateWebhookSecret(req, res, next) {
  const secret = process.env.SHIPROCKET_WEBHOOK_SECRET;

  // If no secret is configured, skip validation in dev mode only
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ SHIPROCKET_WEBHOOK_SECRET not set in production. Rejecting webhook.');
      return res.status(401).json({ error: 'Webhook secret not configured' });
    }
    console.warn('⚠️  SHIPROCKET_WEBHOOK_SECRET not set — skipping validation (dev mode)');
    return next();
  }

  const provided = req.query.token;
  if (!provided || provided !== secret) {
    console.warn('⚠️  Shiprocket webhook: invalid or missing token');
    return res.status(401).json({ error: 'Invalid webhook token' });
  }

  next();
}

// ── POST /api/webhooks/shiprocket ────────────────────────────────────────────
// Shiprocket calls this endpoint on every tracking status change.
router.post('/shiprocket', validateWebhookSecret, async (req, res) => {
  // Respond 200 immediately — Shiprocket expects a fast response.
  res.status(200).json({ received: true });

  // Process asynchronously so we don't block the response
  setImmediate(async () => {
    try {
      const payload = req.body;

      // Shiprocket webhook payload structure (v2):
      // { awb: "xxx", current_status: "Delivered", etd: "2026-08-12", courier_name: "Blue Dart", ... }
      const awb         = payload?.awb || payload?.awb_code;
      const srStatus    = payload?.current_status || payload?.status;
      const etd         = payload?.etd || payload?.estimated_delivery_date;
      const courierName = payload?.courier_name || '';

      if (!awb || !srStatus) {
        console.warn('Shiprocket webhook: missing awb or status in payload', payload);
        return;
      }

      const internalStatus = mapShiprocketStatus(srStatus);

      // Parse estimated delivery date
      let estimatedDelivery = null;
      if (etd) {
        try {
          estimatedDelivery = new Date(etd).toISOString().split('T')[0];
        } catch { /* ignore */ }
      }

      // Find matching order by AWB
      const orderRes = await pool.query(
        'SELECT id, user_id, status FROM orders WHERE awb_number = $1',
        [String(awb)]
      );

      if (orderRes.rows.length === 0) {
        console.warn(`Shiprocket webhook: no order found with AWB ${awb}`);
        return;
      }

      const order = orderRes.rows[0];

      // Build the UPDATE — always update tracking_status; only update main status
      // if the new internal status is a meaningful forward progression.
      // We never overwrite 'Cancelled' with a tracking update.
      const TERMINAL_STATUSES = ['Delivered', 'Cancelled', 'RTO'];
      const shouldUpdateMainStatus =
        internalStatus &&
        !TERMINAL_STATUSES.includes(order.status) &&
        internalStatus !== order.status;

      const updateQuery = shouldUpdateMainStatus
        ? `UPDATE orders
           SET tracking_status   = $1,
               status            = $2,
               estimated_delivery = COALESCE($3, estimated_delivery),
               courier_name      = COALESCE(NULLIF($4, ''), courier_name)
           WHERE id = $5`
        : `UPDATE orders
           SET tracking_status   = $1,
               estimated_delivery = COALESCE($3, estimated_delivery),
               courier_name      = COALESCE(NULLIF($4, ''), courier_name)
           WHERE id = $5`;

      const updateParams = shouldUpdateMainStatus
        ? [srStatus, internalStatus, estimatedDelivery, courierName, order.id]
        : [srStatus, null, estimatedDelivery, courierName, order.id];

      // For the non-main-status query we need to fix param positions
      const finalQuery = shouldUpdateMainStatus
        ? updateQuery
        : `UPDATE orders
           SET tracking_status   = $1,
               estimated_delivery = COALESCE($2, estimated_delivery),
               courier_name      = COALESCE(NULLIF($3, ''), courier_name)
           WHERE id = $4`;

      const finalParams = shouldUpdateMainStatus
        ? [srStatus, internalStatus, estimatedDelivery, courierName, order.id]
        : [srStatus, estimatedDelivery, courierName, order.id];

      await pool.query(finalQuery, finalParams);

      // Invalidate user's order cache so the dashboard refreshes
      if (order.user_id) {
        await deleteCache(CACHE_KEYS.USER_ORDERS(order.user_id)).catch(() => {});
      }

      console.log(
        `📦 Shiprocket webhook processed: Order #${order.id} | AWB ${awb} | ` +
        `Status: "${srStatus}" → internal: "${internalStatus || '(unchanged)'}"`
      );

    } catch (err) {
      console.error('❌ Shiprocket webhook processing error:', err.message);
    }
  });
});

// ── GET /api/webhooks/shiprocket ─────────────────────────────────────────────
// Health-check / verification endpoint (some platforms ping this on setup)
router.get('/shiprocket', (req, res) => {
  res.json({ status: 'BrainyGrasp Shiprocket webhook endpoint is active' });
});

module.exports = router;
