/**
 * BrainyGrasp – Shared Frontend Configuration
 *
 * Load this script BEFORE any other BrainyGrasp JS files so that
 * all modules read the API base URL from a single source of truth.
 *
 * Dev:  script auto-detects localhost and uses http://localhost:3000
 * Prod: set window.BG_API_BASE on the server (via a <meta> tag or
 *       server-rendered inline script) OR update the fallback URL below.
 */
window.BG_CONFIG = {
  API_BASE: (() => {
    // 1. Allow server to inject the production URL at runtime
    if (window.BG_API_BASE) return window.BG_API_BASE;
    // 2. Auto-detect local development
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
      return 'http://localhost:3000';
    }
    // 3. Production: same-origin API (assumes backend serves /api/* on same domain)
    //    Override this with your actual API domain if backend is on a subdomain.
    return window.location.origin;
  })()
};
