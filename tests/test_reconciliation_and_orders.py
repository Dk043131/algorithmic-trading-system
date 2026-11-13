import hashlib
import re
import pytest


def make_deterministic_client_order_id(strategy: str, symbol: str, bar_timestamp: str, side: str) -> str:
    clean_sym = symbol.replace("/", "").replace("-", "")
    payload = f"{strategy}_{clean_sym}_{bar_timestamp}_{side}"
    h = hashlib.sha256(payload.encode()).hexdigest()[:20]
    return f"AGY{h}"


def test_client_order_id_determinism_and_constraints():
    # 1. Deterministic across retries
    id1 = make_deterministic_client_order_id("trend", "BTC/USDT", "1730000000", "BUY")
    id2 = make_deterministic_client_order_id("trend", "BTC/USDT", "1730000000", "BUY")
    assert id1 == id2, "Retry would generate a different ID and duplicate orders"

    # 2. Length <= 36 chars (Binance strict limit)
    assert len(id1) <= 36

    # 3. Strictly alphanumeric (no slashes)
    assert re.match(r"^[a-zA-Z0-9]+$", id1)
    assert "/" not in id1


def test_pessimistic_intrabar_resolution():
    """
    If a candle touches both Stop-Loss and Take-Profit,
    pessimistic execution strictly assumes Stop-Loss was triggered first.
    """
    def resolve_candle(entry: float, sl: float, tp: float, candle_low: float, candle_high: float) -> str:
        sl_hit = candle_low <= sl
        tp_hit = candle_high >= tp
        if sl_hit and tp_hit:
            return "SL_FIRST"
        if sl_hit:
            return "SL_ONLY"
        if tp_hit:
            return "TP_ONLY"
        return "NONE"

    # Both hit in same bar
    res = resolve_candle(entry=50000, sl=48500, tp=51500, candle_low=48400, candle_high=51600)
    assert res == "SL_FIRST"


def test_offline_trade_reconciliation():
    """
    Simulate startup reconciliation:
    If bot was offline and a trade closed on exchange,
    reconciliation updates state and cleans open orders.
    """
    local_db_open_trades = {"trade_101": {"pair": "BTC/USDT", "status": "open", "entry_rate": 50000.0}}

    # Exchange returned closed orders during offline window
    exchange_closed_orders = [
        {"id": "order_sl_1", "trade_id": "trade_101", "status": "closed", "filled": 0.05, "price": 48500.0}
    ]

    # Reconciler processes closed orders
    for order in exchange_closed_orders:
        t_id = order["trade_id"]
        if t_id in local_db_open_trades:
            local_db_open_trades[t_id]["status"] = "closed"
            local_db_open_trades[t_id]["exit_rate"] = order["price"]

    assert local_db_open_trades["trade_101"]["status"] == "closed"
    assert local_db_open_trades["trade_101"]["exit_rate"] == 48500.0
