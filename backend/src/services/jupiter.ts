import axios from 'axios';
import { Connection, Keypair, VersionedTransaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from '../config';

const quoteClient = axios.create({ baseURL: config.jupiterQuoteUrl, timeout: 15_000 });

// SOL mint address
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// ─── Get a swap quote from Jupiter ───────────────────────────────────────────
export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amountLamports: number; // in smallest unit (lamports for SOL, raw for token)
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
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amountLamports,
        slippageBps: params.slippageBps ?? config.defaultSlippageBps,
        onlyDirectRoutes: params.onlyDirectRoutes ?? false,
      },
    });
    return data;
  } catch (err) {
    console.error('[Jupiter] getQuote error:', (err as Error).message);
    return null;
  }
}

// ─── Get SOL price in USD ─────────────────────────────────────────────────────
export async function getSolPrice(): Promise<number> {
  try {
    const { data } = await axios.get(`${config.jupiterPriceUrl}/price`, {
      params: { ids: SOL_MINT },
      timeout: 8000,
    });
    return data?.data?.[SOL_MINT]?.price ?? 0;
  } catch {
    return 160; // fallback
  }
}

// ─── Execute a swap ───────────────────────────────────────────────────────────
export interface SwapParams {
  quote: QuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  prioritizationFeeLamports?: number | 'auto';
}

export interface SwapResult {
  success: boolean;
  signature?: string;
  error?: string;
  outputAmount?: number;
}

export async function executeSwap(params: SwapParams): Promise<SwapResult> {
  if (!config.traderPrivateKey) {
    return { success: false, error: 'No trader private key configured' };
  }

  const connection = new Connection(config.heliusRpcUrl || config.rpcUrl, 'confirmed');

  try {
    // 1. Get serialized transaction from Jupiter
    const { data: swapData } = await quoteClient.post('/swap', {
      quoteResponse: params.quote,
      userPublicKey: params.userPublicKey,
      wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: params.prioritizationFeeLamports ?? 'auto',
    });

    if (!swapData?.swapTransaction) {
      return { success: false, error: 'No swap transaction returned' };
    }

    // 2. Deserialize
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // 3. Sign
    const keypair = Keypair.fromSecretKey(bs58.decode(config.traderPrivateKey));
    transaction.sign([keypair]);

    // 4. Send
    const rawTransaction = transaction.serialize();
    const signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
      maxRetries: 3,
    });

    // 5. Confirm
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature, ...latestBlockhash },
      'confirmed'
    );

    const outAmount = parseInt(params.quote.outAmount, 10);
    return { success: true, signature, outputAmount: outAmount };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Buy a token with SOL ─────────────────────────────────────────────────────
export async function buyToken(
  tokenMint: string,
  solAmount: number,
  slippageBps = config.defaultSlippageBps
): Promise<SwapResult> {
  const amountLamports = Math.floor(solAmount * 1e9);
  const quote = await getQuote({
    inputMint: SOL_MINT,
    outputMint: tokenMint,
    amountLamports,
    slippageBps,
  });
  if (!quote) return { success: false, error: 'Could not get quote' };
  return executeSwap({ quote, userPublicKey: config.traderWalletAddress });
}

// ─── Sell a token for SOL ─────────────────────────────────────────────────────
export async function sellToken(
  tokenMint: string,
  tokenAmount: number,
  decimals: number,
  slippageBps = config.defaultSlippageBps
): Promise<SwapResult> {
  const rawAmount = Math.floor(tokenAmount * Math.pow(10, decimals));
  const quote = await getQuote({
    inputMint: tokenMint,
    outputMint: SOL_MINT,
    amountLamports: rawAmount,
    slippageBps,
  });
  if (!quote) return { success: false, error: 'Could not get quote' };
  return executeSwap({ quote, userPublicKey: config.traderWalletAddress });
}

// ─── Token price in USD via Jupiter price API ─────────────────────────────────
export async function getTokenPriceUsd(mint: string): Promise<number | null> {
  try {
    const { data } = await axios.get(`${config.jupiterPriceUrl}/price`, {
      params: { ids: mint, vsToken: USDC_MINT },
      timeout: 8000,
    });
    return data?.data?.[mint]?.price ?? null;
  } catch {
    return null;
  }
}
