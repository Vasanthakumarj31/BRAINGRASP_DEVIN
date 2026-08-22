/**
 * db.js — BrainyGrasp
 * ─────────────────────────────────────────────────────────────────────────────
 * Single shared PostgreSQL connection pool.
 *
 * All route files (routes/*.js) and server.js import this module so the
 * entire application shares ONE pool instead of creating multiple pools.
 *
 * Configuration (via .env):
 *   DATABASE_URL          — Neon/Supabase/cloud Postgres connection string
 *   DB_USER / DB_HOST / DB_NAME / DB_PASSWORD / DB_PORT — local Docker vars
 */

'use strict';

const { Pool } = require('pg');

const useSsl = process.env.DB_SSL === 'true' || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require'));

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    }
  : {
      user:     process.env.DB_USER     || 'postgres',
      host:     process.env.DB_HOST     || 'localhost',
      database: process.env.DB_NAME     || 'brainygras',
      password: process.env.DB_PASSWORD,
      port:     parseInt(process.env.DB_PORT) || 5432,
      ssl:      useSsl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

module.exports = pool;
