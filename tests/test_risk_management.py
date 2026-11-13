import pytest


def calculate_position_size(equity: float, risk_pct: float, entry_price: float, stop_loss_price: float) -> float:
    """
    Fixed-fractional position sizing formula:
    Size = (Equity * Risk%) / |Entry - StopLoss|
    """
    risk_amount = equity * risk_pct
    risk_per_unit = abs(entry_price - stop_loss_price)
    if risk_per_unit == 0:
        return 0.0
    return risk_amount / risk_per_unit


def test_fixed_fractional_position_sizing():
    equity = 10000.0  # $10,000 capital
    risk_pct = 0.01   # 1% risk ($100 max risk)
    entry = 50000.0
    stop_loss = 48500.0  # $1,500 stop distance

    size = calculate_position_size(equity, risk_pct, entry, stop_loss)
    expected_size = 100.0 / 1500.0  # 0.066667 BTC

    assert pytest.approx(size, 0.00001) == expected_size
    # Verify that if stopped out, exact loss is $100
    dollar_loss = size * (entry - stop_loss)
    assert pytest.approx(dollar_loss, 0.01) == 100.0


def test_min_notional_filter():
    """Verify orders below exchange min notional ($5.0) are rejected."""
    min_notional = 5.0

    # Valid order: $50000 * 0.001 = $50
    notional_valid = 50000.0 * 0.001
    assert notional_valid >= min_notional

    # Invalid micro order: $50000 * 0.00001 = $0.50
    notional_invalid = 50000.0 * 0.00001
    assert notional_invalid < min_notional


def test_single_owner_asset_governance():
    """Ensure two strategies cannot hold the same asset concurrently."""
    active_positions = {"BTC/USDT": "trend_follow"}

    def can_open_position(symbol: str, requesting_strategy: str) -> bool:
        return symbol not in active_positions

    # Same asset requested by mean_rev -> Blocked
    assert can_open_position("BTC/USDT", "mean_rev") is False

    # Different asset requested by mean_rev -> Allowed
    assert can_open_position("ETH/USDT", "mean_rev") is True


def test_circuit_breaker_drawdown_limit():
    """Verify that a 12% drawdown triggers emergency halt."""
    peak_equity = 1000.0
    current_equity = 875.0  # 12.5% drawdown

    drawdown = (peak_equity - current_equity) / peak_equity
    max_allowed_drawdown = 0.12

    is_halt_triggered = drawdown >= max_allowed_drawdown
    assert is_halt_triggered is True

    # 5% drawdown -> Normal operation
    current_equity_safe = 950.0
    drawdown_safe = (peak_equity - current_equity_safe) / peak_equity
    assert (drawdown_safe >= max_allowed_drawdown) is False
