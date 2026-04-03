import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { initDb } from './database/db';
import { walletsRouter } from './routes/wallets';
import { tradesRouter } from './routes/trades';
import { startTracker, trackerEvents } from './services/walletTracker';
import { startCopyTradeEngine } from './services/copyTrade';
import type { WSMessage } from './types';

// ─── Init database ────────────────────────────────────────────────────────────
initDb();

// ─── Express app ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Rate limiting
app.use('/api', rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/wallets', walletsRouter);
app.use('/api/trades', tradesRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    helius: !!config.heliusApiKey,
    birdeye: !!config.birdeyeApiKey,
    traderWallet: config.traderWalletAddress || null,
    uptime: process.uptime(),
  });
});

// ─── Serve frontend build (production) ───────────────────────────────────────
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, {
    maxAge: 0,
    etag: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    },
  }));
  // SPA fallback — toutes les routes non-API renvoient index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
  console.log('[App] Serving frontend from:', frontendDist);
}

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const wsClients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log(`[WS] Client connected (total: ${wsClients.size})`);

  // Send initial status
  ws.send(JSON.stringify({
    type: 'TRACKER_STATUS',
    data: { connected: true, clients: wsClients.size },
    timestamp: Date.now(),
  } as WSMessage));

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`[WS] Client disconnected (total: ${wsClients.size})`);
  });

  ws.on('error', () => wsClients.delete(ws));
});

// ─── Broadcast tracker events to all WS clients ───────────────────────────────
trackerEvents.on('message', (msg: WSMessage) => {
  const payload = JSON.stringify(msg);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
});

// ─── Start services ───────────────────────────────────────────────────────────
startCopyTradeEngine();
startTracker();

// ─── Launch ───────────────────────────────────────────────────────────────────
server.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║          SOLSCRAPER — Solana Copy Trader         ║
╠══════════════════════════════════════════════════╣
║  URL: http://localhost:${config.port}                 ║
║  API: http://localhost:${config.port}/api             ║
║  WS:  ws://localhost:${config.port}/ws                ║
╚══════════════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT',  () => { server.close(); process.exit(0); });
