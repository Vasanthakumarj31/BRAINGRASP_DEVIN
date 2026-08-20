/**
 * BrainyGrasp — Shared Frontend Configuration
 *
 * Port architecture:
 *   5500 → Frontend static files  (frontend-server.js)
 *   3000 → Backend API only       (backend/server.js)
 *
 * HOW TO SET THE API URL FOR PRODUCTION:
 *   Option A (recommended): Add a <script> tag BEFORE this file in every HTML page:
 *     <script>window.BG_API_BASE = 'https://brainygrasp-api.onrender.com';</script>
 *
 *   Option B: Update PRODUCTION_API_URL below directly before deploying.
 *
 * Do NOT change the localhost detection logic — it ensures local dev works without config.
 */

// ── Configurable production backend API URL (override via window.BG_API_BASE) ──
const PRODUCTION_API_URL = window.BG_PRODUCTION_API_URL || 'https://braingrasp-devin-1.onrender.com';

// Backend API port for local development (port 3000 is dedicated to backend)
const LOCAL_API_PORT = '3000';

window.BG_CONFIG = {
  API_BASE: (() => {
    // 1. Allow a page-level override (most flexible, set via meta script)
    if (window.BG_API_BASE) return window.BG_API_BASE;

    // 2. Auto-detect local development & local network / IP access
    const host = window.location.hostname;
    const isLocal =
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.') ||
      host.startsWith('100.') ||
      host.endsWith('.local');

    if (isLocal) {
      // Frontend runs on 5500, backend API runs on 3000 in local dev
      const protocol = window.location.protocol || 'http:';
      const apiHost  = host || 'localhost';
      return `${protocol}//${apiHost}:${LOCAL_API_PORT}`;
    }

    // 3. Production: use configured backend URL or current window origin
    return PRODUCTION_API_URL || window.location.origin;
  })()
};