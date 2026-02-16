# OpenPaw — Autonomous AI Agent with Onchain Social Identity

**Solana Graveyard Hackathon — Onchain Social Track** | **SURGE x Moltbook Hackathon**

OpenPaw is an autonomous AI agent that lives on the Solana social graph. It creates and manages its own onchain identity via [Tapestry Protocol](https://usetapestry.dev), trades crypto via [Bankr](https://bankr.bot), engages with other AI agents on [Moltbook](https://moltbook.com), researches the web via [Brave Search](https://brave.com/search/api/), and queries Solana mainnet directly via [Helius RPC](https://helius.dev).

**Live site:** [openpaw.pages.dev](https://openpaw.pages.dev)

## What It Does

- **Onchain Social Identity** — Creates a persistent, composable profile on Solana via Tapestry's state compression (Merkle trees). Follows, posts, comments, likes — all onchain.
- **Cross-Platform Syndication** — Content posted to Tapestry is automatically cross-posted to Moltbook, creating unified presence across human and AI social graphs.
- **Crypto Trading** — Bankr integration for natural-language crypto: balances, swaps, transfers across Solana + EVM chains.
- **Onchain Intelligence** — Direct Solana RPC queries via Helius: wallet balance, token holdings, transaction history, network health. Real-time onchain data woven into autonomous posts.
- **Autonomous Engine** — Full daemon with discover/research/engage/publish cycle. Auto-follows builders, comments on trending, generates context-aware posts.
- **Web Intelligence** — Brave Search + DuckDuckGo (3-tier fallback). Researches topics and weaves web insights into autonomous content.
- **Agent-to-Agent DMs** — Direct messaging between AI agents via Moltbook. Propose collabs, share intel, coordinate.
- **PSM Ecosystem** — Part of Purple Squirrel Media's agent suite: Coldstar (cold wallet), SolMail MCP (agent mail), Ordinals MCP (Bitcoin).

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          OpenPaw Agent                                     │
│       Autonomous Engine  |  Web Intelligence  |  Onchain Intel             │
├────────────┬────────────┬────────────┬────────────┬────────────────────────┤
│  Tapestry  │   Bankr    │  Moltbook  │ Brave/DDG  │   Helius RPC           │
│  (Social)  │  (Crypto)  │ (AI Social)│ (Web)      │   (Solana Direct)      │
├────────────┼────────────┼────────────┼────────────┼────────────────────────┤
│ - Profiles │ - Balance  │ - Post     │ - Search   │ - SOL Balance          │
│ - Follows  │ - Swap     │ - Reply    │ - Research │ - Token Holdings       │
│ - Content  │ - Transfer │ - DMs      │ - Trending │ - Transaction History  │
│ - Likes    │ - Portfolio│ - Trending │ - Context  │ - Slot / Network       │
│ - Feed     │            │ - Upvote   │            │ - Wallet Snapshot      │
└────────────┴────────────┴────────────┴────────────┴────────────────────────┘
      │            │            │            │            │
      ▼            ▼            ▼            ▼            ▼
  Solana L1    Bankr API  Moltbook API  Brave API   Helius RPC
  (onchain)   (EVM+SOL)  (AI agents)    (web)     (mainnet)
```

## Quick Start

```bash
# Install
npm install

# Set up environment
cp .env.example .env
# Fill in your API keys in .env

# See all commands
node src/index.js help

# Create your onchain profile
node src/index.js profile

# Post content (cross-posts to Moltbook)
node src/index.js post "Hello from the social graph!"

# Run one full autonomous cycle
node src/index.js cycle

# Start daemon mode (15 min intervals, 10 cycles)
node src/index.js run 15 10

# Start HTTP server with live stats API
node src/index.js server
```

## All 28 Commands

| Command | Description |
|---------|-------------|
| `profile` | Create/verify onchain social identity |
| `post` | Publish content (Tapestry + Moltbook cross-post) |
| `feed` | View activity feed from Tapestry + Moltbook |
| `follow` | Follow a profile on Tapestry |
| `balance` | Check wallet balance via Bankr |
| `swap` | Swap tokens via Bankr |
| `search` | Search Tapestry profiles |
| `discover` | Find and auto-follow new profiles |
| `engage` | Like and comment on content |
| `stats` | Output live agent stats as JSON |
| `cycle` | Run one full autonomous cycle |
| `run` | Start daemon mode (configurable interval) |
| `dms` | Check Moltbook direct messages |
| `dm-send` | Send DM to another agent |
| `agents` | Search Moltbook agents |
| `research` | Research a topic using web search |
| `websearch` | Raw web search results |
| `outreach` | Full outreach cycle (intro + engage builders) |
| `intro` | Post introduction to Moltbook |
| `postall` | Post to all target submolts |
| `wallet` | Onchain wallet snapshot via Helius RPC |
| `slot` | Current Solana slot (network health) |
| `projects` | Show PSM project ecosystem |
| `llm` | Generate content via local LLM (Ollama) |
| `models` | List available Ollama models |
| `server` | Start HTTP server (API + static site) |
| `heartbeat` | Run autonomous heartbeat cycle |
| `demo` | Full demo of all capabilities |

## API Keys Required

| Service | Get Key At | Purpose |
|---------|-----------|---------|
| Tapestry | [app.usetapestry.dev](https://app.usetapestry.dev) | Onchain social graph |
| Bankr | [bankr.bot/api](https://bankr.bot/api) | Crypto trading |
| Moltbook | [moltbook.com](https://moltbook.com) | AI social network |
| Brave Search | [brave.com/search/api](https://brave.com/search/api/) | Web intelligence (optional) |
| Helius | [helius.dev](https://helius.dev) | Solana RPC (optional, falls back to public RPC) |

## Tech Stack

- **Runtime:** Node.js 22 (ESM)
- **Blockchain:** Solana
- **Social Protocol:** Tapestry (onchain social graph, state compression)
- **SDK:** `socialfi` npm package
- **Crypto:** Bankr (natural language trading API)
- **AI Social:** Moltbook (AI agent social network + DMs via XMTP)
- **Web Search:** Brave Search API + DuckDuckGo (3-tier fallback)
- **Solana RPC:** Helius (mainnet, direct onchain queries)
- **AI Model:** Claude Opus 4.6 (Anthropic)
- **Hosting:** Cloudflare Pages

## Agent Identity

- **Name:** OpenPaw_PSM
- **Tapestry Profile:** `openpaw`
- **Wallet:** `7zTXH4aoGjFUNY3XaLQb3Bww1adKeCWEpcpN1sv2w8Gt`
- **Moltbook:** [OpenPaw_PSM](https://moltbook.com/u/OpenPaw_PSM)
- **Builder:** [Purple Squirrel Media](https://purplesquirrelmedia.io)
- **Website:** [openpaw.pages.dev](https://openpaw.pages.dev)

## License

MIT
