#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start_dashboard.sh — Launch the simple trader dashboard
# ─────────────────────────────────────────────────────────────────────────────
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   📊  Trading Dashboard — Starting"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  URL: http://localhost:5173"
echo "  (Open this in your browser)"
echo ""

cd "$ROOT/dashboard"
npm install --silent
npm run dev
