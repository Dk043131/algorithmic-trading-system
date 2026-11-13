"""
Unit Tests for HKUDS Multi-Agent Committee, TradeSync, and Groww Net +5% Engine
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from ai_engine.groww_fee_engine import GrowwFeeCalculator, GrowwCapitalDefenseGatekeeper
from ai_engine.consensus_committee import investment_committee
from ai_engine.skills.tradesync.tradesync_engine import TradeSyncEngine
from ai_engine.stock_trader import UniversalStockEngine


def test_groww_fee_net_5_percent_solver():
    """Verify that solve_target_price_for_net_profit calculates a sell price that yields >= 5.0% NET profit."""
    buy_price = 100.0
    shares = 25.0  # ₹2500 capital
    target_net_pct = 5.0

    sol = GrowwFeeCalculator.solve_target_price_for_net_profit(
        buy_price=buy_price,
        shares=shares,
        target_net_pct=target_net_pct,
        product="CNC"
    )

    target_price = sol["target_price"]
    assert target_price > buy_price
    assert sol["net_profit_inr"] >= (buy_price * shares * (target_net_pct / 100.0)) - 0.50  # within tick margin
    assert sol["actual_net_pct"] >= 5.0
    assert sol["total_statutory_fees_inr"] > 0
    assert "brokerage" in sol["fee_breakdown"]
    assert "stt" in sol["fee_breakdown"]


def test_groww_breakeven_solver():
    """Verify that solve_breakeven_price yields a sell price where net PnL >= 0.00 INR."""
    buy_price = 200.0
    shares = 25.0  # ₹5000 capital

    sol = GrowwFeeCalculator.solve_breakeven_price(buy_price=buy_price, shares=shares, product="CNC")
    be_price = sol["breakeven_price"]

    assert be_price > buy_price
    assert sol["net_pnl_inr"] >= -0.10  # tick size margin
    assert sol["breakeven_gain_pct"] > 0


def test_groww_capital_defense_gatekeeper():
    """Verify that the gatekeeper blocks unprofitable micro trades and permits safe capital."""
    # Micro capital (₹150) should be blocked because of excessive fee drag
    safe, msg, _ = GrowwCapitalDefenseGatekeeper.validate_trade_viability(
        amount_inr=150.0,
        target_gain_pct=5.0
    )
    assert safe is False
    assert "safe minimum" in msg or "Fee drag" in msg

    # Viable capital (₹3,000) should pass
    safe_ok, msg_ok, _ = GrowwCapitalDefenseGatekeeper.validate_trade_viability(
        amount_inr=3000.0,
        target_gain_pct=5.0
    )
    assert safe_ok is True


def test_hkuds_investment_committee_consensus():
    """Verify that the 4-agent committee produces valid consensus decisions and rationales."""
    test_ind = {
        "rsi": 54.0,
        "atr": 3.2,
        "ema9": 155.0,
        "ema21": 150.0,
        "ema50": 140.0,
        "ema200": 130.0,
        "vcp_score": 85.0,
        "vol_surge": 1.75,
        "bb_pct": 0.60
    }

    res = investment_committee.evaluate_investment_candidate(
        symbol="IRFC.NS",
        price=150.0,
        shares=20.0,
        indicators=test_ind,
        sector="Infrastructure",
        catalyst="Railway Modernization CapEx",
        available_balance_inr=3000.0,
        target_net_pct=5.0
    )

    assert "consensus_score" in res
    assert 0 <= res["consensus_score"] <= 100
    assert res["decision"] in ["STRONG_BUY", "ACCUMULATE_ON_DIP", "HOLD / NEUTRAL", "AVOID"]
    assert "technical" in res["agents"]
    assert "quant_risk" in res["agents"]
    assert "macro_catalyst" in res["agents"]
    assert res["execution_plan"]["target_net_pct"] == 5.0
    assert res["execution_plan"]["target_net_price"] > 150.0


def test_tradesync_logging(tmp_path):
    """Verify that TradeSync correctly records and retrieves audit events."""
    log_file = tmp_path / "test_tradesync.jsonl"
    engine = TradeSyncEngine(log_path=str(log_file))

    engine.log_event("TEST_EVENT", {"symbol": "PNB.NS", "action": "TEST"})
    engine.broadcast_breakeven_locked("PNB.NS", 128.0, 125.0, 127.5, 2.4)

    recent = engine.get_recent_signals(5)
    assert len(recent) == 2
    assert recent[0]["event_type"] == "BREAKEVEN_LOCKED"
    assert recent[1]["event_type"] == "TEST_EVENT"


def test_stock_engine_net_profit_holding_and_exit():
    """Verify that UniversalStockEngine sets up net +5% target and ratchets breakeven."""
    engine = UniversalStockEngine()
    engine.state["cash_usd"] = 100.0  # ~₹8600
    initial_open = len(engine.state.get("open_positions", []))

    # Buy 20 shares of PNB.NS
    res = engine.buy_stock("PNB.NS", shares=20, auto=False)
    assert res["success"] is True

    pos = res["position"]
    assert pos["symbol"] == "PNB.NS"
    assert pos["target_net_pct"] == 5.0
    assert pos["target_price"] > pos["entry_price"]
    assert pos["breakeven_price"] > pos["entry_price"]
    assert pos["target_price"] > pos["breakeven_price"]

    # Test sell realizing true net profit
    sell_res = engine.sell_stock(pos["id"], reason="Test Sell")
    assert sell_res["success"] is True
    assert "gain_inr" in sell_res["closed_trade"]
    assert "statutory_fees_inr" in sell_res["closed_trade"]
