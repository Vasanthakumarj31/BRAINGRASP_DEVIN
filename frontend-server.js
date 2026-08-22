/**
 * frontend-server.js — BrainyGrasp Dedicated Frontend Server
 * ─────────────────────────────────────────────────────────────
 * Port : 5500 (frontend only)
 * Serves:
 *   /           → frontend/index.html
 *   /admin/*    → admin/
 *   /affiliate/ → frontend/affiliate/
 *
 * Backend API is served SEPARATELY on port 3000 (backend/server.js).
 * All /api/* calls from the browser go to http://localhost:3000.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const FRONTEND_DIR  = path.join(__dirname, 'frontend');
const ADMIN_DIR     = path.join(__dirname, 'admin');

const MIME_TYPES = {
  '.html' : 'text/html',
  '.css'  : 'text/css',
  '.js'   : 'application/javascript',
  '.json' : 'application/json',
  '.png'  : 'image/png',
  '.jpg'  : 'image/jpeg',
  '.jpeg' : 'image/jpeg',
  '.gif'  : 'image/gif',
  '.svg'  : 'image/svg+xml',
  '.ico'  : 'image/x-icon',
  '.woff' : 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf'  : 'font/ttf',
  '.webp' : 'image/webp',
};

// Pages that must not be cached by the browser (auth-protected pages)
const NO_CACHE_PAGES = new Set([
  '/dashboard-new.html',
  '/profile-setup.html',
  '/checkout_cod.html',
  '/checkout.html',
]);

function resolveFilePath(cleanPath) {
  // /admin/* → serve from admin/
  if (cleanPath === '/admin' || cleanPath === '/admin/') {
    return path.join(ADMIN_DIR, 'index.html');
  }
  if (cleanPath.startsWith('/admin/')) {
    return path.join(ADMIN_DIR, cleanPath.slice('/admin/'.length));
  }

  // /frontend/* legacy prefix → strip and serve from frontend/
  if (cleanPath.startsWith('/frontend/')) {
    return path.join(FRONTEND_DIR, cleanPath.slice('/frontend/'.length));
  }
  if (cleanPath === '/frontend') {
    return path.join(FRONTEND_DIR, 'index.html');
  }

  // Root → frontend/index.html
  if (cleanPath === '/' || cleanPath === '') {
    return path.join(FRONTEND_DIR, 'index.html');
  }

  // Everything else → frontend/
  return path.join(FRONTEND_DIR, cleanPath);
}

const server = http.createServer((req, res) => {
  // CORS headers (development convenience)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const rawUrl    = req.url || '/';
  const cleanPath = rawUrl.split('?')[0];

  // Decode URL-encoded characters (e.g. %20 → space) so filenames with
  // spaces or special characters resolve correctly on disk.
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(cleanPath);
  } catch {
    decodedPath = cleanPath; // malformed URI — use raw path as fallback
  }


  let filePath = resolveFilePath(decodedPath);

  // If the resolved path is a directory, look for index.html inside it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  const ext         = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'text/html';

  // No-cache for protected pages
  if (NO_CACHE_PAGES.has(decodedPath)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send404(res, req.url);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

function send404(res, url) {
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head><title>404 - Page Not Found</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 40px;">
        <h1>404 - Page Not Found</h1>
        <p>The path <code>${url}</code> was not found.</p>
        <p><a href="/" style="color: #667eea;">Return to BrainyGrasp Home</a></p>
      </body>
    </html>
  `);
}

const PORT = 5500;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Frontend server  →  http://localhost:${PORT}`);
  console.log(`🛠️  Admin panel      →  http://localhost:${PORT}/admin`);
  console.log(`📁 Serving frontend from: ${FRONTEND_DIR}`);
  console.log(`📁 Serving admin    from: ${ADMIN_DIR}`);
  console.log(`⚡ Backend API       →  http://localhost:3000  (run separately)`);
});
