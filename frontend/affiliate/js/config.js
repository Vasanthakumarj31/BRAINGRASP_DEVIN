/**
 * Shared API Configuration for Affiliate Portal
 */
const PRODUCTION_API_URL = 'https://braingrasp-devin-1.onrender.com';

window.AFF_CONFIG = {
  API_BASE: (() => {
    if (window.BG_API_BASE) return window.BG_API_BASE;
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
      return 'http://localhost:3000';
    }
    return PRODUCTION_API_URL;
  })()
};
