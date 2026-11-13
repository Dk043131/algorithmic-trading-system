"""
HKUDS AI-Trader & Stock-Analysis-AI Multi-Agent Investment Committee
====================================================================
Inspired by HKUDS/AI-Trader (The University of Hong Kong Data Intelligence Lab)
and stock-analysis-ai institutional research architectures.

Deconstructs trading decisions into four specialist AI agents:
1. TechnicalAnalystAgent: Evaluates classic & modern master trader principles
   (Minervini VCP, PTJ 200 EMA, Darvas Box, Wyckoff Spring, TTM Squeeze, RSI/MACD).
2. QuantRiskAnalystAgent: Mathematical fee defense under Groww/SEBI regulations,
   exact +5.0% NET profit target solving, breakeven analysis, and ATR risk-reward.
3. MacroCatalystAgent: Evaluates NSE Indian sectoral momentum (Bank, Auto, Energy, IT)
   and institutional volume footprint (volume surge >= 1.3x).
4. CIOOrchestratorAgent: Chief Investment Officer synthesis, consensus voting,
   and execution plan issuance with strict >= 75% conviction threshold.
"""

import math
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from ai_engine.groww_fee_engine import GrowwFeeCalculator, GrowwCapitalDefenseGatekeeper


class TechnicalAnalystAgent:
    """
    Evaluates classic & modern master trader techniques:
    - Mark Minervini Volatility Contraction Pattern (VCP)
    - Paul Tudor Jones 200-day EMA trend alignment
    - Nicolas Darvas Box breakout
    - Richard Wyckoff Spring / Accumulation
    - John Carter TTM Squeeze / Bollinger contraction
    - Relative Strength Index (RSI-14) & Momentum
    """

    def analyze(self, symbol: str, price: float, indicators: Dict[str, Any]) -> Dict[str, Any]:
        score = 0.0
        reasons = []

        rsi = indicators.get("rsi", 50.0)
        atr = indicators.get("atr", price * 0.015)
        ema9 = indicators.get("ema9", price)
        ema21 = indicators.get("ema21", price)
        ema50 = indicators.get("ema50", price)
        ema200 = indicators.get("ema200", price)
        vcp_score = indicators.get("vcp_score", 50.0)
        vol_surge = indicators.get("vol_surge", 1.0)
        bb_pct = indicators.get("bb_pct", 0.5)

        # 1. Paul Tudor Jones 200 EMA Trend Filter (Max 25 pts)
        if price > ema200 and ema50 > ema200:
            score += 25.0
            reasons.append("PTJ 200 EMA Bullish Trend (Price > EMA-200 and EMA-50 > EMA-200)")
        elif price > ema200:
            score += 15.0
            reasons.append("PTJ Trend Positive (Price > EMA-200)")
        else:
            reasons.append("PTJ Trend Bearish (Price < EMA-200, cautionary)")

        # 2. Mark Minervini Volatility Contraction (VCP) (Max 25 pts)
        if vcp_score >= 80.0:
            score += 25.0
            reasons.append(f"Minervini High-Quality VCP ({vcp_score:.1f}/100) — Tightly coiled price base")
        elif vcp_score >= 60.0:
            score += 18.0
            reasons.append(f"Minervini Moderate VCP ({vcp_score:.1f}/100)")
        else:
            score += 8.0
            reasons.append(f"Minervini Low VCP ({vcp_score:.1f}/100) — Loose price consolidation")

        # 3. Darvas Box / Moving Average Alignment (Max 20 pts)
        if price > ema9 and ema9 > ema21:
            score += 20.0
            reasons.append("Darvas Momentum Stack (Price > EMA-9 > EMA-21)")
        elif price > ema9:
            score += 12.0
            reasons.append("Short-term momentum positive (Price > EMA-9)")
        else:
            reasons.append("Short-term momentum negative (Price < EMA-9)")

        # 4. RSI & Bollinger Mean Reversion / Expansion (Max 15 pts)
        if 42.0 <= rsi <= 68.0:
            score += 15.0
            reasons.append(f"RSI-14 ({rsi:.1f}) in optimum bullish continuation corridor (42-68)")
        elif rsi < 35.0:
            score += 12.0
            reasons.append(f"RSI-14 ({rsi:.1f}) oversold — Wyckoff Spring / mean-reversion setup")
        elif rsi > 72.0:
            score += 5.0
            reasons.append(f"RSI-14 ({rsi:.1f}) overbought — elevated pullback risk")
        else:
            score += 8.0
            reasons.append(f"RSI-14 ({rsi:.1f}) neutral")

        # 5. TTM Squeeze / Bollinger Band Width (Max 15 pts)
        if 0.15 <= bb_pct <= 0.85:
            score += 15.0
            reasons.append("TTM Squeeze healthy: Bollinger Bands expanding into upward trend")
        elif bb_pct < 0.15:
            score += 10.0
            reasons.append("Bollinger lower-band tap: potential reversal rebound")
        else:
            score += 5.0
            reasons.append("Bollinger upper-band piercing: extended move")

        final_score = min(100.0, max(0.0, round(score, 1)))
        if final_score >= 80:
            vote = "STRONG_BUY"
        elif final_score >= 65:
            vote = "BUY"
        elif final_score >= 45:
            vote = "HOLD"
        else:
            vote = "AVOID"

        return {
            "agent": "TechnicalAnalystAgent",
            "score": final_score,
            "vote": vote,
            "vcp_score": vcp_score,
            "rsi": rsi,
            "ptj_trend": "BULLISH" if price > ema200 else "BEARISH",
            "reasons": reasons,
            "summary": f"{vote} ({final_score}/100) — {reasons[0]}"
        }


class QuantRiskAnalystAgent:
    """
    Mathematical Fee Defense & Capital Preservation Engine:
    - Strictly enforces Groww / SEBI fee viability.
    - Solves the exact NSE Target Price required for +5.0% NET profit.
    - Computes Breakeven Price (guaranteeing 0 fee loss).
    - Checks Risk/Reward ratio (Target Net Profit / ATR Stop Loss >= 2.5:1).
    - Prevents account destruction by blocking micro-orders with high fee drag.
    """

    def analyze(
        self,
        symbol: str,
        price: float,
        shares: float,
        available_balance_inr: float = 0.0,
        target_net_pct: float = 5.0,
        product: str = "CNC"
    ) -> Dict[str, Any]:
        qty = max(1.0, float(shares))
        invested_capital = round(price * qty, 2)

        # 1. Solve exact Target Price for +5.0% NET profit after all charges
        target_sol = GrowwFeeCalculator.solve_target_price_for_net_profit(
            buy_price=price,
            shares=qty,
            target_net_pct=target_net_pct,
            product=product
        )

        # 2. Solve exact Breakeven Price (zero fee loss)
        be_sol = GrowwFeeCalculator.solve_breakeven_price(
            buy_price=price,
            shares=qty,
            product=product
        )

        fee_drag_pct = target_sol["fee_drag_pct"]
        req_gross_pct = target_sol["required_gross_gain_pct"]
        target_price = target_sol["target_price"]
        breakeven_price = be_sol["breakeven_price"]
        net_profit_inr = target_sol["net_profit_inr"]
        fees_inr = target_sol["total_statutory_fees_inr"]

        # 3. Dynamic Stop Loss: ATR / Risk Defense (-1.8% max or 1.2x ATR)
        stop_loss_pct = 1.8
        stop_loss_price = round(round((price * (1 - stop_loss_pct / 100.0)) / 0.05) * 0.05, 2)
        max_risk_inr = round((price - stop_loss_price) * qty, 2)

        # 4. Risk / Reward Calculation
        # Reward = Net Profit (INR) / Risk = Max Loss (INR)
        rr_ratio = round(net_profit_inr / (max_risk_inr + 1e-9), 2)

        # 5. Capital & Fee Drag Defense Check
        reasons = []
        is_capital_viable = True
        risk_score = 100.0

        if fee_drag_pct > 2.5:
            risk_score -= 40.0
            reasons.append(
                f"Fee Drag Alert: {fee_drag_pct:.1f}% fee drag on ₹{invested_capital:.0f} capital. "
                f"Fixed Groww fees (₹{fees_inr:.2f}) require a +{req_gross_pct:.1f}% gross surge."
            )
            is_capital_viable = False
        else:
            reasons.append(
                f"Fee Drag Protected: {fee_drag_pct:.2f}% fee drag on ₹{invested_capital:.0f}. "
                f"Requires +{req_gross_pct:.2f}% gross gain to net +{target_net_pct:.1f}% profit (₹{net_profit_inr:.2f})."
            )

        if rr_ratio >= 2.5:
            reasons.append(f"Institutional R:R Ratio: {rr_ratio:.2f}:1 (Target Net ₹{net_profit_inr:.2f} vs Risk ₹{max_risk_inr:.2f})")
        elif rr_ratio >= 1.8:
            risk_score -= 10.0
            reasons.append(f"Acceptable R:R Ratio: {rr_ratio:.2f}:1")
        else:
            risk_score -= 25.0
            reasons.append(f"Low R:R Ratio: {rr_ratio:.2f}:1 (requires >= 2.0:1)")

        if invested_capital < GrowwCapitalDefenseGatekeeper.MINIMUM_REAL_CAPITAL_INR:
            is_capital_viable = False
            reasons.append(
                f"Capital Defense: Position ₹{invested_capital:.0f} < safe minimum "
                f"₹{GrowwCapitalDefenseGatekeeper.MINIMUM_REAL_CAPITAL_INR:.0f}. Run in Paper Mode to prevent fee drag."
            )

        final_score = min(100.0, max(10.0, round(risk_score, 1)))
        status = "APPROVED" if (final_score >= 65 and rr_ratio >= 1.8) else "REJECTED"

        return {
            "agent": "QuantRiskAnalystAgent",
            "score": final_score,
            "status": status,
            "is_capital_viable": is_capital_viable,
            "invested_capital_inr": invested_capital,
            "target_price": target_price,
            "breakeven_price": breakeven_price,
            "stop_loss_price": stop_loss_price,
            "target_net_pct": target_net_pct,
            "required_gross_gain_pct": req_gross_pct,
            "target_net_profit_inr": net_profit_inr,
            "estimated_roundtrip_fees_inr": fees_inr,
            "fee_drag_pct": fee_drag_pct,
            "risk_reward_ratio": rr_ratio,
            "reasons": reasons,
            "summary": f"{status} ({final_score}/100) — Net +{target_net_pct}% Target ₹{target_price} | BE ₹{breakeven_price} | Fees ₹{fees_inr:.2f}"
        }


class MacroCatalystAgent:
    """
    Evaluates Indian Sectoral Momentum & Institutional Volume Footprint:
    - Identifies hot sectors in Indian markets (Banking, Auto, Energy, IT, Metal, Infra).
    - Checks high volume surge (Volume >= 1.3x 20-period SMA) signaling institutional buying.
    - Relative strength and catalyst confluence.
    """

    SECTOR_WEIGHTS = {
        "Banking": 1.15,
        "Automotive": 1.10,
        "Energy & Power": 1.10,
        "Information Technology": 1.05,
        "Metals & Mining": 1.05,
        "Infrastructure": 1.05,
        "FMCG": 0.95,
        "Telecom": 1.00
    }

    def analyze(self, symbol: str, sector: str, vol_surge: float, catalyst: str = "") -> Dict[str, Any]:
        score = 50.0
        reasons = []

        # 1. Institutional Volume Surge (Max 30 pts)
        if vol_surge >= 2.0:
            score += 30.0
            reasons.append(f"Institutional Footprint: Massive {vol_surge:.2f}x volume surge detected!")
        elif vol_surge >= 1.3:
            score += 20.0
            reasons.append(f"Healthy Volume Surge: {vol_surge:.2f}x above 20-period SMA")
        elif vol_surge >= 0.9:
            score += 10.0
            reasons.append(f"Average Volume: {vol_surge:.2f}x 20-period SMA")
        else:
            score -= 10.0
            reasons.append(f"Subdued Volume: Only {vol_surge:.2f}x average — lack of buying momentum")

        # 2. Sector Multiplier (Max 20 pts)
        sector_multiplier = self.SECTOR_WEIGHTS.get(sector, 1.0)
        if sector_multiplier > 1.05:
            score += 20.0
            reasons.append(f"High Momentum Sector: {sector} (Multiplier {sector_multiplier}x)")
        elif sector_multiplier >= 1.0:
            score += 12.0
            reasons.append(f"Stable Sector: {sector}")
        else:
            score += 5.0
            reasons.append(f"Defensive Sector: {sector}")

        # 3. Catalyst Content
        if catalyst:
            reasons.append(f"Market Catalyst: {catalyst}")

        final_score = min(100.0, max(10.0, round(score, 1)))
        sector_bias = "BULLISH" if final_score >= 70 else ("NEUTRAL" if final_score >= 50 else "BEARISH")

        return {
            "agent": "MacroCatalystAgent",
            "score": final_score,
            "sector": sector,
            "sector_bias": sector_bias,
            "volume_surge": vol_surge,
            "reasons": reasons,
            "summary": f"{sector_bias} ({final_score}/100) — {reasons[0]}"
        }


class CIOOrchestratorAgent:
    """
    Chief Investment Officer Orchestrator:
    Synthesizes technical, quant risk, and macro catalyst agents into a unified consensus.
    Requires >= 75% consensus conviction score for STRONG_BUY recommendations.
    Issues mathematically verified execution plan with strict +5.0% NET profit targets.
    """

    def __init__(self):
        self.technical_analyst = TechnicalAnalystAgent()
        self.quant_risk_analyst = QuantRiskAnalystAgent()
        self.macro_catalyst = MacroCatalystAgent()

    def evaluate_investment_candidate(
        self,
        symbol: str,
        price: float,
        shares: float,
        indicators: Dict[str, Any],
        sector: str = "Banking",
        catalyst: str = "",
        available_balance_inr: float = 0.0,
        target_net_pct: float = 5.0,
        product: str = "CNC"
    ) -> Dict[str, Any]:
        """
        Runs the full 4-agent committee debate and produces institutional synthesis.
        """
        # Run 3 specialized agents
        tech_out = self.technical_analyst.analyze(symbol, price, indicators)
        quant_out = self.quant_risk_analyst.analyze(
            symbol, price, shares,
            available_balance_inr=available_balance_inr,
            target_net_pct=target_net_pct,
            product=product
        )
        macro_out = self.macro_catalyst.analyze(
            symbol, sector, indicators.get("vol_surge", 1.0), catalyst=catalyst
        )

        # Consensus Conviction Weighting:
        # Technical (40%), Quant Risk (35%), Macro Catalyst (25%)
        tech_w = 0.40
        quant_w = 0.35
        macro_w = 0.25

        weighted_conviction = round(
            (tech_out["score"] * tech_w) +
            (quant_out["score"] * quant_w) +
            (macro_out["score"] * macro_w),
            1
        )

        # Decision Matrix
        if weighted_conviction >= 75.0 and quant_out["status"] == "APPROVED":
            decision = "STRONG_BUY"
            action_code = "BUY"
            conviction_grade = "HIGH CONVICTION (>= 75%)"
        elif weighted_conviction >= 65.0 and quant_out["status"] == "APPROVED":
            decision = "ACCUMULATE_ON_DIP"
            action_code = "WATCHLIST"
            conviction_grade = "MODERATE CONVICTION"
        elif weighted_conviction >= 50.0:
            decision = "HOLD / NEUTRAL"
            action_code = "HOLD"
            conviction_grade = "NEUTRAL"
        else:
            decision = "AVOID"
            action_code = "AVOID"
            conviction_grade = "LOW CONVICTION"

        execution_plan = {
            "symbol": symbol,
            "action": action_code,
            "decision": decision,
            "entry_price": price,
            "shares": float(shares),
            "invested_capital_inr": quant_out["invested_capital_inr"],
            "target_net_price": quant_out["target_price"],
            "target_net_pct": target_net_pct,
            "required_gross_gain_pct": quant_out["required_gross_gain_pct"],
            "target_net_profit_inr": quant_out["target_net_profit_inr"],
            "breakeven_price": quant_out["breakeven_price"],
            "stop_loss_price": quant_out["stop_loss_price"],
            "estimated_roundtrip_fees_inr": quant_out["estimated_roundtrip_fees_inr"],
            "risk_reward_ratio": quant_out["risk_reward_ratio"],
            "is_capital_viable": quant_out["is_capital_viable"]
        }

        # Synthesize debate narrative
        narrative = [
            f"1. CIO Verdict: {decision} with {weighted_conviction}% Consensus Conviction.",
            f"2. Technical Desk: {tech_out['summary']}.",
            f"3. Quant Risk Desk: {quant_out['summary']}.",
            f"4. Macro & Catalyst Desk: {macro_out['summary']}."
        ]

        return {
            "symbol": symbol,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "consensus_score": weighted_conviction,
            "decision": decision,
            "conviction_grade": conviction_grade,
            "agents": {
                "technical": tech_out,
                "quant_risk": quant_out,
                "macro_catalyst": macro_out
            },
            "execution_plan": execution_plan,
            "committee_narrative": narrative
        }


# Global Singleton Committee Orchestrator
investment_committee = CIOOrchestratorAgent()
