/**
 * ⚠️  ONE-TIME MIGRATION TOOL — LOCAL / DEV ONLY
 *
 * This script adds missing profile columns to the users table.
 * It should NEVER be run in production directly.
 * For production, Render runs server.js which uses CREATE TABLE IF NOT EXISTS
 * and ALTER TABLE ADD COLUMN IF NOT EXISTS — those are the safe migration paths.
 *
 * Usage (local dev):
 *   1. Copy .env.example to .env and fill in your local DB credentials.
 *   2. Run: node update-schema.js
 */

// ── BUG FIX: Removed hardcoded credentials. Use env vars instead. ──────────
require('dotenv').config();
const { Pool } = require('pg');

// Guard: refuse to run if NODE_ENV is production
if (process.env.NODE_ENV === 'production') {
  console.error('❌ update-schema.js must NOT be run in production. Exiting.');
  process.exit(1);
}

// Support DATABASE_URL (cloud) or individual DB_* vars (local Docker)
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new Pool({
      user:     process.env.DB_USER     || 'postgres',
      host:     process.env.DB_HOST     || 'localhost',
      database: process.env.DB_NAME     || 'brainygras',
      password: process.env.DB_PASSWORD,          // required — no insecure default
      port:     parseInt(process.env.DB_PORT) || 5432,
    });

if (!process.env.DATABASE_URL && !process.env.DB_PASSWORD) {
  console.error('❌ Missing required env var: DB_PASSWORD (or DATABASE_URL). Set it in your .env file.');
  process.exit(1);
}

async function updateSchema() {
  console.log('🔧 Updating database schema...');

  try {
    // Check if profile_completed column exists
    const checkColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'profile_completed'
    `);

    if (checkColumn.rows.length === 0) {
      console.log('📝 Adding profile_completed column...');
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN profile_completed BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ profile_completed column added successfully');
    } else {
      console.log('✅ profile_completed column already exists');
    }

    // Check if other profile columns exist
    const profileColumns = [
      { name: 'gender',     def: 'VARCHAR(20)' },
      { name: 'address',    def: 'TEXT' },
      { name: 'city',       def: 'VARCHAR(100)' },
      { name: 'state',      def: 'VARCHAR(100)' },
      { name: 'pincode',    def: 'VARCHAR(10)' },
      { name: 'country',    def: 'VARCHAR(100)' },
      { name: 'updated_at', def: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    ];

    for (const { name, def } of profileColumns) {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = $1
      `, [name]);

      if (result.rows.length === 0) {
        console.log(`📝 Adding ${name} column...`);
        await pool.query(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
        console.log(`✅ ${name} column added successfully`);
      } else {
        console.log(`✅ ${name} column already exists`);
      }
    }

    console.log('🎉 Database schema updated successfully!');

    // Optional: print row count to confirm DB connection is correct
    const { rows } = await pool.query('SELECT COUNT(*) AS total FROM users');
    console.log(`ℹ️  Total users in database: ${rows[0].total}`);

  } catch (error) {
    console.error('❌ Schema update failed:', error);
  } finally {
    await pool.end();
  }
}

updateSchema();

