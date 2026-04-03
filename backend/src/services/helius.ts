import axios from 'axios';
import { config } from '../config';
import type { HeliusTransaction, ParsedTransaction, TxType } from '../types';
import { db } from '../database/db';

const client = axios.create({
  baseURL: config.heliusBaseUrl,
  timeout: 15_000,
});

// ─── Fetch enhanced transactions for a wallet ────────────────────────────────
export async function getWalletTransactions(
  walletAddress: string,
  limit = 100,
  before?: string
): Promise<HeliusTransaction[]> {
  if (!config.heliusApiKey) {
    console.warn('[Helius] No API key — using Solscan fallback');
    return [];
  }
  try {
    const params: Record<string, string | number> = { limit };
    if (before) params.before = before;

    const { data } = await client.get<HeliusTransaction[]>(
      `/addresses/${walletAddress}/transactions`,
      { params: { ...params, 'api-key': config.heliusApiKey } }
    );
    return data ?? [];
  } catch (err) {
    console.error('[Helius] getWalletTransactions error:', (err as Error).message);
    return [];
  }
}

// ─── Parse a Helius enhanced transaction into our format ─────────────────────
export function parseHeliusTx(
  tx: HeliusTransaction,
  walletAddress: string
): ParsedTransaction | null {
  try {
    const { signature, timestamp, fee, events, tokenTransfers, accountData } = tx;

    // Detect swap event
    if (events?.swap) {
      const swap = events.swap;
      const isBuy = swap.nativeInput != null && swap.tokenOutputs.length > 0;
      const isSell = swap.nativeOutput != null && swap.tokenInputs.length > 0;
      const type: TxType = isBuy ? 'BUY' : isSell ? 'SELL' : 'UNKNOWN';

      const tokenSide = isBuy ? swap.tokenOutputs : swap.tokenInputs;
      if (tokenSide.length === 0) return null;

      const primaryToken = tokenSide[0];
      const mint = primaryToken.mint;
      const rawAmount = parseInt(primaryToken.rawTokenAmount.tokenAmount, 10);
      const decimals = primaryToken.rawTokenAmount.decimals;
      const amountToken = rawAmount / Math.pow(10, decimals);

      const nativeLamports = isBuy
        ? parseInt(swap.nativeInput!.amount, 10)
        : parseInt(swap.nativeOutput!.amount, 10);
      const amountSol = nativeLamports / 1e9;

      const cached = db.prepare('SELECT symbol, name, price_usd FROM token_cache WHERE mint = ?').get(mint) as { symbol: string; name: string; price_usd: number } | undefined;
      const priceUsd = cached?.price_usd ?? 0;

      return {
        signature,
        walletAddress,
        type,
        tokenMint: mint,
        tokenSymbol: cached?.symbol ?? mint.slice(0, 6) + '...',
        tokenName: cached?.name ?? 'Unknown',
        amountToken,
        amountSol,
        amountUsd: amountSol * 160, // rough SOL price fallback
        priceUsd,
        dex: tx.source ?? 'Unknown',
        blockTime: timestamp,
        fee: fee / 1e9,
      };
    }

    // Detect token transfers (non-swap)
    if (tokenTransfers && tokenTransfers.length > 0) {
      const transfer = tokenTransfers[0];
      const isIncoming = transfer.toUserAccount === walletAddress;
      return {
        signature,
        walletAddress,
        type: 'TRANSFER',
        tokenMint: transfer.mint,
        tokenSymbol: transfer.mint.slice(0, 6) + '...',
        tokenName: 'Unknown',
        amountToken: transfer.tokenAmount,
        amountSol: 0,
        amountUsd: 0,
        priceUsd: 0,
        dex: tx.source ?? 'Transfer',
        blockTime: timestamp,
        fee: fee / 1e9,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Store parsed transaction ─────────────────────────────────────────────────
export function storeTx(tx: ParsedTransaction): void {
  db.prepare(`
    INSERT OR IGNORE INTO transactions
      (signature, wallet_address, type, token_mint, token_symbol, token_name,
       amount_token, amount_sol, amount_usd, price_usd, dex, block_time, fee)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    tx.signature, tx.walletAddress, tx.type,
    tx.tokenMint, tx.tokenSymbol, tx.tokenName,
    tx.amountToken, tx.amountSol, tx.amountUsd, tx.priceUsd,
    tx.dex, tx.blockTime, tx.fee
  );
}

// ─── WebSocket subscription to Helius for real-time tx ───────────────────────
export function buildHeliusWsUrl(): string {
  if (config.heliusApiKey) {
    return `wss://atlas-mainnet.helius-rpc.com?api-key=${config.heliusApiKey}`;
  }
  return 'wss://api.mainnet-beta.solana.com';
}

// ─── Get token metadata via Helius DAS API ─────────────────────────────────
export async function getTokenMetadata(mint: string): Promise<{ symbol: string; name: string; decimals: number; logoUri?: string } | null> {
  try {
    const { data } = await axios.post(
      `${config.heliusRpcUrl}/?api-key=${config.heliusApiKey}`,
      {
        jsonrpc: '2.0',
        id: 'get-asset',
        method: 'getAsset',
        params: { id: mint },
      },
      { timeout: 8000 }
    );
    const result = data?.result;
    if (!result) return null;
    return {
      symbol: result.content?.metadata?.symbol ?? '',
      name: result.content?.metadata?.name ?? '',
      decimals: result.token_info?.decimals ?? 9,
      logoUri: result.content?.links?.image,
    };
  } catch {
    return null;
  }
}
