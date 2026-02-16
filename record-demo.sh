#!/bin/bash
# OpenPaw v3 — Automated Demo Recording Script
# Records terminal output for hackathon video walkthrough
# Usage: ./record-demo.sh
# Output: demo-recording.cast (asciinema format)
#         Convert to video: agg demo-recording.cast demo.gif
#         Or upload: asciinema upload demo-recording.cast

set -e
cd "$(dirname "$0")"

CAST_FILE="demo-recording.cast"
DELAY=2  # seconds between commands

echo "=== OpenPaw v3 Demo Recording ==="
echo "This will record all demo commands to $CAST_FILE"
echo "Press Enter to start..."
read

# Function to type and run a command with visual delay
run_cmd() {
  echo ""
  echo ">>> $1"
  sleep 1
  eval "$1"
  sleep "$DELAY"
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  OpenPaw v3 — Autonomous AI Agent on Solana     ║"
echo "║  28 commands • 5 integrations • Local LLM       ║"
echo "║  Graveyard Hackathon — Onchain Social Track     ║"
echo "╚══════════════════════════════════════════════════╝"
sleep 3

# 1. Profile — Onchain Identity
echo ""
echo "━━━ Onchain Identity (Tapestry) ━━━"
run_cmd "node src/index.js profile"

# 2. Wallet — Helius RPC
echo ""
echo "━━━ Onchain Intelligence (Helius RPC) ━━━"
run_cmd "node src/index.js wallet"

# 3. Slot — Network health
echo ""
echo "━━━ Solana Network Health ━━━"
run_cmd "node src/index.js slot"

# 4. Models — Local LLM
echo ""
echo "━━━ Local LLM (Ollama) ━━━"
run_cmd "node src/index.js models"

# 5. Feed — Moltbook trending
echo ""
echo "━━━ AI Agent Social Network (Moltbook) ━━━"
run_cmd "node src/index.js feed"

# 6. Research — Web intelligence
echo ""
echo "━━━ Web Intelligence (Brave Search) ━━━"
run_cmd 'node src/index.js research "Solana social agents 2026"'

# 7. Projects — PSM Ecosystem
echo ""
echo "━━━ PSM Project Ecosystem ━━━"
run_cmd "node src/index.js projects"

# 8. Stats — Full JSON
echo ""
echo "━━━ Live Agent Stats ━━━"
run_cmd "node src/index.js stats"

# 9. Full Cycle — The main event
echo ""
echo "━━━ Full Autonomous Cycle ━━━"
run_cmd "node src/index.js cycle"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  Demo complete! 28 commands, 5 integrations.    ║"
echo "║  github.com/ExpertVagabond/openpaw-graveyard     ║"
echo "║  openpaw.pages.dev                               ║"
echo "╚══════════════════════════════════════════════════╝"
