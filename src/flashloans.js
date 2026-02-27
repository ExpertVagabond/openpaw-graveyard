// Flash loan arbitrage scanner + executor for OpenPaw
// Scans for arb opportunities, then executes via atomic flash loan transactions
// Uses @solana/web3.js for transaction building, fetch for Jupiter/Raydium APIs

import {
  Connection, Keypair, PublicKey, TransactionInstruction,
  TransactionMessage, VersionedTransaction, ComputeBudgetProgram,
  SystemProgram, AddressLookupTableAccount,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import fs from 'fs';

// ─── Token Registry ──────────────────────────────────────

const WELL_KNOWN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  RENDER: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
  HNT: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',
  W: '85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ',
  JTO: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
  MSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  JITOSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  BSOL: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
  INF: '5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  POPCAT: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  MEW: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
  TRUMP: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
  FARTCOIN: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump',
  KMNO: 'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS',
  DRIFT: 'DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7',
  AI16Z: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
};

const TOKEN_DECIMALS = {
  SOL: 9, USDC: 6, USDT: 6, JUP: 6, RAY: 6, ORCA: 6, PYTH: 6,
  RENDER: 8, HNT: 8, W: 6, JTO: 9, MSOL: 9, JITOSOL: 9, BSOL: 9,
  INF: 9, BONK: 5, WIF: 6, POPCAT: 9, MEW: 5, TRUMP: 6, FARTCOIN: 6,
  KMNO: 6, DRIFT: 6, AI16Z: 9,
};

function resolveMint(symbolOrMint) {
  return WELL_KNOWN_MINTS[symbolOrMint.toUpperCase()] ?? symbolOrMint;
}

function parsePair(pair) {
  const [a, b] = pair.split('/');
  if (!a || !b) throw new Error(`Invalid pair: ${pair}`);
  return [resolveMint(a), resolveMint(b)];
}

function formatTokenAmount(amount, decimals) {
  if (amount < 0n) amount = -amount;
  const whole = amount / BigInt(10 ** decimals);
  const frac = amount % BigInt(10 ** decimals);
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

// ─── Rate Limiter (Token Bucket) ─────────────────────────

class RateLimiter {
  constructor(maxTokens, refillRate) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire() {
    this.refill();
    if (this.tokens >= 1) { this.tokens -= 1; return; }
    const waitMs = ((1 - this.tokens) / this.refillRate) * 1000;
    return new Promise(resolve => {
      setTimeout(() => { this.refill(); this.tokens = Math.max(0, this.tokens - 1); resolve(); }, Math.ceil(waitMs));
    });
  }

  drain() { this.tokens = 0; this.lastRefill = Date.now(); }
}

// ─── Quote Client (Jupiter + Raydium) ───────────────────

const JUPITER_API_BASE = 'https://api.jup.ag/swap/v1';
const RAYDIUM_API_BASE = 'https://transaction-v1.raydium.io';

const JUPITER_API_KEY = process.env.JUPITER_API_KEY || '';
const rateLimiter = new RateLimiter(3, JUPITER_API_KEY ? 2 : 0.8);

const quoteCache = new Map();
const QUOTE_CACHE_TTL = 5000;

let raydiumCooldownUntil = 0;
const RAYDIUM_COOLDOWN_MS = 120_000;

async function getRaydiumQuote(inputMint, outputMint, amount, slippageBps) {
  const params = new URLSearchParams({
    inputMint, outputMint, amount, slippageBps: String(slippageBps), txVersion: 'V0',
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${RAYDIUM_API_BASE}/compute/swap-base-in?${params}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Raydium ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('Raydium quote failed');
    const d = json.data;
    return {
      inputMint: d.inputMint, inAmount: d.inputAmount,
      outputMint: d.outputMint, outAmount: d.outputAmount,
      priceImpactPct: d.priceImpactPct?.toString() ?? '0',
    };
  } finally { clearTimeout(timeout); }
}

async function getJupiterQuote(inputMint, outputMint, amount, slippageBps, directOnly) {
  await rateLimiter.acquire();
  const params = new URLSearchParams({
    inputMint, outputMint, amount, slippageBps: String(slippageBps),
    ...(directOnly ? { onlyDirectRoutes: 'true' } : {}),
    maxAccounts: directOnly ? '20' : '40',
  });
  const headers = {};
  if (JUPITER_API_KEY) headers['x-api-key'] = JUPITER_API_KEY;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${JUPITER_API_BASE}/quote?${params}`, { headers, signal: controller.signal });
    if (res.status === 429) { rateLimiter.drain(); throw new Error('Rate limited'); }
    if (!res.ok) throw new Error(`Jupiter ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timeout); }
}

async function getQuote(inputMint, outputMint, amount, slippageBps, directOnly = true) {
  const cacheKey = `${inputMint}:${outputMint}:${amount}`;
  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < QUOTE_CACHE_TTL) return cached.quote;

  if (quoteCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of quoteCache) {
      if (now - v.ts > QUOTE_CACHE_TTL) quoteCache.delete(k);
    }
  }

  // Raydium first (generous limits)
  if (Date.now() > raydiumCooldownUntil) {
    try {
      const quote = await getRaydiumQuote(inputMint, outputMint, amount, slippageBps);
      quoteCache.set(cacheKey, { quote, ts: Date.now() });
      return quote;
    } catch (err) {
      if (err.message.includes('429') || err.message.includes('1015')) {
        raydiumCooldownUntil = Date.now() + RAYDIUM_COOLDOWN_MS;
      }
    }
  }

  const quote = await getJupiterQuote(inputMint, outputMint, amount, slippageBps, directOnly);
  quoteCache.set(cacheKey, { quote, ts: Date.now() });
  return quote;
}

// ─── Profit Calculator ──────────────────────────────────

const SOL_MINT = 'So11111111111111111111111111111111111111112';

function estimateSolCostsInToken(borrowAmount, leg1Out, tokenA, tokenB) {
  const BASE_FEE = 5000n;
  const PRIORITY_FEE = BigInt(Math.ceil((400000 * 25000) / 1_000_000));
  const JITO_TIP = 10000n;
  const totalSolCost = BASE_FEE + PRIORITY_FEE + JITO_TIP;

  if (tokenB === SOL_MINT && leg1Out > 0n) {
    return (totalSolCost * borrowAmount) / leg1Out;
  }
  if (tokenA === SOL_MINT) return totalSolCost;

  // Fallback: assume SOL ~ $140
  return (totalSolCost * 140_000_000n) / 1_000_000_000n;
}

function calculateProfit(pair, tokenA, tokenB, borrowAmount, leg1Out, leg2Out, feeBps) {
  const flashLoanFee = (borrowAmount * BigInt(feeBps) + 9999n) / 10000n;
  const solCosts = estimateSolCostsInToken(borrowAmount, leg1Out, tokenA, tokenB);
  const expectedProfit = leg2Out - borrowAmount - flashLoanFee - solCosts;
  const profitBps = borrowAmount > 0n ? Number((expectedProfit * 10000n) / borrowAmount) : 0;
  return {
    pair, tokenA, tokenB, borrowAmount, leg1Out, leg2Out,
    flashLoanFee, solCosts, expectedProfit, profitBps,
    timestamp: Date.now(),
  };
}

// ─── Per-Pair Borrow Sizing ─────────────────────────────

const PAIR_BORROWS = {
  So111111: 0n, Es9vMFrz: 0n,                                    // Deep: default
  JUPyiwrY: 100_000_000n, '4k3Dyjzv': 100_000_000n,             // High: $100
  orcaEKTd: 100_000_000n, mSoLzYCx: 100_000_000n,
  J1toso1u: 100_000_000n, jtojtome: 100_000_000n,
  rndrizKT: 100_000_000n, '85VBFQZC': 100_000_000n,
  EKpQGSJt: 50_000_000n, HZ1JovNi: 50_000_000n,                 // Moderate: $50
  hntyVP6Y: 50_000_000n, TNSRxcUx: 50_000_000n,
  bSo13r4T: 50_000_000n, '5oVNBeEE': 50_000_000n,
  KMNo3nJs: 50_000_000n, DriFtupJ: 50_000_000n,
  DezXAZ8z: 20_000_000n, '7GCihgDB': 20_000_000n,               // Meme: $20
  MEW1gQWJ: 20_000_000n, '6p6xgHyF': 20_000_000n,
  '9BB6NFEc': 20_000_000n, ukHH6c7m: 20_000_000n,
  '7BgBvyjr': 20_000_000n, WENWENvq: 20_000_000n,
  HeLp6NuQ: 10_000_000n,                                         // Low: $10
};

const DEFAULT_BORROW = 100_000_000n; // $100 USDC
const POOL_FEE_BPS = 9;
const MIN_PROFIT_BPS = 5;
const SLIPPAGE_BPS = 50;

// ─── Default Pairs ──────────────────────────────────────

const DEFAULT_PAIRS = [
  'SOL/USDC', 'JUP/USDC', 'RAY/USDC', 'ORCA/USDC', 'BONK/USDC',
  'WIF/USDC', 'PYTH/USDC', 'JTO/USDC', 'RENDER/USDC', 'W/USDC',
  'MSOL/USDC', 'JITOSOL/USDC', 'BSOL/USDC', 'USDT/USDC',
  'TRUMP/USDC', 'FARTCOIN/USDC', 'POPCAT/USDC', 'MEW/USDC',
  'DRIFT/USDC', 'KMNO/USDC',
];

const HOT_PAIRS = new Set([
  'SOL/USDC', 'JUP/USDC', 'RAY/USDC', 'BONK/USDC', 'WIF/USDC',
  'USDT/USDC', 'TRUMP/USDC', 'MSOL/USDC', 'JITOSOL/USDC',
]);

// ─── Scanner ────────────────────────────────────────────

async function scanPair(pair, tokenA, tokenB) {
  const mintPrefix = tokenB.slice(0, 8);
  const borrowAmount = PAIR_BORROWS[mintPrefix] || DEFAULT_BORROW;

  // Use Jupiter-only quotes for consistent pricing (Raydium quotes can diverge)
  const quoteLeg1 = await getJupiterQuote(tokenA, tokenB, borrowAmount.toString(), SLIPPAGE_BPS, true);
  const leg1Out = BigInt(quoteLeg1.outAmount);
  if (leg1Out === 0n) return null;

  const quoteLeg2 = await getJupiterQuote(tokenB, tokenA, leg1Out.toString(), SLIPPAGE_BPS, true);
  const leg2Out = BigInt(quoteLeg2.outAmount);

  const result = calculateProfit(pair, tokenA, tokenB, borrowAmount, leg1Out, leg2Out, POOL_FEE_BPS);
  result.quoteLeg1 = quoteLeg1;
  result.quoteLeg2 = quoteLeg2;
  return result;
}

// ─── Metrics ────────────────────────────────────────────

const metrics = {
  startTime: Date.now(),
  scanCycles: 0,
  pairsScanned: 0,
  opportunitiesFound: 0,
  bestProfitBps: -9999,
  bestProfitPair: '',
  lastScanTime: null,
  history: [],
};

// ─── Scan Cycle ─────────────────────────────────────────

async function scanOnce(opts = {}) {
  const { hotPairsOnly = false } = opts;
  const cycleStart = Date.now();
  metrics.scanCycles++;

  const pairs = hotPairsOnly ? DEFAULT_PAIRS.filter(p => HOT_PAIRS.has(p)) : DEFAULT_PAIRS;
  const opportunities = [];
  let bestBps = -9999;
  let bestPair = '';

  for (const pair of pairs) {
    try {
      const [tokenA, tokenB] = parsePair(pair);
      const opp = await scanPair(pair, tokenA, tokenB);
      if (opp) {
        metrics.pairsScanned++;
        if (opp.profitBps > bestBps) { bestBps = opp.profitBps; bestPair = pair; }
        if (opp.profitBps >= MIN_PROFIT_BPS) {
          opportunities.push(opp);
          metrics.opportunitiesFound++;
        }
      }
    } catch (err) {
      // Skip pairs with no route — continue scanning
    }
  }

  if (bestBps > metrics.bestProfitBps) {
    metrics.bestProfitBps = bestBps;
    metrics.bestProfitPair = bestPair;
  }
  metrics.lastScanTime = new Date().toISOString();

  for (const opp of opportunities) {
    metrics.history.push(opp);
    if (metrics.history.length > 50) metrics.history.shift();
  }

  const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
  return { opportunities, bestPair, bestBps, elapsed, pairsScanned: pairs.length };
}

// ─── Social Posting ─────────────────────────────────────

function formatScanPost(results) {
  const lines = [`Flash Arb Scanner: ${results.pairsScanned} pairs scanned in ${results.elapsed}s`];
  lines.push(`Best spread: ${results.bestPair} at ${results.bestBps} bps`);

  if (results.opportunities.length > 0) {
    lines.push(`${results.opportunities.length} opportunities above ${MIN_PROFIT_BPS} bps:`);
    for (const opp of results.opportunities.slice(0, 5)) {
      const profitStr = formatTokenAmount(opp.expectedProfit > 0n ? opp.expectedProfit : 0n, 6);
      const borrowStr = formatTokenAmount(opp.borrowAmount, 6);
      lines.push(`  ${opp.pair}: +${opp.profitBps}bps ($${profitStr} on $${borrowStr})`);
    }
  } else {
    lines.push('No profitable routes this cycle.');
  }

  lines.push('Jupiter + Raydium | Direct routes only');
  return lines.join('\n');
}

function formatScanReport(results) {
  const lines = ['\n=== Flash Loan Arb Scan ==='];
  lines.push(`Scanned ${results.pairsScanned} pairs in ${results.elapsed}s`);
  lines.push(`Best spread: ${results.bestPair || 'none'} at ${results.bestBps} bps`);

  if (results.opportunities.length > 0) {
    lines.push(`\nOpportunities (>= ${MIN_PROFIT_BPS} bps):`);
    for (const opp of results.opportunities) {
      const profitStr = formatTokenAmount(opp.expectedProfit > 0n ? opp.expectedProfit : 0n, 6);
      const borrowStr = formatTokenAmount(opp.borrowAmount, 6);
      lines.push(`  ${opp.pair}: ${opp.profitBps} bps, profit ~$${profitStr} (borrow $${borrowStr})`);
    }
  } else {
    lines.push('\nNo profitable opportunities in this scan.');
  }

  return lines.join('\n');
}

// ─── Execution Engine ───────────────────────────────────

const FLASH_LOAN_PROGRAM = new PublicKey('2chVPk6DV21qWuyUA2eHAzATdFSHM7ykv1fVX7Gv6nor');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const BORROW_DISC = Buffer.from([64, 203, 133, 3, 2, 181, 8, 180]);
const REPAY_DISC = Buffer.from([119, 239, 18, 45, 194, 107, 31, 238]);

const HELIUS_RPC = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
const WALLET_PATH = process.env.FLASH_WALLET_PATH || (process.env.HOME + '/.config/solana/id.json');
const EXECUTE_MIN_BPS = parseInt(process.env.FLASH_EXECUTE_MIN_BPS || '10');
const PRIORITY_FEE_MICRO = parseInt(process.env.FLASH_PRIORITY_FEE || '25000');
const COMPUTE_UNITS = 400_000;
const JITO_TIP_LAMPORTS = 10000;
const JITO_TIP_ACCT = new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5');

let _connection = null;
let _keypair = null;
let executionEnabled = false;

function getConnection() {
  if (!_connection) _connection = new Connection(HELIUS_RPC, 'confirmed');
  return _connection;
}

function getKeypair() {
  if (!_keypair) {
    try {
      const secret = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
      _keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
    } catch { return null; }
  }
  return _keypair;
}

function enableExecution(enable = true) {
  executionEnabled = enable;
  if (enable) {
    const kp = getKeypair();
    if (kp) console.log(`  [EXEC] Execution enabled, wallet: ${kp.publicKey.toBase58().slice(0, 8)}...`);
    else console.log('  [EXEC] WARNING: No wallet found, execution disabled');
  }
}

// Flash loan PDAs
function derivePoolPda() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('lending_pool'), USDC_MINT.toBuffer()],
    FLASH_LOAN_PROGRAM
  )[0];
}

function deriveVaultPda(poolPda) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool_vault'), poolPda.toBuffer()],
    FLASH_LOAN_PROGRAM
  )[0];
}

function deriveReceiptPda(poolPda, borrower) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('flash_loan_receipt'), poolPda.toBuffer(), borrower.toBuffer()],
    FLASH_LOAN_PROGRAM
  )[0];
}

function buildBorrowIx(borrower, borrowerTokenAccount, amount) {
  const poolPda = derivePoolPda();
  const vaultPda = deriveVaultPda(poolPda);
  const receiptPda = deriveReceiptPda(poolPda, borrower);
  const data = Buffer.alloc(16);
  BORROW_DISC.copy(data, 0);
  data.writeBigUInt64LE(BigInt(amount), 8);
  return new TransactionInstruction({
    programId: FLASH_LOAN_PROGRAM,
    keys: [
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: receiptPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: borrowerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: borrower, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function buildRepayIx(borrower, borrowerTokenAccount) {
  const poolPda = derivePoolPda();
  const vaultPda = deriveVaultPda(poolPda);
  const receiptPda = deriveReceiptPda(poolPda, borrower);
  return new TransactionInstruction({
    programId: FLASH_LOAN_PROGRAM,
    keys: [
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: receiptPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: borrowerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: borrower, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: REPAY_DISC,
  });
}

function deserializeInstruction(raw) {
  return new TransactionInstruction({
    programId: new PublicKey(raw.programId),
    keys: raw.accounts.map(a => ({
      pubkey: new PublicKey(a.pubkey),
      isSigner: a.isSigner,
      isWritable: a.isWritable,
    })),
    data: Buffer.from(raw.data, 'base64'),
  });
}

async function getSwapInstructions(quote, userPubkey, wrapSol = true, useTokenLedger = false) {
  await rateLimiter.acquire();
  const body = {
    quoteResponse: quote,
    userPublicKey: userPubkey.toBase58(),
    wrapAndUnwrapSol: wrapSol,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: 0,
  };
  if (useTokenLedger) body.useTokenLedger = true;

  const headers = { 'Content-Type': 'application/json' };
  if (JUPITER_API_KEY) headers['x-api-key'] = JUPITER_API_KEY;
  const res = await fetch(`${JUPITER_API_BASE}/swap-instructions`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Jupiter swap-instructions ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.swapInstruction) throw new Error('No swapInstruction in response');

  return {
    tokenLedgerInstruction: data.tokenLedgerInstruction ? deserializeInstruction(data.tokenLedgerInstruction) : null,
    setupInstructions: (data.setupInstructions || []).map(deserializeInstruction),
    swapInstruction: deserializeInstruction(data.swapInstruction),
    cleanupInstruction: data.cleanupInstruction ? deserializeInstruction(data.cleanupInstruction) : null,
    addressLookupTableAddresses: data.addressLookupTableAddresses || [],
  };
}

async function loadAddressLookupTables(connection, addresses) {
  const unique = [...new Set(addresses)];
  if (unique.length === 0) return [];
  const tables = [];
  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async addr => {
        const result = await connection.getAddressLookupTable(new PublicKey(addr));
        return result.value;
      })
    );
    for (const t of results) { if (t) tables.push(t); }
  }
  return tables;
}

async function executeArbitrage(opportunity) {
  const keypair = getKeypair();
  if (!keypair) { console.log('  [EXEC] No wallet — skipping'); return null; }
  const connection = getConnection();

  console.log(`  [EXEC] Executing ${opportunity.pair} — ${opportunity.profitBps}bps expected profit`);

  // Use scan quotes directly — no re-quote. Flash loan is atomic so if
  // it's not profitable on-chain the tx just reverts (only lose tx fee).
  const quoteLeg1 = opportunity.quoteLeg1;
  const quoteLeg2 = opportunity.quoteLeg2;
  if (!quoteLeg1 || !quoteLeg2) {
    console.log('  [EXEC] No cached quotes on opportunity — skipping');
    return null;
  }
  const leg1Out = BigInt(quoteLeg1.outAmount);
  console.log(`  [EXEC] Using scan quotes: leg1=${leg1Out} leg2=${quoteLeg2.outAmount} profit=${opportunity.profitBps}bps`);

  // Check if SOL is involved (disable wrapAndUnwrapSol to avoid SyncNative conflicts)
  const involvesSol = opportunity.tokenA === SOL_MINT || opportunity.tokenB === SOL_MINT;

  // Get swap instructions from Jupiter
  const [swapIx1, swapIx2] = await Promise.all([
    getSwapInstructions(quoteLeg1, keypair.publicKey, !involvesSol),
    getSwapInstructions(quoteLeg2, keypair.publicKey, !involvesSol, true),
  ]);

  // Borrower's USDC ATA
  const borrowerUsdcAta = getAssociatedTokenAddressSync(USDC_MINT, keypair.publicKey, false, TOKEN_PROGRAM_ID);

  // Build atomic transaction: borrow → swap A→B → swap B→A → repay
  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_MICRO }),

    // Ensure USDC ATA exists
    createAssociatedTokenAccountIdempotentInstruction(
      keypair.publicKey, borrowerUsdcAta, keypair.publicKey, USDC_MINT, TOKEN_PROGRAM_ID
    ),

    // Flash loan borrow
    buildBorrowIx(keypair.publicKey, borrowerUsdcAta, opportunity.borrowAmount),

    // Leg 1: tokenA → tokenB
    // Token ledger goes AFTER setup (ATA creation) but BEFORE swap so it
    // snapshots the intermediate token balance. Leg 2 uses the delta.
    ...swapIx1.setupInstructions,
    ...(swapIx2.tokenLedgerInstruction ? [swapIx2.tokenLedgerInstruction] : []),
    swapIx1.swapInstruction,
    ...(swapIx1.cleanupInstruction ? [swapIx1.cleanupInstruction] : []),

    // Leg 2: tokenB → tokenA (uses tokenLedger delta as input)
    ...swapIx2.setupInstructions,
    swapIx2.swapInstruction,
    ...(swapIx2.cleanupInstruction ? [swapIx2.cleanupInstruction] : []),

    // Flash loan repay
    buildRepayIx(keypair.publicKey, borrowerUsdcAta),

    // Jito tip (only paid on success)
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: JITO_TIP_ACCT,
      lamports: JITO_TIP_LAMPORTS,
    }),
  ];

  // Load address lookup tables for V0 transaction
  const allAltAddresses = [
    ...swapIx1.addressLookupTableAddresses,
    ...swapIx2.addressLookupTableAddresses,
  ];
  const lookupTables = await loadAddressLookupTables(connection, allAltAddresses);

  // Build V0 transaction
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const messageV0 = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(lookupTables);

  const tx = new VersionedTransaction(messageV0);
  tx.sign([keypair]);

  const txBytes = tx.serialize().length;
  if (txBytes > 1232) {
    console.log(`  [EXEC] TX too large: ${txBytes} bytes — skipping`);
    return null;
  }

  // Simulate first
  console.log(`  [EXEC] Simulating (${txBytes} bytes, ${instructions.length} ix)...`);
  const sim = await connection.simulateTransaction(tx, { commitment: 'confirmed' });
  if (sim.value.err) {
    console.log(`  [EXEC] Simulation FAILED: ${JSON.stringify(sim.value.err)}`);
    const logs = sim.value.logs || [];
    for (const log of logs.slice(-3)) console.log(`    ${log}`);
    metrics.executionFailed = (metrics.executionFailed || 0) + 1;
    return null;
  }

  // Send via Jito for MEV protection
  console.log(`  [EXEC] Simulation PASSED (${sim.value.unitsConsumed} CU). Sending via Jito...`);
  let sig;
  try {
    const jitoRes = await fetch('https://mainnet.block-engine.jito.wtf/api/v1/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'sendTransaction',
        params: [Buffer.from(tx.serialize()).toString('base64'), { encoding: 'base64' }],
      }),
    });
    const jitoData = await jitoRes.json();
    sig = jitoData.result;
    if (!sig) throw new Error(jitoData.error?.message || 'No signature from Jito');
  } catch (jitoErr) {
    // Fallback to RPC
    console.log(`  [EXEC] Jito failed (${jitoErr.message}), sending via RPC...`);
    sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
  }

  console.log(`  [EXEC] TX: ${sig}`);
  console.log(`  [EXEC] https://solscan.io/tx/${sig}`);

  // Confirm
  const conf = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  if (conf.value.err) {
    console.log(`  [EXEC] TX FAILED on-chain: ${JSON.stringify(conf.value.err)}`);
    metrics.executionFailed = (metrics.executionFailed || 0) + 1;
    return { sig, success: false };
  }

  const profitStr = formatTokenAmount(freshProfit > 0n ? freshProfit : 0n, 6);
  console.log(`  [EXEC] ARB SUCCESS! ${opportunity.pair} +${freshBps}bps ($${profitStr} profit)`);
  metrics.executionSuccess = (metrics.executionSuccess || 0) + 1;
  metrics.totalProfit = (metrics.totalProfit || 0n) + freshProfit;
  return { sig, success: true, profitBps: freshBps, profitUsd: profitStr };
}

// ─── Daemon ─────────────────────────────────────────────

let running = false;

async function daemon(intervalSec = 30) {
  running = true;
  enableExecution(true);
  console.log(`Flash loan scanner+executor daemon — interval: ${intervalSec}s, min execute: ${EXECUTE_MIN_BPS}bps`);

  while (running) {
    try {
      const result = await scanOnce();
      console.log(`[SCAN #${metrics.scanCycles}] ${result.pairsScanned} pairs in ${result.elapsed}s | best: ${result.bestPair} ${result.bestBps}bps | opps: ${result.opportunities.length}`);

      // Execute profitable opportunities
      if (executionEnabled) {
        for (const opp of result.opportunities) {
          if (opp.profitBps >= EXECUTE_MIN_BPS) {
            try {
              await executeArbitrage(opp);
            } catch (execErr) {
              console.error(`  [EXEC] Error: ${execErr.message}`);
            }
          }
        }
      }
    } catch (err) {
      console.error(`  Scan error: ${err.message}`);
    }

    if (running) {
      await new Promise(r => setTimeout(r, intervalSec * 1000));
    }
  }
}

function stopDaemon() { running = false; }

// ─── Stats ──────────────────────────────────────────────

function getStats() {
  const uptimeMs = Date.now() - metrics.startTime;
  return {
    uptimeMinutes: (uptimeMs / 60000).toFixed(1),
    scanCycles: metrics.scanCycles,
    pairsScanned: metrics.pairsScanned,
    opportunitiesFound: metrics.opportunitiesFound,
    bestProfitBps: metrics.bestProfitBps,
    bestProfitPair: metrics.bestProfitPair,
    lastScanTime: metrics.lastScanTime,
    executionEnabled,
    executionSuccess: metrics.executionSuccess || 0,
    executionFailed: metrics.executionFailed || 0,
    executionSkipped: metrics.executionSkipped || 0,
    totalProfit: (metrics.totalProfit || 0n).toString(),
    recentOpportunities: metrics.history.slice(-10).map(o => ({
      pair: o.pair,
      profitBps: o.profitBps,
      expectedProfit: o.expectedProfit.toString(),
      borrowAmount: o.borrowAmount.toString(),
      timestamp: new Date(o.timestamp).toISOString(),
    })),
  };
}

// ─── Exports ────────────────────────────────────────────

export {
  scanOnce,
  scanPair,
  daemon,
  stopDaemon,
  getStats,
  formatScanPost,
  formatScanReport,
  executeArbitrage,
  enableExecution,
  DEFAULT_PAIRS,
  HOT_PAIRS,
  WELL_KNOWN_MINTS,
  resolveMint,
  formatTokenAmount,
};
