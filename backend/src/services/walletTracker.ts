import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { config } from '../config';
import { db } from '../database/db';
import { getWalletTransactions, parseHeliusTx, storeTx, buildHeliusWsUrl } from './helius';
import { getWalletPortfolio, getWalletPnl } from './birdeye';
import type { ParsedTransaction, TrackedWallet, WSMessage } from '../types';

// ─── Tracker emits events to WebSocket clients ────────────────────────────────
export const trackerEvents = new EventEmitter();

let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let isRunning = false;
const subscribedWallets = new Set<string>();

export function emit(type: WSMessage['type'], data: unknown) {
  trackerEvents.emit('message', { type, data, timestamp: Date.now() } as WSMessage);
}

// ─── Connect to Helius / Solana WebSocket ─────────────────────────────────────
function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const wsUrl = buildHeliusWsUrl();
  ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('[Tracker] WebSocket connected');
    emit('TRACKER_STATUS', { connected: true, wallets: [...subscribedWallets] });
    resubscribeAll();
  });

  ws.on('message', async (raw: WebSocket.Data) => {
    try {
      const msg = JSON.parse(raw.toString());
      await handleWsMessage(msg);
    } catch {
      // ignore parse errors
    }
  });

  ws.on('close', () => {
    console.warn('[Tracker] WebSocket closed — reconnecting in 5s...');
    emit('TRACKER_STATUS', { connected: false });
    scheduleReconnect(5_000);
  });

  ws.on('error', (err) => {
    console.error('[Tracker] WS error:', err.message);
    ws?.terminate();
  });
}

function scheduleReconnect(delay: number) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (isRunning) connect();
  }, delay);
}

function resubscribeAll() {
  for (const addr of subscribedWallets) {
    subscribeWallet(addr);
  }
}

// ─── Subscribe wallet to Helius account notifications ────────────────────────
function subscribeWallet(address: string) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: `sub-${address}`,
    method: 'accountSubscribe',
    params: [
      address,
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ],
  }));
}

// ─── Handle incoming WebSocket messages ───────────────────────────────────────
async function handleWsMessage(msg: Record<string, unknown>) {
  // Helius transaction notification
  if (msg.method === 'accountNotification') {
    const params = msg.params as { result?: { value?: { signature?: string } }; subscription?: number } | undefined;
    const sig = params?.result?.value?.signature;
    if (!sig) return;

    // Find which wallet this subscription belongs to
    // In production you'd map subscription IDs to wallets
    for (const walletAddr of subscribedWallets) {
      await processNewSignature(walletAddr, sig);
    }
  }

  // Helius enhanced webhook — if using webhooks instead of WS
  if (Array.isArray(msg) && msg[0]?.signature) {
    for (const rawTx of msg as Array<Record<string, unknown>>) {
      const feePayer = rawTx.feePayer as string;
      if (subscribedWallets.has(feePayer)) {
        await processHeliusTx(rawTx as unknown as Parameters<typeof parseHeliusTx>[0], feePayer);
      }
    }
  }
}

async function processNewSignature(walletAddr: string, signature: string) {
  // Fetch enhanced tx details
  const txs = await getWalletTransactions(walletAddr, 1);
  if (txs.length === 0) return;
  await processHeliusTx(txs[0], walletAddr);
}

async function processHeliusTx(rawTx: Parameters<typeof parseHeliusTx>[0], walletAddr: string) {
  const parsed = parseHeliusTx(rawTx, walletAddr);
  if (!parsed || parsed.type === 'UNKNOWN') return;

  // Store transaction
  storeTx(parsed);

  // Emit to UI
  emit('WALLET_TX', parsed);

  // Create alert for significant trades
  if (parsed.amountUsd > 100) {
    const msg = `${parsed.type} ${parsed.tokenSymbol} — $${parsed.amountUsd.toFixed(0)} (${parsed.amountSol.toFixed(3)} SOL)`;
    db.prepare(`
      INSERT INTO alerts (wallet_address, token_mint, token_symbol, type, amount_usd, message)
      VALUES (?,?,?,?,?,?)
    `).run(walletAddr, parsed.tokenMint, parsed.tokenSymbol, parsed.type, parsed.amountUsd, msg);
    emit('ALERT', { walletAddress: walletAddr, signature: parsed.signature, type: parsed.type, tokenSymbol: parsed.tokenSymbol, amountUsd: parsed.amountUsd, message: msg });
  }

  // Trigger copy trade evaluation
  trackerEvents.emit('new_tx', parsed);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startTracker() {
  if (isRunning) return;
  isRunning = true;

  // Load all active wallets
  const wallets = db.prepare('SELECT address FROM tracked_wallets WHERE is_active = 1').all() as { address: string }[];
  for (const w of wallets) subscribedWallets.add(w.address);

  connect();
  console.log(`[Tracker] Started — tracking ${subscribedWallets.size} wallets`);
}

export function stopTracker() {
  isRunning = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws?.close();
  console.log('[Tracker] Stopped');
}

export function addWallet(address: string) {
  subscribedWallets.add(address);
  subscribeWallet(address);
}

export function removeWallet(address: string) {
  subscribedWallets.delete(address);
  // Note: Solana WS doesn't have easy unsubscribe by address, reconnect to clean up
}

// ─── Backfill historical transactions for a wallet ───────────────────────────
export async function backfillWallet(walletAddress: string, limit = 100): Promise<number> {
  const txs = await getWalletTransactions(walletAddress, limit);
  let count = 0;
  for (const rawTx of txs) {
    const parsed = parseHeliusTx(rawTx, walletAddress);
    if (parsed) {
      storeTx(parsed);
      count++;
    }
  }
  // Update wallet stats
  await refreshWalletStats(walletAddress);
  return count;
}

// ─── Refresh wallet PnL stats ─────────────────────────────────────────────────
export async function refreshWalletStats(walletAddress: string) {
  const pnl = await getWalletPnl(walletAddress, '30d');
  if (!pnl) return;
  db.prepare(`
    UPDATE tracked_wallets SET
      total_pnl_usd = ?,
      win_rate = ?,
      trades_count = ?,
      updated_at = datetime('now')
    WHERE address = ?
  `).run(pnl.totalPnl, pnl.winRate, pnl.tradesCount, walletAddress);
}
