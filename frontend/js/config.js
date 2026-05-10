/**
 * BrainyGrasp – Shared Frontend Configuration
 *
 * Load this script BEFORE any other BrainyGrasp JS files so that
 * all modules read the API base URL from a single source of truth.
 *
 * To point to a different backend (staging / production) just change
 * API_BASE here – nothing else needs to be touched.
 */
window.BG_CONFIG = {
  API_BASE: 'http://localhost:3000'
};
