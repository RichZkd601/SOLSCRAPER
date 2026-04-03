import { db } from '../database/db';
import { trackerEvents, emit } from './walletTracker';
import { getTokenInfo } from './birdeye';
import { buyToken, sellToken, getSolPrice } from './jupiter';
import { config } from '../config';
import type { ParsedTransaction, CopyTradeConfig } from '../types';

// ─── Copy Trade Engine ────────────────────────────────────────────────────────

export function startCopyTradeEngine() {
  trackerEvents.on('new_tx', async (tx: ParsedTransaction) => {
    await evaluateCopyTrade(tx);
  });
  console.log('[CopyTrade] Engine started');
}

async function evaluateCopyTrade(tx: ParsedTransaction) {
  if (tx.type !== 'BUY' && tx.type !== 'SELL') return;

  // Find copy trade config for this wallet
  const cfg = db.prepare(`
    SELECT * FROM copy_trade_configs
    WHERE wallet_address = ? AND is_enabled = 1
  `).get(tx.walletAddress) as (CopyTradeConfig & {
    auto_buy: number; auto_sell: number;
    copy_mode: string; fixed_amount_sol: number;
    percent_of_portfolio: number; max_position_sol: number;
    min_liquidity_usd: number; max_slippage_bps: number;
    stop_loss_percent: number; take_profit_percent: number;
    skip_if_mcap_above: number;
  }) | undefined;

  if (!cfg) return;
  if (tx.type === 'BUY' && !cfg.auto_buy) return;
  if (tx.type === 'SELL' && !cfg.auto_sell) return;
  if (!config.traderPrivateKey) return; // No wallet configured

  // Insert pending copy trade
  const result = db.prepare(`
    INSERT INTO copy_trades
      (config_id, tracked_wallet, signature, token_mint, token_symbol, type, amount_sol, status)
    VALUES (?,?,?,?,?,?,?,'PENDING')
  `).run(cfg.id, tx.walletAddress, tx.signature, tx.tokenMint, tx.tokenSymbol, tx.type, tx.amountSol);
  const tradeId = result.lastInsertRowid;

  try {
    db.prepare("UPDATE copy_trades SET status = 'EXECUTING' WHERE id = ?").run(tradeId);

    // ── BUY logic ──────────────────────────────────────────────────────────────
    if (tx.type === 'BUY') {
      // Determine buy amount
      let solAmount: number;
      if (cfg.copy_mode === 'FIXED') {
        solAmount = cfg.fixed_amount_sol;
      } else {
        // PERCENT of portfolio (approximated)
        const solPrice = await getSolPrice();
        const portfolioSol = cfg.max_position_sol; // use max as portfolio estimate for now
        solAmount = (portfolioSol * cfg.percent_of_portfolio) / 100;
      }
      solAmount = Math.min(solAmount, cfg.max_position_sol, config.maxSolPerTrade);

      // Check token liquidity
      if (cfg.min_liquidity_usd > 0) {
        const tokenInfo = await getTokenInfo(tx.tokenMint);
        if (!tokenInfo || (tokenInfo.liquidity ?? 0) < cfg.min_liquidity_usd) {
          db.prepare("UPDATE copy_trades SET status = 'SKIPPED', error_msg = ? WHERE id = ?")
            .run(`Liquidity $${tokenInfo?.liquidity?.toFixed(0) ?? 0} < min $${cfg.min_liquidity_usd}`, tradeId);
          return;
        }
        if (cfg.skip_if_mcap_above > 0 && (tokenInfo.marketCap ?? 0) > cfg.skip_if_mcap_above) {
          db.prepare("UPDATE copy_trades SET status = 'SKIPPED', error_msg = ? WHERE id = ?")
            .run(`Mcap $${tokenInfo.marketCap?.toFixed(0)} > max $${cfg.skip_if_mcap_above}`, tradeId);
          return;
        }
      }

      const swapResult = await buyToken(tx.tokenMint, solAmount, cfg.max_slippage_bps);
      if (swapResult.success) {
        db.prepare(`
          UPDATE copy_trades SET status = 'SUCCESS', our_signature = ?, amount_sol = ?
          WHERE id = ?
        `).run(swapResult.signature, solAmount, tradeId);
        emit('COPY_TRADE_EXECUTED', { tradeId, type: 'BUY', signature: swapResult.signature, solAmount, token: tx.tokenSymbol });
      } else {
        db.prepare("UPDATE copy_trades SET status = 'FAILED', error_msg = ? WHERE id = ?")
          .run(swapResult.error, tradeId);
        emit('COPY_TRADE_EXECUTED', { tradeId, type: 'BUY', status: 'FAILED', error: swapResult.error });
      }
    }

    // ── SELL logic ─────────────────────────────────────────────────────────────
    if (tx.type === 'SELL') {
      // For sell: we mirror the tracked wallet's sell
      // In a real implementation, look up our position in the token
      const swapResult = await sellToken(tx.tokenMint, tx.amountToken, 9, cfg.max_slippage_bps);
      if (swapResult.success) {
        db.prepare(`
          UPDATE copy_trades SET status = 'SUCCESS', our_signature = ?
          WHERE id = ?
        `).run(swapResult.signature, tradeId);
        emit('COPY_TRADE_EXECUTED', { tradeId, type: 'SELL', signature: swapResult.signature, token: tx.tokenSymbol });
      } else {
        db.prepare("UPDATE copy_trades SET status = 'FAILED', error_msg = ? WHERE id = ?")
          .run(swapResult.error, tradeId);
      }
    }
  } catch (err) {
    db.prepare("UPDATE copy_trades SET status = 'FAILED', error_msg = ? WHERE id = ?")
      .run((err as Error).message, tradeId);
    console.error('[CopyTrade] Error:', (err as Error).message);
  }
}

// ─── CRUD for copy trade configs ───────────────────────────────────────────────

export function getCopyTradeConfig(walletAddress: string): CopyTradeConfig | undefined {
  return db.prepare('SELECT * FROM copy_trade_configs WHERE wallet_address = ?').get(walletAddress) as CopyTradeConfig | undefined;
}

export function upsertCopyTradeConfig(cfg: Partial<CopyTradeConfig> & { wallet_address: string }): void {
  db.prepare(`
    INSERT INTO copy_trade_configs
      (wallet_address, is_enabled, copy_mode, fixed_amount_sol, percent_of_portfolio,
       max_position_sol, min_liquidity_usd, max_slippage_bps, auto_buy, auto_sell,
       stop_loss_percent, take_profit_percent, skip_if_mcap_above)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(wallet_address) DO UPDATE SET
      is_enabled = excluded.is_enabled,
      copy_mode = excluded.copy_mode,
      fixed_amount_sol = excluded.fixed_amount_sol,
      percent_of_portfolio = excluded.percent_of_portfolio,
      max_position_sol = excluded.max_position_sol,
      min_liquidity_usd = excluded.min_liquidity_usd,
      max_slippage_bps = excluded.max_slippage_bps,
      auto_buy = excluded.auto_buy,
      auto_sell = excluded.auto_sell,
      stop_loss_percent = excluded.stop_loss_percent,
      take_profit_percent = excluded.take_profit_percent,
      skip_if_mcap_above = excluded.skip_if_mcap_above
  `).run(
    cfg.wallet_address,
    cfg.isEnabled ?? 1,
    cfg.copyMode ?? 'FIXED',
    cfg.fixedAmountSol ?? 0.1,
    cfg.percentOfPortfolio ?? 10,
    cfg.maxPositionSol ?? 1.0,
    cfg.minLiquidityUsd ?? 10000,
    cfg.maxSlippageBps ?? 300,
    cfg.autoBuy ? 1 : 0,
    cfg.autoSell ? 1 : 0,
    cfg.stopLossPercent ?? 50,
    cfg.takeProfitPercent ?? 200,
    cfg.skipIfMcapAbove ?? 0
  );
}

export function getCopyTradeHistory(limit = 50, offset = 0) {
  return db.prepare(`
    SELECT ct.*, ctc.wallet_address
    FROM copy_trades ct
    JOIN copy_trade_configs ctc ON ct.config_id = ctc.id
    ORDER BY ct.executed_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}
