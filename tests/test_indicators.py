import numpy as np
import pandas as pd
import pandas_ta as ta
import pytest


@pytest.fixture
def sample_ohlcv():
    np.random.seed(42)
    n = 250
    close = 50000 + np.cumsum(np.random.randn(n) * 400)
    high = close + np.abs(np.random.randn(n) * 150)
    low = close - np.abs(np.random.randn(n) * 150)
    open_ = close + np.random.randn(n) * 50
    vol = np.random.randint(50, 500, n).astype(float)
    return pd.DataFrame({"open": open_, "high": high, "low": low, "close": close, "volume": vol})


def test_ema_indicators(sample_ohlcv):
    df = sample_ohlcv.copy()
    df["ema20"] = ta.ema(df["close"], length=20)
    df["ema50"] = ta.ema(df["close"], length=50)
    df["ema200"] = ta.ema(df["close"], length=200)

    # After warm-up, no NaNs
    assert df["ema20"].iloc[25:].notna().all()
    assert df["ema50"].iloc[55:].notna().all()
    assert df["ema200"].iloc[205:].notna().all()


def test_rsi_and_atr(sample_ohlcv):
    df = sample_ohlcv.copy()
    df["rsi"] = ta.rsi(df["close"], length=14)
    df["atr"] = ta.atr(df["high"], df["low"], df["close"], length=14)

    valid_rsi = df["rsi"].dropna()
    assert (valid_rsi >= 0).all() and (valid_rsi <= 100).all()

    valid_atr = df["atr"].dropna()
    assert (valid_atr > 0).all()


def test_bollinger_bands_column_names(sample_ohlcv):
    df = sample_ohlcv.copy()
    bb = ta.bbands(df["close"], length=20, std=2.0)
    assert bb is not None and not bb.empty

    bbl_cols = [c for c in bb.columns if c.startswith("BBL_")]
    bbm_cols = [c for c in bb.columns if c.startswith("BBM_")]
    bbu_cols = [c for c in bb.columns if c.startswith("BBU_")]

    assert len(bbl_cols) >= 1
    assert len(bbm_cols) >= 1
    assert len(bbu_cols) >= 1

    # Upper band must be greater than lower band
    valid_idx = bb[bbl_cols[0]].dropna().index
    assert (bb.loc[valid_idx, bbu_cols[0]] >= bb.loc[valid_idx, bbl_cols[0]]).all()


def test_adx_chop_indicator(sample_ohlcv):
    df = sample_ohlcv.copy()
    adx_df = ta.adx(df["high"], df["low"], df["close"], length=14)
    assert adx_df is not None and not adx_df.empty

    adx_cols = [c for c in adx_df.columns if c.startswith("ADX_")]
    assert len(adx_cols) >= 1

    valid_adx = adx_df[adx_cols[0]].dropna()
    assert (valid_adx >= 0).all() and (valid_adx <= 100).all()
