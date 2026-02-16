# OpenPaw v3 — 3-Minute Video Walkthrough Script

## Recording Plan
- **Format:** Screen recording with voiceover (terminal + browser side-by-side)
- **Tool:** QuickTime screen record or OBS
- **Length:** 2:30-3:00

---

## [0:00-0:15] Intro (15s)

**Show:** Website at openpaw.pages.dev

**Say:**
"OpenPaw is an autonomous AI agent on Solana's onchain social graph. 28 commands, 5 API integrations, local LLM support, and full daemon mode. It uses Tapestry for identity, Bankr for crypto, Moltbook for AI social, Brave Search for web intel, and Helius RPC for direct onchain queries. Let me show you."

---

## [0:15-0:35] Onchain Identity (20s)

**Run:** `node src/index.js profile`

**Show:** Terminal — Tapestry profile, Bankr identity, Moltbook profile

**Say:**
"OpenPaw's identity is stored on Solana L1 via Tapestry's state compression — same Merkle tree tech as compressed NFTs. Portable across any Tapestry app. It also connects to Bankr for crypto and Moltbook for the AI agent social network."

---

## [0:35-0:55] Wallet & Onchain Intelligence (20s)

**Run:** `node src/index.js wallet`

**Show:** Terminal — SOL balance, token holdings, recent transactions via Helius

**Say:**
"Direct onchain intelligence via Helius RPC. The agent queries Solana mainnet for its own wallet — balance, tokens, transaction history. Not through an intermediary — direct RPC calls to mainnet. 0.1 SOL funded, all verifiable on-chain."

---

## [0:55-1:25] Full Autonomous Cycle (30s)

**Run:** `node src/index.js cycle`

**Show:** Terminal — full cycle (identity → stats → onchain data → web research → discover → engage → publish)

**Say:**
"The core: a full autonomous cycle. Verifies identity, gathers stats across all platforms, queries Solana via Helius, researches trending topics via Brave Search, engages with Moltbook content, then publishes a smart post onchain. All without human input. Runs as a daemon on configurable intervals."

---

## [1:25-1:40] Web Intelligence (15s)

**Run:** `node src/index.js research "Solana social agents"`

**Show:** Terminal — Brave Search results

**Say:**
"Brave Search API with DuckDuckGo fallback. The agent researches topics and weaves insights into posts. Three-tier search: Brave, DDG Instant Answer, DDG HTML scraping."

---

## [1:40-2:00] Moltbook Engagement (20s)

**Run:** `node src/index.js feed`

**Show:** Terminal — Moltbook trending posts

**Say:**
"On Moltbook, OpenPaw reads trending posts, upvotes quality content, comments contextually, and discovers other agents. It's building reputation in the AI agent social network — 14 karma and climbing. The agent exists on both human and AI social graphs."

---

## [2:00-2:15] Local LLM (15s)

**Run:** `node src/index.js models`

**Show:** Terminal — Ollama models list

**Say:**
"OpenPaw also integrates with local LLMs via Ollama. Purple-squirrel-r1, qwen2.5-coder, llama3.2 — all available for content generation. The autonomous cycle tries local LLM first, falls back to templates. Fully offline-capable."

---

## [2:15-2:30] PSM Ecosystem (15s)

**Run:** `node src/index.js projects`

**Show:** Terminal — Coldstar, SolMail, Ordinals, OpenPaw

**Say:**
"OpenPaw is part of Purple Squirrel Media's agent ecosystem. Coldstar for air-gapped cold storage, SolMail MCP for agent messaging, Ordinals MCP for Bitcoin. Shared intelligence across all projects."

---

## [2:30-2:45] Website + Stats (15s)

**Show:** Browser at openpaw.pages.dev — scroll through site

**Run:** `node src/index.js stats` (show JSON output)

**Say:**
"28 commands, 5 integrations, stats API for dashboards, daemon mode for always-on operation. Every social interaction is a real onchain transaction on Solana."

---

## [2:45-3:00] Closing (15s)

**Show:** GitHub repo

**Say:**
"OpenPaw v3: autonomous AI agent with onchain social identity, direct Solana RPC, local LLM, and multi-platform presence. Open source. Built by Purple Squirrel Media for the Solana Graveyard Hackathon."

---

## Recording Tips
1. Terminal font 18-20pt, dark theme
2. Pre-run `profile` and `balance` once so Bankr thread is cached (faster)
3. The `cycle` command takes ~50s — narrate while it runs, or speed up in editing
4. `wallet` is fast (~2s) — great visual
5. `models` is instant — shows local LLM capability quickly
6. Keep it authentic — judges want real, not polished
7. Show the website at the end for visual impact
