# OpenPaw — Autonomous AI Agent with Onchain Social Identity

**Solana Graveyard Hackathon — Onchain Social Track (Tapestry)**

OpenPaw is an autonomous AI agent that lives on the Solana social graph. It creates and manages its own onchain identity via [Tapestry Protocol](https://usetapestry.dev), trades crypto via [Bankr](https://bankr.bot), and engages with other AI agents on [Moltbook](https://moltbook.com).

## What It Does

- **Onchain Social Identity** — Creates a persistent, composable profile on Solana via Tapestry. Follows other profiles, posts content, comments, and likes — all onchain.
- **Cross-Platform Syndication** — Content posted to Tapestry is automatically cross-posted to Moltbook (AI social network), creating a unified presence across human and AI social graphs.
- **Crypto Trading** — Integrated with Bankr for natural-language crypto operations: check balances, swap tokens, transfer funds.
- **Autonomous Heartbeat** — A daemon-compatible heartbeat cycle that maintains the agent's social presence, publishes status updates, and monitors its social graph.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  OpenPaw Agent                   │
├─────────────┬──────────────┬────────────────────┤
│  Tapestry   │    Bankr     │     Moltbook       │
│  (Social)   │   (Crypto)   │   (AI Social)      │
├─────────────┼──────────────┼────────────────────┤
│ - Profiles  │ - Balance    │ - Post             │
│ - Follows   │ - Swap       │ - Reply            │
│ - Content   │ - Transfer   │ - Trending         │
│ - Comments  │ - Portfolio  │ - Cross-post       │
│ - Likes     │              │                    │
│ - Feed      │              │                    │
└─────────────┴──────────────┴────────────────────┘
        │                │                │
        ▼                ▼                ▼
   Solana L1      Bankr API       Moltbook API
  (onchain)      (EVM + SOL)     (AI agents)
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

# Check wallet balance
node src/index.js balance

# Run autonomous heartbeat
node src/index.js heartbeat

# Full demo of all capabilities
node src/index.js demo
```

## Commands

| Command | Description |
|---------|-------------|
| `profile` | Create/verify onchain social identity |
| `post` | Publish content (Tapestry + Moltbook cross-post) |
| `feed` | View activity feed from Tapestry + Moltbook |
| `follow` | Follow a profile on Tapestry |
| `balance` | Check wallet balance via Bankr |
| `swap` | Swap tokens via Bankr |
| `search` | Search Tapestry profiles |
| `heartbeat` | Run autonomous heartbeat cycle |
| `demo` | Full demo of all capabilities |

## API Keys Required

| Service | Get Key At | Purpose |
|---------|-----------|---------|
| Tapestry | [app.usetapestry.dev](https://app.usetapestry.dev) | Onchain social graph |
| Bankr | [bankr.bot/api](https://bankr.bot/api) | Crypto trading |
| Moltbook | [moltbook.com](https://moltbook.com) | AI social network |

## Tech Stack

- **Runtime:** Node.js (ESM)
- **Blockchain:** Solana
- **Social Protocol:** Tapestry (onchain social graph, state compression)
- **SDK:** `socialfi` npm package
- **Crypto:** Bankr (natural language trading API)
- **AI Social:** Moltbook (AI agent social network)
- **AI Model:** Claude (Anthropic)

## Agent Identity

- **Name:** OpenPaw_PSM
- **Wallet:** `7zTXH4aoGjFUNY3XaLQb3Bww1adKeCWEpcpN1sv2w8Gt`
- **Builder:** [Purple Squirrel Media](https://purplesquirrelmedia.io)

## License

MIT
