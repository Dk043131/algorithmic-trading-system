"""
Unit tests for DK's TRADE Stock Trading & Autonomous Brokerage Engine
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from ai_engine.stock_trader import StockTradingEngine, STOCKS_UNIVERSE

def test_stock_universe_definitions():
    """Verify core US and Indian equities are registered with valid risk parameters."""
    for sym in ["NVDA", "AAPL", "RELIANCE.NS", "TCS.NS", "SPY"]:
        assert sym in STOCKS_UNIVERSE
        meta = STOCKS_UNIVERSE[sym]
        assert meta["target_gain_pct"] > 0
        assert meta["stop_loss_pct"] > 0
        assert meta["base_price"] > 0
        assert "strategy" in meta

def test_stock_buy_and_sell_cycle():
    """Verify buy stock order creation, portfolio balance deduction, and sell realization."""
    engine = StockTradingEngine()
    engine.state["cash_usd"] = max(1000.0, engine.state.get("cash_usd", 1000.0))
    initial_cash = engine.state["cash_usd"]
    
    # Test Buy Order
    res_buy = engine.buy_stock("NVDA", shares=2, strategy="Test AI Breakout", auto=False)
    assert res_buy["success"] is True
    assert "position" in res_buy
    pos = res_buy["position"]
    assert pos["symbol"] == "NVDA"
    assert pos["shares"] == 2
    assert engine.state["cash_usd"] < initial_cash
    
    # Test Sell Order
    res_sell = engine.sell_stock(pos["id"], reason="Test Profit Exit")
    assert res_sell["success"] is True
    assert "closed_trade" in res_sell
    assert res_sell["closed_trade"]["shares"] == 2
    assert len([p for p in engine.state["open_positions"] if p["id"] == pos["id"]]) == 0

def test_stock_portfolio_summary_integrity():
    """Verify portfolio summary calculations (USD & INR conversion with live FX)."""
    engine = StockTradingEngine()
    summary = engine.get_portfolio_summary()
    assert "cash_usd" in summary
    assert "cash_inr" in summary
    fx = summary.get("usd_to_inr", 84.0)
    assert summary["cash_inr"] == round(summary["cash_usd"] * fx, 2)
    assert "open_positions" in summary
    assert "universe" in summary
