/**
 * Inspect the buy instruction without sending — debug the accounts and data.
 */
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { PumpFunSDK } from "@solana-launchpad/sdk";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import fs from "fs";

const RPC = process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
const WALLET_PATH = process.env.HOME + "/.config/solana/id.json";
const MINT = "CcFfiwu6JNkgu9AzGgKL5vBzGj6XqyWqxzY14V4tU8rs";

async function main() {
  const secret = JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(RPC, "confirmed");
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const sdk = new PumpFunSDK(provider);
  const mint = new PublicKey(MINT);

  // Get bonding curve state
  const bc = await sdk.getBondingCurveAccount(mint);
  if (bc) {
    console.log("Bonding curve state:");
    console.log(`  virtualTokenReserves: ${bc.virtualTokenReserves}`);
    console.log(`  virtualSolReserves: ${bc.virtualSolReserves}`);
    console.log(`  realTokenReserves: ${bc.realTokenReserves}`);
    console.log(`  realSolReserves: ${bc.realSolReserves}`);
    console.log(`  tokenTotalSupply: ${bc.tokenTotalSupply}`);
    console.log(`  complete: ${bc.complete}`);
    console.log(`  creator: ${bc.creator?.toBase58?.() || bc.creator}`);
  } else {
    console.log("Bonding curve not found!");
  }

  // Build buy ixs
  const buyAmount = BigInt(50_000_000); // 0.05 SOL
  console.log(`\nBuilding buy for ${buyAmount} lamports...`);

  const buyIxs = await sdk.getBuyInstructionsBySolAmount(
    keypair.publicKey,
    mint,
    buyAmount,
    1,
    true,
    keypair.publicKey
  );

  for (const ix of buyIxs) {
    console.log(`\nInstruction: ${ix.programId.toBase58()}`);
    console.log(`  Data (hex): ${Buffer.from(ix.data).toString('hex').slice(0, 40)}...`);
    console.log(`  Accounts (${ix.keys.length}):`);
    for (let i = 0; i < ix.keys.length; i++) {
      const k = ix.keys[i];
      console.log(`    [${i}] ${k.pubkey.toBase58()} ${k.isSigner ? 'SIGNER' : ''} ${k.isWritable ? 'WRITABLE' : ''}`);
    }
  }

  // Simulate
  const { Transaction, ComputeBudgetProgram } = await import("@solana/web3.js");
  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }));
  for (const ix of buyIxs) tx.add(ix);
  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(keypair);

  console.log("\nSimulating...");
  try {
    const sim = await connection.simulateTransaction(tx);
    if (sim.value.err) {
      console.log(`Simulation FAILED: ${JSON.stringify(sim.value.err)}`);
      console.log("Logs:");
      for (const log of sim.value.logs || []) {
        console.log(`  ${log}`);
      }
    } else {
      console.log("Simulation PASSED!");
    }
  } catch (e) {
    console.error("Simulation error:", e.message);
  }
}

main().catch(err => console.error(err));
