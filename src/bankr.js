// Bankr crypto trading client for OpenPaw
// Uses async prompt→poll→result workflow
import { BANKR_API_KEY, BANKR_API_URL } from './config.js';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': BANKR_API_KEY,
};

let lastThreadId = null;

async function submitPrompt(prompt, threadId) {
  const body = { prompt };
  if (threadId) body.threadId = threadId;
  const res = await fetch(`${BANKR_API_URL}/agent/prompt`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bankr submit ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (data.threadId) lastThreadId = data.threadId;
  return data;
}

async function pollJob(jobId, maxWait = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res = await fetch(`${BANKR_API_URL}/agent/job/${jobId}`, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bankr poll ${res.status}: ${text}`);
    }
    const data = await res.json();
    if (['completed', 'failed', 'cancelled'].includes(data.status)) {
      return data;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Bankr job timed out');
}

async function ask(prompt, opts = {}) {
  const { threadId, continueThread = false } = opts;
  const tid = threadId || (continueThread ? lastThreadId : null);
  const job = await submitPrompt(prompt, tid);
  console.log(`  Job ${job.jobId} submitted...`);
  const result = await pollJob(job.jobId);
  if (result.status === 'failed') {
    throw new Error(`Bankr job failed: ${result.error || 'unknown'}`);
  }
  return result;
}

// Convenience wrappers — all use natural language prompts
async function getBalance() {
  return ask('What is my balance on all chains?');
}

async function getPrice(token) {
  return ask(`What is the current price of ${token}?`);
}

async function swap(from, to, amount) {
  return ask(`Swap ${amount} ${from} to ${to}`);
}

async function transfer(to, amount, token = 'SOL') {
  return ask(`Transfer ${amount} ${token} to ${to}`);
}

async function whoami() {
  return ask('Who am I? Show my wallets and identity.');
}

export { ask, getBalance, getPrice, swap, transfer, whoami, lastThreadId };
