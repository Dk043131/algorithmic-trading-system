"""
DK's TRADE - Groww & SEBI Institutional Fee & Regulatory Defense Engine
========================================================================
Implements full statutory Indian equity fee structures, regulatory compliance,
and mathematical fee drag defense for Groww (NSE / BSE).

Term & Condition Awareness:
1. Flat Brokerage: Up to ₹20 or 0.05% per executed order (whichever is lower).
2. STT (Securities Transaction Tax): 0.1% buy + 0.1% sell on Delivery (CNC).
3. Exchange Transaction Charges (NSE): 0.00297% on buy and sell.
4. SEBI Turnover Charges: ₹10 per crore (0.0001%).
5. Stamp Duty: 0.015% on buy value (delivery).
6. GST: 18% on (Brokerage + Exchange Charges + SEBI Charges).
7. DP Charges: ₹13.50 + 18% GST (₹15.93) per scrip per day on selling delivery shares.
8. Peak Margin Rules: 20% margin hold on same-day CNC sell proceeds until T+1.

Core Mathematical Principle:
Any automated trading strategy with a fee drag > 1.2% is GUARANTEED to lose money over time.
Therefore, this engine acts as an immovable pre-trade gatekeeper.
"""

from typing import Dict, Any, Tuple


class GrowwFeeCalculator:
    """
    Precision Indian Equity Regulatory Fee Breakdown.
    Accurate to the paisa according to current Groww tariff and SEBI schedule.
    """

    BROKERAGE_MAX_PER_ORDER = 20.0
    BROKERAGE_RATE = 0.0005  # 0.05%
    STT_DELIVERY_BUY = 0.001   # 0.1%
    STT_DELIVERY_SELL = 0.001  # 0.1%
    STT_INTRADAY_SELL = 0.00025  # 0.025%
    EXCHANGE_TURNOVER_RATE = 0.0000297  # 0.00297%
    SEBI_TURNOVER_RATE = 0.0000010      # ₹10 per crore (0.0001%)
    STAMP_DUTY_DELIVERY = 0.00015       # 0.015% buy only
    GST_RATE = 0.18                     # 18%
    DP_CHARGE_INCL_GST = 15.93          # ₹13.50 + 18% GST on selling delivery

    @classmethod
    def calculate_fees(
        cls,
        buy_price: float,
        sell_price: float,
        shares: float,
        product: str = "CNC",
        is_same_day: bool = True
    ) -> Dict[str, Any]:
        """
        Calculate complete round-trip fees, gross profit, net pocket profit,
        and required breakeven percentage.
        """
        qty = max(1.0, float(shares))
        buy_val = round(buy_price * qty, 2)
        sell_val = round(sell_price * qty, 2)
        total_turnover = round(buy_val + sell_val, 2)

        # 1. Brokerage (Groww: ₹20 or 0.05% per order)
        buy_brokerage = min(cls.BROKERAGE_MAX_PER_ORDER, round(buy_val * cls.BROKERAGE_RATE, 2))
        # Groww charges ₹20 min on delivery in many standard accounts; use conservative ₹20 to protect capital
        buy_brokerage = max(buy_brokerage, min(cls.BROKERAGE_MAX_PER_ORDER, 20.0))
        sell_brokerage = min(cls.BROKERAGE_MAX_PER_ORDER, round(sell_val * cls.BROKERAGE_RATE, 2))
        sell_brokerage = max(sell_brokerage, min(cls.BROKERAGE_MAX_PER_ORDER, 20.0))
        total_brokerage = round(buy_brokerage + sell_brokerage, 2)

        # 2. STT (Securities Transaction Tax)
        if product.upper() == "CNC":
            stt = round((buy_val * cls.STT_DELIVERY_BUY) + (sell_val * cls.STT_DELIVERY_SELL), 2)
        else:
            stt = round(sell_val * cls.STT_INTRADAY_SELL, 2)

        # 3. Exchange Turnover Charges (NSE)
        exchange_charges = round(total_turnover * cls.EXCHANGE_TURNOVER_RATE, 2)

        # 4. SEBI Turnover Charges
        sebi_charges = round(total_turnover * cls.SEBI_TURNOVER_RATE, 4)

        # 5. Stamp Duty (Buy leg only)
        stamp_duty = round(buy_val * cls.STAMP_DUTY_DELIVERY, 2)

        # 6. GST (18% on Brokerage + Exchange Charges + SEBI charges)
        gst_taxable = total_brokerage + exchange_charges + sebi_charges
        gst = round(gst_taxable * cls.GST_RATE, 2)

        # 7. DP Charges (applicable if sold from delivery; waived on same-day intraday squaring)
        dp_charges = 0.0 if is_same_day else cls.DP_CHARGE_INCL_GST

        # Total Round-Trip Costs
        total_costs = round(total_brokerage + stt + exchange_charges + sebi_charges + stamp_duty + gst + dp_charges, 2)

        # P&L Calculation
        gross_pnl = round(sell_val - buy_val, 2)
        net_pnl = round(gross_pnl - total_costs, 2)
        fee_drag_pct = round((total_costs / buy_val) * 100.0, 2) if buy_val > 0 else 0.0
        breakeven_gain_pct = fee_drag_pct

        return {
            "buy_value": buy_val,
            "sell_value": sell_val,
            "total_turnover": total_turnover,
            "brokerage": total_brokerage,
            "stt": stt,
            "exchange_charges": exchange_charges,
            "sebi_charges": round(sebi_charges, 2),
            "stamp_duty": stamp_duty,
            "gst": gst,
            "dp_charges": dp_charges,
            "total_fees_inr": total_costs,
            "gross_pnl_inr": gross_pnl,
            "net_pnl_inr": net_pnl,
            "fee_drag_pct": fee_drag_pct,
            "breakeven_gain_pct": breakeven_gain_pct
        }

    @classmethod
    def solve_target_price_for_net_profit(
        cls,
        buy_price: float,
        shares: float,
        target_net_pct: float = 5.0,
        product: str = "CNC",
        is_same_day: bool = True
    ) -> Dict[str, Any]:
        """
        Bisection solver to calculate the exact Sell Price on NSE/BSE
        that guarantees a net profit equal to target_net_pct (e.g., +5.0%)
        AFTER all Groww brokerage, STT, turnover, SEBI, stamp duty, GST, and DP charges.
        """
        qty = max(1.0, float(shares))
        invested_capital = round(buy_price * qty, 2)
        target_net_inr = round(invested_capital * (target_net_pct / 100.0), 2)

        # Bisection search bounds
        low = buy_price
        high = buy_price * 2.5  # Up to +150% search ceiling
        for _ in range(80):
            mid = (low + high) / 2.0
            fees = cls.calculate_fees(buy_price, mid, qty, product=product, is_same_day=is_same_day)
            if fees["net_pnl_inr"] >= target_net_inr:
                high = mid
            else:
                low = mid

        # Align to NSE tick size (0.05 INR)
        raw_target = high
        tick_target = round(round(raw_target / 0.05) * 0.05, 2)
        final_fees = cls.calculate_fees(buy_price, tick_target, qty, product=product, is_same_day=is_same_day)

        # If tick rounding fell slightly below target, bump up 1 tick
        if final_fees["net_pnl_inr"] < target_net_inr:
            tick_target = round(tick_target + 0.05, 2)
            final_fees = cls.calculate_fees(buy_price, tick_target, qty, product=product, is_same_day=is_same_day)

        required_gross_gain_pct = round(((tick_target - buy_price) / buy_price) * 100.0, 2)
        actual_net_pct = round((final_fees["net_pnl_inr"] / invested_capital) * 100.0, 2) if invested_capital > 0 else 0.0

        return {
            "buy_price": buy_price,
            "target_price": tick_target,
            "shares": qty,
            "invested_capital_inr": invested_capital,
            "target_net_pct": target_net_pct,
            "actual_net_pct": actual_net_pct,
            "required_gross_gain_pct": required_gross_gain_pct,
            "net_profit_inr": final_fees["net_pnl_inr"],
            "total_statutory_fees_inr": final_fees["total_fees_inr"],
            "fee_drag_pct": final_fees["fee_drag_pct"],
            "fee_breakdown": {
                "brokerage": final_fees["brokerage"],
                "stt": final_fees["stt"],
                "exchange_charges": final_fees["exchange_charges"],
                "sebi_charges": final_fees["sebi_charges"],
                "stamp_duty": final_fees["stamp_duty"],
                "gst": final_fees["gst"],
                "dp_charges": final_fees["dp_charges"]
            }
        }

    @classmethod
    def solve_breakeven_price(
        cls,
        buy_price: float,
        shares: float,
        product: str = "CNC",
        is_same_day: bool = True
    ) -> Dict[str, Any]:
        """
        Calculates the exact Sell Price where Net PnL == 0.00 INR (True Breakeven).
        Selling at or above this price guarantees zero loss after all Groww charges.
        """
        qty = max(1.0, float(shares))
        invested_capital = round(buy_price * qty, 2)

        low = buy_price
        high = buy_price * 1.8
        for _ in range(80):
            mid = (low + high) / 2.0
            fees = cls.calculate_fees(buy_price, mid, qty, product=product, is_same_day=is_same_day)
            if fees["net_pnl_inr"] >= 0.0:
                high = mid
            else:
                low = mid

        raw_target = high
        tick_target = round(round(raw_target / 0.05) * 0.05, 2)
        final_fees = cls.calculate_fees(buy_price, tick_target, qty, product=product, is_same_day=is_same_day)
        if final_fees["net_pnl_inr"] < 0.0:
            tick_target = round(tick_target + 0.05, 2)
            final_fees = cls.calculate_fees(buy_price, tick_target, qty, product=product, is_same_day=is_same_day)

        breakeven_gain_pct = round(((tick_target - buy_price) / buy_price) * 100.0, 2)
        return {
            "buy_price": buy_price,
            "breakeven_price": tick_target,
            "shares": qty,
            "invested_capital_inr": invested_capital,
            "breakeven_gain_pct": breakeven_gain_pct,
            "total_fees_inr": final_fees["total_fees_inr"],
            "net_pnl_inr": final_fees["net_pnl_inr"]
        }


class GrowwCapitalDefenseGatekeeper:
    """
    Prevents account destruction by enforcing mathematical capital viability rules.
    Blocks any trade where transaction costs make profitability mathematically impossible.
    """

    # Minimum capital per position to ensure fixed ₹20 fees don't eat > 2.5% of trade
    MINIMUM_REAL_CAPITAL_INR = 2500.0
    MAX_ALLOWABLE_FEE_DRAG_PCT = 2.5  # Fee must not exceed 2.5% of trade capital
    MAX_DAILY_TRADES = 2             # Strictly max 2 high-conviction trades per day

    @classmethod
    def validate_trade_viability(
        cls,
        amount_inr: float,
        target_gain_pct: float = 2.5,
        live_account_balance_inr: float = 0.0
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Verify that a proposed trade can mathematically generate net profit
        after subtracting all Groww brokerage, GST, and SEBI regulatory fees.
        """
        if amount_inr <= 0:
            return False, "Trade amount must be greater than zero.", {}

        # 1. Enforce Minimum Capital Threshold
        if amount_inr < cls.MINIMUM_REAL_CAPITAL_INR:
            # Calculate what the fees would be on this micro amount
            fees = GrowwFeeCalculator.calculate_fees(
                buy_price=amount_inr,
                sell_price=amount_inr * 1.025,
                shares=1
            )
            drag = fees["fee_drag_pct"]
            return False, (
                f"🛑 BLOCKED BY FEE DEFENSE ENGINE:\n"
                f"Trade amount ₹{amount_inr:.2f} is below the safe minimum of ₹{cls.MINIMUM_REAL_CAPITAL_INR:.0f}.\n"
                f"Groww's fixed fees (~₹{fees['total_fees_inr']:.2f}) would create a {drag:.1f}% fee drag.\n"
                f"A stock would need to rise +{drag:.1f}% just to break even! Trade rejected to prevent capital loss."
            ), fees

        # 2. Check that target gain comfortably exceeds breakeven fees
        hypothetical_fees = GrowwFeeCalculator.calculate_fees(
            buy_price=amount_inr,
            sell_price=amount_inr * (1 + target_gain_pct / 100.0),
            shares=1
        )

        fee_drag = hypothetical_fees["fee_drag_pct"]
        if fee_drag > cls.MAX_ALLOWABLE_FEE_DRAG_PCT:
            return False, (
                f"🛑 BLOCKED BY FEE DEFENSE ENGINE:\n"
                f"Fee drag of {fee_drag:.2f}% exceeds the safe threshold of {cls.MAX_ALLOWABLE_FEE_DRAG_PCT}%.\n"
                f"Net profit would be severely eroded by brokerage charges."
            ), hypothetical_fees

        if target_gain_pct <= fee_drag:
            return False, (
                f"🛑 BLOCKED BY FEE DEFENSE ENGINE:\n"
                f"Target gain of +{target_gain_pct:.2f}% is lower than required breakeven fees (+{fee_drag:.2f}%).\n"
                f"This trade would produce a guaranteed net loss after Groww fees."
            ), hypothetical_fees

        # Net expected profit check
        net_profit = hypothetical_fees["net_pnl_inr"]
        if net_profit <= 0:
            return False, f"🛑 Projected net profit (₹{net_profit:.2f}) is non-positive after fees.", hypothetical_fees

        return True, f"✅ Trade passes fee defense: Fee drag {fee_drag:.2f}% < target +{target_gain_pct:.2f}%. Projected net profit: ₹{net_profit:.2f}.", hypothetical_fees
