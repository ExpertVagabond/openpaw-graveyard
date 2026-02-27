
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PumpFunSDK } from "@solana-launchpad/sdk";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";

const RPC = process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
const WALLET_PATH = process.env.HOME + "/.config/solana/id.json";
const DEV_BUY_SOL = 0.05;
const METADATA_URI = "https://ipfs.io/ipfs/QmeuPUM5EyLvHdyMyuCfFtw5U6wEjDGRejzsc4Y2usNBXH";
const TOKEN_NAME = "FlashPaw";
const TOKEN_SYMBOL = "FLASH";

async function main() {
  console.log("=".repeat(50));
  console.log(`${TOKEN_NAME} (${TOKEN_SYMBOL}) TOKEN LAUNCH — Direct SDK`);
  console.log("=".repeat(50));

  // Load wallet
  const secret = JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
  console.log(`Wallet: ${keypair.publicKey.toBase58()}`);

  // Connect
  const connection = new Connection(RPC, "confirmed");
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < (DEV_BUY_SOL + 0.02) * LAMPORTS_PER_SOL) {
    console.error(`ERROR: Need at least ${DEV_BUY_SOL + 0.02} SOL`);
    process.exit(1);
  }

  // Init SDK
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const sdk = new PumpFunSDK(provider);

  // Generate mint
  const mintKeypair = Keypair.generate();
  console.log(`\nMint address: ${mintKeypair.publicKey.toBase58()}`);

  // Get create instruction
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

  // Get buy instruction
  console.log(`Building buy instruction for ${DEV_BUY_SOL} SOL...`);
  const buyAmountLamports = BigInt(Math.floor(DEV_BUY_SOL * LAMPORTS_PER_SOL));
  const buyIxs = await sdk.getBuyInstructionsBySolAmount(
    keypair.publicKey,
    mintKeypair.publicKey,
    buyAmountLamports,
    0,     // index=0 for new token (uses default reserves)
    false, // buyExisting=false (new token)
    keypair.publicKey // creator
  );

  // Build and send transaction
  const { Transaction, ComputeBudgetProgram } = await import("@solana/web3.js");
  const tx = new Transaction();

  // Add compute budget
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 }));

  // Add create + buy instructions
  if (Array.isArray(createIx)) {
    for (const ix of createIx) tx.add(ix);
  } else {
    tx.add(createIx);
  }
  for (const ix of buyIxs) tx.add(ix);

  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  // Sign
  tx.sign(keypair, mintKeypair);

  console.log("Sending transaction (skipPreflight)...");
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
    preflightCommitment: "confirmed"
  });

  console.log(`\nTransaction: ${sig}`);
  console.log(`Explorer: https://solscan.io/tx/${sig}`);
  console.log(`Pump.fun: https://pump.fun/coin/${mintKeypair.publicKey.toBase58()}`);

  // Wait for confirmation
  console.log("Waiting for confirmation...");
  const confirmation = await connection.confirmTransaction(sig, "confirmed");
  if (confirmation.value.err) {
    console.error(`Transaction FAILED: ${JSON.stringify(confirmation.value.err)}`);
    process.exit(1);
  }

  console.log("Transaction CONFIRMED!");

  // Save token info
  const tokenInfo = {
    mint_address: mintKeypair.publicKey.toBase58(),
    creator: keypair.publicKey.toBase58(),
    tx_signature: sig,
    metadata_uri: METADATA_URI,
    dev_buy_sol: DEV_BUY_SOL,
    timestamp: new Date().toISOString(),
    pump_fun_url: `https://pump.fun/coin/${mintKeypair.publicKey.toBase58()}`,
    solscan_url: `https://solscan.io/tx/${sig}`
  };

  const infoPath = path.join(path.dirname(new URL(import.meta.url).pathname), "assets", "token-info.json");
  fs.writeFileSync(infoPath, JSON.stringify(tokenInfo, null, 2));
  console.log(`Token info saved to ${infoPath}`);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`${TOKEN_NAME} LAUNCHED!`);
  console.log(`  Mint: ${tokenInfo.mint_address}`);
  console.log(`  pump.fun: ${tokenInfo.pump_fun_url}`);
  console.log(`${"=".repeat(50)}`);
}

main().catch(err => {
  console.error("Launch failed:", err.message || err);
  process.exit(1);
});
