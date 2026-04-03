// Simple static server — sert le build production sur port 3000
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');
const API  = 'http://localhost:3001';

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  // Proxy /api and /ws to backend
  if (req.url.startsWith('/api') || req.url.startsWith('/ws')) {
    const { request } = await import('http');
    const options = {
      hostname: 'localhost', port: 3001,
      path: req.url, method: req.method,
      headers: req.headers,
    };
    const proxy = request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    req.pipe(proxy);
    return;
  }

  // Serve static files
  let filePath = join(DIST, req.url === '/' ? 'index.html' : req.url);
  if (!existsSync(filePath)) filePath = join(DIST, 'index.html');
  
  const ext = extname(filePath);
  res.setHeader('Content-Type', MIME[ext] || 'text/plain');
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(200);
  res.end(readFileSync(filePath));
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Frontend ready: http://localhost:3000');
});
