// Unpause flash loan pool and deposit USDC
// Admin = Wallet B (GhBP7kYr3fa3VvP1g7ypm9Pxemi8AeFk7YTkDjoEoe6u)
import {
  Connection, PublicKey, Keypair, TransactionInstruction,
  TransactionMessage, VersionedTransaction, SystemProgram, LAMPORTS_PER_SOL,
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

// Wallet B = pool admin
const WALLET_B_PATH = '/Volumes/Virtual Server/projects/solana-flash-loan/bot/wallet.json';
const adminKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_B_PATH))));
console.log('Admin wallet:', adminKp.publicKey.toBase58());

// PDAs
const [poolPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('lending_pool'), USDC.toBuffer()], PROGRAM
);
const [vaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('pool_vault'), poolPda.toBuffer()], PROGRAM
);
console.log('Pool PDA:', poolPda.toBase58());
console.log('Vault PDA:', vaultPda.toBase58());

// Anchor discriminator: sha256("global:update_pool_config")[0..8]
function anchorDisc(name) {
  return createHash('sha256').update('global:' + name).digest().slice(0, 8);
}

// Build update_pool_config(None, Some(true)) instruction
function buildUnpauseIx() {
  const disc = anchorDisc('update_pool_config');
  // Borsh: Option<u16> None = [0], Option<bool> Some(true) = [1, 1]
  const data = Buffer.concat([disc, Buffer.from([0, 1, 1])]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: adminKp.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  });
}

// Step 1: Unpause the pool
console.log('\n=== STEP 1: Unpause pool ===');
const unpauseIx = buildUnpauseIx();
const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
const msg = new TransactionMessage({
  payerKey: adminKp.publicKey,
  recentBlockhash: blockhash,
  instructions: [unpauseIx],
}).compileToV0Message();
const tx = new VersionedTransaction(msg);
tx.sign([adminKp]);

console.log('Simulating...');
const sim = await conn.simulateTransaction(tx, { commitment: 'confirmed' });
if (sim.value.err) {
  console.log('Simulation FAILED:', JSON.stringify(sim.value.err));
  for (const log of (sim.value.logs || []).slice(-10)) console.log('  ' + log);
  process.exit(1);
}
console.log('Simulation PASSED! Sending...');

const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
console.log('TX:', sig);
console.log('https://solscan.io/tx/' + sig);

const conf = await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
if (conf.value.err) {
  console.log('FAILED on-chain:', JSON.stringify(conf.value.err));
  process.exit(1);
}
console.log('Pool UNPAUSED successfully!');

// Verify
const acct = await conn.getAccountInfo(poolPda);
const isActive = acct.data[132] === 1;
console.log('Verified is_active:', isActive);
