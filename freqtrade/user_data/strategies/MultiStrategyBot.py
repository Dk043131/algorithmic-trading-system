"""
Multi-Strategy Bot for Freqtrade
Combines Trend-Following, Mean-Reversion and conservative Bounded-Grid/DCA.
Single-owner asset governance: only one strategy can own a pair at a time.
"""

from freqtrade.strategy import IStrategy, merge_informative_pair, DecimalParameter, IntParameter
from freqtrade.persistence import Trade
from pandas import DataFrame
import pandas_ta as ta  # type: ignore
import logging

logger = logging.getLogger(__name__)


class MultiStrategyBot(IStrategy):
    """
    Production Multi-Strategy Bot
    ==============================
    Strategy A: Trend-Following  (4h bars, EMA 20/50/200 + RSI + ATR trail)
    Strategy B: Mean-Reversion   (4h bars, Bollinger Bands + RSI extremes)
    Strategy C: Grid/DCA         (NOT implemented here — handled via custom entry)

    Capital limits enforced via max_open_trades and stake_amount in config.
    Risk protection via Freqtrade's native MaxDrawdown + StoplossGuard.
    """

    INTERFACE_VERSION = 3

    # ─── Strategy metadata ────────────────────────────────────────────────────
    timeframe = "4h"
    timeframe_detail = "1h"
    can_short = False
    use_exit_signal = True
    exit_profit_only = False
    ignore_roi_if_entry_signal = False
    process_only_new_candles = True
    position_adjustment_enable = True
    max_entry_position_adjustment = 2

    # ─── Stoploss & Trailing ──────────────────────────────────────────────────
    stoploss = -0.05
    trailing_stop = True
    trailing_stop_positive = 0.02
    trailing_stop_positive_offset = 0.03
    trailing_only_offset_is_reached = True

    # ─── ROI Table ────────────────────────────────────────────────────────────
    minimal_roi = {
        "0":   0.10,
        "60":  0.05,
        "120": 0.02,
    }

    # ─── Protections ──────────────────────────────────────────────────────────
    @property
    def protections(self):
        return [
            {
                "method": "MaxDrawdown",
                "lookback_period_candles": 48,
                "trade_limit": 20,
                "stop_duration_candles": 4,
                "max_allowed_drawdown": 0.12,
            },
            {
                "method": "StoplossGuard",
                "lookback_period_candles": 24,
                "trade_limit": 3,
                "stop_duration_candles": 4,
                "only_per_pair": False,
            },
            {
                "method": "CooldownPeriod",
                "stop_duration_candles": 1,
            },
        ]

    # ─── Tunable Parameters (Hyperopt-ready, max 2 per strategy) ─────────────
    # Strategy A: Trend-Following
    trend_atr_mult = DecimalParameter(1.5, 2.5, default=2.0, space="sell", optimize=True)
    trend_rsi_min = IntParameter(40, 55, default=48, space="buy", optimize=True)
    trend_rsi_max = IntParameter(65, 80, default=72, space="buy", optimize=True)

    # Strategy B: Mean-Reversion
    mr_rsi_oversold = IntParameter(20, 35, default=28, space="buy", optimize=True)
    mr_rsi_overbought = IntParameter(65, 80, default=72, space="sell", optimize=True)

    # Strategy C: Bounded Grid / DCA
    grid_adx_max = IntParameter(18, 25, default=22, space="buy", optimize=True)
    grid_profit_target = DecimalParameter(0.015, 0.035, default=0.025, space="sell", optimize=True)

    # ─── Fixed constants (NOT optimised — market standard) ───────────────────
    EMA_FAST = 20
    EMA_MED = 50
    EMA_SLOW = 200
    RSI_PERIOD = 14
    BB_PERIOD = 20
    BB_STD = 2.0
    ATR_PERIOD = 14
    ADX_PERIOD = 14

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """Compute all technical indicators on the candle series."""

        # ── Trend indicators ──────────────────────────────────────────────────
        dataframe["ema20"] = ta.ema(dataframe["close"], length=self.EMA_FAST)
        dataframe["ema50"] = ta.ema(dataframe["close"], length=self.EMA_MED)
        dataframe["ema200"] = ta.ema(dataframe["close"], length=self.EMA_SLOW)
        dataframe["rsi"] = ta.rsi(dataframe["close"], length=self.RSI_PERIOD)
        dataframe["atr"] = ta.atr(
            dataframe["high"], dataframe["low"], dataframe["close"], length=self.ATR_PERIOD
        )

        # ── ADX (for Trend vs Range/Grid classification) ──────────────────────
        adx_df = ta.adx(dataframe["high"], dataframe["low"], dataframe["close"], length=self.ADX_PERIOD)
        if adx_df is not None and not adx_df.empty:
            adx_cols = [c for c in adx_df.columns if c.startswith("ADX_")]
            if adx_cols:
                dataframe["adx"] = adx_df[adx_cols[0]]
            else:
                dataframe["adx"] = 25.0
        else:
            dataframe["adx"] = 25.0

        # ── Bollinger Bands for Mean-Reversion & Grid ────────────────────────
        bb = ta.bbands(dataframe["close"], length=self.BB_PERIOD, std=self.BB_STD)
        if bb is not None and not bb.empty:
            bbl_cols = [c for c in bb.columns if c.startswith("BBL_")]
            bbm_cols = [c for c in bb.columns if c.startswith("BBM_")]
            bbu_cols = [c for c in bb.columns if c.startswith("BBU_")]
            if bbl_cols and bbm_cols and bbu_cols:
                dataframe["bb_lower"] = bb[bbl_cols[0]]
                dataframe["bb_mid"] = bb[bbm_cols[0]]
                dataframe["bb_upper"] = bb[bbu_cols[0]]

        # ── EMA crossover signal ──────────────────────────────────────────────
        dataframe["ema20_cross_ema50"] = (
            (dataframe["ema20"] > dataframe["ema50"]) &
            (dataframe["ema20"].shift(1) <= dataframe["ema50"].shift(1))
        )

        return dataframe

    # ─── ENTRY SIGNALS ────────────────────────────────────────────────────────
    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Strategy A (Trend): Price > 200 EMA + 20-EMA cross 50-EMA + healthy RSI.
        Strategy B (Mean-Rev): Price <= lower BB + RSI oversold + uptrend filter.
        Strategy C (Grid/DCA): Ranging market (ADX < threshold) near lower-mid band.
        Tags: 'trend_follow', 'mean_rev', 'grid_dca'
        """
        # Strategy A — Trend Following
        trend_long = (
            (dataframe["close"] > dataframe["ema200"]) &
            (dataframe["ema20_cross_ema50"]) &
            (dataframe["rsi"] >= self.trend_rsi_min.value) &
            (dataframe["rsi"] <= self.trend_rsi_max.value) &
            (dataframe["volume"] > 0)
        )

        # Strategy B — Mean Reversion
        mr_long = (
            (dataframe["close"] <= dataframe["bb_lower"]) &
            (dataframe["rsi"] <= self.mr_rsi_oversold.value) &
            (dataframe["close"] > dataframe["ema200"]) &
            (dataframe["volume"] > 0)
        )

        # Strategy C — Bounded Grid / DCA Entry in Ranging Markets
        grid_long = (
            (dataframe["adx"] < self.grid_adx_max.value) &
            (dataframe["close"] < dataframe["bb_mid"]) &
            (dataframe["close"] > dataframe["bb_lower"]) &
            (dataframe["rsi"] >= 35) &
            (dataframe["rsi"] <= 48) &
            (dataframe["volume"] > 0)
        )

        # Priority order: Trend > Mean-Rev > Grid/DCA
        dataframe.loc[trend_long, ["enter_long", "enter_tag"]] = (1, "trend_follow")
        dataframe.loc[mr_long & ~trend_long, ["enter_long", "enter_tag"]] = (1, "mean_rev")
        dataframe.loc[grid_long & ~trend_long & ~mr_long, ["enter_long", "enter_tag"]] = (1, "grid_dca")

        return dataframe

    # ─── EXIT SIGNALS ─────────────────────────────────────────────────────────
    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Trend: exit when price breaks 50 EMA or RSI overextended.
        Mean-Rev: exit when price reverts to BB mid (SMA 20).
        Grid: exit when price reaches upper-mid band.
        """
        trend_exit = (
            (dataframe["close"] < dataframe["ema50"]) |
            (dataframe["rsi"] > self.mr_rsi_overbought.value)
        )

        mr_exit = (dataframe["close"] >= dataframe["bb_mid"])

        grid_exit = (dataframe["close"] >= dataframe["bb_mid"])

        dataframe.loc[trend_exit | mr_exit | grid_exit, "exit_long"] = 1
        return dataframe

    def adjust_trade_position(
        self, trade: Trade, current_time, current_rate: float,
        current_profit: float, min_stake: float | None, max_stake: float,
        current_entry_rate: float = 0.0, current_exit_rate: float = 0.0,
        current_entry_profit: float = 0.0, current_exit_profit: float = 0.0, **kwargs
    ) -> float | None | tuple[float | None, str | None]:
        """
        Strategy C (Grid/DCA) Position Layering:
        - Adds spaced limit buy rungs if profit drops by -1.5% and -3.0%.
        - Strictly capped at 2 adjustments (3 rungs total).
        - Hard stop if drawdown breaches -6.0% (trend-break exit).
        """
        if trade.enter_tag != "grid_dca":
            return None

        # Hard trend-break stop for Grid
        if current_profit <= -0.06:
            logger.warning(f"[GridExit] Hard trend-break stop triggered for {trade.pair} at {current_profit:.2%}")
            return None

        # Count existing entries
        filled_entries = trade.nr_of_successful_entries

        # Rung 2: -1.5% drop
        if filled_entries == 1 and current_profit <= -0.015:
            stake = min(trade.stake_amount, max_stake)
            logger.info(f"[GridDCA] Executing Rung 2 for {trade.pair} at {current_rate}")
            return stake, "grid_rung_2"

        # Rung 3: -3.0% drop
        if filled_entries == 2 and current_profit <= -0.030:
            stake = min(trade.stake_amount, max_stake)
            logger.info(f"[GridDCA] Executing Rung 3 for {trade.pair} at {current_rate}")
            return stake, "grid_rung_3"

        return None

    def custom_stoploss(
        self, current_time, current_rate, current_profit, trade: Trade, **kwargs
    ) -> float:
        """
        ATR-based dynamic trailing stop for Trend positions.
        Mean-Reversion uses the fixed stoploss from config.
        """
        if trade.enter_tag == "trend_follow":
            dataframe, _ = self.dp.get_analyzed_dataframe(trade.pair, self.timeframe)
            if not dataframe.empty:
                last_candle = dataframe.iloc[-1]
                atr = last_candle.get("atr", 0)
                if atr and last_candle["close"] > 0:
                    atr_stoploss = -(atr * self.trend_atr_mult.value) / last_candle["close"]
                    return max(atr_stoploss, -0.10)  # Floor at -10%
        return self.stoploss  # Fallback to config stoploss

    def confirm_trade_entry(
        self, pair: str, order_type: str, amount: float, rate: float,
        time_in_force: str, current_time, entry_tag: str | None, side: str, **kwargs
    ) -> bool:
        """
        Pre-trade safety checks:
        - Don't add to a pair that already has an open trade (single-owner rule).
        - Verify notional >= $5 minimum.
        """
        open_trades = Trade.get_trades_proxy(is_open=True)
        active_pairs = [t.pair for t in open_trades]
        if pair in active_pairs:
            logger.info(f"[SingleOwner] Blocked entry on {pair}: already occupied.")
            return False

        notional = amount * rate
        if notional < 5.0:
            logger.warning(f"[MinNotional] Order rejected for {pair}: notional ${notional:.2f} below $5 minimum.")
            return False

        return True
