# Graveyard Hackathon Submission — OpenPaw

## Project Name
OpenPaw — Autonomous AI Agent with Onchain Social Identity

## Track
Onchain Social (Tapestry)

## One-Liner
An autonomous AI agent with 20 commands that creates and manages its own onchain social identity on Solana via Tapestry, trades crypto via Bankr, DMs other agents on Moltbook, and researches the web — all without human prompting.

## Description

OpenPaw is a fully autonomous AI agent that lives natively on Solana's onchain social graph. Using Tapestry Protocol for persistent, composable identity and social interactions, OpenPaw demonstrates what "social agentic commerce" looks like in practice.

**What makes this different from other AI agents:**

1. **Onchain-first identity** — OpenPaw's profile, posts, follows, and likes are stored directly on Solana L1 via Tapestry's state compression (Merkle trees). Real onchain social data, portable across any Tapestry-built app.

2. **Cross-platform syndication** — Content published to Tapestry is automatically cross-posted to Moltbook (AI agent social network), creating presence on both human-readable and agent-native social graphs.

3. **Autonomous engine** — Full daemon with discover/research/engage/publish cycle. The agent discovers new profiles, researches web topics for context, engages with trending content, generates smart posts from live data, and cross-posts — all in a configurable loop.

4. **Web intelligence** — Brave Search API + DuckDuckGo (3-tier fallback). The agent researches topics autonomously and weaves web insights into its content generation.

5. **Agent-to-agent DMs** — Direct messaging between AI agents via Moltbook. Can propose collaborations, share intel, and coordinate with other autonomous agents.

6. **Crypto-native operations** — Integrated with Bankr for natural-language crypto trading. Balances, swaps, transfers across Solana + EVM chains.

**Architecture:**
- Tapestry Protocol (onchain social graph on Solana)
- Bankr (crypto wallet + trading via natural language)
- Moltbook (AI agent social network + DMs)
- Brave Search / DuckDuckGo (web intelligence)
- Claude Opus 4.6 (Anthropic) as the reasoning engine
- Node.js 22 ESM runtime
- Cloudflare Pages (site hosting)

**Live agent data:**
- Tapestry profile: `openpaw` namespace, linked to wallet `7zTXH...w8Gt`
- Bankr wallet: 0.1 SOL funded, Solana + EVM addresses
- Moltbook: `OpenPaw_PSM`, verified, 14 karma
- 20 CLI commands, autonomous daemon mode
- Multiple onchain posts published and verifiable
- Web search operational via Brave API

## Team
- **Matthew Karsten** — Founder, Purple Squirrel Media (@expertvagabond)
- Solo builder, 1-person team

## Links
- **Website:** https://openpaw.pages.dev
- **GitHub:** https://github.com/ExpertVagabond/openpaw-graveyard
- **PDF:** https://openpaw.pages.dev/openpaw-submission.pdf
- **Video:** [TODO — record 3-min walkthrough]
- **Wallet:** 7zTXH4aoGjFUNY3XaLQb3Bww1adKeCWEpcpN1sv2w8Gt
- **Tapestry Profile:** openpaw (namespace: openpaw)
- **Moltbook:** https://moltbook.com/u/OpenPaw_PSM
- **Builder:** https://purplesquirrelmedia.io

## Tech Stack
- Node.js 22 (ESM)
- socialfi npm package (Tapestry SDK)
- Bankr REST API (async job workflow)
- Moltbook REST API (posts, DMs, agent search)
- Brave Search API + DuckDuckGo (web intelligence)
- Solana (onchain via Tapestry state compression)
- Claude Opus 4.6 (Anthropic)
- Cloudflare Pages
