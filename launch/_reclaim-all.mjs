// Reclaim all SOL: withdraw pool USDC, swap USDC→SOL, transfer all to Wallet A
import {
  Connection, PublicKey, Keypair, TransactionInstruction,
  TransactionMessage, VersionedTransaction, SystemProgram, LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction, TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { createHash } from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const conn = new Connection(process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com');
const PROGRAM = new PublicKey('2chVPk6DV21qWuyUA2eHAzATdFSHM7ykv1fVX7Gv6nor');
const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

const WALLET_A_PATH = process.env.HOME + '/.config/solana/id.json';
const WALLET_B_PATH = '/Volumes/Virtual Server/projects/solana-flash-loan/bot/wallet.json';
const walletA = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_A_PATH))));
const walletB = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_B_PATH))));

const JUP_BASE = 'https://api.jup.ag/swap/v1';
const JUP_KEY = process.env.JUPITER_API_KEY || '';
const jupHeaders = { 'Content-Type': 'application/json' };
if (JUP_KEY) jupHeaders['x-api-key'] = JUP_KEY;

function anchorDisc(name) {
  return createHash('sha256').update('global:' + name).digest().slice(0, 8);
}

function deserializeIx(ix) {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map(a => ({
      pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable,
    })),
    data: Buffer.from(ix.data, 'base64'),
  });
}

async function sendAndConfirm(tx, label) {
  console.log(`  Simulating ${label}...`);
  const sim = await conn.simulateTransaction(tx, { commitment: 'confirmed' });
  if (sim.value.err) {
    console.log(`  Simulation FAILED:`, JSON.stringify(sim.value.err));
    for (const log of (sim.value.logs || []).slice(-5)) console.log('    ' + log);
    throw new Error(`${label} simulation failed`);
  }
  console.log(`  Simulation PASSED. Sending...`);
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
  console.log(`  TX: ${sig}`);
  console.log(`  https://solscan.io/tx/${sig}`);
  const bh = tx.message.recentBlockhash;
  // Get fresh blockhash info for confirmation
  const { lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const conf = await conn.confirmTransaction({ signature: sig, blockhash: bh, lastValidBlockHeight }, 'confirmed');
  if (conf.value.err) throw new Error(`${label} failed on-chain: ${JSON.stringify(conf.value.err)}`);
  console.log(`  ${label} confirmed!`);
  return sig;
}

// ─── STEP 1: Withdraw all USDC from flash loan pool ───
console.log('=== STEP 1: Withdraw USDC from pool ===');
const [poolPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('lending_pool'), USDC.toBuffer()], PROGRAM
);
const [vaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('pool_vault'), poolPda.toBuffer()], PROGRAM
);
const [receiptPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('deposit_receipt'), poolPda.toBuffer(), walletB.publicKey.toBuffer()], PROGRAM
);

// Read pool to get shares
const poolAcct = await conn.getAccountInfo(poolPda);
const totalShares = poolAcct.data.readBigUInt64LE(112);
const totalDeposits = poolAcct.data.readBigUInt64LE(104);
console.log(`  Pool: ${(Number(totalDeposits)/1e6).toFixed(2)} USDC, ${totalShares} shares`);

// Read receipt to get our shares
const receiptAcct = await conn.getAccountInfo(receiptPda);
if (!receiptAcct) {
  console.log('  No deposit receipt found — pool may already be empty');
} else {
  const ourShares = receiptAcct.data.readBigUInt64LE(72); // offset: 8 disc + 32 pool + 32 depositor = 72
  console.log(`  Our shares: ${ourShares}`);

  if (ourShares > 0n) {
    // Ensure Wallet B has USDC ATA
    const walletBUsdcAta = getAssociatedTokenAddressSync(USDC, walletB.publicKey, false, TOKEN_PROGRAM_ID);

    const withdrawDisc = anchorDisc('withdraw');
    const withdrawData = Buffer.alloc(16);
    withdrawDisc.copy(withdrawData, 0);
    withdrawData.writeBigUInt64LE(ourShares, 8);

    const withdrawIx = new TransactionInstruction({
      programId: PROGRAM,
      keys: [
        { pubkey: poolPda, isSigner: false, isWritable: true },
        { pubkey: receiptPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: walletBUsdcAta, isSigner: false, isWritable: true },
        { pubkey: walletB.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: withdrawData,
    });

    const bh1 = await conn.getLatestBlockhash('confirmed');
    const msg1 = new TransactionMessage({
      payerKey: walletB.publicKey,
      recentBlockhash: bh1.blockhash,
      instructions: [
        createAssociatedTokenAccountIdempotentInstruction(walletB.publicKey, walletBUsdcAta, walletB.publicKey, USDC, TOKEN_PROGRAM_ID),
        withdrawIx,
      ],
    }).compileToV0Message();
    const tx1 = new VersionedTransaction(msg1);
    tx1.sign([walletB]);
    await sendAndConfirm(tx1, 'Withdraw');
  }
}

// Check USDC balance after withdraw
const walletBUsdcAta = getAssociatedTokenAddressSync(USDC, walletB.publicKey, false, TOKEN_PROGRAM_ID);
let usdcBalance = 0n;
const ataInfo = await conn.getAccountInfo(walletBUsdcAta);
if (ataInfo) {
  usdcBalance = ataInfo.data.readBigUInt64LE(64);
  console.log(`  Wallet B USDC: ${(Number(usdcBalance)/1e6).toFixed(2)}`);
}

// Also check Wallet A USDC
const walletAUsdcAta = getAssociatedTokenAddressSync(USDC, walletA.publicKey, false, TOKEN_PROGRAM_ID);
const ataInfoA = await conn.getAccountInfo(walletAUsdcAta);
let usdcBalanceA = 0n;
if (ataInfoA) {
  usdcBalanceA = ataInfoA.data.readBigUInt64LE(64);
  if (usdcBalanceA > 0n) console.log(`  Wallet A USDC: ${(Number(usdcBalanceA)/1e6).toFixed(2)}`);
}

// ─── STEP 2: Swap all USDC → SOL via Jupiter (Wallet B) ───
if (usdcBalance > 100_000n) { // > $0.10 worth
  console.log('\n=== STEP 2: Swap USDC → SOL (Wallet B) ===');
  const SOL_MINT = 'So11111111111111111111111111111111111111112';

  const quoteRes = await fetch(`${JUP_BASE}/quote?inputMint=${USDC}&outputMint=${SOL_MINT}&amount=${usdcBalance}&slippageBps=100`, { headers: jupHeaders });
  const quote = await quoteRes.json();
  if (quote.error || quote.code) { console.log('Quote error:', JSON.stringify(quote)); process.exit(1); }
  console.log(`  Quote: ${(Number(usdcBalance)/1e6).toFixed(2)} USDC -> ${(Number(quote.outAmount)/1e9).toFixed(4)} SOL`);

  const swapRes = await fetch(`${JUP_BASE}/swap-instructions`, {
    method: 'POST', headers: jupHeaders,
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: walletB.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 25000,
    }),
  });
  const swapData = await swapRes.json();
  if (swapData.error || swapData.code) { console.log('Swap error:', JSON.stringify(swapData)); process.exit(1); }

  const instructions = [
    ...swapData.computeBudgetInstructions.map(deserializeIx),
    ...(swapData.setupInstructions || []).map(deserializeIx),
    deserializeIx(swapData.swapInstruction),
    ...(swapData.cleanupInstruction ? [deserializeIx(swapData.cleanupInstruction)] : []),
  ];

  const altAddrs = swapData.addressLookupTableAddresses || [];
  const tables = [];
  for (const addr of altAddrs) {
    const r = await conn.getAddressLookupTable(new PublicKey(addr));
    if (r.value) tables.push(r.value);
  }

  const bh2 = await conn.getLatestBlockhash('confirmed');
  const msg2 = new TransactionMessage({
    payerKey: walletB.publicKey, recentBlockhash: bh2.blockhash, instructions,
  }).compileToV0Message(tables);
  const tx2 = new VersionedTransaction(msg2);
  tx2.sign([walletB]);
  await sendAndConfirm(tx2, 'USDC→SOL swap');
}

// ─── STEP 3: Close any remaining token accounts on Wallet B ───
console.log('\n=== STEP 3: Close empty token accounts ===');
const tokenAccts = await conn.getTokenAccountsByOwner(walletB.publicKey, { programId: TOKEN_PROGRAM_ID });
const closeIxs = [];
for (const { pubkey, account } of tokenAccts.value) {
  const amount = account.data.readBigUInt64LE(64);
  if (amount === 0n) {
    closeIxs.push(createCloseAccountInstruction(pubkey, walletB.publicKey, walletB.publicKey, [], TOKEN_PROGRAM_ID));
    console.log(`  Closing empty ATA: ${pubkey.toBase58().slice(0,12)}...`);
  } else {
    console.log(`  Skipping ATA with balance: ${pubkey.toBase58().slice(0,12)}... (${amount})`);
  }
}

if (closeIxs.length > 0) {
  const bh3 = await conn.getLatestBlockhash('confirmed');
  const msg3 = new TransactionMessage({
    payerKey: walletB.publicKey, recentBlockhash: bh3.blockhash, instructions: closeIxs,
  }).compileToV0Message();
  const tx3 = new VersionedTransaction(msg3);
  tx3.sign([walletB]);
  await sendAndConfirm(tx3, 'Close ATAs');
}

// ─── STEP 4: Transfer all SOL from Wallet B to Wallet A ───
console.log('\n=== STEP 4: Transfer all SOL → Wallet A ===');
const walletBBal = await conn.getBalance(walletB.publicKey);
const keepForRent = 5000 + 5000; // tx fee + tiny buffer
const transferAmount = walletBBal - keepForRent;
if (transferAmount > 0) {
  console.log(`  Wallet B: ${(walletBBal/1e9).toFixed(6)} SOL`);
  console.log(`  Transferring: ${(transferAmount/1e9).toFixed(6)} SOL to Wallet A`);

  const bh4 = await conn.getLatestBlockhash('confirmed');
  const msg4 = new TransactionMessage({
    payerKey: walletB.publicKey, recentBlockhash: bh4.blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: walletB.publicKey,
        toPubkey: walletA.publicKey,
        lamports: transferAmount,
      }),
    ],
  }).compileToV0Message();
  const tx4 = new VersionedTransaction(msg4);
  tx4.sign([walletB]);
  await sendAndConfirm(tx4, 'SOL transfer');
}

// Also close Wallet A token accounts
console.log('\n=== STEP 5: Close Wallet A empty token accounts ===');
const tokenAcctsA = await conn.getTokenAccountsByOwner(walletA.publicKey, { programId: TOKEN_PROGRAM_ID });
const closeIxsA = [];
for (const { pubkey, account } of tokenAcctsA.value) {
  const amount = account.data.readBigUInt64LE(64);
  if (amount === 0n) {
    closeIxsA.push(createCloseAccountInstruction(pubkey, walletA.publicKey, walletA.publicKey, [], TOKEN_PROGRAM_ID));
    console.log(`  Closing empty ATA: ${pubkey.toBase58().slice(0,12)}...`);
  } else {
    console.log(`  Skipping ATA with balance: ${pubkey.toBase58().slice(0,12)}... (${amount})`);
  }
}

if (closeIxsA.length > 0) {
  const bh5 = await conn.getLatestBlockhash('confirmed');
  const msg5 = new TransactionMessage({
    payerKey: walletA.publicKey, recentBlockhash: bh5.blockhash, instructions: closeIxsA,
  }).compileToV0Message();
  const tx5 = new VersionedTransaction(msg5);
  tx5.sign([walletA]);
  await sendAndConfirm(tx5, 'Close Wallet A ATAs');
}

// ─── Final balances ───
console.log('\n=== FINAL BALANCES ===');
const finalA = await conn.getBalance(walletA.publicKey);
const finalB = await conn.getBalance(walletB.publicKey);
console.log(`Wallet A (main): ${(finalA/1e9).toFixed(6)} SOL`);
console.log(`Wallet B (flash): ${(finalB/1e9).toFixed(6)} SOL`);
console.log(`Total: ${((finalA + finalB)/1e9).toFixed(6)} SOL`);
