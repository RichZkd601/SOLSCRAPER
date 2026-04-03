import axios from 'axios';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from '../config';

const quoteClient = axios.create({ baseURL: config.jupiterQuoteUrl, timeout: 15_000 });

export const SOL_MINT  = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// ─── SOL price cache ──────────────────────────────────────────────────────────
let _solPriceCache: { price: number; ts: number } = { price: 160, ts: 0 };

export async function getSolPrice(): Promise<number> {
  // Cache 60s
  if (Date.now() - _solPriceCache.ts < 60_000) return _solPriceCache.price;
  try {
    const { data } = await axios.get(`${config.jupiterPriceUrl}/price`, {
      params: { ids: SOL_MINT },
      timeout: 8_000,
    });
    const price = data?.data?.[SOL_MINT]?.price ?? 160;
    _solPriceCache = { price, ts: Date.now() };
    return price;
  } catch {
    return _solPriceCache.price;
  }
}

// ─── Dynamic slippage based on pool liquidity ─────────────────────────────────
export function computeSlippage(liquidityUsd: number): number {
  if (liquidityUsd >= config.slippage.highLiqThreshold) return config.slippage.highLiquidity;
  if (liquidityUsd >= config.slippage.medLiqThreshold)  return config.slippage.medLiquidity;
  return config.slippage.lowLiquidity;
}

// ─── Smart priority fee (based on network congestion estimate) ────────────────
export async function getSmartPriorityFee(): Promise<number> {
  try {
    const connection = new Connection(config.heliusRpcUrl || config.rpcUrl, 'confirmed');
    const fees = await connection.getRecentPrioritizationFees();
    if (!fees.length) return config.priorityFee.default;
    const avg = fees.reduce((s, f) => s + f.prioritizationFee, 0) / fees.length;
    const smart = Math.ceil(avg * 1.2); // 20% above avg to land reliably
    return Math.min(smart, config.priorityFee.maxCap);
  } catch {
    return config.priorityFee.medium;
  }
}

// ─── Quote types ─────────────────────────────────────────────────────────────
export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amountLamports: number;
  slippageBps?: number;
  onlyDirectRoutes?: boolean;
}

export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: unknown[];
  contextSlot: number;
  timeTaken: number;
}

export async function getQuote(params: QuoteParams): Promise<QuoteResponse | null> {
  try {
    const { data } = await quoteClient.get<QuoteResponse>('/quote', {
      params: {
        inputMint:        params.inputMint,
        outputMint:       params.outputMint,
        amount:           params.amountLamports,
        slippageBps:      params.slippageBps ?? config.defaultSlippageBps,
        onlyDirectRoutes: params.onlyDirectRoutes ?? false,
        maxAccounts:      64, // optimize route complexity
      },
    });
    return data;
  } catch (err) {
    console.error('[Jupiter] getQuote error:', (err as Error).message);
    return null;
  }
}

// ─── Swap result ─────────────────────────────────────────────────────────────
export interface SwapResult {
  success: boolean;
  signature?: string;
  error?: string;
  outputAmount?: number;
  feeSol?: number;
  slippageUsed?: number;
  priceImpact?: number;
}

// ─── Execute swap with optimized fees ────────────────────────────────────────
export async function executeSwap(params: {
  quote: QuoteResponse;
  userPublicKey: string;
  priorityFeeLamports?: number;
}): Promise<SwapResult> {
  if (!config.traderPrivateKey) {
    return { success: false, error: 'Clé privée non configurée dans .env' };
  }

  const connection = new Connection(config.heliusRpcUrl || config.rpcUrl, 'confirmed');

  try {
    const priorityFee = params.priorityFeeLamports ?? await getSmartPriorityFee();

    const { data: swapData } = await quoteClient.post('/swap', {
      quoteResponse:            params.quote,
      userPublicKey:            params.userPublicKey,
      wrapAndUnwrapSol:         true,
      dynamicComputeUnitLimit:  true,   // auto-optimize compute units
      prioritizationFeeLamports: priorityFee,
    });

    if (!swapData?.swapTransaction) {
      return { success: false, error: 'Pas de transaction retournée par Jupiter' };
    }

    const transaction = VersionedTransaction.deserialize(
      Buffer.from(swapData.swapTransaction, 'base64')
    );
    const keypair = Keypair.fromSecretKey(bs58.decode(config.traderPrivateKey));
    transaction.sign([keypair]);

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight:     true,
      maxRetries:        3,
      preflightCommitment: 'confirmed',
    });

    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature, ...latestBlockhash },
      'confirmed'
    );

    return {
      success:      true,
      signature,
      outputAmount: parseInt(params.quote.outAmount, 10),
      feeSol:       priorityFee / 1e9,
      slippageUsed: params.quote.slippageBps,
      priceImpact:  parseFloat(params.quote.priceImpactPct),
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Buy token with SOL — optimized ──────────────────────────────────────────
export async function buyToken(
  tokenMint: string,
  solAmount: number,
  liquidityUsd = 0,
  customSlippageBps?: number
): Promise<SwapResult> {
  const slippage = customSlippageBps ?? computeSlippage(liquidityUsd);
  const amountLamports = Math.floor(solAmount * 1e9);

  const quote = await getQuote({ inputMint: SOL_MINT, outputMint: tokenMint, amountLamports, slippageBps: slippage });
  if (!quote) return { success: false, error: 'Impossible d\'obtenir un quote Jupiter' };

  // Reject if price impact too high (> 5%)
  if (parseFloat(quote.priceImpactPct) > 5) {
    return { success: false, error: `Impact prix trop élevé: ${quote.priceImpactPct}%` };
  }

  return executeSwap({ quote, userPublicKey: config.traderWalletAddress });
}

// ─── Sell token for SOL — optimized ──────────────────────────────────────────
export async function sellToken(
  tokenMint: string,
  tokenAmount: number,
  decimals: number,
  liquidityUsd = 0,
  customSlippageBps?: number
): Promise<SwapResult> {
  const slippage = customSlippageBps ?? computeSlippage(liquidityUsd);
  const rawAmount = Math.floor(tokenAmount * Math.pow(10, decimals));

  const quote = await getQuote({ inputMint: tokenMint, outputMint: SOL_MINT, amountLamports: rawAmount, slippageBps: slippage });
  if (!quote) return { success: false, error: 'Impossible d\'obtenir un quote Jupiter' };

  return executeSwap({ quote, userPublicKey: config.traderWalletAddress });
}

// ─── Token price in USD ───────────────────────────────────────────────────────
export async function getTokenPriceUsd(mint: string): Promise<number | null> {
  try {
    const { data } = await axios.get(`${config.jupiterPriceUrl}/price`, {
      params: { ids: mint, vsToken: USDC_MINT },
      timeout: 8_000,
    });
    return data?.data?.[mint]?.price ?? null;
  } catch {
    return null;
  }
}
