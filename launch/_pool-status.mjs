import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
dotenv.config();

const conn = new Connection(process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com');
const PROGRAM = new PublicKey('2chVPk6DV21qWuyUA2eHAzATdFSHM7ykv1fVX7Gv6nor');
const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

const [poolPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('lending_pool'), USDC.toBuffer()],
  PROGRAM
);
console.log('Pool PDA:', poolPda.toBase58());

const [vaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('pool_vault'), poolPda.toBuffer()],
  PROGRAM
);
console.log('Vault PDA:', vaultPda.toBase58());

const acct = await conn.getAccountInfo(poolPda);
if (!acct) { console.log('Pool NOT found'); process.exit(0); }
console.log('Pool data len:', acct.data.length);

const data = acct.data;
const admin = new PublicKey(data.slice(8, 40));
const tokenMint = new PublicKey(data.slice(40, 72));
const vault = new PublicKey(data.slice(72, 104));
const totalDeposits = data.readBigUInt64LE(104);
const totalShares = data.readBigUInt64LE(112);
const totalFees = data.readBigUInt64LE(120);
const feeBps = data.readUInt16LE(128);
const bump = data[130];
const vaultBump = data[131];
const isActive = data[132] === 1;

console.log('Admin:', admin.toBase58());
console.log('Token mint:', tokenMint.toBase58());
console.log('Vault:', vault.toBase58());
console.log('Total deposits:', totalDeposits.toString(), '(' + (Number(totalDeposits) / 1e6).toFixed(2) + ' USDC)');
console.log('Total shares:', totalShares.toString());
console.log('Total fees earned:', totalFees.toString(), '(' + (Number(totalFees) / 1e6).toFixed(6) + ' USDC)');
console.log('Fee bps:', feeBps);
console.log('Bump:', bump);
console.log('Vault bump:', vaultBump);
console.log('Is active:', isActive);

// Check vault balance
const vaultAcct = await conn.getAccountInfo(vaultPda);
if (vaultAcct) {
  const vaultAmount = vaultAcct.data.readBigUInt64LE(64);
  console.log('Vault USDC balance:', vaultAmount.toString(), '(' + (Number(vaultAmount) / 1e6).toFixed(2) + ' USDC)');
}
