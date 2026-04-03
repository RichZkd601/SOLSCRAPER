import axios from 'axios';
import { config, scoreWallet } from '../config';
import { db } from '../database/db';
import type { TokenInfo, TokenPosition } from '../types';

const client = axios.create({
  baseURL: config.birdeyeBaseUrl,
  timeout: 15_000,
  headers: {
    'X-API-KEY': config.birdeyeApiKey,
    'x-chain': 'solana',
  },
});

// ─── Token price ─────────────────────────────────────────────────────────────
export async function getTokenPrice(mint: string): Promise<number | null> {
  try {
    const { data } = await client.get('/defi/price', { params: { address: mint } });
    return data?.data?.value ?? null;
  } catch { return null; }
}

// ─── Multi-token prices ───────────────────────────────────────────────────────
export async function getMultipleTokenPrices(mints: string[]): Promise<Record<string, number>> {
  if (!mints.length) return {};
  try {
    const { data } = await client.get('/defi/multi_price', {
      params: { list_address: mints.join(',') },
    });
    const result: Record<string, number> = {};
    for (const [mint, info] of Object.entries(data?.data ?? {})) {
      result[mint] = (info as { value: number }).value;
    }
    return result;
  } catch { return {}; }
}

// ─── Token info ───────────────────────────────────────────────────────────────
export async function getTokenInfo(mint: string): Promise<TokenInfo | null> {
  try {
    const { data } = await client.get('/defi/token_overview', { params: { address: mint } });
    const d = data?.data;
    if (!d) return null;
    const info: TokenInfo = {
      address: mint,
      symbol: d.symbol ?? '',
      name: d.name ?? '',
      decimals: d.decimals ?? 9,
      logoURI: d.logoURI,
      price: d.price,
      marketCap: d.mc,
      volume24h: d.v24hUSD,
      priceChange24h: d.priceChange24hPercent,
      liquidity: d.liquidity,
    };
    db.prepare(`
      INSERT OR REPLACE INTO token_cache
        (mint, symbol, name, decimals, logo_uri, price_usd, market_cap, volume_24h, price_change_24h, liquidity, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
    `).run(mint, info.symbol, info.name, info.decimals, info.logoURI ?? null,
           info.price ?? null, info.marketCap ?? null, info.volume24h ?? null,
           info.priceChange24h ?? null, info.liquidity ?? null);
    return info;
  } catch { return null; }
}

// ─── Wallet portfolio ─────────────────────────────────────────────────────────
export async function getWalletPortfolio(walletAddress: string): Promise<TokenPosition[]> {
  try {
    const { data } = await client.get('/v1/wallet/token_list', {
      params: { wallet: walletAddress },
    });
    return (data?.data?.items ?? [])
      .filter((item: Record<string, unknown>) => (item.valueUsd as number) > 0.01)
      .map((item: Record<string, unknown>) => ({
        mint:          item.address as string,
        symbol:        item.symbol as string,
        name:          item.name as string,
        balance:       item.uiAmount as number,
        valueUsd:      item.valueUsd as number,
        priceUsd:      item.priceUsd as number,
        priceChange24h:(item.priceChange24hPercent as number) ?? 0,
        logoUri:       item.logoURI as string | undefined,
      }));
  } catch { return []; }
}

// ─── Enriched top traders with volume + last activity filters ─────────────────
export interface EnrichedTrader {
  address: string;
  pnlUsd: number;
  winRate: number;
  tradesCount: number;
  volumeUsd: number;
  lastActivityHours: number;
  score: number;
  tier: 1 | 2 | 3;
  tierLabel: string;
  isTracked: boolean;
  passesFilters: boolean;
}

export async function getTopTraders(params: {
  timeframe?: '24h' | '7d' | '30d';
  sortBy?: 'pnl' | 'winRate' | 'volume';
  limit?: number;
  minDailyVolumeUsd?: number;
  maxLastActivityHours?: number;
} = {}): Promise<EnrichedTrader[]> {
  try {
    const {
      timeframe = '7d',
      sortBy = 'pnl',
      limit = 100,
      minDailyVolumeUsd = config.minDailyVolumeUsd,
      maxLastActivityHours = config.maxLastActivityHours,
    } = params;

    const { data } = await client.get('/trader/gainers-losers', {
      params: { type: 'gainers', time_frame: timeframe, sort_by: sortBy, limit },
    });

    const tracked = new Set(
      (db.prepare('SELECT address FROM tracked_wallets').all() as { address: string }[]).map(w => w.address)
    );

    const now = Date.now() / 1000;
    const traders: EnrichedTrader[] = (data?.data ?? []).map((t: Record<string, unknown>) => {
      const pnlUsd      = (t.pnlUsd ?? t.pnl ?? 0) as number;
      const winRate     = (t.winRate ?? 0) as number;
      const tradesCount = (t.tradeCount ?? t.tradesCount ?? 0) as number;
      const volumeUsd   = (t.volumeUsd ?? 0) as number;

      // Calculate last activity in hours
      const lastTxTime = (t.lastTradeUnixTime ?? t.lastActivityTime ?? 0) as number;
      const lastActivityHours = lastTxTime > 0
        ? Math.round((now - lastTxTime) / 3600)
        : 999;

      const score = scoreWallet({ winRate, pnlUsd, tradesCount, volumeUsd, lastActivityHours });

      let tier: 1 | 2 | 3 = 1;
      if (score >= 85) tier = 3;
      else if (score >= 70) tier = 2;

      const tierLabels = ['Palier 1 — 5€', 'Palier 2 — 10€', 'Palier 3 — 15€'];

      const passesFilters =
        volumeUsd >= minDailyVolumeUsd &&
        lastActivityHours <= maxLastActivityHours;

      return {
        address: t.address as string,
        pnlUsd,
        winRate,
        tradesCount,
        volumeUsd,
        lastActivityHours,
        score,
        tier,
        tierLabel: tierLabels[tier - 1],
        isTracked: tracked.has(t.address as string),
        passesFilters,
      };
    });

    return traders;
  } catch (err) {
    console.error('[Birdeye] getTopTraders error:', (err as Error).message);
    return [];
  }
}

// ─── Wallet PnL stats ─────────────────────────────────────────────────────────
export async function getWalletPnl(
  walletAddress: string,
  timeframe: '24h' | '7d' | '30d' = '30d'
): Promise<{ realizedPnl: number; unrealizedPnl: number; totalPnl: number; winRate: number; tradesCount: number } | null> {
  try {
    const { data } = await client.get('/trader/txs/seek_by_time', {
      params: { address: walletAddress, time_frame: timeframe },
    });
    const d = data?.data;
    if (!d) return null;
    return {
      realizedPnl:   d.realized_profit ?? 0,
      unrealizedPnl: d.unrealized_profit ?? 0,
      totalPnl:      (d.realized_profit ?? 0) + (d.unrealized_profit ?? 0),
      winRate:        d.winrate ?? 0,
      tradesCount:    d.trade_count ?? 0,
    };
  } catch { return null; }
}

// ─── Trending tokens ─────────────────────────────────────────────────────────
export async function getTrendingTokens(limit = 20): Promise<TokenInfo[]> {
  try {
    const { data } = await client.get('/defi/token_trending', {
      params: { sort_by: 'rank', sort_type: 'asc', offset: 0, limit },
    });
    return (data?.data?.tokens ?? []).map((t: Record<string, unknown>) => ({
      address:      t.address as string,
      symbol:       t.symbol as string,
      name:         t.name as string,
      decimals:     (t.decimals as number) ?? 9,
      logoURI:      t.logoURI as string | undefined,
      price:        t.price as number | undefined,
      marketCap:    t.mc as number | undefined,
      volume24h:    t.v24hUSD as number | undefined,
      priceChange24h: t.priceChange24hPercent as number | undefined,
      liquidity:    t.liquidity as number | undefined,
    }));
  } catch { return []; }
}

// ─── New token listings ───────────────────────────────────────────────────────
export async function getNewTokens(limit = 20): Promise<TokenInfo[]> {
  try {
    const { data } = await client.get('/defi/token_new_listing', {
      params: { limit, offset: 0 },
    });
    return (data?.data?.items ?? []).map((t: Record<string, unknown>) => ({
      address:   t.address as string,
      symbol:    t.symbol as string,
      name:      t.name as string,
      decimals:  (t.decimals as number) ?? 9,
      price:     t.price as number | undefined,
      marketCap: t.mc as number | undefined,
      volume24h: t.v24hUSD as number | undefined,
      liquidity: t.liquidity as number | undefined,
    }));
  } catch { return []; }
}
