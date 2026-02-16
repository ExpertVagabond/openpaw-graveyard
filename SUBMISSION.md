# Graveyard Hackathon Submission — OpenPaw

## Project Name
OpenPaw — Autonomous AI Agent with Onchain Social Identity

## Track
Onchain Social (Tapestry)

## One-Liner
An autonomous AI agent that creates and manages its own onchain social identity on Solana via Tapestry, trades crypto via Bankr, and cross-posts to the AI social network Moltbook.

## Description

OpenPaw is a fully autonomous AI agent that lives natively on Solana's onchain social graph. Using Tapestry Protocol for persistent, composable identity and social interactions, OpenPaw demonstrates what "social agentic commerce" looks like in practice.

**What makes this different from other AI agents:**

1. **Onchain-first identity** — OpenPaw's profile, posts, follows, and likes are stored directly on Solana L1 via Tapestry's state compression (Merkle trees). This isn't a database pretending to be onchain — it's real onchain social data, portable across any app built on Tapestry.

2. **Cross-platform syndication** — Content published to Tapestry is automatically cross-posted to Moltbook (AI agent social network), creating presence on both human-readable and agent-native social graphs simultaneously.

3. **Crypto-native operations** — Integrated with Bankr for natural-language crypto trading. The agent can check balances, swap tokens, and transfer funds as part of its autonomous behavior loop.

4. **Autonomous heartbeat** — A daemon-compatible cycle that maintains social presence: publish status updates, monitor social graph growth, check wallet health, and engage with content — all without human prompting.

**Architecture:**
- Tapestry Protocol (onchain social graph on Solana)
- Bankr (crypto wallet + trading via natural language)
- Moltbook (AI agent social network)
- Claude (Anthropic) as the reasoning engine
- Node.js ESM runtime

**Live demo data:**
- Tapestry profile: `openpaw` namespace, linked to wallet `7zTXH...w8Gt`
- Bankr wallet: 0.1 SOL funded, EVM + Solana addresses
- Moltbook: `OpenPaw_PSM`, verified, 8 karma
- Multiple onchain posts published and verifiable

## Team
- **Matthew Karsten** — Founder, Purple Squirrel Media (@expertvagabond)
- Solo builder, 1-person team

## Links
- **GitHub:** https://github.com/ExpertVagabond/openpaw-graveyard
- **Video:** [TODO — record 3-min walkthrough]
- **Wallet:** 7zTXH4aoGjFUNY3XaLQb3Bww1adKeCWEpcpN1sv2w8Gt
- **Tapestry Profile:** openpaw (namespace: openpaw)
- **Moltbook:** https://moltbook.com/u/OpenPaw_PSM
- **Builder:** https://purplesquirrelmedia.io

## Tech Stack
- Node.js 22 (ESM)
- socialfi npm package (Tapestry SDK)
- Bankr REST API (async job workflow)
- Moltbook REST API
- Solana (onchain via Tapestry state compression)
- Claude Opus 4.6 (Anthropic)
