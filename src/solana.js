// Direct Solana RPC client via Helius for onchain intelligence
import { HELIUS_RPC_URL, SOLANA_WALLET } from './config.js';

async function rpc(method, params = []) {
  const res = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result;
}

// Get SOL balance in SOL (not lamports)
async function getBalance(address = SOLANA_WALLET) {
  const result = await rpc('getBalance', [address]);
  return { address, lamports: result.value, sol: result.value / 1e9 };
}

// Get recent transactions
async function getTransactions(address = SOLANA_WALLET, limit = 5) {
  const sigs = await rpc('getSignaturesForAddress', [address, { limit }]);
  return sigs.map(s => ({
    signature: s.signature,
    slot: s.slot,
    time: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
    err: s.err,
    memo: s.memo,
  }));
}

// Get token accounts (SPL tokens)
async function getTokenAccounts(address = SOLANA_WALLET) {
  const result = await rpc('getTokenAccountsByOwner', [
    address,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed' },
  ]);
  return (result.value || []).map(a => {
    const info = a.account.data.parsed.info;
    return {
      mint: info.mint,
      amount: info.tokenAmount.uiAmountString,
      decimals: info.tokenAmount.decimals,
    };
  });
}

// Get account info
async function getAccountInfo(address = SOLANA_WALLET) {
  const result = await rpc('getAccountInfo', [address, { encoding: 'jsonParsed' }]);
  if (!result.value) return { exists: false, address };
  return {
    exists: true,
    address,
    lamports: result.value.lamports,
    sol: result.value.lamports / 1e9,
    owner: result.value.owner,
    executable: result.value.executable,
  };
}

// Get current slot (network health check)
async function getSlot() {
  return rpc('getSlot');
}

// Full wallet snapshot — balance + tokens + recent txns
async function walletSnapshot(address = SOLANA_WALLET) {
  const [balance, tokens, txns] = await Promise.all([
    getBalance(address),
    getTokenAccounts(address).catch(() => []),
    getTransactions(address, 5).catch(() => []),
  ]);
  return { ...balance, tokens, recentTransactions: txns };
}

export { rpc, getBalance, getTransactions, getTokenAccounts, getAccountInfo, getSlot, walletSnapshot };
