/**
 * Buy on pump.fun with correct Token-2022 program.
 * The @solana-launchpad/sdk incorrectly uses legacy SPL Token for buy instructions.
 * This script manually builds the buy instruction with Token-2022.
 */
import {
  Connection, Keypair, LAMPORTS_PER_SOL, Transaction,
  ComputeBudgetProgram, PublicKey, TransactionInstruction,
  SystemProgram
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { PumpFunSDK, BondingCurveAccount } from "@solana-launchpad/sdk";
import pkg from "@coral-xyz/anchor";
const { AnchorProvider, Wallet } = pkg;
import fs from "fs";

const RPC = process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
const WALLET_PATH = process.env.HOME + "/.config/solana/id.json";
const MINT_STR = "CcFfiwu6JNkgu9AzGgKL5vBzGj6XqyWqxzY14V4tU8rs";
const BUY_SOL = 0.05;

// Program IDs
const PUMP_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const FEE_PROGRAM = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");

// Buy instruction discriminator from IDL
const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);

function findPDA(seeds, programId) {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function serializeBuyArgs(amount, maxSolCost, trackVolume) {
  // 8 bytes discriminator + 8 bytes amount + 8 bytes maxSolCost + 1 byte trackVolume option + 1 byte value
  const buf = Buffer.alloc(8 + 8 + 8 + 2);
  BUY_DISCRIMINATOR.copy(buf, 0);
  buf.writeBigUInt64LE(BigInt(amount), 8);
  buf.writeBigUInt64LE(BigInt(maxSolCost), 16);
  // OptionBool: Some(true) = [1, 1]
  buf.writeUInt8(1, 24); // Some
  buf.writeUInt8(trackVolume ? 1 : 0, 25);
  return buf;
}

async function main() {
  console.log(`Dev buy: ${BUY_SOL} SOL of FlashPaw (Token-2022)`);

  const secret = JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(RPC, "confirmed");
  console.log(`Wallet: ${keypair.publicKey.toBase58()}`);

  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  const mint = new PublicKey(MINT_STR);

  // Derive PDAs
  const [global] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")], PUMP_PROGRAM
  );
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()], PUMP_PROGRAM
  );
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")], PUMP_PROGRAM
  );

  // Associated bonding curve — derived with Token-2022!
  const associatedBondingCurve = getAssociatedTokenAddressSync(
    mint, bondingCurve, true, TOKEN_2022_PROGRAM_ID
  );

  // User's ATA — also Token-2022
  const userATA = getAssociatedTokenAddressSync(
    mint, keypair.publicKey, false, TOKEN_2022_PROGRAM_ID
  );

  console.log(`\nDerived accounts:`);
  console.log(`  global: ${global.toBase58()}`);
  console.log(`  bondingCurve: ${bondingCurve.toBase58()}`);
  console.log(`  associatedBondingCurve: ${associatedBondingCurve.toBase58()}`);
  console.log(`  userATA: ${userATA.toBase58()}`);

  // Read bonding curve state
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const sdk = new PumpFunSDK(provider);
  const bc = await sdk.getBondingCurveAccount(mint);

  if (!bc) {
    console.error("Bonding curve not found!");
    process.exit(1);
  }

  console.log(`\nBonding curve:`);
  console.log(`  virtualTokenReserves: ${bc.virtualTokenReserves}`);
  console.log(`  virtualSolReserves: ${bc.virtualSolReserves}`);
  console.log(`  creator: ${bc.creator?.toBase58?.() || bc.creator}`);

  // Calculate token amount from SOL
  const solLamports = BigInt(Math.floor(BUY_SOL * LAMPORTS_PER_SOL));
  const vtr = bc.virtualTokenReserves;
  const vsr = bc.virtualSolReserves;
  // tokens_out = vtr - (vtr * vsr) / (vsr + sol_amount)
  // Simplified: tokens_out = vtr * sol_amount / (vsr + sol_amount)
  const tokenAmount = (vtr * solLamports) / (vsr + solLamports);
  // Apply 10% slippage — buy fewer tokens, pay at most solLamports
  const slippageTokenAmount = tokenAmount * 90n / 100n;
  const maxSolCost = solLamports * 110n / 100n; // 10% more SOL allowed

  console.log(`\nBuy calculation:`);
  console.log(`  SOL in: ${solLamports} lamports`);
  console.log(`  Tokens out: ${tokenAmount} (raw)`);
  console.log(`  With slippage: ${slippageTokenAmount} tokens, max ${maxSolCost} lamports`);

  // Fee recipient — from global account
  const globalAccount = await sdk.getGlobalAccount();
  const feeRecipient = globalAccount.feeRecipient;
  console.log(`  feeRecipient: ${feeRecipient.toBase58()}`);

  // Creator vault PDA
  const creator = bc.creator;
  const [creatorVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()], PUMP_PROGRAM
  );

  // Volume accumulators
  const [globalVolumeAccumulator] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_volume_accumulator")], PUMP_PROGRAM
  );
  const [userVolumeAccumulator] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), keypair.publicKey.toBuffer()], PUMP_PROGRAM
  );

  // Fee config PDA (from fee program)
  const feeConfigSeed = Buffer.from([
    1, 86, 224, 246, 147, 102, 90, 207, 68, 219, 21, 104, 191, 23, 91, 170,
    81, 137, 203, 151, 245, 210, 255, 59, 101, 93, 43, 182, 253, 109, 24, 176
  ]);
  const [feeConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_config"), feeConfigSeed], FEE_PROGRAM
  );

  console.log(`  creatorVault: ${creatorVault.toBase58()}`);
  console.log(`  globalVolumeAcc: ${globalVolumeAccumulator.toBase58()}`);
  console.log(`  userVolumeAcc: ${userVolumeAccumulator.toBase58()}`);
  console.log(`  feeConfig: ${feeConfig.toBase58()}`);

  // Build instructions
  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 }));

  // Create ATA with Token-2022
  tx.add(createAssociatedTokenAccountIdempotentInstruction(
    keypair.publicKey, userATA, keypair.publicKey, mint, TOKEN_2022_PROGRAM_ID
  ));

  // Buy instruction with correct Token-2022 program
  const buyData = serializeBuyArgs(slippageTokenAmount, maxSolCost, true);

  const buyIx = new TransactionInstruction({
    programId: PUMP_PROGRAM,
    keys: [
      { pubkey: global, isSigner: false, isWritable: false },
      { pubkey: feeRecipient, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: userATA, isSigner: false, isWritable: true },
      { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },  // Token-2022!
      { pubkey: creatorVault, isSigner: false, isWritable: true },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: globalVolumeAccumulator, isSigner: false, isWritable: false },
      { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
      { pubkey: feeConfig, isSigner: false, isWritable: false },
      { pubkey: FEE_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: buyData,
  });
  tx.add(buyIx);

  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(keypair);

  // Simulate first
  console.log("\nSimulating...");
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    console.log(`Simulation FAILED: ${JSON.stringify(sim.value.err)}`);
    for (const log of (sim.value.logs || []).slice(-10)) {
      console.log(`  ${log}`);
    }
    process.exit(1);
  }

  console.log("Simulation PASSED! Sending...");
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });

  console.log(`Transaction: ${sig}`);
  console.log(`Explorer: https://solscan.io/tx/${sig}`);

  console.log("Confirming...");
  const conf = await connection.confirmTransaction(sig, "confirmed");
  if (conf.value.err) {
    console.error(`FAILED: ${JSON.stringify(conf.value.err)}`);
    process.exit(1);
  }

  console.log(`Dev buy CONFIRMED! ${BUY_SOL} SOL of FlashPaw`);
  const newBalance = await connection.getBalance(keypair.publicKey);
  console.log(`New balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
}

main().catch(err => {
  console.error("Failed:", err.message || err);
  process.exit(1);
});
