#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# watchdog.sh — 24/7 Supervisor with Auto-Restart & Network Failure Recovery
# ─────────────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

LOG_FILE="$ROOT/freqtrade/user_data/logs/watchdog.log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "  🤖  24/7 Trading Bot Supervisor Started"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESTART_DELAY=5
MAX_RESTART_DELAY=60
CONSECUTIVE_CRASHES=0

while true; do
    # 1. Connectivity Check
    log "Checking internet connectivity..."
    if ! curl -s --connect-timeout 5 https://api.binance.com/api/v3/ping > /dev/null; then
        log "⚠️  No network connection to Binance API. Waiting 15s..."
        sleep 15
        continue
    fi

    log "Network healthy. Launching Freqtrade bot..."
    source "$ROOT/venv/bin/activate"
    cd "$ROOT"

    # Launch bot
    freqtrade trade \
        --config freqtrade/config.json \
        --strategy MultiStrategyBot \
        --userdir freqtrade/user_data \
        --logfile freqtrade/user_data/logs/bot.log

    EXIT_CODE=$?
    log "⚠️  Bot process exited with code $EXIT_CODE."

    # If exit was intentional (code 0) or user stopped it
    if [ $EXIT_CODE -eq 0 ]; then
        log "Bot terminated normally. Exiting supervisor."
        break
    fi

    CONSECUTIVE_CRASHES=$((CONSECUTIVE_CRASHES + 1))
    log "Bot crashed (crash #$CONSECUTIVE_CRASHES). Auto-restarting in ${RESTART_DELAY}s..."
    sleep $RESTART_DELAY

    # Exponential backoff up to max
    RESTART_DELAY=$((RESTART_DELAY * 2))
    if [ $RESTART_DELAY -gt $MAX_RESTART_DELAY ]; then
        RESTART_DELAY=$MAX_RESTART_DELAY
    fi
done
