"""
TradeSync Engine for Indian Stock Trading Bot
=============================================
Manages real-time signal broadcasting, position state synchronization,
and institutional audit logging inspired by HKUDS/AI-Trader.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger("TradeSync")

LOG_FILE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "tradesync_log.jsonl")


class TradeSyncEngine:
    def __init__(self, log_path: str = LOG_FILE_PATH):
        self.log_path = os.path.abspath(log_path)
        self.signals_buffer: List[Dict[str, Any]] = []
        self._ensure_log_file()

    def _ensure_log_file(self):
        os.makedirs(os.path.dirname(self.log_path), exist_ok=True)
        if not os.path.exists(self.log_path):
            with open(self.log_path, "w", encoding="utf-8") as f:
                pass

    def log_event(self, event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Record an event to the persistent TradeSync JSONL ledger."""
        record = {
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "event_type": event_type,
            "data": data
        }
        try:
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(record) + "\n")
        except Exception as e:
            logger.error(f"Failed to append to TradeSync log: {e}")

        # Maintain buffer of last 50 events in memory
        self.signals_buffer.insert(0, record)
        if len(self.signals_buffer) > 50:
            self.signals_buffer = self.signals_buffer[:50]

        return record

    def broadcast_buy_signal(
        self,
        symbol: str,
        price: float,
        shares: float,
        consensus_packet: Dict[str, Any],
        live_order_status: str = "SIMULATED",
        groww_order_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Broadcasts and logs a high-conviction BUY signal."""
        exec_plan = consensus_packet.get("execution_plan", {})
        payload = {
            "symbol": symbol,
            "action": "BUY",
            "entry_price": price,
            "shares": shares,
            "invested_capital_inr": exec_plan.get("invested_capital_inr", price * shares),
            "target_net_pct": exec_plan.get("target_net_pct", 5.0),
            "target_net_price": exec_plan.get("target_net_price", round(price * 1.07, 2)),
            "target_net_profit_inr": exec_plan.get("target_net_profit_inr", 0.0),
            "breakeven_price": exec_plan.get("breakeven_price", round(price * 1.02, 2)),
            "stop_loss_price": exec_plan.get("stop_loss_price", round(price * 0.982, 2)),
            "estimated_roundtrip_fees_inr": exec_plan.get("estimated_roundtrip_fees_inr", 0.0),
            "risk_reward_ratio": exec_plan.get("risk_reward_ratio", 2.5),
            "consensus_score": consensus_packet.get("consensus_score", 80.0),
            "decision": consensus_packet.get("decision", "STRONG_BUY"),
            "live_order_status": live_order_status,
            "groww_order_id": groww_order_id,
            "committee_narrative": consensus_packet.get("committee_narrative", [])
        }
        return self.log_event("BUY_SIGNAL", payload)

    def broadcast_breakeven_locked(
        self,
        symbol: str,
        current_price: float,
        entry_price: float,
        breakeven_price: float,
        gain_pct: float
    ) -> Dict[str, Any]:
        """Logs zero-risk breakeven defense activation."""
        payload = {
            "symbol": symbol,
            "current_price": current_price,
            "entry_price": entry_price,
            "breakeven_price": breakeven_price,
            "unrealized_gain_pct": gain_pct,
            "status": "ZERO_RISK_LOCKED"
        }
        return self.log_event("BREAKEVEN_LOCKED", payload)

    def broadcast_profit_harvest(
        self,
        symbol: str,
        entry_price: float,
        exit_price: float,
        shares: float,
        net_profit_inr: float,
        net_pct: float,
        statutory_fees_inr: float,
        groww_order_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Logs +5.0% Net Profit Target Harvest."""
        payload = {
            "symbol": symbol,
            "entry_price": entry_price,
            "exit_price": exit_price,
            "shares": shares,
            "net_profit_inr": net_profit_inr,
            "net_pct": net_pct,
            "statutory_fees_inr": statutory_fees_inr,
            "groww_order_id": groww_order_id,
            "status": "HARVEST_EXIT"
        }
        return self.log_event("PROFIT_HARVEST", payload)

    def get_recent_signals(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Returns the most recent TradeSync records."""
        if self.signals_buffer:
            return self.signals_buffer[:limit]

        events = []
        if os.path.exists(self.log_path):
            try:
                with open(self.log_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            events.append(json.loads(line.strip()))
            except Exception:
                pass
        events.reverse()
        return events[:limit]


# Global TradeSync Engine Instance
tradesync = TradeSyncEngine()
