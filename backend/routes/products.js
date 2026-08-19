/**
 * routes/products.js — BrainyGrasp
 * ─────────────────────────────────────────────────────────────────────────────
 * Public product catalog endpoints.
 *
 * Endpoints:
 *   GET /api/products          — All products (Redis-cached, 1 h)
 *   GET /api/products/search   — Full-text search (Redis-cached, 30 min)
 *   GET /api/categories/search — Category search (Redis-cached, 30 min)
 */

'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getCached, setCache, CACHE_KEYS, TTL } = require('../redisClient');

// ── GET /api/products ─────────────────────────────────────────────────────────
router.get('/api/products', async (req, res) => {
  try {
    const cachedProducts = await getCached(CACHE_KEYS.ALL_PRODUCTS);
    if (cachedProducts && cachedProducts.length > 0) {
      return res.json(cachedProducts);
    }

    const result = await pool.query('SELECT * FROM products ORDER BY sales DESC');

    if (result.rows.length > 0) {
      await setCache(CACHE_KEYS.ALL_PRODUCTS, result.rows, TTL.PRODUCTS);
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Product fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ── GET /api/products/search ──────────────────────────────────────────────────
router.get('/api/products/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  try {
    const cacheKey = CACHE_KEYS.PRODUCT_SEARCH(q);
    const cachedResults = await getCached(cacheKey);
    if (cachedResults) {
      return res.json({ products: cachedResults });
    }

    const escapedQ = q.trim().replace(/[%_\\]/g, '\\$&');
    const pattern  = `%${escapedQ}%`;
    const result   = await pool.query(`
      SELECT id, name, category, price, original_price, image, badge, age, sales
      FROM products
      WHERE name       ILIKE $1
         OR category   ILIKE $1
         OR theme      ILIKE $1
         OR group_name ILIKE $1
      ORDER BY sales DESC
      LIMIT 20
    `, [pattern]);

    await setCache(cacheKey, result.rows, TTL.PRODUCT_SEARCH);
    res.json({ products: result.rows });
  } catch (err) {
    console.error('Product search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── GET /api/categories/search ────────────────────────────────────────────────
router.get('/api/categories/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  try {
    const cacheKey = CACHE_KEYS.CATEGORY_SEARCH(q);
    const cachedResults = await getCached(cacheKey);
    if (cachedResults) {
      return res.json({ categories: cachedResults });
    }

    const pattern = `%${q.trim()}%`;
    const result  = await pool.query(`
      SELECT category AS name, COUNT(*) AS product_count
      FROM products
      WHERE category ILIKE $1
      GROUP BY category
      ORDER BY product_count DESC
      LIMIT 10
    `, [pattern]);

    await setCache(cacheKey, result.rows, TTL.PRODUCT_SEARCH);
    res.json({ categories: result.rows });
  } catch (err) {
    console.error('Category search error:', err);
    res.status(500).json({ error: 'Category search failed' });
  }
});

module.exports = router;
