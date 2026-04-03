// ─── Wallet Types ────────────────────────────────────────────────────────────

export interface TrackedWallet {
  id: number;
  address: string;
  label: string;
  tags: string; // JSON array: ["whale", "degen", "sniper"]
  totalPnlUsd: number;
  winRate: number;
  tradesCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WalletStats {
  address: string;
  totalPnlUsd: number;
  realizedPnl: number;
  unrealizedPnl: number;
  winRate: number;
  tradesCount: number;
  avgHoldTime: number; // hours
  bestTrade: number;
  worstTrade: number;
  portfolioValue: number;
  topTokens: TokenPosition[];
}

// ─── Token Types ─────────────────────────────────────────────────────────────

export interface TokenPosition {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  valueUsd: number;
  priceUsd: number;
  priceChange24h: number;
  logoUri?: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
  priceChange24h?: number;
  liquidity?: number;
}

// ─── Transaction Types ────────────────────────────────────────────────────────

export type TxType = 'BUY' | 'SELL' | 'TRANSFER' | 'UNKNOWN';

export interface ParsedTransaction {
  signature: string;
  walletAddress: string;
  type: TxType;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  amountToken: number;
  amountSol: number;
  amountUsd: number;
  priceUsd: number;
  dex: string;
  blockTime: number;
  fee: number;
}

// ─── Copy Trade Types ─────────────────────────────────────────────────────────

export type CopyMode = 'FIXED' | 'PERCENT';
export type TradeStatus = 'PENDING' | 'EXECUTING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export interface CopyTradeConfig {
  id: number;
  walletAddress: string;
  isEnabled: boolean;
  copyMode: CopyMode;
  fixedAmountSol: number;
  percentOfPortfolio: number;
  maxPositionSol: number;
  minLiquidityUsd: number;
  maxSlippageBps: number;
  autoBuy: boolean;
  autoSell: boolean;
  stopLossPercent: number;
  takeProfitPercent: number;
  skipIfMcapAbove: number;
  createdAt: string;
}

export interface CopyTrade {
  id: number;
  configId: number;
  trackedWallet: string;
  signature: string;
  ourSignature?: string;
  tokenMint: string;
  tokenSymbol: string;
  type: TxType;
  amountSol: number;
  amountToken: number;
  status: TradeStatus;
  errorMsg?: string;
  pnlUsd?: number;
  executedAt: string;
}

// ─── Alert Types ──────────────────────────────────────────────────────────────

export interface Alert {
  id: number;
  walletAddress: string;
  tokenMint: string;
  tokenSymbol: string;
  type: TxType;
  amountUsd: number;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface BirdeyeWalletPortfolio {
  data: {
    wallet: string;
    totalUsd: number;
    items: Array<{
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      balance: number;
      uiAmount: number;
      priceUsd: number;
      valueUsd: number;
      logoURI?: string;
      priceChange24hPercent?: number;
    }>;
  };
}

export interface BirdeyeTokenPrice {
  data: {
    value: number;
    updateUnixTime: number;
    updateHumanTime: string;
  };
}

export interface BirdeyeTopTrader {
  address: string;
  pnl: number;
  pnlUsd: number;
  winRate: number;
  volume: number;
  tradesCount: number;
}

export interface HeliusTransaction {
  description: string;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  signature: string;
  slot: number;
  timestamp: number;
  tokenTransfers: Array<{
    fromTokenAccount: string;
    toTokenAccount: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    decimals: number;
    mint: string;
    tokenStandard: string;
  }>;
  nativeTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  accountData: Array<{
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges: Array<{
      userAccount: string;
      tokenAccount: string;
      rawTokenAmount: {
        tokenAmount: string;
        decimals: number;
      };
      mint: string;
    }>;
  }>;
  events?: {
    swap?: {
      nativeInput?: { account: string; amount: string };
      nativeOutput?: { account: string; amount: string };
      tokenInputs: Array<{ userAccount: string; tokenAccount: string; rawTokenAmount: { tokenAmount: string; decimals: number }; mint: string }>;
      tokenOutputs: Array<{ userAccount: string; tokenAccount: string; rawTokenAmount: { tokenAmount: string; decimals: number }; mint: string }>;
      innerSwaps: unknown[];
    };
  };
}

// ─── WebSocket Message Types ──────────────────────────────────────────────────

export type WSEventType =
  | 'WALLET_TX'
  | 'COPY_TRADE_EXECUTED'
  | 'ALERT'
  | 'PRICE_UPDATE'
  | 'TRACKER_STATUS'
  | 'ERROR';

export interface WSMessage {
  type: WSEventType;
  data: unknown;
  timestamp: number;
}
