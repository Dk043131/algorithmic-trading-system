#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start_bot.sh — Launch Freqtrade bot in Paper (dry-run) mode
# ─────────────────────────────────────────────────────────────────────────────
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   🤖  Auto Trading Bot — Starting Up"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Mode    : PAPER (dry_run = true)"
echo "  Config  : freqtrade/config.json"
echo "  Strategy: MultiStrategyBot"
echo "  API     : http://127.0.0.1:8080"
echo ""
echo "  To go LIVE: edit config.json → set dry_run: false + add API keys"
echo ""

# Activate virtual environment
source "$ROOT/venv/bin/activate"

# Install pandas_ta if missing
python3 -c "import pandas_ta" 2>/dev/null || pip install pandas_ta -q

# Run freqtrade
cd "$ROOT"
freqtrade trade \
    --config freqtrade/config.json \
    --strategy MultiStrategyBot \
    --userdir freqtrade/user_data \
    --logfile freqtrade/user_data/logs/bot.log
