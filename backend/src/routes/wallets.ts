import { Router } from 'express';
import { db } from '../database/db';
import { addWallet, removeWallet, backfillWallet, refreshWalletStats } from '../services/walletTracker';
import { getWalletPortfolio, getTopTraders, getWalletPnl, getTrendingTokens, getNewTokens } from '../services/birdeye';
import { upsertCopyTradeConfig, getCopyTradeConfig } from '../services/copyTrade';
import type { TrackedWallet } from '../types';

export const walletsRouter = Router();

// ─── GET /api/wallets — list all tracked wallets ──────────────────────────────
walletsRouter.get('/', (_req, res) => {
  const wallets = db.prepare('SELECT * FROM tracked_wallets ORDER BY total_pnl_usd DESC').all();
  res.json({ success: true, data: wallets });
});

// ─── POST /api/wallets — add a wallet to track ────────────────────────────────
walletsRouter.post('/', async (req, res) => {
  const { address, label = '', tags = [] } = req.body as { address: string; label?: string; tags?: string[] };
  if (!address || address.length < 32) {
    res.status(400).json({ success: false, error: 'Invalid wallet address' });
    return;
  }
  try {
    db.prepare(`
      INSERT OR IGNORE INTO tracked_wallets (address, label, tags)
      VALUES (?, ?, ?)
    `).run(address, label, JSON.stringify(tags));
    addWallet(address);

    // Backfill in background
    backfillWallet(address, 100).catch(console.error);

    const wallet = db.prepare('SELECT * FROM tracked_wallets WHERE address = ?').get(address);
    res.json({ success: true, data: wallet });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ─── PATCH /api/wallets/:address — update label/tags/active ──────────────────
walletsRouter.patch('/:address', (req, res) => {
  const { address } = req.params;
  const { label, tags, isActive } = req.body as { label?: string; tags?: string[]; isActive?: boolean };
  const updates: string[] = [];
  const params: (string | number)[] = [];
  if (label !== undefined) { updates.push('label = ?'); params.push(label); }
  if (tags !== undefined)  { updates.push('tags = ?'); params.push(JSON.stringify(tags)); }
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    params.push(isActive ? 1 : 0);
    if (!isActive) removeWallet(address);
    else addWallet(address);
  }
  if (updates.length === 0) { res.status(400).json({ success: false, error: 'Nothing to update' }); return; }
  params.push(address);
  db.prepare(`UPDATE tracked_wallets SET ${updates.join(', ')}, updated_at = datetime('now') WHERE address = ?`).run(...params);
  res.json({ success: true });
});

// ─── DELETE /api/wallets/:address ─────────────────────────────────────────────
walletsRouter.delete('/:address', (req, res) => {
  removeWallet(req.params.address);
  db.prepare('DELETE FROM tracked_wallets WHERE address = ?').run(req.params.address);
  res.json({ success: true });
});

// ─── GET /api/wallets/:address/portfolio ──────────────────────────────────────
walletsRouter.get('/:address/portfolio', async (req, res) => {
  const portfolio = await getWalletPortfolio(req.params.address);
  res.json({ success: true, data: portfolio });
});

// ─── GET /api/wallets/:address/pnl ────────────────────────────────────────────
walletsRouter.get('/:address/pnl', async (req, res) => {
  const { timeframe = '30d' } = req.query as { timeframe?: '24h' | '7d' | '30d' };
  const pnl = await getWalletPnl(req.params.address, timeframe);
  res.json({ success: true, data: pnl });
});

// ─── GET /api/wallets/:address/transactions ───────────────────────────────────
walletsRouter.get('/:address/transactions', (req, res) => {
  const { limit = 50, offset = 0 } = req.query as { limit?: string; offset?: string };
  const txs = db.prepare(`
    SELECT * FROM transactions WHERE wallet_address = ?
    ORDER BY block_time DESC LIMIT ? OFFSET ?
  `).all(req.params.address, parseInt(limit as string), parseInt(offset as string));
  res.json({ success: true, data: txs });
});

// ─── POST /api/wallets/:address/refresh ───────────────────────────────────────
walletsRouter.post('/:address/refresh', async (req, res) => {
  const count = await backfillWallet(req.params.address, 100);
  res.json({ success: true, data: { imported: count } });
});

// ─── GET /api/wallets/:address/copy-config ────────────────────────────────────
walletsRouter.get('/:address/copy-config', (req, res) => {
  const cfg = getCopyTradeConfig(req.params.address);
  res.json({ success: true, data: cfg ?? null });
});

// ─── PUT /api/wallets/:address/copy-config ────────────────────────────────────
walletsRouter.put('/:address/copy-config', (req, res) => {
  upsertCopyTradeConfig({ wallet_address: req.params.address, ...req.body });
  res.json({ success: true });
});

// ─── GET /api/wallets/discover/top-traders ────────────────────────────────────
walletsRouter.get('/discover/top-traders', async (req, res) => {
  const { timeframe = '7d', sortBy = 'pnl', limit = 50 } = req.query as {
    timeframe?: '24h' | '7d' | '30d';
    sortBy?: 'pnl' | 'winRate' | 'volume';
    limit?: string;
  };
  const traders = await getTopTraders({ timeframe, sortBy, limit: parseInt(limit as string) });
  // Annotate with "already tracked" flag
  const tracked = new Set(
    (db.prepare('SELECT address FROM tracked_wallets').all() as { address: string }[]).map(w => w.address)
  );
  const result = traders.map(t => ({ ...t, isTracked: tracked.has(t.address) }));
  res.json({ success: true, data: result });
});

// ─── GET /api/wallets/discover/trending ───────────────────────────────────────
walletsRouter.get('/discover/trending', async (_req, res) => {
  const tokens = await getTrendingTokens(20);
  res.json({ success: true, data: tokens });
});

// ─── GET /api/wallets/discover/new-tokens ─────────────────────────────────────
walletsRouter.get('/discover/new-tokens', async (_req, res) => {
  const tokens = await getNewTokens(20);
  res.json({ success: true, data: tokens });
});
