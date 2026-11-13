import pytest


def test_section_115bbh_asymmetric_taxation():
    """
    Section 115BBH:
    - 30% tax + 4% cess = 31.2% effective tax rate on winning trades.
    - Zero tax relief/offset on losing trades.
    """
    trades = [
        {"pnl": 500.0, "is_win": True},
        {"pnl": -200.0, "is_win": False},
        {"pnl": 300.0, "is_win": True},
        {"pnl": -150.0, "is_win": False},
    ]

    gross_gains = sum(t["pnl"] for t in trades if t["is_win"])   # 800
    gross_losses = sum(abs(t["pnl"]) for t in trades if not t["is_win"])  # 350

    tax_rate = 0.312
    tax_liability = gross_gains * tax_rate  # 800 * 0.312 = 249.60

    net_pre_tax_pnl = gross_gains - gross_losses  # 800 - 350 = 450
    net_post_tax_pnl = net_pre_tax_pnl - tax_liability  # 450 - 249.60 = 200.40

    pf_pre = gross_gains / gross_losses  # 800 / 350 = 2.2857
    pf_post = (gross_gains * (1 - tax_rate)) / gross_losses  # (800 * 0.688) / 350 = 1.5725

    assert pytest.approx(pf_post, 0.001) == pf_pre * (1 - tax_rate)
    assert net_post_tax_pnl < net_pre_tax_pnl


def test_breakeven_threshold_under_indian_tax():
    """
    To break even post-tax (PF_post = 1.0):
    PF_pre must be at least 1 / (1 - 0.312) = 1 / 0.688 = 1.453
    """
    tax_rate = 0.312
    min_pre_tax_pf_for_breakeven = 1.0 / (1.0 - tax_rate)
    assert pytest.approx(min_pre_tax_pf_for_breakeven, 0.01) == 1.453

    # If strategy has pre-tax PF of 1.35:
    pf_pre = 1.35
    pf_post = pf_pre * (1.0 - tax_rate)
    assert pf_post < 1.0  # Guaranteed net loss despite being profitable pre-tax!
