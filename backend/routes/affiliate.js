/**
 * routes/affiliate.js — BrainyGrasp
 * ─────────────────────────────────────────────────────────────────────────────
 * All Affiliate System API routes, both partner-facing and admin-facing.
 *
 * Partner (Public) Endpoints:
 *   GET  /api/affiliate/track            — Record a referral click (public)
 *   POST /api/affiliate/login            — Affiliate partner login
 *   GET  /api/affiliate/stats            — Partner dashboard stats
 *   GET  /api/affiliate/commissions      — Partner commission history
 *   GET  /api/affiliate/payouts          — Partner payout history
 *   GET  /api/affiliate/payout-config    — Next payout date info (public)
 *
 * Admin Endpoints:
 *   POST /api/admin/affiliates                   — Create affiliate account
 *   GET  /api/admin/affiliates                   — List all affiliates
 *   PUT  /api/admin/affiliates/:id               — Update affiliate
 *   GET  /api/admin/affiliate-wallets            — Wallets & payout overview
 *   POST /api/admin/affiliate-payouts/:id        — Mark affiliate as paid
 *   GET  /api/admin/affiliate-payouts            — All payout history
 *   GET  /api/admin/affiliate-settings           — Get payout config
 *   PUT  /api/admin/affiliate-settings           — Update payout config
 *
 * Mount in server.js:
 *   const affiliateRouter = require('./routes/affiliate');
 *   app.use('/', affiliateRouter);
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const { Pool } = require('pg');

const SECRET_KEY = process.env.JWT_SECRET;

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

// ── Auth Middleware: Affiliate Partner ──────────────────────────────────────
function authenticateAffiliate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Affiliate access denied' });
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err || decoded.role !== 'affiliate') {
      return res.status(403).json({ error: 'Affiliate access required' });
    }
    req.affiliate = decoded;
    next();
  });
}

// ── Auth Middleware: Admin ───────────────────────────────────────────────────
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Admin access denied' });
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err || decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  });
}

// ── Helper: Calculate next payout date & remaining days ─────────────────────
async function getPayoutConfig() {
  try {
    const res = await pool.query('SELECT payout_day FROM affiliate_settings WHERE id=1');
    const payoutDay = res.rows[0]?.payout_day || 1;

    const now = new Date();
    let day = parseInt(payoutDay) || 1;
    if (day < 1) day = 1;
    if (day > 28) day = 28;

    let nextPayout = new Date(now.getFullYear(), now.getMonth(), day);
    if (nextPayout <= now) {
      nextPayout = new Date(now.getFullYear(), now.getMonth() + 1, day);
    }
    const diffMs = nextPayout.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
      payoutDay: day,
      nextPayoutDate: nextPayout.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      nextPayoutIso: nextPayout.toISOString().split('T')[0],
      daysRemaining
    };
  } catch (err) {
    return { payoutDay: 1, nextPayoutDate: '1st of next month', daysRemaining: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ── PARTNER-FACING AFFILIATE ENDPOINTS ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// 1. Referral Track Endpoint (Public)
//    Called from common.js when a visitor lands via ?ref=CODE
router.get('/api/affiliate/track', async (req, res) => {
  const { ref } = req.query;
  if (!ref) return res.status(400).json({ error: 'Referral code is required' });

  try {
    const aff = await pool.query("SELECT id FROM affiliates WHERE affiliate_code=$1 AND status='ACTIVE'", [ref.trim()]);
    if (aff.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or inactive affiliate code' });
    }

    const affiliateId = aff.rows[0].id;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    await pool.query(`
      INSERT INTO affiliate_clicks (affiliate_id, ip_address, session_id, page_url)
      VALUES ($1, $2, $3, $4)
    `, [affiliateId, String(ip).split(',')[0].trim(), req.headers['user-agent'] || 'browser', req.headers['referer'] || '/']);

    res.json({ success: true, message: 'Click tracked successfully' });
  } catch (err) {
    console.error('Affiliate click track error:', err);
    res.status(500).json({ error: 'Tracking failed' });
  }
});

// 2. Affiliate Login
router.post('/api/affiliate/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    const userRes = await pool.query("SELECT * FROM users WHERE email=$1 AND role='AFFILIATE'", [email.trim().toLowerCase()]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid affiliate credentials' });
    }

    const user = userRes.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid affiliate credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid affiliate credentials' });
    }

    const affRes = await pool.query('SELECT * FROM affiliates WHERE user_id=$1', [user.id]);
    if (affRes.rows.length === 0) {
      return res.status(404).json({ error: 'Affiliate record not found' });
    }

    const aff = affRes.rows[0];
    if (aff.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is inactive. Contact admin.' });
    }

    const token = jwt.sign({
      id: user.id,
      affiliate_id: aff.id,
      affiliate_code: aff.affiliate_code,
      role: 'affiliate'
    }, SECRET_KEY, { expiresIn: '7d' });

    res.json({
      token,
      affiliate: {
        id: aff.id,
        code: aff.affiliate_code,
        name: user.name,
        email: user.email,
        phone: user.phone,
        commission_pct: aff.commission_pct
      }
    });
  } catch (err) {
    console.error('Affiliate login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 3. Get Current Affiliate Profile & Dashboard Stats
router.get('/api/affiliate/stats', authenticateAffiliate, async (req, res) => {
  const affId = req.affiliate.affiliate_id;
  try {
    const [clicksRes, salesRes, walletRes, affRes, userRes, payoutConfig] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM affiliate_clicks WHERE affiliate_id=$1', [affId]),
      pool.query("SELECT COUNT(*), COALESCE(SUM(order_amount),0) AS total_sales_val FROM commissions WHERE affiliate_id=$1 AND status!='CANCELLED'", [affId]),
      pool.query('SELECT current_balance, total_earned FROM affiliate_wallets WHERE affiliate_id=$1', [affId]),
      pool.query('SELECT affiliate_code, commission_pct, status, created_at FROM affiliates WHERE id=$1', [affId]),
      pool.query('SELECT name, email, phone FROM users WHERE id=$1', [req.affiliate.id]),
      getPayoutConfig()
    ]);

    const aff = affRes.rows[0] || {};
    const usr = userRes.rows[0] || {};
    const wlt = walletRes.rows[0] || { current_balance: 0, total_earned: 0 };

    let affCode = aff.affiliate_code;
    if (!affCode) {
      affCode = 'AFF' + String(affId).padStart(3, '0');
      await pool.query('UPDATE affiliates SET affiliate_code=$1 WHERE id=$2', [affCode, affId]).catch(() => {});
    }

    res.json({
      affiliate: {
        id: affId,
        code: affCode,
        commission_pct: parseFloat(aff.commission_pct || 20),
        status: aff.status || 'ACTIVE',
        name: usr.name,
        email: usr.email,
        phone: usr.phone,
        created_at: aff.created_at
      },
      stats: {
        totalClicks: parseInt(clicksRes.rows[0].count || 0),
        totalSalesCount: parseInt(salesRes.rows[0].count || 0),
        totalSalesValue: parseInt(salesRes.rows[0].total_sales_val || 0),
        totalEarned: parseInt(wlt.total_earned || 0),
        currentWalletBalance: parseInt(wlt.current_balance || 0),
        nextPayoutDate: payoutConfig.nextPayoutDate,
        daysRemaining: payoutConfig.daysRemaining
      }
    });
  } catch (err) {
    console.error('Affiliate stats error:', err);
    res.status(500).json({ error: 'Failed to fetch affiliate stats' });
  }
});

// 4. Get Affiliate Commissions List
router.get('/api/affiliate/commissions', authenticateAffiliate, async (req, res) => {
  const affId = req.affiliate.affiliate_id;
  try {
    const result = await pool.query(`
      SELECT c.*, o.status AS order_status, o.total AS order_total, o.created_at AS order_date
      FROM commissions c
      LEFT JOIN orders o ON c.order_id = o.id
      WHERE c.affiliate_id = $1
      ORDER BY c.created_at DESC
    `, [affId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Affiliate commissions fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch commissions' });
  }
});

// 5. Get Affiliate Payouts History
router.get('/api/affiliate/payouts', authenticateAffiliate, async (req, res) => {
  const affId = req.affiliate.affiliate_id;
  try {
    const result = await pool.query(`
      SELECT * FROM affiliate_payouts
      WHERE affiliate_id = $1
      ORDER BY paid_at DESC
    `, [affId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Affiliate payouts fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch payout history' });
  }
});

// 6. Get Payout Date Config (Public — used on login page too)
router.get('/api/affiliate/payout-config', async (req, res) => {
  const cfg = await getPayoutConfig();
  res.json(cfg);
});

// ═══════════════════════════════════════════════════════════════════════════
// ── ADMIN AFFILIATE MANAGEMENT APIs ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// A10. Create Affiliate Account (Admin)
router.post('/api/admin/affiliates', authenticateAdmin, async (req, res) => {
  const { name, email, password, phone, commission_pct = 20 } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const commPct = parseFloat(commission_pct) || 20;
    const hash = await bcrypt.hash(password, 10);
    const lowerEmail = email.trim().toLowerCase();

    let userId;
    const existingUser = await client.query('SELECT id, role FROM users WHERE email=$1', [lowerEmail]);

    if (existingUser.rows.length > 0) {
      const existing = existingUser.rows[0];
      const existingAff = await client.query('SELECT id FROM affiliates WHERE user_id=$1', [existing.id]);
      if (existingAff.rows.length > 0) {
        return res.status(400).json({ error: 'An affiliate account with this email already exists' });
      }
      await client.query(
        'UPDATE users SET name=$1, phone=COALESCE($2, phone), password_hash=$3, role=$4, updated_at=NOW() WHERE id=$5',
        [name, phone || null, hash, 'AFFILIATE', existing.id]
      );
      userId = existing.id;
    } else {
      const newUser = await client.query(
        'INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [name, lowerEmail, phone || null, hash, 'AFFILIATE']
      );
      userId = newUser.rows[0].id;
    }

    const affCodeRaw = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) + String(userId).padStart(3, '0');
    const affResult = await client.query(
      'INSERT INTO affiliates (user_id, affiliate_code, commission_pct, status) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, affCodeRaw, commPct, 'ACTIVE']
    );
    const affId = affResult.rows[0].id;

    const affCode = affCodeRaw + affId;
    await client.query('UPDATE affiliates SET affiliate_code=$1 WHERE id=$2', [affCode, affId]);

    await client.query(
      'INSERT INTO affiliate_wallets (affiliate_id, current_balance, total_earned) VALUES ($1, 0, 0) ON CONFLICT (affiliate_id) DO NOTHING',
      [affId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Affiliate created successfully',
      affiliate: { id: affId, user_id: userId, name, email: lowerEmail, affiliate_code: affCode, commission_pct: commPct }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Admin create affiliate error:', err);
    if (err.code === '23505') {
      if (err.detail?.includes('email')) {
        return res.status(400).json({ error: 'This email address is already registered to another account' });
      }
    }
    res.status(500).json({ error: err.message || 'Failed to create affiliate account' });
  } finally {
    client.release();
  }
});

// A11. Get All Affiliates (Admin)
router.get('/api/admin/affiliates', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        a.id, a.user_id, a.affiliate_code, a.commission_pct, a.status, a.created_at,
        u.name, u.email, u.phone,
        COALESCE(w.current_balance, 0) AS current_balance,
        COALESCE(w.total_earned, 0) AS total_earned,
        (SELECT COUNT(*) FROM affiliate_clicks WHERE affiliate_id = a.id) AS total_clicks,
        (SELECT COUNT(*) FROM commissions WHERE affiliate_id = a.id AND status!='CANCELLED') AS total_sales
      FROM affiliates a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN affiliate_wallets w ON a.id = w.affiliate_id
      ORDER BY a.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Admin list affiliates error:', err);
    res.status(500).json({ error: 'Failed to fetch affiliates' });
  }
});

// A12. Update Affiliate (Admin)
router.put('/api/admin/affiliates/:id', authenticateAdmin, async (req, res) => {
  const affId = parseInt(req.params.id);
  const { name, phone, commission_pct, status } = req.body;

  try {
    const affRes = await pool.query('SELECT user_id FROM affiliates WHERE id=$1', [affId]);
    if (affRes.rows.length === 0) return res.status(404).json({ error: 'Affiliate not found' });

    const userId = affRes.rows[0].user_id;

    if (name || phone !== undefined) {
      await pool.query('UPDATE users SET name=COALESCE($1, name), phone=COALESCE($2, phone) WHERE id=$3', [name, phone, userId]);
    }

    if (commission_pct !== undefined || status !== undefined) {
      await pool.query(`
        UPDATE affiliates
        SET commission_pct = COALESCE($1, commission_pct),
            status         = COALESCE($2, status),
            updated_at     = NOW()
        WHERE id = $3
      `, [commission_pct !== undefined ? parseFloat(commission_pct) : null, status || null, affId]);
    }

    res.json({ success: true, message: 'Affiliate updated successfully' });
  } catch (err) {
    console.error('Admin update affiliate error:', err);
    res.status(500).json({ error: 'Failed to update affiliate' });
  }
});

// A13. Get Monthly Payouts Overview (Admin)
router.get('/api/admin/affiliate-wallets', authenticateAdmin, async (req, res) => {
  try {
    const [payoutConfig, walletsRes] = await Promise.all([
      getPayoutConfig(),
      pool.query(`
        SELECT
          a.id AS affiliate_id, a.affiliate_code, a.status AS affiliate_status,
          u.name, u.email, u.phone,
          COALESCE(w.current_balance, 0) AS current_balance,
          COALESCE(w.total_earned, 0) AS total_earned,
          (SELECT MAX(paid_at) FROM affiliate_payouts WHERE affiliate_id = a.id) AS last_payout_date
        FROM affiliates a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN affiliate_wallets w ON a.id = w.affiliate_id
        ORDER BY w.current_balance DESC, a.id ASC
      `)
    ]);

    res.json({ payoutConfig, affiliates: walletsRes.rows });
  } catch (err) {
    console.error('Admin affiliate wallets error:', err);
    res.status(500).json({ error: 'Failed to fetch payout wallets' });
  }
});

// A14. Mark Affiliate As Paid (Admin Manual Payout)
router.post('/api/admin/affiliate-payouts/:affiliateId', authenticateAdmin, async (req, res) => {
  const affId = parseInt(req.params.affiliateId);
  const { payment_reference, admin_note } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const walletRes = await client.query('SELECT current_balance FROM affiliate_wallets WHERE affiliate_id=$1 FOR UPDATE', [affId]);
    if (walletRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Affiliate wallet not found' });
    }

    const currentBalance = parseInt(walletRes.rows[0].current_balance || 0);
    if (currentBalance <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Wallet balance is ₹0. Nothing to payout.' });
    }

    // 1. Create payout record
    const payoutRes = await client.query(`
      INSERT INTO affiliate_payouts (affiliate_id, amount, status, payment_reference, admin_note, paid_at)
      VALUES ($1, $2, 'PAID', $3, $4, NOW())
      RETURNING id, amount, paid_at
    `, [affId, currentBalance, payment_reference || null, admin_note || null]);

    const payout = payoutRes.rows[0];

    // 2. Log transaction
    await client.query(`
      INSERT INTO wallet_transactions (affiliate_id, transaction_type, amount, description, reference_id)
      VALUES ($1, 'PAYOUT', $2, $3, $4)
    `, [affId, currentBalance, 'Monthly payout recorded by admin', payout.id]);

    // 3. Reset wallet balance to 0 (total_earned remains unchanged)
    await client.query(`
      UPDATE affiliate_wallets
      SET current_balance = 0, updated_at = NOW()
      WHERE affiliate_id = $1
    `, [affId]);

    // 4. Update status of approved commissions to PAID
    await client.query(`
      UPDATE commissions
      SET status = 'PAID'
      WHERE affiliate_id = $1 AND status = 'APPROVED'
    `, [affId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Successfully paid ₹${currentBalance} to affiliate and reset wallet to ₹0`,
      payout
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Admin mark payout paid error:', err);
    res.status(500).json({ error: 'Failed to process payout' });
  } finally {
    client.release();
  }
});

// A15. Get All Payout History (Admin)
router.get('/api/admin/affiliate-payouts', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, a.affiliate_code, u.name AS affiliate_name, u.email AS affiliate_email
      FROM affiliate_payouts p
      JOIN affiliates a ON p.affiliate_id = a.id
      JOIN users u ON a.user_id = u.id
      ORDER BY p.paid_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Admin payout history error:', err);
    res.status(500).json({ error: 'Failed to fetch payout history' });
  }
});

// A16. Get Payout Settings (Admin)
router.get('/api/admin/affiliate-settings', authenticateAdmin, async (req, res) => {
  const cfg = await getPayoutConfig();
  res.json(cfg);
});

// A17. Update Payout Settings (Admin)
router.put('/api/admin/affiliate-settings', authenticateAdmin, async (req, res) => {
  const { payout_day } = req.body;
  let day = parseInt(payout_day);
  if (isNaN(day) || day < 1 || day > 28) {
    return res.status(400).json({ error: 'Payout day must be a number between 1 and 28' });
  }
  try {
    await pool.query('UPDATE affiliate_settings SET payout_day=$1 WHERE id=1', [day]);
    const updatedCfg = await getPayoutConfig();
    res.json({ success: true, message: `Monthly payout day updated to ${day}st/th`, config: updatedCfg });
  } catch (err) {
    console.error('Update affiliate settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
