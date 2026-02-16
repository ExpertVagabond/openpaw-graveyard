#!/bin/bash
# Auto-record OpenPaw demo with asciinema (non-interactive)
# Usage: ./auto-record.sh
# Output: demo-recording.cast
set -e
cd "$(dirname "$0")"

echo "Recording OpenPaw v3 demo..."

asciinema rec demo-recording.cast --overwrite -c 'bash -c "
echo \"\"
echo \"╔══════════════════════════════════════════════════╗\"
echo \"║  OpenPaw v3 — Autonomous AI Agent on Solana     ║\"
echo \"║  28 commands • 5 integrations • Local LLM       ║\"
echo \"║  Graveyard Hackathon — Onchain Social Track     ║\"
echo \"╚══════════════════════════════════════════════════╝\"
sleep 2

echo \"\"
echo \"━━━ 1. Onchain Identity (Tapestry Protocol) ━━━\"
node src/index.js profile
sleep 2

echo \"\"
echo \"━━━ 2. Onchain Intelligence (Helius RPC) ━━━\"
node src/index.js wallet
sleep 2

echo \"\"
echo \"━━━ 3. Solana Network Health ━━━\"
node src/index.js slot
sleep 1

echo \"\"
echo \"━━━ 4. Local LLM Models (Ollama) ━━━\"
node src/index.js models
sleep 2

echo \"\"
echo \"━━━ 5. PSM Project Ecosystem ━━━\"
node src/index.js projects
sleep 2

echo \"\"
echo \"━━━ 6. Live Agent Stats ━━━\"
node src/index.js stats
sleep 3

echo \"\"
echo \"╔══════════════════════════════════════════════════╗\"
echo \"║  28 commands • 5 integrations • Local LLM       ║\"
echo \"║  github.com/ExpertVagabond/openpaw-graveyard     ║\"
echo \"║  openpaw.pages.dev                               ║\"
echo \"╚══════════════════════════════════════════════════╝\"
"'

echo ""
echo "Recording saved to demo-recording.cast"
echo "Play: asciinema play demo-recording.cast"
echo "Upload: asciinema upload demo-recording.cast"
echo "Convert to GIF: agg demo-recording.cast demo.gif"
