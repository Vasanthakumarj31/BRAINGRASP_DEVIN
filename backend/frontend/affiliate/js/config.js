/**
 * Shared API Configuration for Affiliate Portal
 */
const PRODUCTION_API_URL = 'https://braingrasp-devin-1.onrender.com';

window.AFF_CONFIG = {
  API_BASE: (() => {
    if (window.BG_API_BASE) return window.BG_API_BASE.replace(/\/$/, '');
    const host = window.location.hostname;
    const isLocal = !host || 
                    host === 'localhost' || 
                    host === '127.0.0.1' || 
                    host === '0.0.0.0' || 
                    host.startsWith('192.168.') || 
                    host.startsWith('10.') || 
                    host.startsWith('172.') || 
                    host.endsWith('.local');
    if (isLocal) {
      return `http://${host || 'localhost'}:3000`;
    }
    return PRODUCTION_API_URL;
  })()
};
