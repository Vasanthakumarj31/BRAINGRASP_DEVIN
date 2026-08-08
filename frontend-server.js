const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Extract clean path without query parameters
  const rawUrl = req.url || '/';
  const cleanPath = rawUrl.split('?')[0];

  // Direct checkout protection check
  if (cleanPath === '/checkout' || cleanPath === '/checkout_cod.html' || cleanPath === '/checkout.html') {
    const hasToken = req.url.includes('token=') || (req.headers.authorization && req.headers.authorization.startsWith('Bearer '));
    if (!hasToken) {
      res.writeHead(302, { 'Location': '/login.html?redirect=checkout_cod.html' });
      res.end();
      return;
    }
  }

  // Resolve disk path
  let relativePath = cleanPath;
  if (relativePath.startsWith('/frontend/')) {
    relativePath = relativePath.substring('/frontend/'.length);
  } else if (relativePath === '/frontend') {
    relativePath = 'index.html';
  }

  if (relativePath === '/' || relativePath === '') {
    relativePath = 'index.html';
  }

  let filePath = path.join(__dirname, 'frontend', relativePath);

  // If path is a directory, append index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/html';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fallback: check if root index.html exists
      const rootIndex = path.join(__dirname, 'index.html');
      if (fs.existsSync(rootIndex)) {
        return fs.readFile(rootIndex, (rErr, rData) => {
          if (!rErr) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            return res.end(rData);
          }
          send404(res, req.url);
        });
      }
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

const PORT = 5501;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Frontend server running on http://localhost:${PORT}`);
  console.log(`🌐 Accessible from network devices at http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving files from: ${path.join(__dirname, 'frontend')}`);
});
