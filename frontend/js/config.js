/**
 * BrainyGrasp — Shared Frontend Configuration
 *
 * HOW TO SET THE API URL FOR PRODUCTION:
 *   Option A (recommended): Add a <script> tag BEFORE this file in every HTML page:
 *     <script>window.BG_API_BASE = 'https://brainygrasp-api.onrender.com';</script>
 *
 *   Option B: Update PRODUCTION_API_URL below directly before deploying to Vercel.
 *
 * Do NOT change the localhost detection logic — it ensures local dev works without config.
 */

// ── CHANGE THIS to your Render/Railway backend URL before deploying ──
const PRODUCTION_API_URL = 'https://braingrasp-devin-1.onrender.com';

window.BG_CONFIG = {
  API_BASE: (() => {
    // 1. Allow a page-level override (most flexible, set via meta script)
    if (window.BG_API_BASE) return window.BG_API_BASE;

    // 2. Auto-detect local development & local network / IP access
    const host = window.location.hostname;
    const isLocal = !host || 
                    host === 'localhost' || 
                    host === '127.0.0.1' || 
                    host === '0.0.0.0' || 
                    host.startsWith('192.168.') || 
                    host.startsWith('10.') || 
                    host.startsWith('172.') || 
                    host.startsWith('100.') || 
                    host.endsWith('.local');

    if (isLocal) {
      const port = window.location.port ? `:${window.location.port}` : ':3000';
      const protocol = window.location.protocol && window.location.protocol.startsWith('http') 
        ? window.location.protocol 
        : 'http:';
      return `${protocol}//${host || 'localhost'}${port}`;
    }

    // 3. Production: use the configured backend URL
    return PRODUCTION_API_URL;
  })()
};