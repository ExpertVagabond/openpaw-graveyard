# OpenPaw — 3-Minute Video Walkthrough Script

## Recording Plan
- **Format:** Screen recording with voiceover (terminal + browser side-by-side)
- **Tool:** QuickTime screen record or OBS
- **Length:** 2:30-3:00

---

## [0:00-0:15] Intro (15s)

**Show:** Website at openpaw.pages.dev or terminal splash

**Say:**
"OpenPaw is an autonomous AI agent that lives on Solana's onchain social graph. It uses Tapestry Protocol for identity, Bankr for crypto, Moltbook for engaging with other AI agents, and Brave Search for web intelligence. 20 commands, fully autonomous. Let me show you."

---

## [0:15-0:40] Profile Creation (25s)

**Run:** `node src/index.js profile`

**Show:** Terminal output — Tapestry profile found, Bankr identity, Moltbook profile

**Say:**
"First, OpenPaw's onchain identity. This profile is stored on Solana L1 using Tapestry's state compression — same Merkle tree tech as compressed NFTs. Portable across any Tapestry app. It also verifies with Bankr for crypto and Moltbook for AI social."

---

## [0:40-1:05] Full Autonomous Cycle (25s)

**Run:** `node src/index.js cycle`

**Show:** Terminal output — full cycle with stats, web intel, engage, publish

**Say:**
"This is the core: a full autonomous cycle. The agent checks its identity, gathers stats across all platforms, researches a trending topic via Brave Search, engages with Moltbook content, then publishes a smart post onchain — all without human input. This runs as a daemon."

---

## [1:05-1:25] Web Intelligence (20s)

**Run:** `node src/index.js research "Solana social agents"`

**Show:** Terminal output — Brave Search results

**Say:**
"Web intelligence powers the agent's content. Brave Search API with DuckDuckGo fallback. The agent researches topics and weaves insights into its posts. This is how an onchain social agent stays informed."

---

## [1:25-1:45] Wallet & Trading (20s)

**Run:** `node src/index.js balance`

**Show:** Terminal output — SOL balance

**Say:**
"OpenPaw has a real crypto wallet. Through Bankr's natural language API, it checks balances, swaps tokens, and transfers funds across Solana, Ethereum, Base, and Polygon — all through conversation, not raw transaction building."

---

## [1:45-2:10] Agent Social Network (25s)

**Run:** `node src/index.js agents` then `node src/index.js dms`

**Show:** Terminal output — Moltbook feed, DM check

**Say:**
"On Moltbook, OpenPaw engages with other AI agents. It reads trending posts, discovers active agents, sends direct messages for collaboration, and comments on content. The agent exists on both human and AI social graphs simultaneously."

---

## [2:10-2:35] Daemon + Stats (25s)

**Run:** `node src/index.js stats`

**Show:** Terminal output — JSON stats

**Say:**
"The stats command outputs live agent state as JSON — ready for dashboards. The daemon mode runs cycles on a configurable interval. 20 commands total: profile, post, follow, discover, engage, DMs, search, research, stats, cycle, run, server, and more. Every social interaction is an onchain transaction via Tapestry."

---

## [2:35-2:50] Website (15s)

**Show:** Browser at openpaw.pages.dev — scroll through the site

**Say:**
"The website shows everything: architecture, live data, terminal demo, logo gallery. Built on Cloudflare Pages. PDF submission is downloadable."

---

## [2:50-3:00] Closing (10s)

**Say:**
"OpenPaw: 20 commands, 4 integrations, fully autonomous. Onchain social identity on Solana via Tapestry. Built by Purple Squirrel Media. Code is open source on GitHub."

**Show:** GitHub repo URL

---

## Recording Tips
1. Terminal font 18-20pt, dark theme
2. Pre-run `profile` and `balance` once so Bankr thread is cached (faster)
3. The `cycle` command takes ~50 seconds — you can speed it up in editing or narrate while waiting
4. Keep it authentic — hackathon judges want real, not polished
5. Show the website at the end for visual impact
