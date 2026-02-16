# Graveyard Hackathon Submission — OpenPaw v3

## Project Name
OpenPaw — Autonomous AI Agent with Onchain Social Identity

## Track
Onchain Social (Tapestry)

## One-Liner
An autonomous AI agent with 28 commands that creates its own onchain social identity on Solana via Tapestry, queries mainnet via Helius RPC, trades crypto via Bankr, engages AI agents on Moltbook, researches the web, and generates content via local LLM — all without human prompting.

## Description

OpenPaw is a fully autonomous AI agent that lives natively on Solana's onchain social graph. Using Tapestry Protocol for persistent, composable identity and social interactions, OpenPaw demonstrates what "social agentic commerce" looks like in practice.

**What makes this different from other AI agents:**

1. **Onchain-first identity** — Profile, posts, follows, and likes stored on Solana L1 via Tapestry's state compression (Merkle trees). Portable across any Tapestry-built app.

2. **Direct onchain intelligence** — Queries Solana mainnet via Helius RPC: wallet balance, token holdings, transaction history, network health. Real-time chain data woven into autonomous posts.

3. **Cross-platform syndication** — Content published to Tapestry is cross-posted to Moltbook (AI agent social network). Unified presence across human and AI social graphs.

4. **Autonomous engine** — Full daemon with discover/research/engage/publish cycle on configurable intervals. Discovers profiles, researches topics, engages trending content, generates context-aware posts.

5. **Local LLM integration** — Ollama for offline content generation via purple-squirrel-r1, qwen2.5-coder, llama3.2. Tries local LLM first, falls back to templates.

6. **Web intelligence** — Brave Search API + DuckDuckGo (3-tier fallback). Researches topics and weaves web insights into autonomous content.

7. **Crypto-native operations** — Bankr for natural-language trading: balances, swaps, transfers across Solana + EVM chains.

8. **PSM ecosystem** — Part of Purple Squirrel Media's agent suite: Coldstar (cold wallet), SolMail MCP (agent messaging), Ordinals MCP (Bitcoin). Shared intelligence.

**Architecture:**
- Tapestry Protocol (onchain social graph on Solana)
- Helius RPC (direct Solana mainnet queries)
- Bankr (crypto wallet + trading via natural language)
- Moltbook (AI agent social network + engagement)
- Brave Search / DuckDuckGo (web intelligence)
- Ollama (local LLM — purple-squirrel-r1, qwen, llama3.2)
- Claude Opus 4.6 (Anthropic) as the reasoning engine
- Node.js 22 ESM runtime
- Cloudflare Pages (site hosting)

**Live agent data:**
- Tapestry profile: `openpaw` namespace, linked to wallet `7zTXH...w8Gt`
- Bankr wallet: 0.1 SOL funded, Solana + EVM addresses
- Moltbook: `OpenPaw_PSM`, verified, 14+ karma
- Helius RPC: Live mainnet queries (slot 400M+)
- 28 CLI commands, autonomous daemon mode
- 10+ onchain posts published and verifiable
- Local LLM operational via Ollama

## Team
- **Matthew Karsten** — Founder, Purple Squirrel Media (@expertvagabond)
- Solo builder, 1-person team

## Links
- **Website:** https://openpaw.pages.dev
- **GitHub:** https://github.com/ExpertVagabond/openpaw-graveyard
- **PDF:** https://openpaw.pages.dev/openpaw-submission.pdf
- **Video:** [Record using VIDEO_SCRIPT.md]
- **Wallet:** 7zTXH4aoGjFUNY3XaLQb3Bww1adKeCWEpcpN1sv2w8Gt
- **Tapestry Profile:** openpaw (namespace: openpaw)
- **Moltbook:** https://moltbook.com/u/OpenPaw_PSM
- **Builder:** https://purplesquirrelmedia.io

## Tech Stack
- Node.js 22 (ESM)
- socialfi npm package (Tapestry SDK)
- Helius RPC (Solana mainnet)
- Bankr REST API (async job workflow)
- Moltbook REST API (posts, upvotes, engagement)
- Brave Search API + DuckDuckGo (web intelligence)
- Ollama (local LLM: purple-squirrel-r1, qwen2.5-coder, llama3.2)
- Solana (onchain via Tapestry state compression)
- Claude Opus 4.6 (Anthropic)
- Cloudflare Pages

## Graveyard Hackathon — Typeform Answers
- **Name:** Matthew Karsten
- **Email:** MatthewKarstenConnects@gmail.com
- **GitHub:** https://github.com/ExpertVagabond/openpaw-graveyard
