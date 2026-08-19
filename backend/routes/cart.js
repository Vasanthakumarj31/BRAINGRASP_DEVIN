/**
 * routes/cart.js — BrainyGrasp
 * ─────────────────────────────────────────────────────────────────────────────
 * User cart endpoints (all require authentication).
 *
 * Endpoints:
 *   GET  /api/cart       — Fetch user's cart (Redis-first, 24 h)
 *   POST /api/cart/sync  — Sync guest cart → server on login
 */

'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getCached, setCache, CACHE_KEYS, TTL } = require('../redisClient');
const { authenticateToken } = require('../middleware/auth');

// ── GET /api/cart ─────────────────────────────────────────────────────────────
router.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const cachedCart = await getCached(CACHE_KEYS.USER_CART(req.user.id));
    if (cachedCart) {
      return res.json(cachedCart);
    }

    const result = await pool.query('SELECT cart FROM users WHERE id = $1', [req.user.id]);
    const cart   = result.rows[0]?.cart || [];

    await setCache(CACHE_KEYS.USER_CART(req.user.id), cart, TTL.USER_CART);
    res.json(cart);
  } catch (err) {
    console.error('Cart fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// ── POST /api/cart/sync ───────────────────────────────────────────────────────
router.post('/api/cart/sync', authenticateToken, async (req, res) => {
  const { items } = req.body;
  try {
    await pool.query(
      'UPDATE users SET cart = $1 WHERE id = $2',
      [JSON.stringify(items), req.user.id]
    );
    await setCache(CACHE_KEYS.USER_CART(req.user.id), items, TTL.USER_CART);
    res.json({ success: true });
  } catch (err) {
    console.error('Cart sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

module.exports = router;
