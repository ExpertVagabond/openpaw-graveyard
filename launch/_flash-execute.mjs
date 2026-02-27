/**
 * Focused flash loan execution on BONK and POPCAT.
 * Scans both pairs, executes if profitable.
 */
import {
  Connection, Keypair, PublicKey, TransactionInstruction,
  TransactionMessage, VersionedTransaction, ComputeBudgetProgram,
  SystemProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import fs from 'fs';
import 'dotenv/config';

const JUPITER_API_BASE = 'https://api.jup.ag/swap/v1';
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || '';
const HELIUS_RPC = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
const SLIPPAGE_BPS = 50;

const FLASH_LOAN_PROGRAM = new PublicKey('2chVPk6DV21qWuyUA2eHAzATdFSHM7ykv1fVX7Gv6nor');
const USDC_MINT_PK = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const BORROW_DISC = Buffer.from([64, 203, 133, 3, 2, 181, 8, 180]);
const REPAY_DISC = Buffer.from([119, 239, 18, 45, 194, 107, 31, 238]);
const JITO_TIP_ACCT = new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5');

const PAIRS = [
  { pair: 'BONK/USDC', tokenA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', tokenB: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', borrow: 20_000_000n },
  { pair: 'POPCAT/USDC', tokenA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', tokenB: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', borrow: 20_000_000n },
];

const connection = new Connection(HELIUS_RPC, 'confirmed');
const secret = JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf8'));
const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));

async function jupQuote(inputMint, outputMint, amount) {
  const params = new URLSearchParams({
    inputMint, outputMint, amount: amount.toString(),
    slippageBps: String(SLIPPAGE_BPS), onlyDirectRoutes: 'true', maxAccounts: '20',
  });
  const headers = {};
  if (JUPITER_API_KEY) headers['x-api-key'] = JUPITER_API_KEY;
  const res = await fetch(JUPITER_API_BASE + '/quote?' + params, { headers });
  if (res.status !== 200) throw new Error('Jupiter quote ' + res.status);
  return await res.json();
}

function deserializeIx(raw) {
  return new TransactionInstruction({
    programId: new PublicKey(raw.programId),
    keys: raw.accounts.map(a => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
    data: Buffer.from(raw.data, 'base64'),
  });
}

async function getSwapIx(quote, userPubkey, wrapSol, useTokenLedger) {
  const body = {
    quoteResponse: quote, userPublicKey: userPubkey.toBase58(),
    wrapAndUnwrapSol: wrapSol, dynamicComputeUnitLimit: true, prioritizationFeeLamports: 0,
  };
  if (useTokenLedger) body.useTokenLedger = true;
  const headers = { 'Content-Type': 'application/json' };
  if (JUPITER_API_KEY) headers['x-api-key'] = JUPITER_API_KEY;
  const res = await fetch(JUPITER_API_BASE + '/swap-instructions', { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.status !== 200) throw new Error('swap-instructions ' + res.status + ': ' + await res.text());
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return {
    tokenLedgerInstruction: data.tokenLedgerInstruction ? deserializeIx(data.tokenLedgerInstruction) : null,
    setupInstructions: (data.setupInstructions || []).map(deserializeIx),
    swapInstruction: deserializeIx(data.swapInstruction),
    cleanupInstruction: data.cleanupInstruction ? deserializeIx(data.cleanupInstruction) : null,
    addressLookupTableAddresses: data.addressLookupTableAddresses || [],
  };
}

function derivePoolPda() { return PublicKey.findProgramAddressSync([Buffer.from('lending_pool'), USDC_MINT_PK.toBuffer()], FLASH_LOAN_PROGRAM)[0]; }
function deriveVaultPda(pool) { return PublicKey.findProgramAddressSync([Buffer.from('pool_vault'), pool.toBuffer()], FLASH_LOAN_PROGRAM)[0]; }
function deriveReceiptPda(pool, borrower) { return PublicKey.findProgramAddressSync([Buffer.from('flash_loan_receipt'), pool.toBuffer(), borrower.toBuffer()], FLASH_LOAN_PROGRAM)[0]; }

function buildBorrowIx(borrower, ata, amount) {
  const pool = derivePoolPda(), vault = deriveVaultPda(pool), receipt = deriveReceiptPda(pool, borrower);
  const data = Buffer.alloc(16); BORROW_DISC.copy(data, 0); data.writeBigUInt64LE(BigInt(amount), 8);
  return new TransactionInstruction({ programId: FLASH_LOAN_PROGRAM, keys: [
    { pubkey: pool, isSigner: false, isWritable: true }, { pubkey: receipt, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true }, { pubkey: ata, isSigner: false, isWritable: true },
    { pubkey: borrower, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ], data });
}

function buildRepayIx(borrower, ata) {
  const pool = derivePoolPda(), vault = deriveVaultPda(pool), receipt = deriveReceiptPda(pool, borrower);
  return new TransactionInstruction({ programId: FLASH_LOAN_PROGRAM, keys: [
    { pubkey: pool, isSigner: false, isWritable: true }, { pubkey: receipt, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true }, { pubkey: ata, isSigner: false, isWritable: true },
    { pubkey: borrower, isSigner: true, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ], data: REPAY_DISC });
}

async function main() {
  console.log('Wallet:', keypair.publicKey.toBase58().slice(0, 12) + '...');
  const bal = await connection.getBalance(keypair.publicKey);
  console.log('Balance:', (bal / 1e9).toFixed(4), 'SOL');
  console.log('\n=== Focused Flash Scan: BONK + POPCAT ===\n');

  for (const { pair, tokenA, tokenB, borrow } of PAIRS) {
    console.log('--- ' + pair + ' (borrow $' + Number(borrow) / 1e6 + ') ---');
    try {
      const q1 = await jupQuote(tokenA, tokenB, borrow.toString());
      const leg1Out = BigInt(q1.outAmount);
      console.log('  Leg1: ' + borrow + ' USDC -> ' + leg1Out + ' ' + pair.split('/')[0]);

      const q2 = await jupQuote(tokenB, tokenA, leg1Out.toString());
      const leg2Out = BigInt(q2.outAmount);
      console.log('  Leg2: ' + leg1Out + ' -> ' + leg2Out + ' USDC');

      const fee = (borrow * 9n + 9999n) / 10000n;
      const profit = leg2Out - borrow - fee;
      const bps = Number((profit * 10000n) / borrow);
      console.log('  Profit: ' + profit + ' (' + bps + ' bps), fee: ' + fee);

      // Force execute regardless of profitability — atomic flash loan reverts if unprofitable
      console.log('  Building flash loan tx (force execute, bps=' + bps + ')...');

      const [swapIx1, swapIx2] = await Promise.all([
        getSwapIx(q1, keypair.publicKey, true, false),
        getSwapIx(q2, keypair.publicKey, true, true),
      ]);

      const usdcAta = getAssociatedTokenAddressSync(USDC_MINT_PK, keypair.publicKey, false, TOKEN_PROGRAM_ID);

      const instructions = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 25000 }),
        createAssociatedTokenAccountIdempotentInstruction(keypair.publicKey, usdcAta, keypair.publicKey, USDC_MINT_PK, TOKEN_PROGRAM_ID),
        buildBorrowIx(keypair.publicKey, usdcAta, borrow),
        ...swapIx1.setupInstructions,
        swapIx1.swapInstruction,
        ...(swapIx1.cleanupInstruction ? [swapIx1.cleanupInstruction] : []),
        ...(swapIx2.tokenLedgerInstruction ? [swapIx2.tokenLedgerInstruction] : []),
        ...swapIx2.setupInstructions,
        swapIx2.swapInstruction,
        ...(swapIx2.cleanupInstruction ? [swapIx2.cleanupInstruction] : []),
        buildRepayIx(keypair.publicKey, usdcAta),
        SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: JITO_TIP_ACCT, lamports: 10000 }),
      ];

      // Load ALTs
      const altAddrs = [...new Set([...swapIx1.addressLookupTableAddresses, ...swapIx2.addressLookupTableAddresses])];
      const tables = [];
      for (const addr of altAddrs) {
        const r = await connection.getAddressLookupTable(new PublicKey(addr));
        if (r.value) tables.push(r.value);
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const msg = new TransactionMessage({ payerKey: keypair.publicKey, recentBlockhash: blockhash, instructions }).compileToV0Message(tables);
      const tx = new VersionedTransaction(msg);
      tx.sign([keypair]);

      const txBytes = tx.serialize().length;
      console.log('  TX: ' + txBytes + ' bytes, ' + instructions.length + ' ix');

      if (txBytes > 1232) { console.log('  TX too large — skipping'); continue; }

      console.log('  Simulating...');
      const sim = await connection.simulateTransaction(tx, { commitment: 'confirmed' });
      if (sim.value.err) {
        console.log('  Simulation FAILED:', JSON.stringify(sim.value.err));
        for (const log of (sim.value.logs || []).slice(-10)) console.log('    ' + log);
        continue;
      }
      console.log('  Simulation PASSED! (' + sim.value.unitsConsumed + ' CU)');

      console.log('  Sending via Jito...');
      let sig;
      try {
        const jitoRes = await fetch('https://mainnet.block-engine.jito.wtf/api/v1/transactions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction',
            params: [Buffer.from(tx.serialize()).toString('base64'), { encoding: 'base64' }] }),
        });
        const jitoData = await jitoRes.json();
        sig = jitoData.result;
        if (sig) { console.log('  Jito sig:', sig); }
        else throw new Error(jitoData.error?.message || 'No sig');
      } catch (e) {
        console.log('  Jito failed (' + e.message + '), sending via RPC...');
        sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
      }

      console.log('  TX:', sig);
      console.log('  https://solscan.io/tx/' + sig);

      const conf = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      if (conf.value.err) {
        console.log('  REVERTED on-chain (expected if not profitable):', JSON.stringify(conf.value.err));
      } else {
        console.log('  >>> TX LANDED! ' + pair + ' ' + bps + 'bps <<<');
      }
    } catch (e) {
      console.log('  Error: ' + e.message);
    }
    console.log();
  }
  console.log('Done.');
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1); });
