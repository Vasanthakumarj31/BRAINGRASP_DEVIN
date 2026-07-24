/**
 * BrainGrasp Admin — API Configuration
 *
 * Production override (optional, add before this script in HTML):
 *   <script>window.BG_API_BASE = 'https://your-api.onrender.com';</script>
 *
 * Local dev auto-detects localhost and uses http://localhost:3000
 */

const PRODUCTION_API_URL = 'https://braingrasp-devin-1.onrender.com';

window.BG_ADMIN_CONFIG = {
  API_BASE: (() => {
    if (window.BG_API_BASE) return window.BG_API_BASE.replace(/\/$/, '');

    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
      return 'http://localhost:3000';
    }

    return PRODUCTION_API_URL;
  })()
};
