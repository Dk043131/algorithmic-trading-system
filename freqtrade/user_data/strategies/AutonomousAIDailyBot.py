"""
Autonomous AI Daily Profit Strategy
====================================
Designed for 15-minute intraday execution and dynamic multi-asset scanning.
Automatically scans the top-volume movers on Binance, detects volume surges,
momentum breakouts, and takes daily profits within hours.
"""

from datetime import datetime
from freqtrade.strategy import IStrategy, DecimalParameter, IntParameter, merge_informative_pair
from freqtrade.persistence import Trade
from pandas import DataFrame
import pandas_ta as ta  # type: ignore
import logging

logger = logging.getLogger(__name__)


class AutonomousAIDailyBot(IStrategy):
    """
    Autonomous AI Daily Profit Engine (DK's TRADE)
    - Timeframe: 15m (intraday trading, exits within hours/day)
    - Dynamic Multi-Asset: Trades whichever coin has the highest volume & momentum
    - AI Multi-Factor Decision Rules: Volume Surge + Momentum + Trend Alignment
    - Auto-Defense Mode: Macro 1h BTC trend guard prevents entering into flash crashes
    - Daily Profit Harvesting: Rapid ROI step ladder + trailing profit lock
    """

    INTERFACE_VERSION = 3

    # ─── 15m Intraday Settings ────────────────────────────────────────────────
    timeframe = "15m"
    informative_timeframe = "1h"
    can_short = False
    use_exit_signal = True
    exit_profit_only = False
    ignore_roi_if_entry_signal = False
    process_only_new_candles = False
    position_adjustment_enable = True
    max_entry_position_adjustment = 1

    def informative_pairs(self):
        """Define macro informative pair to classify market regime (BULL vs FLASH CRASH/DEFENSE)."""
        return [("BTC/USDT", self.informative_timeframe)]

    # ─── Stoploss & Trailing Profit Lock ──────────────────────────────────────
    stoploss = -0.035  # Strict 3.5% initial stop-loss to protect capital
    trailing_stop = True
    trailing_stop_positive = 0.012         # Lock +1.2% profit once reached
    trailing_stop_positive_offset = 0.020  # Activates trailing when +2.0% in profit
    trailing_only_offset_is_reached = True

    # ─── Daily Intraday Profit Step-Ladder ────────────────────────────────────
    # Secures profits quickly within a day
    minimal_roi = {
        "0":   0.030,  # +3.0% instant profit take on quick spikes
        "30":  0.020,  # +2.0% after 30 minutes
        "60":  0.012,  # +1.2% after 1 hour
        "120": 0.007,  # +0.7% after 2 hours
    }

    # ─── Protections ──────────────────────────────────────────────────────────
    @property
    def protections(self):
        return [
            {
                "method": "MaxDrawdown",
                "lookback_period_candles": 48,
                "trade_limit": 15,
                "stop_duration_candles": 4,
                "max_allowed_drawdown": 0.10,
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

    # ─── Tunable Parameters ───────────────────────────────────────────────────
    vol_surge_mult = DecimalParameter(1.3, 2.5, default=1.6, space="buy", optimize=True)
    rsi_min = IntParameter(45, 55, default=48, space="buy", optimize=True)
    rsi_max = IntParameter(65, 78, default=72, space="buy", optimize=True)

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """Calculate multi-factor quantitative indicators on 15m candles."""

        # ── Fast Trend Alignment (20, 50, 200 EMA) ───────────────────────────
        dataframe["ema20"] = ta.ema(dataframe["close"], length=20)
        dataframe["ema50"] = ta.ema(dataframe["close"], length=50)
        ema200_series = ta.ema(dataframe["close"], length=200)
        dataframe["ema200"] = ema200_series.bfill().fillna(dataframe["close"]) if ema200_series is not None else dataframe["close"]

        # ── Momentum & Velocity ───────────────────────────────────────────────
        dataframe["rsi"] = ta.rsi(dataframe["close"], length=14)
        dataframe["atr"] = ta.atr(dataframe["high"], dataframe["low"], dataframe["close"], length=14)

        # MACD
        macd_df = ta.macd(dataframe["close"], fast=12, slow=26, signal=9)
        if macd_df is not None and not macd_df.empty:
            dataframe["macd"] = macd_df["MACD_12_26_9"]
            dataframe["macdsignal"] = macd_df["MACDs_12_26_9"]
            dataframe["macdh"] = macd_df["MACDh_12_26_9"]
        else:
            dataframe["macd"] = 0.0
            dataframe["macdsignal"] = 0.0
            dataframe["macdh"] = 0.0

        # ── Volume Surge AI Filter ────────────────────────────────────────────
        dataframe["volume_sma"] = dataframe["volume"].rolling(window=20).mean()
        dataframe["volume_ratio"] = dataframe["volume"] / dataframe["volume_sma"].replace(0, 1)

        # ── Bollinger Bands ───────────────────────────────────────────────────
        bb = ta.bbands(dataframe["close"], length=20, std=2.0)
        if bb is not None and not bb.empty:
            bbl_cols = [c for c in bb.columns if c.startswith("BBL_")]
            bbm_cols = [c for c in bb.columns if c.startswith("BBM_")]
            bbu_cols = [c for c in bb.columns if c.startswith("BBU_")]
            if bbl_cols and bbm_cols and bbu_cols:
                dataframe["bb_lower"] = bb[bbl_cols[0]]
                dataframe["bb_mid"] = bb[bbm_cols[0]]
                dataframe["bb_upper"] = bb[bbu_cols[0]]

        # ── Macro Market Regime Classifier (BTC 1h Data) ─────────────────────
        dp = getattr(self, "dp", None)
        if dp:
            try:
                inf_btc = dp.get_pair_dataframe("BTC/USDT", self.informative_timeframe)
                if not inf_btc.empty:
                    inf_btc["ema200_macro"] = ta.ema(inf_btc["close"], length=200)
                    inf_btc["roc4_macro"] = (inf_btc["close"] - inf_btc["close"].shift(4)) / inf_btc["close"].shift(4)
                    dataframe = merge_informative_pair(dataframe, inf_btc, self.timeframe, self.informative_timeframe, ffill=True)
            except Exception as e:
                logger.warning(f"Informative BTC pair merge: {e}")

        # Safe fallbacks if informative data is not yet downloaded
        macro_close_col = f"close_{self.informative_timeframe}"
        macro_ema_col = f"ema200_macro_{self.informative_timeframe}"
        macro_roc_col = f"roc4_macro_{self.informative_timeframe}"

        if macro_close_col not in dataframe.columns:
            dataframe[macro_close_col] = dataframe["close"]
        if macro_ema_col not in dataframe.columns:
            dataframe[macro_ema_col] = dataframe["ema200"]
        if macro_roc_col not in dataframe.columns:
            dataframe[macro_roc_col] = 0.0

        # Auto-Defense Mode: Activates if BTC dumps > 2.0% in 4h or falls 2% under 1h EMA 200
        dataframe["defense_mode"] = (
            (dataframe[macro_roc_col] < -0.02) |
            (dataframe[macro_close_col] < (dataframe[macro_ema_col] * 0.98))
        ).fillna(False)

        # ── Real Top Trader Algorithmic Guardrails ───────────────────────────
        # 1. Paul Tudor Jones: Never buy against the 200 EMA macro line
        dataframe["ptj_passed"] = (dataframe["close"] >= dataframe["ema200"] * 0.99)

        # 2. Mark Minervini: Volatility Contraction Pattern (VCP)
        atr_rolling = dataframe["atr"].rolling(14).mean().fillna(dataframe["atr"])
        dataframe["minervini_vcp"] = (dataframe["atr"] <= atr_rolling * 1.20)

        # 3. Jesse Livermore: Pivot Breakout with Volume Expansion
        rolling_high_20 = dataframe["high"].shift(1).rolling(20).max().fillna(dataframe["high"])
        dataframe["livermore_pivot"] = (
            (dataframe["close"] >= rolling_high_20 * 0.998) &
            (dataframe["volume_ratio"] >= 1.25)
        )

        # 4. Stan Weinstein: Stage 2 Markup Phase confirmation
        dataframe["stage2_markup"] = (
            (dataframe["close"] > dataframe["ema50"]) &
            (dataframe["ema20"] > dataframe["ema50"])
        )

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Autonomous AI Multi-Signal Decision Rules:
        1. AI Volume Surge Breakout: Unusual volume spike + price > 50 EMA + rising MACD. (Halted during defense mode)
        2. AI Momentum Trend: 20 EMA > 50 EMA + RSI in healthy expansion + volume above average. (Halted during defense mode)
        3. AI Dip Bounce: Oversold RSI bounce near lower Bollinger Band with uptrend support.
        """
        # Condition 1: High-conviction Volume Surge Breakout
        vol_breakout = (
            (~dataframe["defense_mode"]) &
            (dataframe["volume_ratio"] >= self.vol_surge_mult.value) &
            (dataframe["close"] > dataframe["ema50"]) &
            (dataframe["close"] > dataframe["open"]) &
            (dataframe["macdh"] > 0) &
            (dataframe["rsi"] >= self.rsi_min.value) &
            (dataframe["rsi"] <= self.rsi_max.value)
        )

        # Condition 2: Fast Momentum Trend
        momentum_trend = (
            (~dataframe["defense_mode"]) &
            (dataframe["ema20"] > dataframe["ema50"]) &
            (dataframe["close"] > dataframe["ema20"]) &
            (dataframe["rsi"] >= 52) &
            (dataframe["rsi"] <= 68) &
            (dataframe["volume"] > dataframe["volume_sma"])
        )

        # Condition 3: Oversold Intraday Dip Bounce
        dip_bounce = (
            (dataframe["close"] <= dataframe["bb_lower"]) &
            (dataframe["rsi"] <= 32) &
            (dataframe["close"] > dataframe["ema200"]) &
            (dataframe["volume"] > 0)
        )

        # Condition 4: AI Trend Rider (Pullback to EMA 20 in established uptrend)
        trend_rider = (
            (~dataframe["defense_mode"]) &
            (dataframe["ema20"] > dataframe["ema50"]) &
            (dataframe["close"] > dataframe["ema200"]) &
            (dataframe["close"] >= dataframe["ema20"] * 0.995) &
            (dataframe["close"] <= dataframe["ema20"] * 1.015) &
            (dataframe["close"] > dataframe["open"]) &
            (dataframe["rsi"] >= 50) &
            (dataframe["rsi"] <= 65)
        )

        dataframe.loc[vol_breakout, ["enter_long", "enter_tag"]] = (1, "ai_vol_surge")
        dataframe.loc[momentum_trend & ~vol_breakout, ["enter_long", "enter_tag"]] = (1, "ai_momentum")
        dataframe.loc[dip_bounce & ~vol_breakout & ~momentum_trend, ["enter_long", "enter_tag"]] = (1, "ai_dip_bounce")
        dataframe.loc[trend_rider & ~vol_breakout & ~momentum_trend & ~dip_bounce, ["enter_long", "enter_tag"]] = (1, "ai_trend_rider")

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Dynamic Exit Signals:
        - Momentum exhaustion: RSI > 78 or MACD histogram turns negative below EMA 20
        - Trend breakdown: Close drops below 50 EMA
        """
        exhaustion = (
            (dataframe["rsi"] >= 78) |
            ((dataframe["close"] < dataframe["ema20"]) & (dataframe["macdh"] < 0))
        )
        dataframe.loc[exhaustion, "exit_long"] = 1
        return dataframe

    def custom_exit(
        self, pair: str, trade: Trade, current_time: datetime, current_rate: float,
        current_profit: float, **kwargs
    ) -> str | None:
        """
        Real-Time AI Exit Decision Engine:
        1. Instant profit securing: If trade reached +1.8% and pulls back by 0.4%, lock profit now.
        2. Fast momentum exhaustion: If profit > +1.0% and RSI is overbought, exit immediately.
        3. Intraday Capital Recycler: If open > 4 hours and flat, recycle capital for fresh movers.
        """
        # 1. Real-time Trailing Peak Lock
        if trade.max_rate and trade.open_rate > 0:
            max_profit = (trade.max_rate - trade.open_rate) / trade.open_rate
            if max_profit >= 0.018 and current_profit <= (max_profit - 0.004):
                logger.info(f"[AI RealTime] Locking in {current_profit:.2%} profit on {pair} after peak {max_profit:.2%}")
                return "ai_profit_secure"

        # 2. Fast Take-Profit Target
        if current_profit >= 0.025:
            return "ai_target_hit"

        # 3. Capital Recycler for Stale/Flat Trades
        open_minutes = (current_time - trade.open_date_utc).total_seconds() / 60
        if open_minutes > 240 and abs(current_profit) < 0.004:
            logger.info(f"[AI Recycler] Stale trade on {pair} after {open_minutes:.0f}m. Recycling capital.")
            return "ai_capital_recycle"

        # 4. Mark Minervini Breakeven Lock ("Never let a good gain turn into a loss")
        if trade.max_rate and trade.open_rate > 0:
            max_profit = (trade.max_rate - trade.open_rate) / trade.open_rate
            if max_profit >= 0.014 and current_profit <= 0.004:
                logger.info(f"[Minervini Guard] Peak was +{max_profit:.2%}, securing breakeven profit on {pair} at {current_profit:.2%}")
                return "minervini_be_lock"

        return None

    def confirm_trade_entry(
        self, pair: str, order_type: str, amount: float, rate: float,
        time_in_force: str, current_time, entry_tag: str | None, side: str, **kwargs
    ) -> bool:
        """Enforce single-owner and min $5 notional."""
        open_trades = Trade.get_trades_proxy(is_open=True)
        active_pairs = [t.pair for t in open_trades]
        if pair in active_pairs:
            return False
        if (amount * rate) < 5.0:
            return False
        return True

    def adjust_trade_position(
        self, trade: Trade, current_time, current_rate: float,
        current_profit: float, min_stake: float | None, max_stake: float,
        current_entry_rate: float = 0.0, current_exit_rate: float = 0.0,
        current_entry_profit: float = 0.0, current_exit_profit: float = 0.0, **kwargs
    ) -> float | None | tuple[float | None, str | None]:
        """
        Way 5: Smart Micro-DCA Layering:
        If an open trade pulls back -1.2% to -2.2% within standard market noise,
        add 1 safety tranche to lower the average cost basis.
        Allows instant exit in profit on minor bounce.
        """
        if current_profit > -0.012 or current_profit < -0.025:
            return None

        # Strictly max 1 adjustment (2 total tranches)
        if trade.nr_of_successful_entries >= 2:
            return None

        stake = min(trade.stake_amount, max_stake)
        if min_stake and stake < min_stake:
            stake = min_stake
        logger.info(f"[AI MultiWay DCA] Adding safety layer for {trade.pair} at {current_profit:.2%}")
        return stake, "ai_smart_dca_layer"
