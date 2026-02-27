// Step 2-5: Swap USDC→SOL, close ATAs, transfer all SOL to Wallet A
import {
  Connection, PublicKey, Keypair, TransactionInstruction,
  TransactionMessage, VersionedTransaction, SystemProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync, createCloseAccountInstruction, TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const conn = new Connection(process.env.HELIUS_RPC_URL);
const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const SOL_MINT = 'So11111111111111111111111111111111111111112';

const walletA = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json'))));
const walletB = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync('/Volumes/Virtual Server/projects/solana-flash-loan/bot/wallet.json'))));

const JUP_BASE = 'https://api.jup.ag/swap/v1';
const JUP_KEY = process.env.JUPITER_API_KEY || '';
const jupH = { 'Content-Type': 'application/json' };
if (JUP_KEY) jupH['x-api-key'] = JUP_KEY;

function deserializeIx(ix) {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map(a => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
    data: Buffer.from(ix.data, 'base64'),
  });
}

// ─── Swap USDC → SOL ───
const usdcAta = getAssociatedTokenAddressSync(USDC, walletB.publicKey, false, TOKEN_PROGRAM_ID);
const ataInfo = await conn.getAccountInfo(usdcAta);
const usdcBal = ataInfo ? ataInfo.data.readBigUInt64LE(64) : 0n;
console.log('Wallet B USDC:', (Number(usdcBal) / 1e6).toFixed(2));

if (usdcBal > 100_000n) {
  console.log('\n=== Swap USDC → SOL ===');
  const qRes = await fetch(`${JUP_BASE}/quote?inputMint=${USDC}&outputMint=${SOL_MINT}&amount=${usdcBal}&slippageBps=100`, { headers: jupH });
  const quote = await qRes.json();
  console.log(`Quote: ${(Number(usdcBal)/1e6).toFixed(2)} USDC → ${(Number(quote.outAmount)/1e9).toFixed(4)} SOL`);

  const sRes = await fetch(`${JUP_BASE}/swap-instructions`, {
    method: 'POST', headers: jupH,
    body: JSON.stringify({ quoteResponse: quote, userPublicKey: walletB.publicKey.toBase58(), wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: 25000 }),
  });
  const sd = await sRes.json();
  if (sd.error) { console.log('Error:', sd.error); process.exit(1); }

  const ixs = [
    ...sd.computeBudgetInstructions.map(deserializeIx),
    ...(sd.setupInstructions || []).map(deserializeIx),
    deserializeIx(sd.swapInstruction),
    ...(sd.cleanupInstruction ? [deserializeIx(sd.cleanupInstruction)] : []),
  ];

  const tables = [];
  for (const addr of (sd.addressLookupTableAddresses || [])) {
    const r = await conn.getAddressLookupTable(new PublicKey(addr));
    if (r.value) tables.push(r.value);
  }

  const bh = await conn.getLatestBlockhash('confirmed');
  const msg = new TransactionMessage({ payerKey: walletB.publicKey, recentBlockhash: bh.blockhash, instructions: ixs }).compileToV0Message(tables);
  const tx = new VersionedTransaction(msg);
  tx.sign([walletB]);

  const sim = await conn.simulateTransaction(tx, { commitment: 'confirmed' });
  if (sim.value.err) { console.log('Sim failed:', JSON.stringify(sim.value.err)); process.exit(1); }
  console.log('Sim passed. Sending...');
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
  console.log('TX:', sig);
  const conf = await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, 'confirmed');
  if (conf.value.err) { console.log('Failed:', JSON.stringify(conf.value.err)); process.exit(1); }
  console.log('Swap confirmed!');
}

// ─── Close all empty ATAs on both wallets ───
console.log('\n=== Close empty token accounts ===');
for (const [name, kp] of [['B', walletB], ['A', walletA]]) {
  const accts = await conn.getTokenAccountsByOwner(kp.publicKey, { programId: TOKEN_PROGRAM_ID });
  const closeIxs = [];
  for (const { pubkey, account } of accts.value) {
    const amt = account.data.readBigUInt64LE(64);
    if (amt === 0n) {
      closeIxs.push(createCloseAccountInstruction(pubkey, kp.publicKey, kp.publicKey, [], TOKEN_PROGRAM_ID));
      console.log(`  Closing ${name}: ${pubkey.toBase58().slice(0,16)}...`);
    }
  }
  if (closeIxs.length > 0) {
    const bh = await conn.getLatestBlockhash('confirmed');
    const msg = new TransactionMessage({ payerKey: kp.publicKey, recentBlockhash: bh.blockhash, instructions: closeIxs }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    tx.sign([kp]);
    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
    await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, 'confirmed');
    console.log(`  Closed ${closeIxs.length} ATAs on Wallet ${name}`);
  }
}

// ─── Transfer ALL SOL from B to A ───
console.log('\n=== Transfer SOL: B → A ===');
await new Promise(r => setTimeout(r, 2000)); // wait for balance update
const bBal = await conn.getBalance(walletB.publicKey);
const txFee = 5000;
const transferAmt = bBal - txFee;
console.log(`Wallet B: ${(bBal/1e9).toFixed(6)} SOL`);
console.log(`Transfer: ${(transferAmt/1e9).toFixed(6)} SOL`);

if (transferAmt > 0) {
  const bh = await conn.getLatestBlockhash('confirmed');
  const msg = new TransactionMessage({
    payerKey: walletB.publicKey, recentBlockhash: bh.blockhash,
    instructions: [SystemProgram.transfer({ fromPubkey: walletB.publicKey, toPubkey: walletA.publicKey, lamports: transferAmt })],
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign([walletB]);
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
  console.log('TX:', sig);
  await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, 'confirmed');
  console.log('Transfer confirmed!');
}

// ─── Final ───
console.log('\n=== FINAL BALANCES ===');
const fA = await conn.getBalance(walletA.publicKey);
const fB = await conn.getBalance(walletB.publicKey);
console.log(`Wallet A (main): ${(fA/1e9).toFixed(6)} SOL`);
console.log(`Wallet B (flash): ${(fB/1e9).toFixed(6)} SOL`);
console.log(`Total: ${((fA+fB)/1e9).toFixed(6)} SOL`);
