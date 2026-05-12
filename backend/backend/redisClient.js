const redis = require('redis');

/**
 * Redis Cache Management Module
 * Handles all caching logic for BrainyGrasp
 */

const IS_DEV = process.env.NODE_ENV !== 'production';

let client;

// ── Initialize Redis Connection ──────────────────────────────────────────────
async function initRedis() {
  try {
    client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || 'redis_password',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      }
    });

    client.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
    });

    client.on('connect', () => {
      console.log('✅ Redis Connected Successfully');
    });

    await client.connect();
    return true;
  } catch (err) {
    console.error('⚠️  Redis connection failed:', err.message);
    console.error('⚠️  Caching disabled. Application will still work without Redis.');
    return false;
  }
}

// ── Cache Helpers ────────────────────────────────────────────────────────────

/**
 * Get value from cache
 */
async function getCached(key) {
  try {
    if (!client) return null;
    const data = await client.get(key);
    if (data) {
      if (IS_DEV) console.log(`✅ Cache HIT: ${key}`);
      return JSON.parse(data);
    }
    if (IS_DEV) console.log(`⏭️  Cache MISS: ${key}`);
    return null;
  } catch (err) {
    console.error(`❌ Cache GET error for ${key}:`, err.message);
    return null;
  }
}

/**
 * Set value in cache with TTL
 * @param {string} key - Cache key
 * @param {*} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds
 */
async function setCache(key, value, ttlSeconds = 3600) {
  try {
    if (!client) return false;
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
    if (IS_DEV) console.log(`💾 Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    return true;
  } catch (err) {
    console.error(`❌ Cache SET error for ${key}:`, err.message);
    return false;
  }
}

/**
 * Delete cache key(s)
 */
async function deleteCache(...keys) {
  try {
    if (!client || keys.length === 0) return false;
    await client.del(keys);
    if (IS_DEV) console.log(`🗑️  Cache DELETED: ${keys.join(', ')}`);
    return true;
  } catch (err) {
    console.error(`❌ Cache DELETE error:`, err.message);
    return false;
  }
}

/**
 * Clear cache by pattern (e.g., "products:*")
 * Uses SCAN instead of KEYS to avoid blocking Redis on large datasets.
 */
async function clearCachePattern(pattern) {
  try {
    if (!client) return false;
    let deleted = 0;
    // Async SCAN iterator — non-blocking, safe for large key spaces
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      await client.del(key);
      deleted++;
    }
    if (IS_DEV && deleted > 0) {
      console.log(`🗑️  Cache CLEARED pattern: ${pattern} (${deleted} keys deleted)`);
    }
    return true;
  } catch (err) {
    console.error(`❌ Cache pattern clear error:`, err.message);
    return false;
  }
}

// ── Cache Key Builders ───────────────────────────────────────────────────────

const CACHE_KEYS = {
  // Products cache
  ALL_PRODUCTS: 'products:all',
  PRODUCT_BY_ID: (id) => `products:id:${id}`,
  PRODUCTS_BY_CATEGORY: (cat) => `products:category:${cat.toLowerCase()}`,
  
  // Search cache
  PRODUCT_SEARCH: (query) => `search:products:${query.toLowerCase()}`,
  CATEGORY_SEARCH: (query) => `search:categories:${query.toLowerCase()}`,
  
  // OTP cache
  OTP: (email) => `otp:${email.toLowerCase()}`,
  
  // User cache
  USER_PROFILE: (userId) => `user:profile:${userId}`,
  USER_CART: (userId) => `user:cart:${userId}`,
  USER_ORDERS: (userId) => `user:orders:${userId}`,
  
  // Session cache
  USER_SESSION: (userId) => `session:user:${userId}`,
};

// ── Cache TTL Constants ──────────────────────────────────────────────────────
const TTL = {
  PRODUCTS: 3600,           // 1 hour
  PRODUCT_SEARCH: 1800,     // 30 minutes
  OTP: 600,                 // 10 minutes
  USER_PROFILE: 1800,       // 30 minutes
  USER_CART: 86400,         // 24 hours
  USER_ORDERS: 3600,        // 1 hour
  USER_SESSION: 604800,     // 7 days
};

module.exports = {
  initRedis,
  getCached,
  setCache,
  deleteCache,
  clearCachePattern,
  CACHE_KEYS,
  TTL,
  getClient: () => client,
};
