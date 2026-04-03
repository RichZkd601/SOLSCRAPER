import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  // ─── Solana RPC ────────────────────────────────────────────────────
  rpcUrl:       process.env.HELIUS_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
  heliusApiKey: process.env.HELIUS_API_KEY ?? '',
  heliusBaseUrl:'https://api.helius.xyz/v0',
  heliusRpcUrl: process.env.HELIUS_RPC_URL ?? 'https://mainnet.helius-rpc.com',

  // ─── Birdeye ───────────────────────────────────────────────────────
  birdeyeApiKey: process.env.BIRDEYE_API_KEY ?? '',
  birdeyeBaseUrl:'https://public-api.birdeye.so',

  // ─── Jupiter ───────────────────────────────────────────────────────
  jupiterQuoteUrl:'https://quote-api.jup.ag/v6',
  jupiterPriceUrl:'https://price.jup.ag/v4',

  // ─── Trader wallet ─────────────────────────────────────────────────
  traderPrivateKey:    process.env.TRADER_PRIVATE_KEY ?? '',
  traderWalletAddress: process.env.TRADER_WALLET_ADDRESS ?? '',

  // ─── Budget & position sizing (EUR) ────────────────────────────────
  budgetEur:         parseFloat(process.env.BUDGET_EUR ?? '100'),
  basePositionEur:   parseFloat(process.env.BASE_POSITION_EUR ?? '5'),
  // Paliers automatiques
  // Tier 1 (score < 70)  → basePositionEur      = 5€
  // Tier 2 (score 70-85) → basePositionEur × 2  = 10€
  // Tier 3 (score > 85)  → basePositionEur × 3  = 15€
  tierMultipliers: [1, 2, 3] as const,
  solEurRate:        parseFloat(process.env.SOL_EUR_RATE ?? '160'),

  // ─── Database ──────────────────────────────────────────────────────
  dbPath: process.env.DB_PATH ?? path.resolve(__dirname, '../../data/solscraper.db'),

  // ─── Safety & slippage ─────────────────────────────────────────────
  maxSolPerTrade:       parseFloat(process.env.MAX_SOL_PER_TRADE ?? '0.15'),
  defaultSlippageBps:   parseInt(process.env.DEFAULT_SLIPPAGE_BPS ?? '100', 10),
  minLiquidityUsd:      parseFloat(process.env.MIN_LIQUIDITY_USD ?? '50000'),

  // ─── Wallet discovery filters ──────────────────────────────────────
  minDailyVolumeUsd:      parseFloat(process.env.MIN_DAILY_VOLUME_USD ?? '10000'),
  maxLastActivityHours:   parseInt(process.env.MAX_LAST_ACTIVITY_HOURS ?? '24', 10),

  // ─── Dynamic slippage thresholds ───────────────────────────────────
  slippage: {
    highLiquidity:   50,   // 0.5%  — liquidité > $500k
    medLiquidity:    100,  // 1%    — liquidité $50k–$500k
    lowLiquidity:    300,  // 3%    — liquidité < $50k
    highLiqThreshold: 500_000,
    medLiqThreshold:   50_000,
  },

  // ─── Priority fee caps ─────────────────────────────────────────────
  priorityFee: {
    default:    1_000,    // 0.000001 SOL
    medium:    50_000,    // 0.00005 SOL
    high:     200_000,    // 0.0002 SOL (rush)
    maxCap:   500_000,    // jamais au-delà
  },
} as const;

// ─── Helpers EUR ↔ SOL ─────────────────────────────────────────────────────
export function eurToSol(eur: number, solEurRate = config.solEurRate): number {
  return parseFloat((eur / solEurRate).toFixed(6));
}

export function solToEur(sol: number, solEurRate = config.solEurRate): number {
  return parseFloat((sol * solEurRate).toFixed(2));
}

// ─── Tiered position size selon score wallet (0–100) ────────────────────────
export function getTierSolAmount(walletScore: number, solEurRate = config.solEurRate): {
  tier: 1 | 2 | 3;
  eur: number;
  sol: number;
  label: string;
} {
  const { basePositionEur, tierMultipliers } = config;
  let tier: 1 | 2 | 3 = 1;
  if (walletScore >= 85) tier = 3;
  else if (walletScore >= 70) tier = 2;

  const eur = basePositionEur * tierMultipliers[tier - 1];
  const sol = eurToSol(eur, solEurRate);
  const labels = ['Palier 1 — Conservateur', 'Palier 2 — Modéré', 'Palier 3 — Agressif'];
  return { tier, eur, sol, label: labels[tier - 1] };
}

// ─── Score d'un wallet (0–100) ────────────────────────────────────────────────
export function scoreWallet(params: {
  winRate: number;        // 0–1
  pnlUsd: number;
  tradesCount: number;
  volumeUsd: number;
  lastActivityHours: number;
}): number {
  const { winRate, pnlUsd, tradesCount, volumeUsd, lastActivityHours } = params;
  let score = 0;
  // Win rate (40 pts)
  score += Math.min(40, winRate * 40);
  // PnL (20 pts)
  if (pnlUsd > 100_000) score += 20;
  else if (pnlUsd > 50_000) score += 15;
  else if (pnlUsd > 10_000) score += 10;
  else if (pnlUsd > 1_000) score += 5;
  // Trades (20 pts)
  if (tradesCount > 100) score += 20;
  else if (tradesCount > 50) score += 15;
  else if (tradesCount > 20) score += 10;
  else if (tradesCount > 5) score += 5;
  // Volume journalier (10 pts)
  if (volumeUsd > 100_000) score += 10;
  else if (volumeUsd > 50_000) score += 7;
  else if (volumeUsd > 10_000) score += 4;
  // Activité récente (10 pts) — pénalité si inactif
  if (lastActivityHours <= 6) score += 10;
  else if (lastActivityHours <= 12) score += 8;
  else if (lastActivityHours <= 24) score += 5;
  else score -= 10;
  return Math.min(100, Math.max(0, Math.round(score)));
}
