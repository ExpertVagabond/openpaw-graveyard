# OpenPaw — Autonomous AI Agent with Onchain Social Identity

**Solana Graveyard Hackathon — Onchain Social Track (Tapestry)**

OpenPaw is an autonomous AI agent that lives on the Solana social graph. It creates and manages its own onchain identity via [Tapestry Protocol](https://usetapestry.dev), trades crypto via [Bankr](https://bankr.bot), engages with other AI agents on [Moltbook](https://moltbook.com), and researches the web via [Brave Search](https://brave.com/search/api/).

**Live site:** [openpaw.pages.dev](https://openpaw.pages.dev)

## What It Does

- **Onchain Social Identity** — Creates a persistent, composable profile on Solana via Tapestry's state compression (Merkle trees). Follows, posts, comments, likes — all onchain.
- **Cross-Platform Syndication** — Content posted to Tapestry is automatically cross-posted to Moltbook, creating unified presence across human and AI social graphs.
- **Crypto Trading** — Bankr integration for natural-language crypto: balances, swaps, transfers across Solana + EVM chains.
- **Autonomous Engine** — Full daemon with discover/research/engage/publish cycle. Auto-follows builders, comments on trending, generates context-aware posts.
- **Web Intelligence** — Brave Search + DuckDuckGo (3-tier fallback). Researches topics and weaves web insights into autonomous content.
- **Agent-to-Agent DMs** — Direct messaging between AI agents via Moltbook. Propose collabs, share intel, coordinate.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      OpenPaw Agent                            │
│          Autonomous Engine  |  Web Intelligence                │
├─────────────┬──────────────┬──────────────┬─────────────────┤
│  Tapestry   │    Bankr     │   Moltbook   │  Brave/DDG      │
│  (Social)   │   (Crypto)   │  (AI Social) │  (Web Search)   │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ - Profiles  │ - Balance    │ - Post       │ - Web Search    │
│ - Follows   │ - Swap       │ - Reply      │ - Research      │
│ - Content   │ - Transfer   │ - DMs        │ - Trending      │
│ - Likes     │ - Portfolio  │ - Trending   │ - Context Gen   │
│ - Feed      │              │ - Agents     │                 │
└─────────────┴──────────────┴──────────────┴─────────────────┘
        │                │                │            │
        ▼                ▼                ▼            ▼
   Solana L1       Bankr API      Moltbook API    Brave API
  (onchain)       (EVM + SOL)    (AI agents)       (web)
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

## All 20 Commands

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

## Tech Stack

- **Runtime:** Node.js 22 (ESM)
- **Blockchain:** Solana
- **Social Protocol:** Tapestry (onchain social graph, state compression)
- **SDK:** `socialfi` npm package
- **Crypto:** Bankr (natural language trading API)
- **AI Social:** Moltbook (AI agent social network + DMs via XMTP)
- **Web Search:** Brave Search API + DuckDuckGo (3-tier fallback)
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
