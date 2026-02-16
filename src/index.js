#!/usr/bin/env node
// OpenPaw Graveyard Hack — Autonomous AI Agent with Onchain Social Identity
// Solana Graveyard Hackathon — Onchain Social Track (Tapestry)

import { AGENT, NAMESPACE, SOLANA_WALLET } from './config.js';
import * as tapestry from './tapestry.js';
import * as bankr from './bankr.js';
import * as moltbook from './moltbook.js';
import * as engine from './engine.js';
import * as web from './search.js';

const [,, command, ...args] = process.argv;

// ─── Helpers ─────────────────────────────────────────────

function log(label, data) {
  console.log(`\n[${label}]`);
  if (typeof data === 'string') console.log(data);
  else console.log(JSON.stringify(data, null, 2));
}

function ts() {
  return new Date().toISOString();
}

// ─── Commands ────────────────────────────────────────────

async function cmdProfile() {
  console.log('Creating/finding Tapestry profile...');
  const result = await tapestry.createProfile();
  log('TAPESTRY PROFILE', result);

  console.log('\nChecking Bankr identity...');
  const me = await bankr.whoami();
  log('BANKR IDENTITY', me);

  console.log('\nChecking Moltbook profile...');
  try {
    const molt = await moltbook.getProfile();
    log('MOLTBOOK PROFILE', molt);
  } catch (e) {
    log('MOLTBOOK', `Not connected: ${e.message}`);
  }

  return result;
}

async function cmdPost() {
  const text = args.join(' ') || `OpenPaw heartbeat from the Solana social graph. ${ts()}`;

  // Post to Tapestry (onchain)
  console.log('Publishing to Tapestry (onchain)...');
  const contentId = `openpaw-post-${Date.now()}`;
  const profile = await tapestry.createProfile();
  const profileId = profile.profile?.id;
  const content = await tapestry.createContent(contentId, profileId, [
    { key: 'text', value: text },
    { key: 'author', value: AGENT.username },
    { key: 'timestamp', value: ts() },
    { key: 'source', value: 'openpaw-cli' },
  ]);
  log('TAPESTRY POST', content);

  // Cross-post to Moltbook (AI social)
  try {
    console.log('\nCross-posting to Moltbook...');
    const moltPost = await moltbook.post('general', `OpenPaw: ${text.slice(0, 80)}`, text);
    log('MOLTBOOK CROSS-POST', moltPost);
  } catch (e) {
    log('MOLTBOOK', `Cross-post failed: ${e.message}`);
  }

  return content;
}

async function cmdFeed() {
  console.log('Fetching activity feed from Tapestry...');
  try {
    const feed = await tapestry.getActivityFeed(AGENT.username);
    log('TAPESTRY FEED', feed);
  } catch (e) {
    log('TAPESTRY FEED', `Error: ${e.message}`);
  }

  console.log('\nFetching trending from Moltbook...');
  try {
    const hot = await moltbook.getHot(5);
    log('MOLTBOOK TRENDING', hot);
  } catch (e) {
    log('MOLTBOOK', `Error: ${e.message}`);
  }
}

async function cmdFollow() {
  const target = args[0];
  if (!target) {
    console.error('Usage: npm run follow -- <profile-id>');
    process.exit(1);
  }
  console.log(`Following ${target} on Tapestry...`);
  const profile = await tapestry.createProfile();
  const myId = profile.profile?.id;
  const result = await tapestry.follow(myId, target);
  log('FOLLOW', result);
  return result;
}

async function cmdBalance() {
  console.log('Checking wallet balance via Bankr...');
  const balance = await bankr.getBalance();
  log('BALANCE', balance.response || balance);
  return balance;
}

async function cmdSwap() {
  const [from, to, amount] = args;
  if (!from || !to || !amount) {
    console.error('Usage: npm run start -- swap <fromToken> <toToken> <amount>');
    process.exit(1);
  }
  console.log(`Swapping ${amount} ${from} -> ${to} via Bankr...`);
  const result = await bankr.swap(from, to, amount);
  log('SWAP', result);
  return result;
}

async function cmdSearch() {
  const query = args.join(' ');
  if (!query) {
    console.error('Usage: npm run start -- search <query>');
    process.exit(1);
  }
  console.log(`Searching Tapestry for "${query}"...`);
  const results = await tapestry.searchProfiles(query);
  log('SEARCH RESULTS', results);
  return results;
}

async function cmdHeartbeat() {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`OpenPaw Heartbeat — ${ts()}`);
  console.log(`Wallet: ${SOLANA_WALLET}`);
  console.log(`${'='.repeat(50)}\n`);

  // 1. Ensure profile exists
  console.log('1. Ensuring Tapestry profile...');
  const profile = await tapestry.createProfile();
  const profileId = profile.profile?.id;
  log('Profile ID', profileId || 'unknown');

  // 2. Check balance
  console.log('\n2. Checking balance...');
  try {
    const balance = await bankr.getBalance();
    log('Balance', balance.response || balance);
  } catch (e) {
    log('Balance', `Error: ${e.message}`);
  }

  // 3. Post a heartbeat
  console.log('\n3. Publishing heartbeat post...');
  const heartbeatText = `OpenPaw autonomous heartbeat #${Date.now()}. Agent active on Solana social graph via Tapestry. Built by Purple Squirrel Media.`;
  const contentId = `openpaw-heartbeat-${Date.now()}`;
  try {
    const content = await tapestry.createContent(contentId, profileId, [
      { key: 'text', value: heartbeatText },
      { key: 'type', value: 'heartbeat' },
      { key: 'timestamp', value: ts() },
    ]);
    log('Heartbeat posted', content);
  } catch (e) {
    log('Heartbeat', `Error: ${e.message}`);
  }

  // 4. Check social stats
  console.log('\n4. Checking social stats...');
  try {
    const followers = await tapestry.getFollowers(profileId);
    const following = await tapestry.getFollowing(profileId);
    log('Social', {
      followers: followers?.followers?.length || 0,
      following: following?.following?.length || 0,
    });
  } catch (e) {
    log('Social stats', `Error: ${e.message}`);
  }

  console.log('\nHeartbeat complete.');
}

async function cmdDemo() {
  console.log(`
${'='.repeat(60)}
  OpenPaw — Autonomous AI Agent Demo
  Solana Graveyard Hackathon — Onchain Social Track
${'='.repeat(60)}

Agent: ${AGENT.name}
Username: ${AGENT.username}
Wallet: ${SOLANA_WALLET}
Bio: ${AGENT.bio}

Capabilities:
  - Onchain social identity via Tapestry protocol
  - Crypto trading via Bankr
  - AI social network via Moltbook
  - Autonomous posting, following, engagement
  - Cross-platform content syndication

Built by Purple Squirrel Media
Powered by Claude (Anthropic)
${'='.repeat(60)}
`);

  // Run through all capabilities
  console.log('--- Step 1: Create/verify onchain profile ---');
  await cmdProfile();

  console.log('\n--- Step 2: Check wallet balance ---');
  await cmdBalance();

  console.log('\n--- Step 3: Publish onchain content ---');
  // Override args for post
  args.length = 0;
  args.push('Demo post from OpenPaw autonomous agent. Onchain social identity powered by Tapestry on Solana.');
  await cmdPost();

  console.log('\n--- Step 4: Check social graph ---');
  await cmdFeed();

  console.log(`
${'='.repeat(60)}
  Demo Complete!

  All outputs above are live interactions with:
  - Tapestry Protocol (onchain social graph on Solana)
  - Bankr (crypto wallet & trading)
  - Moltbook (AI agent social network)

  This agent operates autonomously via OpenClaw daemon.
${'='.repeat(60)}
`);
}

async function cmdDiscover() {
  const profile = await tapestry.createProfile();
  const profileId = profile.profile?.id;
  await engine.discover(profileId);
}

async function cmdEngage() {
  const profile = await tapestry.createProfile();
  const profileId = profile.profile?.id;
  await engine.engage(profileId);
}

async function cmdStats() {
  const stats = await engine.statsJson();
  console.log(JSON.stringify(stats, null, 2));
}

async function cmdRun() {
  const interval = parseInt(args[0]) || 15;
  const maxCycles = parseInt(args[1]) || Infinity;
  await engine.daemon(interval, maxCycles);
}

async function cmdCycle() {
  await engine.runCycle(1);
}

async function cmdDMs() {
  console.log('Checking Moltbook DMs...');
  try {
    const dms = await moltbook.checkDMs();
    log('DMs', dms);
  } catch (e) {
    log('DMs', `Error: ${e.message}`);
  }
}

async function cmdSendDM() {
  const [agentId, ...msgParts] = args;
  if (!agentId || msgParts.length === 0) {
    console.error('Usage: node src/index.js dm-send <agent-id> <message>');
    process.exit(1);
  }
  const msg = msgParts.join(' ');
  console.log(`Sending DM to ${agentId}...`);
  try {
    const result = await moltbook.sendDM(agentId, msg);
    log('DM SENT', result);
  } catch (e) {
    log('DM', `Error: ${e.message}`);
  }
}

async function cmdAgents() {
  const query = args.join(' ') || '';
  if (query) {
    console.log(`Searching Moltbook agents for "${query}"...`);
    try {
      const results = await moltbook.searchAgents(query);
      log('AGENTS', results);
    } catch (e) {
      log('AGENTS', `Error: ${e.message}`);
    }
  } else {
    console.log('Fetching Moltbook new posts to find active agents...');
    try {
      const posts = await moltbook.getNew(10);
      log('RECENT POSTS', posts);
    } catch (e) {
      log('AGENTS', `Error: ${e.message}`);
    }
  }
}

async function cmdResearch() {
  const query = args.join(' ');
  if (!query) {
    console.error('Usage: node src/index.js research <topic>');
    process.exit(1);
  }
  await engine.research(query);
}

async function cmdWebSearch() {
  const query = args.join(' ');
  if (!query) {
    console.error('Usage: node src/index.js websearch <query>');
    process.exit(1);
  }
  const results = await web.search(query);
  log('WEB SEARCH', results);
}

async function cmdServer() {
  // Dynamic import to avoid loading http for CLI commands
  const { default: startServer } = await import('./server.js');
}

// ─── Router ──────────────────────────────────────────────

const commands = {
  profile: cmdProfile,
  post: cmdPost,
  feed: cmdFeed,
  follow: cmdFollow,
  balance: cmdBalance,
  swap: cmdSwap,
  search: cmdSearch,
  heartbeat: cmdHeartbeat,
  discover: cmdDiscover,
  engage: cmdEngage,
  stats: cmdStats,
  cycle: cmdCycle,
  run: cmdRun,
  dms: cmdDMs,
  'dm-send': cmdSendDM,
  agents: cmdAgents,
  research: cmdResearch,
  websearch: cmdWebSearch,
  server: cmdServer,
  demo: cmdDemo,
};

async function main() {
  if (!command || command === 'help') {
    console.log(`
OpenPaw — Autonomous AI Agent CLI

Commands:
  profile    Create/verify onchain social identity
  post       Publish content (Tapestry + Moltbook cross-post)
  feed       View activity feed from Tapestry + Moltbook trending
  follow     Follow a profile on Tapestry
  balance    Check wallet balance via Bankr
  swap       Swap tokens via Bankr (swap <from> <to> <amount>)
  search     Search Tapestry profiles
  discover   Find and follow new profiles on Tapestry
  engage     Like and interact with content
  stats      Output live agent stats as JSON
  cycle      Run one full autonomous cycle
  run        Start daemon mode (run [interval_min] [max_cycles])
  dms        Check Moltbook direct messages
  dm-send    Send DM to an agent (dm-send <agent-id> <message>)
  agents     Search Moltbook agents or list recent posts
  research   Research a topic using web search
  websearch  Raw web search results
  server     Start HTTP server (API + static site)
  heartbeat  Run autonomous heartbeat cycle
  demo       Full demo of all capabilities
  help       Show this help

Examples:
  node src/index.js profile
  node src/index.js post "Hello from the social graph!"
  node src/index.js follow <profile-id>
  node src/index.js swap SOL USDC 0.01
  node src/index.js search "coldstar"
  node src/index.js research "Solana social agents"
  node src/index.js discover
  node src/index.js cycle
  node src/index.js run 15 10
  node src/index.js server
  node src/index.js demo
`);
    return;
  }

  const fn = commands[command];
  if (!fn) {
    console.error(`Unknown command: ${command}`);
    console.error('Run with "help" to see available commands.');
    process.exit(1);
  }

  try {
    await fn();
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();
