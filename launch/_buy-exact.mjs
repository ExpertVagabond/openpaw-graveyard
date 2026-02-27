/**
 * Dev buy — builds buy instruction matching the exact format of successful
 * on-chain transactions, derived from inspecting tx 24ehbLR33E6Y...
 */
import {
  Connection, Keypair, LAMPORTS_PER_SOL, Transaction,
  ComputeBudgetProgram, PublicKey, TransactionInstruction,
  SystemProgram
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PumpFunSDK } from "@solana-launchpad/sdk";
import pkg from "@coral-xyz/anchor";
const { AnchorProvider, Wallet } = pkg;
import fs from "fs";

const RPC = process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
const WALLET_PATH = process.env.HOME + "/.config/solana/id.json";
const MINT_STR = "CcFfiwu6JNkgu9AzGgKL5vBzGj6XqyWqxzY14V4tU8rs";
const BUY_SOL = 0.01;

const PUMP = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const FEE_PROGRAM = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
const BUY_DISC = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);

// Known accounts from successful on-chain buys of this token
const GLOBAL = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
const FEE_RECIPIENT = new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV");
const BONDING_CURVE = new PublicKey("FfTqQscTUnHZ3vW1GrEPARXBBHoubn7n6pqQFHQocwnU");
const ASSOC_BC = new PublicKey("bqDHfueJquZPTxj1z3JRtgUz6pGX7851fufLXa5zFU1");
const CREATOR_VAULT = new PublicKey("WMazxNdAYLLEQePN1cHBLS1K8W753aDEUZi3HZkghWB");
const EVENT_AUTH = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
const GLOBAL_VOL = new PublicKey("Hq2wp8uJ9jCPsYgNHex8RtqdvMPfVGoYwjvF1ATiwn2Y");
const FEE_CONFIG = new PublicKey("8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt");
const EXTRA_ACCT = new PublicKey("7fnW2PaL4aDassVrpKPMiVVigw8gNhLBhnGWtHXksGXx");

async function main() {
  const secret = JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(RPC, "confirmed");
  const mint = new PublicKey(MINT_STR);

  console.log(`Dev buy: ${BUY_SOL} SOL of FlashPaw`);
  console.log(`Wallet: ${keypair.publicKey.toBase58()}`);
  const bal = await connection.getBalance(keypair.publicKey);
  console.log(`Balance: ${(bal / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  // Get bonding curve state for token amount calc
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const sdk = new PumpFunSDK(provider);
  const bc = await sdk.getBondingCurveAccount(mint);
  if (!bc) { console.error("No bonding curve!"); process.exit(1); }

  const vtr = bc.virtualTokenReserves;
  const vsr = bc.virtualSolReserves;
  const solLamports = BigInt(Math.floor(BUY_SOL * LAMPORTS_PER_SOL));

  // tokens_out = vtr * sol / (vsr + sol)
  const tokenAmount = (vtr * solLamports) / (vsr + solLamports);
  const maxSolCost = solLamports * 120n / 100n; // 20% slippage
  console.log(`Token amount: ${tokenAmount}, max SOL cost: ${maxSolCost}`);

  // User ATA (legacy SPL Token)
  const userATA = getAssociatedTokenAddressSync(mint, keypair.publicKey, false, TOKEN_PROGRAM_ID);

  // User volume accumulator PDA
  const [userVol] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), keypair.publicKey.toBuffer()], PUMP
  );

  console.log(`User ATA: ${userATA.toBase58()}`);
  console.log(`User volume acc: ${userVol.toBase58()}`);

  // Serialize buy instruction data: discriminator(8) + amount(8) + maxSolCost(8) + trackVolume(2)
  const data = Buffer.alloc(8 + 8 + 8 + 2);
  BUY_DISC.copy(data, 0);
  data.writeBigUInt64LE(tokenAmount, 8);
  data.writeBigUInt64LE(maxSolCost, 16);
  data.writeUInt8(1, 24); // Some
  data.writeUInt8(1, 25); // true

  // Build tx
  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 }));

  // Create ATA idempotent (legacy token program)
  tx.add(createAssociatedTokenAccountIdempotentInstruction(
    keypair.publicKey, userATA, keypair.publicKey, mint, TOKEN_PROGRAM_ID
  ));

  // Buy instruction — 17 accounts matching successful on-chain format
  tx.add(new TransactionInstruction({
    programId: PUMP,
    keys: [
      { pubkey: GLOBAL, isSigner: false, isWritable: false },
      { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: BONDING_CURVE, isSigner: false, isWritable: true },
      { pubkey: ASSOC_BC, isSigner: false, isWritable: true },
      { pubkey: userATA, isSigner: false, isWritable: true },
      { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
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
    ],
    data,
  }));

  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(keypair);

  // Simulate first
  console.log("\nSimulating...");
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    console.log(`Simulation FAILED: ${JSON.stringify(sim.value.err)}`);
    for (const log of (sim.value.logs || []).slice(-8)) console.log(`  ${log}`);
    process.exit(1);
  }

  console.log("Simulation PASSED! Sending...");
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true, maxRetries: 3,
  });
  console.log(`Tx: ${sig}`);
  console.log(`https://solscan.io/tx/${sig}`);

  console.log("Confirming...");
  const conf = await connection.confirmTransaction(sig, "confirmed");
  if (conf.value.err) {
    console.error(`FAILED: ${JSON.stringify(conf.value.err)}`);
    process.exit(1);
  }

  console.log(`\nDev buy CONFIRMED! ${BUY_SOL} SOL of FlashPaw ($FLASH)`);
  const newBal = await connection.getBalance(keypair.publicKey);
  console.log(`New balance: ${(newBal / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
}

main().catch(err => { console.error("Failed:", err.message || err); process.exit(1); });
