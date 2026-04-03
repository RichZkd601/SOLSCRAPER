import axios from 'axios';
import { config } from '../config';
import { db } from '../database/db';
import type { TokenInfo, WalletStats, TokenPosition } from '../types';

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
  } catch {
    return null;
  }
}

// ─── Multi-token prices ───────────────────────────────────────────────────────
export async function getMultipleTokenPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  try {
    const { data } = await client.get('/defi/multi_price', {
      params: { list_address: mints.join(',') },
    });
    const result: Record<string, number> = {};
    for (const [mint, info] of Object.entries(data?.data ?? {})) {
      result[mint] = (info as { value: number }).value;
    }
    return result;
  } catch {
    return {};
  }
}

// ─── Token info (metadata + price + market data) ─────────────────────────────
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
    // cache it
    db.prepare(`
      INSERT OR REPLACE INTO token_cache
        (mint, symbol, name, decimals, logo_uri, price_usd, market_cap, volume_24h, price_change_24h, liquidity, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
    `).run(mint, info.symbol, info.name, info.decimals, info.logoURI ?? null,
           info.price ?? null, info.marketCap ?? null, info.volume24h ?? null,
           info.priceChange24h ?? null, info.liquidity ?? null);
    return info;
  } catch {
    return null;
  }
}

// ─── Wallet portfolio via Birdeye ─────────────────────────────────────────────
export async function getWalletPortfolio(walletAddress: string): Promise<TokenPosition[]> {
  try {
    const { data } = await client.get('/v1/wallet/token_list', {
      params: { wallet: walletAddress },
    });
    const items = data?.data?.items ?? [];
    return items
      .filter((item: Record<string, unknown>) => (item.valueUsd as number) > 0.01)
      .map((item: Record<string, unknown>) => ({
        mint: item.address as string,
        symbol: item.symbol as string,
        name: item.name as string,
        balance: item.uiAmount as number,
        valueUsd: item.valueUsd as number,
        priceUsd: item.priceUsd as number,
        priceChange24h: (item.priceChange24hPercent as number) ?? 0,
        logoUri: item.logoURI as string | undefined,
      }));
  } catch {
    return [];
  }
}

// ─── Top traders / gainers (Wallet Discovery) ────────────────────────────────
export async function getTopTraders(params: {
  timeframe?: '24h' | '7d' | '30d';
  sortBy?: 'pnl' | 'winRate' | 'volume';
  limit?: number;
} = {}): Promise<Array<{
  address: string;
  pnlUsd: number;
  winRate: number;
  tradesCount: number;
  volumeUsd: number;
}>> {
  try {
    const { timeframe = '7d', sortBy = 'pnl', limit = 50 } = params;
    const { data } = await client.get('/trader/gainers-losers', {
      params: { type: 'gainers', time_frame: timeframe, sort_by: sortBy, limit },
    });
    return (data?.data ?? []).map((t: Record<string, unknown>) => ({
      address: t.address as string,
      pnlUsd: (t.pnlUsd ?? t.pnl ?? 0) as number,
      winRate: (t.winRate ?? 0) as number,
      tradesCount: (t.tradeCount ?? 0) as number,
      volumeUsd: (t.volumeUsd ?? 0) as number,
    }));
  } catch {
    return [];
  }
}

// ─── Wallet PnL stats ─────────────────────────────────────────────────────────
export async function getWalletPnl(walletAddress: string, timeframe: '24h' | '7d' | '30d' = '30d'): Promise<{
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  winRate: number;
  tradesCount: number;
} | null> {
  try {
    const { data } = await client.get('/trader/txs/seek_by_time', {
      params: { address: walletAddress, time_frame: timeframe },
    });
    const d = data?.data;
    if (!d) return null;
    return {
      realizedPnl: d.realized_profit ?? 0,
      unrealizedPnl: d.unrealized_profit ?? 0,
      totalPnl: (d.realized_profit ?? 0) + (d.unrealized_profit ?? 0),
      winRate: d.winrate ?? 0,
      tradesCount: d.trade_count ?? 0,
    };
  } catch {
    return null;
  }
}

// ─── Trending tokens on Solana DEXs ──────────────────────────────────────────
export async function getTrendingTokens(limit = 20): Promise<TokenInfo[]> {
  try {
    const { data } = await client.get('/defi/token_trending', {
      params: { sort_by: 'rank', sort_type: 'asc', offset: 0, limit },
    });
    return (data?.data?.tokens ?? []).map((t: Record<string, unknown>) => ({
      address: t.address as string,
      symbol: t.symbol as string,
      name: t.name as string,
      decimals: (t.decimals as number) ?? 9,
      logoURI: t.logoURI as string | undefined,
      price: t.price as number | undefined,
      marketCap: t.mc as number | undefined,
      volume24h: t.v24hUSD as number | undefined,
      priceChange24h: t.priceChange24hPercent as number | undefined,
      liquidity: t.liquidity as number | undefined,
    }));
  } catch {
    return [];
  }
}

// ─── New listings (freshly launched tokens) ───────────────────────────────────
export async function getNewTokens(limit = 20): Promise<TokenInfo[]> {
  try {
    const { data } = await client.get('/defi/token_new_listing', {
      params: { limit, offset: 0 },
    });
    return (data?.data?.items ?? []).map((t: Record<string, unknown>) => ({
      address: t.address as string,
      symbol: t.symbol as string,
      name: t.name as string,
      decimals: (t.decimals as number) ?? 9,
      price: t.price as number | undefined,
      marketCap: t.mc as number | undefined,
      volume24h: t.v24hUSD as number | undefined,
      liquidity: t.liquidity as number | undefined,
    }));
  } catch {
    return [];
  }
}

// ─── Get wallet transaction list via Birdeye ──────────────────────────────────
export async function getWalletTxHistory(walletAddress: string, limit = 50): Promise<Array<{
  txHash: string;
  blockUnixTime: number;
  type: string;
  from: string;
  to: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: number;
  value: number;
}>> {
  try {
    const { data } = await client.get('/trader/txs/seek_by_time', {
      params: { address: walletAddress, limit },
    });
    return data?.data?.items ?? [];
  } catch {
    return [];
  }
}
