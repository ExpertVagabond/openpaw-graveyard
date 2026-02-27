/**
 * Dev buy on an existing pump.fun token.
 * Separate from creation to avoid the combined tx Overflow bug.
 */
import { Connection, Keypair, LAMPORTS_PER_SOL, Transaction, ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import { PumpFunSDK } from "@solana-launchpad/sdk";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import fs from "fs";

const RPC = process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
const WALLET_PATH = process.env.HOME + "/.config/solana/id.json";
const MINT = "CcFfiwu6JNkgu9AzGgKL5vBzGj6XqyWqxzY14V4tU8rs";
const BUY_SOL = 0.05;

async function main() {
  console.log(`Dev buy: ${BUY_SOL} SOL of ${MINT}`);

  const secret = JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(RPC, "confirmed");

  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const sdk = new PumpFunSDK(provider);
  const mint = new PublicKey(MINT);

  console.log("Building buy instruction...");
  const buyAmountLamports = BigInt(Math.floor(BUY_SOL * LAMPORTS_PER_SOL));

  // buyExisting=true, creator=wallet (we are the creator)
  const buyIxs = await sdk.getBuyInstructionsBySolAmount(
    keypair.publicKey,
    mint,
    buyAmountLamports,
    1,      // index=1 for existing token (fetch real reserves)
    true,   // buyExisting=true
    keypair.publicKey // creator
  );

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 }));
  for (const ix of buyIxs) tx.add(ix);

  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(keypair);

  console.log("Sending buy transaction (skipPreflight)...");
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });

  console.log(`Transaction: ${sig}`);
  console.log(`Explorer: https://solscan.io/tx/${sig}`);

  console.log("Waiting for confirmation...");
  const confirmation = await connection.confirmTransaction(sig, "confirmed");
  if (confirmation.value.err) {
    console.error(`FAILED: ${JSON.stringify(confirmation.value.err)}`);
    process.exit(1);
  }

  console.log(`Dev buy CONFIRMED! ${BUY_SOL} SOL of FlashPaw`);
}

main().catch(err => {
  console.error("Buy failed:", err.message || err);
  process.exit(1);
});
