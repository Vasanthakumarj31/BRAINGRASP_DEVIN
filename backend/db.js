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

const useSsl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      user:     process.env.DB_USER     || 'postgres',
      host:     process.env.DB_HOST     || 'localhost',
      database: process.env.DB_NAME     || 'brainygras',
      password: process.env.DB_PASSWORD,
      port:     parseInt(process.env.DB_PORT) || 5432,
      ssl:      useSsl ? { rejectUnauthorized: false } : false,
    });

module.exports = pool;
