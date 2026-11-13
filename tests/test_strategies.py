import pandas as pd
import numpy as np
import pytest
import sys
import os

# Add strategy path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../freqtrade/user_data/strategies")))
from MultiStrategyBot import MultiStrategyBot
from AutonomousAIDailyBot import AutonomousAIDailyBot


@pytest.fixture
def strategy_instance():
    # Instantiate strategy with default config
    bot = MultiStrategyBot(config={})
    return bot


def test_strategy_a_trend_following_signal(strategy_instance):
    """
    Synthesize an uptrend breakout:
    - Price above EMA 200
    - EMA 20 crosses above EMA 50
    - RSI healthy (48-70)
    """
    n = 260
    c = np.full(n, 50000.0)
    c[200:225] = np.linspace(50000, 48000, 25)
    c[225:240] = np.linspace(48000, 49800, 15)
    c[240:243] = [49700, 49600, 49700]  # Pause keeps RSI in healthy zone
    c[243:260] = np.linspace(49800, 52000, 17)

    df = pd.DataFrame({"open": c, "high": c + 50, "low": c - 50, "close": c, "volume": np.full(n, 1000.0)})
    df = strategy_instance.populate_indicators(df, metadata={"pair": "BTC/USDT"})
    df = strategy_instance.populate_entry_trend(df, metadata={"pair": "BTC/USDT"})

    # Check that trend_follow signal was generated
    trend_entries = df[df["enter_tag"] == "trend_follow"]
    assert len(trend_entries) > 0, "Strategy A (Trend) failed to generate signal during uptrend breakout"


def test_strategy_b_mean_reversion_signal(strategy_instance):
    """
    Synthesize a mean-reversion dip in an uptrend:
    - Base price > EMA 200
    - Sharp flash crash candle that pierces below lower Bollinger Band with RSI <= 28
    """
    n = 260
    # Gentle uptrend
    close = np.linspace(50000, 60000, n)
    high = close + 100
    low = close - 100
    open_ = close
    volume = np.full(n, 500.0)

    # Inject sharp 4-bar pullback at the end
    close[-4:] = [57000, 54000, 51000, 49000]
    high[-4:] = close[-4:] + 50
    low[-4:] = close[-4:] - 200
    open_[-4:] = close[-4:] + 100

    df = pd.DataFrame({"open": open_, "high": high, "low": low, "close": close, "volume": volume})
    df = strategy_instance.populate_indicators(df, metadata={"pair": "BTC/USDT"})
    df = strategy_instance.populate_entry_trend(df, metadata={"pair": "BTC/USDT"})

    mr_entries = df[df["enter_tag"] == "mean_rev"]
    assert len(mr_entries) > 0, "Strategy B (Mean Reversion) failed to generate signal on oversold dip"


def test_strategy_c_grid_dca_adjustment(strategy_instance):
    """
    Verify Strategy C position adjustment:
    - Rung 2 triggered at -1.5% profit
    - Rung 3 triggered at -3.0% profit
    - Max adjustments = 2 (total 3 rungs)
    - Hard stop triggered if drawdown hits -6%
    """
    class MockTrade:
        enter_tag = "grid_dca"
        pair = "BTC/USDT"
        stake_amount = 100.0
        nr_of_successful_entries = 1

    trade = MockTrade()

    # Case 1: Drop is small (-0.5%) -> No adjustment
    adj = strategy_instance.adjust_trade_position(
        trade=trade, current_time=None, current_rate=49750,
        current_profit=-0.005, min_stake=10.0, max_stake=500.0
    )
    assert adj is None

    # Case 2: Drop reaches -1.5% -> Trigger Rung 2
    adj = strategy_instance.adjust_trade_position(
        trade=trade, current_time=None, current_rate=49250,
        current_profit=-0.015, min_stake=10.0, max_stake=500.0
    )
    assert adj is not None
    stake, tag = adj
    assert tag == "grid_rung_2"
    assert stake == 100.0

    # Case 3: Rung 2 already filled, drop reaches -3.0% -> Trigger Rung 3
    trade.nr_of_successful_entries = 2
    adj = strategy_instance.adjust_trade_position(
        trade=trade, current_time=None, current_rate=48500,
        current_profit=-0.030, min_stake=10.0, max_stake=500.0
    )
    assert adj is not None
    stake, tag = adj
    assert tag == "grid_rung_3"

    # Case 4: Max 2 adjustments reached (entries = 3) -> No more adjustments allowed
    trade.nr_of_successful_entries = 3
    adj = strategy_instance.adjust_trade_position(
        trade=trade, current_time=None, current_rate=48000,
        current_profit=-0.040, min_stake=10.0, max_stake=500.0
    )
    assert adj is None

    # Case 5: Deep breakdown (-6.5%) -> Hard stop (returns None, triggers exit)
    adj = strategy_instance.adjust_trade_position(
        trade=trade, current_time=None, current_rate=46500,
        current_profit=-0.065, min_stake=10.0, max_stake=500.0
    )
    assert adj is None


def test_autonomous_ai_volume_surge_and_defense_mode():
    """
    Test AutonomousAIDailyBot:
    1. Volume surge triggers ai_vol_surge entry under normal conditions.
    2. When macro defense mode activates (e.g. BTC dumps > 2%), entry is suppressed.
    """
    ai_bot = AutonomousAIDailyBot(config={})
    n = 260
    c = np.full(n, 100.0)
    for i in range(1, n):
        drift = 0.02
        noise = 0.15 if i % 2 == 0 else -0.12
        c[i] = c[i - 1] + drift + noise

    # At candle 252, create clean upward breakout
    c[252] = c[251] + 0.5
    high = c + 0.3
    low = c - 0.3
    open_ = c - 0.1
    open_[252] = c[251]
    vol = np.full(n, 1000.0)
    vol[252] = 2500.0

    df = pd.DataFrame({"open": open_, "high": high, "low": low, "close": c, "volume": vol})
    df = ai_bot.populate_indicators(df, metadata={"pair": "SOL/USDT"})
    df = ai_bot.populate_entry_trend(df, metadata={"pair": "SOL/USDT"})

    # Check that normal conditions trigger entry
    surge_entries = df[df["enter_tag"] == "ai_vol_surge"]
    assert len(surge_entries) > 0, "Autonomous AI failed to generate ai_vol_surge signal on volume breakout"

    # Now simulate Defense Mode activation (e.g. BTC flash crash)
    df_crash = pd.DataFrame({"open": open_, "high": high, "low": low, "close": c, "volume": vol})
    df_crash = ai_bot.populate_indicators(df_crash, metadata={"pair": "SOL/USDT"})
    df_crash["defense_mode"] = True  # Macro Defense Active
    df_crash = ai_bot.populate_entry_trend(df_crash, metadata={"pair": "SOL/USDT"})

    crash_surges = df_crash[df_crash["enter_tag"] == "ai_vol_surge"]
    assert len(crash_surges) == 0, "Auto-Defense Mode failed to suppress risky breakout entries during market crash"

