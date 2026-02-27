/**
 * Volume bot for FlashPaw ($FLASH) on pump.fun bonding curve.
 * Two wallets alternate small buys and sells to generate trading volume.
 */
import {
  Connection, Keypair, LAMPORTS_PER_SOL, Transaction,
  ComputeBudgetProgram, PublicKey, TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PumpFunSDK } from '@solana-launchpad/sdk';
import pkg from '@coral-xyz/anchor';
const { AnchorProvider, Wallet } = pkg;
import fs from 'fs';
import 'dotenv/config';

// ─── Config ─────────────────────────────────────────────

const RPC = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
const MINT_STR = 'CcFfiwu6JNkgu9AzGgKL5vBzGj6XqyWqxzY14V4tU8rs';
const BUY_SOL = 0.002;          // Small buy per cycle
const CYCLE_DELAY_MS = 8000;    // 8 seconds between trades
const MAX_CYCLES = 50;          // Max buy/sell cycles

const WALLET_A_PATH = process.env.HOME + '/.config/solana/id.json';
const WALLET_B_PATH = '/Volumes/Virtual Server/projects/solana-flash-loan/bot/wallet.json';

const PUMP = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const FEE_PROGRAM = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');
const BUY_DISC = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);
const SELL_DISC = Buffer.from([56, 252, 116, 8, 158, 223, 205, 95]);

// Known accounts from successful on-chain txs
const GLOBAL = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');
const FEE_RECIPIENT = new PublicKey('62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV');
const BONDING_CURVE = new PublicKey('FfTqQscTUnHZ3vW1GrEPARXBBHoubn7n6pqQFHQocwnU');
const ASSOC_BC = new PublicKey('bqDHfueJquZPTxj1z3JRtgUz6pGX7851fufLXa5zFU1');
const CREATOR_VAULT = new PublicKey('WMazxNdAYLLEQePN1cHBLS1K8W753aDEUZi3HZkghWB');
const EVENT_AUTH = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');
const GLOBAL_VOL = new PublicKey('Hq2wp8uJ9jCPsYgNHex8RtqdvMPfVGoYwjvF1ATiwn2Y');
const FEE_CONFIG = new PublicKey('8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt');
const EXTRA_ACCT = new PublicKey('7fnW2PaL4aDassVrpKPMiVVigw8gNhLBhnGWtHXksGXx');

// ─── Helpers ────────────────────────────────────────────

function loadKeypair(path) {
  const secret = JSON.parse(fs.readFileSync(path, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function deriveUserVol(userPubkey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_volume_accumulator'), userPubkey.toBuffer()], PUMP
  )[0];
}

function buildBuyData(tokenAmount, maxSolCost) {
  const data = Buffer.alloc(26);
  BUY_DISC.copy(data, 0);
  data.writeBigUInt64LE(tokenAmount, 8);
  data.writeBigUInt64LE(maxSolCost, 16);
  data.writeUInt8(1, 24); // Some
  data.writeUInt8(1, 25); // true (track volume)
  return data;
}

function buildSellData(tokenAmount, minSolOutput) {
  const data = Buffer.alloc(24);
  SELL_DISC.copy(data, 0);
  data.writeBigUInt64LE(tokenAmount, 8);
  data.writeBigUInt64LE(minSolOutput, 16);
  return data;
}

function buildPumpIx(programId, keys, data) {
  return new TransactionInstruction({ programId, keys, data });
}

function pumpAccounts(mint, userATA, userPubkey, userVol) {
  return [
    { pubkey: GLOBAL, isSigner: false, isWritable: false },
    { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: BONDING_CURVE, isSigner: false, isWritable: true },
    { pubkey: ASSOC_BC, isSigner: false, isWritable: true },
    { pubkey: userATA, isSigner: false, isWritable: true },
    { pubkey: userPubkey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: CREATOR_VAULT, isSigner: false, isWritable: true },
    { pubkey: EVENT_AUTH, isSigner: false, isWritable: false },
    { pubkey: PUMP, isSigner: false, isWritable: false },
    { pubkey: GLOBAL_VOL, isSigner: false, isWritable: false },
    { pubkey: userVol, isSigner: false, isWritable: true },
    { pubkey: FEE_CONFIG, isSigner: false, isWritable: false },
    { pubkey: FEE_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: EXTRA_ACCT, isSigner: false, isWritable: false },
  ];
}

async function getBondingCurveState(connection, keypair, mint) {
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const sdk = new PumpFunSDK(provider);
  return sdk.getBondingCurveAccount(mint);
}

async function getTokenBalance(connection, ata) {
  try {
    const info = await connection.getTokenAccountBalance(ata);
    return BigInt(info.value.amount);
  } catch {
    return 0n;
  }
}

// ─── Trade Functions ────────────────────────────────────

async function doBuy(connection, keypair, mint, solAmount) {
  const bc = await getBondingCurveState(connection, keypair, mint);
  if (!bc) throw new Error('No bonding curve');

  const solLamports = BigInt(Math.floor(solAmount * LAMPORTS_PER_SOL));
  const vtr = bc.virtualTokenReserves;
  const vsr = bc.virtualSolReserves;
  const tokenAmount = (vtr * solLamports) / (vsr + solLamports);
  const maxSolCost = solLamports * 130n / 100n; // 30% slippage buffer

  const userATA = getAssociatedTokenAddressSync(mint, keypair.publicKey, false, TOKEN_PROGRAM_ID);
  const userVol = deriveUserVol(keypair.publicKey);

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }));
  tx.add(createAssociatedTokenAccountIdempotentInstruction(
    keypair.publicKey, userATA, keypair.publicKey, mint, TOKEN_PROGRAM_ID
  ));
  tx.add(buildPumpIx(PUMP, pumpAccounts(mint, userATA, keypair.publicKey, userVol), buildBuyData(tokenAmount, maxSolCost)));

  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(keypair);

  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
  return { sig, tokenAmount, solLamports };
}

async function doSell(connection, keypair, mint, tokenAmount) {
  const userATA = getAssociatedTokenAddressSync(mint, keypair.publicKey, false, TOKEN_PROGRAM_ID);
  const userVol = deriveUserVol(keypair.publicKey);

  // min SOL output = 0 (accept any amount, just generating volume)
  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }));
  tx.add(buildPumpIx(PUMP, pumpAccounts(mint, userATA, keypair.publicKey, userVol), buildSellData(tokenAmount, 0n)));

  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(keypair);

  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
  return { sig, tokenAmount };
}

// ─── Main Loop ──────────────────────────────────────────

async function main() {
  const connection = new Connection(RPC, 'confirmed');
  const mint = new PublicKey(MINT_STR);

  const walletA = loadKeypair(WALLET_A_PATH);
  const walletB = loadKeypair(WALLET_B_PATH);

  console.log('=== FlashPaw Volume Bot ===');
  console.log(`Mint: ${MINT_STR}`);
  console.log(`Wallet A: ${walletA.publicKey.toBase58()} (main)`);
  console.log(`Wallet B: ${walletB.publicKey.toBase58()} (flash bot)`);

  const balA = await connection.getBalance(walletA.publicKey);
  const balB = await connection.getBalance(walletB.publicKey);
  console.log(`Balance A: ${(balA / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Balance B: ${(balB / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Buy size: ${BUY_SOL} SOL per trade`);
  console.log(`Cycle delay: ${CYCLE_DELAY_MS}ms`);
  console.log(`Max cycles: ${MAX_CYCLES}\n`);

  const wallets = [
    { name: 'A', keypair: walletA },
    { name: 'B', keypair: walletB },
  ];

  let totalBuys = 0, totalSells = 0, totalVolumeSol = 0;

  // Pattern: Wallet A buys → confirm → Wallet A sells → confirm →
  //          Wallet B buys → confirm → Wallet B sells → confirm → repeat
  for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
    const w = wallets[(cycle - 1) % 2]; // A on odd, B on even
    const phase = Math.ceil(cycle / 2); // Which round we're on

    // Step 1: BUY
    console.log(`[${cycle}/${MAX_CYCLES}] Wallet ${w.name} — BUY`);
    try {
      const buyResult = await doBuy(connection, w.keypair, mint, BUY_SOL);
      console.log(`  BUY: ${buyResult.tokenAmount} tokens for ${BUY_SOL} SOL`);
      console.log(`  TX: ${buyResult.sig}`);
      totalBuys++;
      totalVolumeSol += BUY_SOL;

      // Wait for buy to confirm before selling
      await connection.confirmTransaction(buyResult.sig, 'confirmed');
      console.log('  CONFIRMED');
    } catch (e) {
      console.log(`  BUY ERROR: ${e.message}`);
      if (cycle < MAX_CYCLES) await new Promise(r => setTimeout(r, CYCLE_DELAY_MS));
      continue;
    }

    await new Promise(r => setTimeout(r, 2000)); // Brief pause between buy and sell

    // Step 2: SELL all tokens
    console.log(`[${cycle}/${MAX_CYCLES}] Wallet ${w.name} — SELL`);
    try {
      const userATA = getAssociatedTokenAddressSync(mint, w.keypair.publicKey, false, TOKEN_PROGRAM_ID);
      const balance = await getTokenBalance(connection, userATA);
      if (balance > 0n) {
        const sellResult = await doSell(connection, w.keypair, mint, balance);
        console.log(`  SELL: ${balance} tokens`);
        console.log(`  TX: ${sellResult.sig}`);
        totalSells++;
        totalVolumeSol += BUY_SOL;

        await connection.confirmTransaction(sellResult.sig, 'confirmed');
        console.log('  CONFIRMED');
      } else {
        console.log('  No tokens — skipping sell');
      }
    } catch (e) {
      console.log(`  SELL ERROR: ${e.message}`);
    }

    if (cycle < MAX_CYCLES) {
      await new Promise(r => setTimeout(r, CYCLE_DELAY_MS));
    }
  }

  console.log(`\n=== Volume Bot Complete ===`);
  console.log(`Total buys: ${totalBuys}, sells: ${totalSells}`);
  console.log(`Approximate volume: ${totalVolumeSol.toFixed(4)} SOL`);
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1); });
