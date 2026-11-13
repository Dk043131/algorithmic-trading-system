#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup.sh — One-time setup: creates venv, installs all dependencies
# ─────────────────────────────────────────────────────────────────────────────
set -e
# Always resolve to the TRADING BOT project root (one level up from scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   ⚙️   First-Time Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Project root: $ROOT"

# ── Python: require 3.10–3.13 (Freqtrade does NOT support 3.14+) ──────────
PYTHON=""
for candidate in python3.13 python3.12 python3.11 python3.10; do
    if command -v "$candidate" &>/dev/null; then
        PYTHON="$candidate"
        break
    fi
done
if [ -z "$PYTHON" ]; then
    echo ""
    echo "❌  Could not find Python 3.10–3.13."
    echo "    Install it with: brew install python@3.13"
    exit 1
fi
echo "  Using Python: $($PYTHON --version)"

# ── Create venv if missing or wrong Python version ────────────────────────
if [ -d "venv" ]; then
    VENV_VER=$(venv/bin/python --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    VENV_MAJOR_MINOR=$(echo "$VENV_VER" | cut -d. -f1-2)
    if [[ "$VENV_MAJOR_MINOR" == "3.14" ]]; then
        echo "  ⚠️  Existing venv uses Python 3.14 — recreating with $PYTHON…"
        rm -rf venv
    fi
fi
if [ ! -d "venv" ]; then
    "$PYTHON" -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip -q
pip install freqtrade pandas_ta -q

# ── Node dashboard ─────────────────────────────────────────────────────────
cd "$ROOT/dashboard"
npm install --silent
cd "$ROOT"

echo ""
echo "✅  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Open freqtrade/config.json and set:"
echo "       - Your exchange name (binance, bybit, okx…)"
echo "       - API key & secret (for live trading)"
echo "       - api_server jwt_secret_key (any random string)"
echo ""
echo "  2. Run the bot:       bash scripts/start_bot.sh"
echo "  3. Run the dashboard: bash scripts/start_dashboard.sh"
echo "  4. Open browser:      http://localhost:5173"
echo ""
