// Swap SOL for USDC via Jupiter, then deposit into flash loan pool
import {
  Connection, PublicKey, Keypair, TransactionInstruction,
  TransactionMessage, VersionedTransaction, SystemProgram, AddressLookupTableAccount,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { createHash } from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const conn = new Connection(process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com');
const PROGRAM = new PublicKey('2chVPk6DV21qWuyUA2eHAzATdFSHM7ykv1fVX7Gv6nor');
const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

const WALLET_B_PATH = '/Volumes/Virtual Server/projects/solana-flash-loan/bot/wallet.json';
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_B_PATH))));
console.log('Wallet B:', kp.publicKey.toBase58());

const bal = await conn.getBalance(kp.publicKey);
console.log('SOL balance:', (bal / 1e9).toFixed(4));

// Swap 1 SOL -> USDC (keep rest for fees)
const SWAP_LAMPORTS = 1_000_000_000; // 1 SOL
if (bal < SWAP_LAMPORTS + 50_000_000) {
  console.log('Not enough SOL to swap 1 SOL');
  process.exit(1);
}

// Step 1: Get Jupiter quote
console.log('\n=== STEP 1: Swap 1 SOL -> USDC via Jupiter ===');
const JUP_BASE = 'https://api.jup.ag/swap/v1';
const JUP_KEY = process.env.JUPITER_API_KEY || '';
const jupHeaders = { 'Content-Type': 'application/json' };
if (JUP_KEY) jupHeaders['x-api-key'] = JUP_KEY;

const quoteUrl = `${JUP_BASE}/quote?inputMint=${SOL_MINT}&outputMint=${USDC}&amount=${SWAP_LAMPORTS}&slippageBps=100`;
const quoteRes = await fetch(quoteUrl, { headers: jupHeaders });
const quote = await quoteRes.json();
if (quote.error || quote.code) { console.log('Quote error:', JSON.stringify(quote)); process.exit(1); }
console.log('Quote: 1 SOL ->', (Number(quote.outAmount) / 1e6).toFixed(2), 'USDC');

// Get swap instructions
const swapRes = await fetch(`${JUP_BASE}/swap-instructions`, {
  method: 'POST',
  headers: jupHeaders,
  body: JSON.stringify({
    quoteResponse: quote,
    userPublicKey: kp.publicKey.toBase58(),
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: 25000,
  }),
});
const swapData = await swapRes.json();
if (swapData.error || swapData.code) { console.log('Swap error:', JSON.stringify(swapData)); process.exit(1); }

function deserializeIx(ix) {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map(a => ({
      pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable,
    })),
    data: Buffer.from(ix.data, 'base64'),
  });
}

const instructions = [
  ...swapData.computeBudgetInstructions.map(deserializeIx),
  ...(swapData.setupInstructions || []).map(deserializeIx),
  deserializeIx(swapData.swapInstruction),
  ...(swapData.cleanupInstruction ? [deserializeIx(swapData.cleanupInstruction)] : []),
];

// Load ALTs
const altAddrs = swapData.addressLookupTableAddresses || [];
const tables = [];
for (const addr of altAddrs) {
  const r = await conn.getAddressLookupTable(new PublicKey(addr));
  if (r.value) tables.push(r.value);
}

const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
const msg = new TransactionMessage({
  payerKey: kp.publicKey,
  recentBlockhash: blockhash,
  instructions,
}).compileToV0Message(tables);
const tx = new VersionedTransaction(msg);
tx.sign([kp]);

console.log('Simulating swap...');
const sim = await conn.simulateTransaction(tx, { commitment: 'confirmed' });
if (sim.value.err) {
  console.log('Simulation FAILED:', JSON.stringify(sim.value.err));
  for (const log of (sim.value.logs || []).slice(-10)) console.log('  ' + log);
  process.exit(1);
}
console.log('Simulation PASSED! Sending...');

const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
console.log('Swap TX:', sig);
console.log('https://solscan.io/tx/' + sig);

const conf = await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
if (conf.value.err) {
  console.log('Swap FAILED:', JSON.stringify(conf.value.err));
  process.exit(1);
}
console.log('Swap confirmed!');

// Check USDC balance
const usdcAta = getAssociatedTokenAddressSync(USDC, kp.publicKey, false, TOKEN_PROGRAM_ID);
const ataInfo = await conn.getAccountInfo(usdcAta);
const usdcBal = ataInfo ? ataInfo.data.readBigUInt64LE(64) : 0n;
console.log('USDC balance:', (Number(usdcBal) / 1e6).toFixed(2));

// Step 2: Deposit all USDC into flash loan pool
console.log('\n=== STEP 2: Deposit USDC into flash loan pool ===');
const [poolPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('lending_pool'), USDC.toBuffer()], PROGRAM
);
const [vaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('pool_vault'), poolPda.toBuffer()], PROGRAM
);
const [receiptPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('deposit_receipt'), poolPda.toBuffer(), kp.publicKey.toBuffer()], PROGRAM
);

function anchorDisc(name) {
  return createHash('sha256').update('global:' + name).digest().slice(0, 8);
}

const depositDisc = anchorDisc('deposit');
const depositAmount = usdcBal;
const depositData = Buffer.alloc(16);
depositDisc.copy(depositData, 0);
depositData.writeBigUInt64LE(depositAmount, 8);

const depositIx = new TransactionInstruction({
  programId: PROGRAM,
  keys: [
    { pubkey: poolPda, isSigner: false, isWritable: true },
    { pubkey: receiptPda, isSigner: false, isWritable: true },
    { pubkey: vaultPda, isSigner: false, isWritable: true },
    { pubkey: usdcAta, isSigner: false, isWritable: true },
    { pubkey: kp.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ],
  data: depositData,
});

const bh2 = await conn.getLatestBlockhash('confirmed');
const msg2 = new TransactionMessage({
  payerKey: kp.publicKey,
  recentBlockhash: bh2.blockhash,
  instructions: [depositIx],
}).compileToV0Message();
const tx2 = new VersionedTransaction(msg2);
tx2.sign([kp]);

console.log('Simulating deposit...');
const sim2 = await conn.simulateTransaction(tx2, { commitment: 'confirmed' });
if (sim2.value.err) {
  console.log('Simulation FAILED:', JSON.stringify(sim2.value.err));
  for (const log of (sim2.value.logs || []).slice(-10)) console.log('  ' + log);
  process.exit(1);
}
console.log('Simulation PASSED! Sending...');

const sig2 = await conn.sendRawTransaction(tx2.serialize(), { skipPreflight: true, maxRetries: 3 });
console.log('Deposit TX:', sig2);
console.log('https://solscan.io/tx/' + sig2);

const conf2 = await conn.confirmTransaction({ signature: sig2, blockhash: bh2.blockhash, lastValidBlockHeight: bh2.lastValidBlockHeight }, 'confirmed');
if (conf2.value.err) {
  console.log('Deposit FAILED:', JSON.stringify(conf2.value.err));
  process.exit(1);
}
console.log('Deposit confirmed!');

// Final pool state
console.log('\n=== Final Pool State ===');
const poolAcct = await conn.getAccountInfo(poolPda);
const totalDeposits = poolAcct.data.readBigUInt64LE(104);
const isActive = poolAcct.data[132] === 1;
console.log('Total deposits:', (Number(totalDeposits) / 1e6).toFixed(2), 'USDC');
console.log('Is active:', isActive);
console.log('\nFlash loan pool is READY!');
