import ccxt
import pytest


def test_binance_public_ticker():
    """Verify live connectivity to Binance public endpoints via CCXT."""
    exchange = ccxt.binance({"enableRateLimit": True, "options": {"defaultType": "spot"}})
    ticker = exchange.fetch_ticker("BTC/USDT")
    assert ticker is not None
    assert "last" in ticker
    assert ticker["last"] > 1000.0  # Sanity check BTC price


def test_binance_market_limits():
    """Verify that market rules and precision are loaded properly."""
    exchange = ccxt.binance({"enableRateLimit": True, "options": {"defaultType": "spot"}})
    markets = exchange.load_markets()

    for pair in ["BTC/USDT", "ETH/USDT", "SOL/USDT"]:
        assert pair in markets
        m = markets[pair]
        assert "limits" in m
        assert "cost" in m["limits"]
        min_cost = m["limits"]["cost"].get("min", 0)
        assert min_cost > 0  # e.g., $5.0
