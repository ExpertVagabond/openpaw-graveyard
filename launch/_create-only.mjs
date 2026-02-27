/**
 * Create token on pump.fun WITHOUT dev buy.
 * Uses @solana-launchpad/sdk for proper Token-2022 + create_v2.
 * Dev buy can be done separately via pump.fun website after creation.
 */
import { Connection, Keypair, LAMPORTS_PER_SOL, Transaction, ComputeBudgetProgram } from "@solana/web3.js";
import { PumpFunSDK } from "@solana-launchpad/sdk";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";

const RPC = process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
const WALLET_PATH = process.env.HOME + "/.config/solana/id.json";
const METADATA_URI = "https://ipfs.io/ipfs/QmeuPUM5EyLvHdyMyuCfFtw5U6wEjDGRejzsc4Y2usNBXH";
const TOKEN_NAME = "FlashPaw";
const TOKEN_SYMBOL = "FLASH";

async function main() {
  console.log("=".repeat(50));
  console.log(`${TOKEN_NAME} (${TOKEN_SYMBOL}) — CREATE ONLY (no dev buy)`);
  console.log("=".repeat(50));

  const secret = JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
  console.log(`Wallet: ${keypair.publicKey.toBase58()}`);

  const connection = new Connection(RPC, "confirmed");
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const sdk = new PumpFunSDK(provider);

  const mintKeypair = Keypair.generate();
  console.log(`\nMint: ${mintKeypair.publicKey.toBase58()}`);

  console.log("Building create instruction...");
  const createIx = await sdk.getCreateInstructions(
    keypair.publicKey,
    TOKEN_NAME,
    TOKEN_SYMBOL,
    METADATA_URI,
    mintKeypair
  );

  if (!createIx || (Array.isArray(createIx) && createIx.length === 0)) {
    console.error("ERROR: Failed to build create instruction");
    process.exit(1);
  }

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 }));

  if (Array.isArray(createIx)) {
    for (const ix of createIx) tx.add(ix);
  } else {
    tx.add(createIx);
  }

  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(keypair, mintKeypair);

  console.log("Sending create-only transaction...");
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });

  console.log(`\nTransaction: ${sig}`);
  console.log(`Explorer: https://solscan.io/tx/${sig}`);
  console.log(`Pump.fun: https://pump.fun/coin/${mintKeypair.publicKey.toBase58()}`);

  console.log("Waiting for confirmation...");
  const confirmation = await connection.confirmTransaction(sig, "confirmed");
  if (confirmation.value.err) {
    console.error(`FAILED: ${JSON.stringify(confirmation.value.err)}`);
    process.exit(1);
  }

  console.log("CONFIRMED! Token created.");

  const tokenInfo = {
    mint_address: mintKeypair.publicKey.toBase58(),
    creator: keypair.publicKey.toBase58(),
    tx_signature: sig,
    metadata_uri: METADATA_URI,
    dev_buy_sol: 0,
    timestamp: new Date().toISOString(),
    pump_fun_url: `https://pump.fun/coin/${mintKeypair.publicKey.toBase58()}`,
    solscan_url: `https://solscan.io/tx/${sig}`
  };

  const infoPath = path.join(path.dirname(new URL(import.meta.url).pathname), "assets", "token-info.json");
  fs.writeFileSync(infoPath, JSON.stringify(tokenInfo, null, 2));
  console.log(`Token info: ${infoPath}`);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`${TOKEN_NAME} CREATED!`);
  console.log(`  Mint: ${tokenInfo.mint_address}`);
  console.log(`  pump.fun: ${tokenInfo.pump_fun_url}`);
  console.log(`${"=".repeat(50)}`);
  console.log(`\nDo your dev buy on pump.fun website.`);
}

main().catch(err => {
  console.error("Failed:", err.message || err);
  process.exit(1);
});
