---
name: tradesync
description: "AI-Trader real-time signal and position synchronization engine for Indian equity and global markets, supporting multi-agent consensus broadcasting, automated order reconciliation, and Groww statutory fee calculation."
---

# TradeSync: Real-Time Signal & Portfolio Synchronization Skill

Inspired by **HKUDS/AI-Trader** (`https://github.com/HKUDS/AI-Trader/blob/main/skills/tradesync/SKILL.md`) and institutional multi-agent trading benchmarks (`https://github.com/topics/stock-analysis-ai`).

TradeSync empowers the AI Trading Assistant to act as an autonomous Signal Provider and Position Synchronizer. It captures, formats, and broadcasts live trading decisions, position states, fee breakdowns, and closed trade outcomes across local dashboards, external API endpoints, and real-time Telegram channels.

---

## 1. Core Capabilities

1. **Multi-Agent Consensus Broadcast:**
   - Synchronizes consensus decisions reached by the 4-desk committee (Technical Desk, Quant Risk Desk, Macro Catalyst Desk, CIO Desk).
   - Formats transparent rationales including Minervini VCP scores, PTJ 200 EMA status, volume surge multiples, and sector momentum.

2. **Precision +5.0% Net Profit Target Synchronization:**
   - Every BUY signal is synchronized with an exact statutory Groww fee breakdown.
   - Computes and syncs:
     - `target_net_price`: The exact NSE limit/market price yielding $\ge +5.0\%$ NET profit in pocket after brokerage, STT, exchange turnover, SEBI, GST, and stamp duty.
     - `breakeven_price`: The exact zero-loss price covering 100% of roundtrip fees.
     - `stop_loss_price`: ATR volatility defense stop (-1.8% to -2.0% max loss).

3. **Autonomous Holding & Trailing State Machine:**
   - Monitors active positions 24/7 without arbitrary time-decay exits.
   - Emits real-time state transitions:
     - `BREAKEVEN_DEFENSE_LOCKED`: When price crosses breakeven (+0.2% buffer), ratchets stop-loss to ensure zero capital loss.
     - `PROFIT_RATCHET_35`: When price hits +3.5% net, ratchets stop-loss to +2.5% net.
     - `PROFIT_HARVEST_50`: When price hits $\ge +5.0\%$ net, executes harvest sell.

4. **Institutional Order Ledger & Audit Logging:**
   - Maintains transactional records in JSONL format (`tradesync_log.jsonl`).
   - Syncs order executions directly with Groww broker adapters and local React dashboard terminals.

---

## 2. Signal Schema

Standard real-time signal payload:

```json
{
  "event_type": "TRADE_SIGNAL",
  "symbol": "PNB.NS",
  "action": "BUY",
  "price": 125.00,
  "shares": 20,
  "invested_capital_inr": 2500.00,
  "target_net_pct": 5.0,
  "target_price": 133.90,
  "breakeven_price": 127.65,
  "stop_loss_price": 122.75,
  "estimated_roundtrip_fees_inr": 52.94,
  "consensus_score": 89.5,
  "decision": "STRONG_BUY",
  "committee_narrative": [
    "CIO Verdict: STRONG_BUY with 89.5% Consensus Conviction",
    "Technical Desk: Minervini High-Quality VCP (88.5/100)",
    "Quant Risk Desk: Net +5.0% Target ₹133.90 | Fees ₹52.94",
    "Macro Catalyst Desk: Banking Momentum | 1.65x Volume Surge"
  ],
  "timestamp": "2026-11-06T16:52:43Z"
}
```

---

## 3. Integration Endpoints

- `GET /api/tradesync/signals`: Returns the latest active signals with consensus rationale.
- `GET /api/tradesync/positions`: Synchronizes current live open positions with trailing stop states.
- `GET /api/tradesync/history`: Returns historical closed trades with verified net PnL after Groww charges.
- `POST /api/tradesync/broadcast`: Broadcasts manual or autonomous trade events to connected webhooks and Telegram.
