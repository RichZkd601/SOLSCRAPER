import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function require_env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  // ─── Solana ────────────────────────────────────────────────────────
  rpcUrl: process.env.HELIUS_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
  heliusApiKey: process.env.HELIUS_API_KEY ?? '',
  heliusBaseUrl: 'https://api.helius.xyz/v0',
  heliusRpcUrl: process.env.HELIUS_RPC_URL ?? 'https://mainnet.helius-rpc.com',

  // ─── Birdeye ───────────────────────────────────────────────────────
  birdeyeApiKey: process.env.BIRDEYE_API_KEY ?? '',
  birdeyeBaseUrl: 'https://public-api.birdeye.so',

  // ─── Jupiter ───────────────────────────────────────────────────────
  jupiterQuoteUrl: 'https://quote-api.jup.ag/v6',
  jupiterPriceUrl: 'https://price.jup.ag/v4',

  // ─── Wallet ────────────────────────────────────────────────────────
  // Your trading wallet private key (base58 encoded) - NEVER commit this!
  traderPrivateKey: process.env.TRADER_PRIVATE_KEY ?? '',
  traderWalletAddress: process.env.TRADER_WALLET_ADDRESS ?? '',

  // ─── Database ──────────────────────────────────────────────────────
  dbPath: process.env.DB_PATH ?? path.resolve(__dirname, '../../data/solscraper.db'),

  // ─── Safety limits ─────────────────────────────────────────────────
  maxSolPerTrade: parseFloat(process.env.MAX_SOL_PER_TRADE ?? '1'),
  defaultSlippageBps: parseInt(process.env.DEFAULT_SLIPPAGE_BPS ?? '300', 10),
  minLiquidityUsd: parseFloat(process.env.MIN_LIQUIDITY_USD ?? '10000'),
} as const;
