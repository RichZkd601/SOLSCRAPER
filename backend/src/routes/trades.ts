import { Router } from 'express';
import { db } from '../database/db';
import { getCopyTradeHistory } from '../services/copyTrade';
import { buyToken, sellToken, getQuote, getSolPrice, SOL_MINT } from '../services/jupiter';
import { config } from '../config';

export const tradesRouter = Router();

// ─── GET /api/trades — copy trade history ─────────────────────────────────────
tradesRouter.get('/', (req, res) => {
  const { limit = 50, offset = 0, status } = req.query as { limit?: string; offset?: string; status?: string };
  let query = `
    SELECT ct.*, ctc.wallet_address as config_wallet
    FROM copy_trades ct
    JOIN copy_trade_configs ctc ON ct.config_id = ctc.id
  `;
  const limitN = parseInt(limit as string);
  const offsetN = parseInt(offset as string);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trades = status
    ? db.prepare(query + ' WHERE ct.status = ? ORDER BY ct.executed_at DESC LIMIT ? OFFSET ?').all(status, limitN, offsetN)
    : db.prepare(query + ' ORDER BY ct.executed_at DESC LIMIT ? OFFSET ?').all(limitN, offsetN);
  res.json({ success: true, data: trades });
});

// ─── POST /api/trades/manual-buy — manual swap ───────────────────────────────
tradesRouter.post('/manual-buy', async (req, res) => {
  const { tokenMint, solAmount, slippageBps } = req.body as {
    tokenMint: string;
    solAmount: number;
    slippageBps?: number;
  };
  if (!tokenMint || !solAmount) {
    res.status(400).json({ success: false, error: 'tokenMint and solAmount required' });
    return;
  }
  if (!config.traderPrivateKey) {
    res.status(400).json({ success: false, error: 'Trader wallet not configured. Set TRADER_PRIVATE_KEY in .env' });
    return;
  }
  if (solAmount > config.maxSolPerTrade) {
    res.status(400).json({ success: false, error: `Max ${config.maxSolPerTrade} SOL per trade` });
    return;
  }
  const result = await buyToken(tokenMint, solAmount, slippageBps);
  res.json({ success: result.success, data: result });
});

// ─── POST /api/trades/manual-sell ─────────────────────────────────────────────
tradesRouter.post('/manual-sell', async (req, res) => {
  const { tokenMint, tokenAmount, decimals, slippageBps } = req.body as {
    tokenMint: string;
    tokenAmount: number;
    decimals: number;
    slippageBps?: number;
  };
  if (!tokenMint || !tokenAmount) {
    res.status(400).json({ success: false, error: 'tokenMint and tokenAmount required' });
    return;
  }
  if (!config.traderPrivateKey) {
    res.status(400).json({ success: false, error: 'Trader wallet not configured' });
    return;
  }
  const result = await sellToken(tokenMint, tokenAmount, decimals ?? 9, slippageBps);
  res.json({ success: result.success, data: result });
});

// ─── GET /api/trades/quote ────────────────────────────────────────────────────
tradesRouter.get('/quote', async (req, res) => {
  const { inputMint, outputMint, amount, slippageBps } = req.query as {
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps?: string;
  };
  if (!inputMint || !outputMint || !amount) {
    res.status(400).json({ success: false, error: 'inputMint, outputMint and amount required' });
    return;
  }
  const quote = await getQuote({
    inputMint,
    outputMint,
    amountLamports: parseInt(amount),
    slippageBps: slippageBps ? parseInt(slippageBps) : undefined,
  });
  res.json({ success: !!quote, data: quote });
});

// ─── GET /api/trades/sol-price ────────────────────────────────────────────────
tradesRouter.get('/sol-price', async (_req, res) => {
  const price = await getSolPrice();
  res.json({ success: true, data: { price } });
});

// ─── GET /api/trades/stats ────────────────────────────────────────────────────
tradesRouter.get('/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END) as skipped,
      SUM(CASE WHEN type = 'BUY' AND status = 'SUCCESS' THEN amount_sol ELSE 0 END) as total_sol_invested,
      COALESCE(SUM(pnl_usd), 0) as total_pnl_usd
    FROM copy_trades
  `).get();
  res.json({ success: true, data: stats });
});

// ─── GET /api/trades/alerts ───────────────────────────────────────────────────
tradesRouter.get('/alerts', (req, res) => {
  const { unreadOnly } = req.query as { unreadOnly?: string };
  let query = 'SELECT * FROM alerts';
  if (unreadOnly === 'true') query += ' WHERE is_read = 0';
  query += ' ORDER BY created_at DESC LIMIT 100';
  const alerts = db.prepare(query).all();
  res.json({ success: true, data: alerts });
});

// ─── PATCH /api/trades/alerts/:id/read ───────────────────────────────────────
tradesRouter.patch('/alerts/:id/read', (req, res) => {
  db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── POST /api/trades/alerts/read-all ────────────────────────────────────────
tradesRouter.post('/alerts/read-all', (_req, res) => {
  db.prepare('UPDATE alerts SET is_read = 1').run();
  res.json({ success: true });
});
