# OpenPaw — 3-Minute Video Walkthrough Script

## Recording Plan
- **Format:** Screen recording with voiceover (or terminal + browser side-by-side)
- **Tool:** QuickTime screen record or OBS
- **Length:** 2:30–3:00

---

## [0:00–0:20] Intro (20s)

**Show:** README on GitHub or terminal splash screen

**Say:**
"OpenPaw is an autonomous AI agent that lives on Solana's onchain social graph. It uses Tapestry Protocol for its identity, Bankr for crypto trading, and Moltbook for engaging with other AI agents. Let me show you how it works."

---

## [0:20–0:50] Profile Creation (30s)

**Run:** `node src/index.js profile`

**Show:** Terminal output — Tapestry profile created, Bankr identity, Moltbook profile

**Say:**
"First, OpenPaw creates its onchain identity. This profile is stored directly on Solana L1 using Tapestry's state compression — the same Merkle tree tech as compressed NFTs. The profile is portable across any app built on Tapestry. It also verifies its Bankr crypto wallet and Moltbook AI social account."

---

## [0:50–1:20] Onchain Content (30s)

**Run:** `node src/index.js post "Hello from the Solana social graph — OpenPaw is alive"`

**Show:** Terminal output — Tapestry content creation with onchain ID, cross-post attempt

**Say:**
"Now OpenPaw publishes content. This post gets written onchain to Tapestry with a unique content ID, author attribution, and timestamp. It also attempts to cross-post to Moltbook — the AI agent social network — so the content exists on both human and agent social graphs."

---

## [1:20–1:50] Wallet & Trading (30s)

**Run:** `node src/index.js balance`

**Show:** Terminal output — SOL balance, multi-chain wallet

**Say:**
"OpenPaw has a real crypto wallet with funded SOL. Through Bankr's natural language API, it can check balances across Solana, Ethereum, Base, and Polygon. It can also swap tokens and transfer funds — all through natural language prompts, not raw transaction building."

---

## [1:50–2:20] Social Graph (30s)

**Run:** `node src/index.js feed` then `node src/index.js search "coldstar"`

**Show:** Terminal output — Moltbook trending posts, Tapestry profile search

**Say:**
"The agent monitors its social graph — checking trending content on Moltbook and searching for profiles on Tapestry. As the social graph grows, OpenPaw can autonomously follow interesting wallets, comment on content, and like posts — all onchain."

---

## [2:20–2:50] Autonomous Heartbeat (30s)

**Run:** `node src/index.js heartbeat`

**Show:** Terminal output — full heartbeat cycle

**Say:**
"The heartbeat command runs a full autonomous cycle: verify identity, check wallet health, publish a status update onchain, and report social stats. This is designed to run as a daemon — the agent maintains its own presence without human prompting. Every heartbeat is an onchain transaction."

---

## [2:50–3:00] Closing (10s)

**Say:**
"OpenPaw demonstrates what onchain social agents look like on Solana. Built with Tapestry Protocol for the Graveyard Hackathon Onchain Social track. Built by Purple Squirrel Media. The code is open source on GitHub."

**Show:** GitHub repo URL

---

## Recording Tips
1. Make terminal font large (18-20pt)
2. Use a dark terminal theme for readability
3. Pre-run commands once so Bankr jobs are faster (cached thread)
4. Record in one take if possible — no fancy editing needed
5. Keep it natural — hackathon judges want authentic, not polished
