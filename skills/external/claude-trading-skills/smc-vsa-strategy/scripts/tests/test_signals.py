"""Unit tests for the SMC + VSA signal calculation library."""

from __future__ import annotations

import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Make the scripts directory importable when running from anywhere
_SCRIPTS = Path(__file__).resolve().parent.parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from signals import calculate_signals, to_json_dict, to_markdown


# ---------------------------------------------------------------------------
# Fixtures — synthetic OHLCV data
# ---------------------------------------------------------------------------

def _make_df(
    n: int = 200,
    base_price: float = 50000.0,
    trend: float = 0.0,
    interval: str = "15m",
    tz: str = "UTC",
    start_hour_utc: int = 8,   # 08:00 UTC = 03:00 EST (in kill zone)
) -> pd.DataFrame:
    """Generate synthetic OHLCV data for testing."""
    np.random.seed(42)
    idx = pd.date_range(
        start=f"2026-06-02 {start_hour_utc:02d}:00:00",
        periods=n,
        freq="15min",
        tz=tz,
    )
    closes = base_price + np.cumsum(np.random.randn(n) * 100 + trend)
    highs = closes + np.abs(np.random.randn(n) * 80)
    lows = closes - np.abs(np.random.randn(n) * 80)
    opens = closes - np.random.randn(n) * 50

    df = pd.DataFrame({
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": np.abs(np.random.randn(n) * 500 + 1000),
    }, index=idx)
    df.attrs["interval"] = interval
    return df


def _make_htf_bullish(base_price: float = 50000.0) -> pd.DataFrame:
    """HTF data where close > EMA50 (bullish)."""
    np.random.seed(7)
    n = 100
    idx = pd.date_range("2026-01-01", periods=n, freq="4h", tz="UTC")
    # Start low and trend up so EMA50 is well below close
    prices = base_price * 0.8 + np.linspace(0, base_price * 0.3, n) + np.random.randn(n) * 200
    df = pd.DataFrame({
        "open": prices - 100,
        "high": prices + 200,
        "low": prices - 200,
        "close": prices,
        "volume": np.ones(n) * 1000,
    }, index=idx)
    df.attrs["interval"] = "4h"
    return df


def _make_htf_bearish(base_price: float = 50000.0) -> pd.DataFrame:
    """HTF data where close < EMA50 (bearish)."""
    np.random.seed(11)
    n = 100
    idx = pd.date_range("2026-01-01", periods=n, freq="4h", tz="UTC")
    # Start high and trend down
    prices = base_price * 1.2 - np.linspace(0, base_price * 0.3, n) + np.random.randn(n) * 200
    df = pd.DataFrame({
        "open": prices + 100,
        "high": prices + 200,
        "low": prices - 200,
        "close": prices,
        "volume": np.ones(n) * 1000,
    }, index=idx)
    df.attrs["interval"] = "4h"
    return df


# ---------------------------------------------------------------------------
# Helper to inject a sell-side liquidity grab on the last bar
# ---------------------------------------------------------------------------

def _inject_sell_side_grab(df: pd.DataFrame, lookback: int = 50) -> pd.DataFrame:
    """Make the last bar sweep below the N-bar low and close above it."""
    df = df.copy()
    prev_lows = df["low"].iloc[-(lookback + 2): -1]
    n_bar_low = float(prev_lows.min())
    sweep_low = n_bar_low - 50  # below the N-bar low
    close_above = n_bar_low + 10  # close back above

    df.iloc[-1, df.columns.get_loc("low")] = sweep_low
    df.iloc[-1, df.columns.get_loc("close")] = close_above
    df.iloc[-1, df.columns.get_loc("high")] = close_above + 20
    df.iloc[-1, df.columns.get_loc("open")] = close_above + 5
    return df


def _inject_buy_side_grab(df: pd.DataFrame, lookback: int = 50) -> pd.DataFrame:
    """Make the last bar sweep above the N-bar high and close below it."""
    df = df.copy()
    prev_highs = df["high"].iloc[-(lookback + 2): -1]
    n_bar_high = float(prev_highs.max())
    sweep_high = n_bar_high + 50
    close_below = n_bar_high - 10

    df.iloc[-1, df.columns.get_loc("high")] = sweep_high
    df.iloc[-1, df.columns.get_loc("close")] = close_below
    df.iloc[-1, df.columns.get_loc("low")] = close_below - 20
    df.iloc[-1, df.columns.get_loc("open")] = close_below - 5
    return df


def _inject_bullish_break(df: pd.DataFrame) -> pd.DataFrame:
    """Make the last bar close above the 10-bar highest close."""
    df = df.copy()
    prev_closes = df["close"].iloc[-12:-1]
    ten_bar_high = float(prev_closes.max())
    df.iloc[-1, df.columns.get_loc("close")] = ten_bar_high + 50
    df.iloc[-1, df.columns.get_loc("high")] = ten_bar_high + 100
    # Ensure previous bar was NOT above the threshold (for crossover logic)
    df.iloc[-2, df.columns.get_loc("close")] = ten_bar_high - 10
    return df


def _inject_bearish_break(df: pd.DataFrame) -> pd.DataFrame:
    """Make the last bar close below the 10-bar lowest close."""
    df = df.copy()
    prev_closes = df["close"].iloc[-12:-1]
    ten_bar_low = float(prev_closes.min())
    df.iloc[-1, df.columns.get_loc("close")] = ten_bar_low - 50
    df.iloc[-1, df.columns.get_loc("low")] = ten_bar_low - 100
    df.iloc[-2, df.columns.get_loc("close")] = ten_bar_low + 10
    return df


# ---------------------------------------------------------------------------
# Default call kwargs
# ---------------------------------------------------------------------------

_DEFAULT_KWARGS = dict(
    symbol="TESTUSD",
    equity=10000.0,
    risk_pct=1.0,
    rr_target=3.0,
    lookback=50,
    point_value=1.0,
    killzone="03:00-11:00",
    max_losses=2,
    consecutive_losses=0,
)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestHTFBias:
    def test_bullish_when_close_above_ema(self):
        ltf = _make_df(n=200)
        htf = _make_htf_bullish()
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        assert r.htf_bias == "bullish"

    def test_bearish_when_close_below_ema(self):
        ltf = _make_df(n=200)
        htf = _make_htf_bearish()
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        assert r.htf_bias == "bearish"


class TestLiquiditySweeps:
    def test_sell_side_grab_detected(self):
        ltf = _make_df(n=200)
        ltf = _inject_sell_side_grab(ltf)
        htf = _make_htf_bullish()
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        assert r.sell_side_liquidity_grab is True
        assert r.buy_side_liquidity_grab is False

    def test_buy_side_grab_detected(self):
        ltf = _make_df(n=200)
        ltf = _inject_buy_side_grab(ltf)
        htf = _make_htf_bearish()
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        assert r.buy_side_liquidity_grab is True
        assert r.sell_side_liquidity_grab is False


class TestLongSignal:
    def _make_long_setup(self):
        ltf = _make_df(n=200)
        ltf = _inject_sell_side_grab(ltf)
        ltf = _inject_bullish_break(ltf)
        htf = _make_htf_bullish()
        return ltf, htf

    def test_long_direction(self):
        ltf, htf = self._make_long_setup()
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        assert r.direction == "LONG"

    def test_long_levels_set(self):
        ltf, htf = self._make_long_setup()
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        assert r.entry is not None
        assert r.stop_loss is not None
        assert r.tp1 is not None
        assert r.entry > r.stop_loss
        assert r.tp1 > r.entry

    def test_long_rr_correct(self):
        ltf, htf = self._make_long_setup()
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        if r.direction == "LONG" and r.tp1 and r.entry and r.stop_loss:
            actual_rr = (r.tp1 - r.entry) / (r.entry - r.stop_loss)
            assert abs(actual_rr - 3.0) < 0.01

    def test_long_position_sizing_dollars(self):
        ltf, htf = self._make_long_setup()
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        if r.direction == "LONG" and r.total_qty and r.risk_distance:
            target_risk = _DEFAULT_KWARGS["equity"] * (_DEFAULT_KWARGS["risk_pct"] / 100)
            ideal_qty_raw = target_risk / (r.risk_distance * _DEFAULT_KWARGS["point_value"])
            # When ideal_qty < 1, min-qty enforcement (max(1, round(...))) means
            # actual risk > target risk — this is correct Pine Script behaviour.
            # Only assert "within budget" when ideal qty rounds to >= 1.
            if round(ideal_qty_raw) >= 1:
                implied_risk = r.total_qty * r.risk_distance * _DEFAULT_KWARGS["point_value"]
                assert abs(implied_risk - target_risk) / target_risk < 0.6  # within 60% due to rounding
            else:
                # Min-qty case: qty is forced to 1, risk may exceed target — acceptable
                assert r.total_qty == 1


class TestShortSignal:
    def _make_short_setup(self):
        ltf = _make_df(n=200)
        ltf = _inject_buy_side_grab(ltf)
        ltf = _inject_bearish_break(ltf)
        htf = _make_htf_bearish()
        return ltf, htf

    def test_short_direction(self):
        ltf, htf = self._make_short_setup()
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        assert r.direction == "SHORT"

    def test_short_levels_set(self):
        ltf, htf = self._make_short_setup()
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        assert r.entry is not None
        assert r.stop_loss is not None
        assert r.tp1 is not None
        assert r.entry < r.stop_loss
        assert r.tp1 < r.entry

    def test_short_tp1_qty_at_least_1(self):
        ltf, htf = self._make_short_setup()
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        if r.direction == "SHORT":
            assert r.tp1_qty is not None and r.tp1_qty >= 1


class TestKillSwitch:
    def test_kill_switch_blocks_entry(self):
        ltf = _make_df(n=200)
        ltf = _inject_sell_side_grab(ltf)
        ltf = _inject_bullish_break(ltf)
        htf = _make_htf_bullish()
        kwargs = {**_DEFAULT_KWARGS, "consecutive_losses": 2, "max_losses": 2}
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **kwargs)
        assert r.kill_switch_active is True
        assert r.direction == "FLAT"

    def test_kill_switch_allows_when_below_threshold(self):
        ltf = _make_df(n=200)
        ltf = _inject_sell_side_grab(ltf)
        ltf = _inject_bullish_break(ltf)
        htf = _make_htf_bullish()
        kwargs = {**_DEFAULT_KWARGS, "consecutive_losses": 1, "max_losses": 2}
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **kwargs)
        assert r.kill_switch_active is False


class TestPositionSplitting:
    def test_qty_splits_into_tp1_and_runner(self):
        ltf = _make_df(n=200)
        ltf = _inject_sell_side_grab(ltf)
        ltf = _inject_bullish_break(ltf)
        htf = _make_htf_bullish()
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        if r.direction == "LONG" and r.total_qty:
            assert r.tp1_qty is not None
            assert r.runner_qty is not None
            assert r.tp1_qty + r.runner_qty == r.total_qty
            assert r.tp1_qty >= 1

    def test_minimum_qty_is_1(self):
        ltf = _make_df(n=200)
        ltf = _inject_sell_side_grab(ltf)
        ltf = _inject_bullish_break(ltf)
        htf = _make_htf_bullish()
        # Very small equity — forces minimum qty
        kwargs = {**_DEFAULT_KWARGS, "equity": 100.0, "risk_pct": 0.5}
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **kwargs)
        if r.direction == "LONG":
            assert r.total_qty is not None and r.total_qty >= 1
            assert r.tp1_qty is not None and r.tp1_qty >= 1


class TestOutputFormatters:
    def _get_long_result(self):
        ltf = _make_df(n=200)
        ltf = _inject_sell_side_grab(ltf)
        ltf = _inject_bullish_break(ltf)
        htf = _make_htf_bullish()
        return calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)

    def test_json_dict_keys(self):
        r = self._get_long_result()
        d = to_json_dict(r)
        assert "symbol" in d
        assert "signal" in d
        assert "sizing" in d
        assert "kill_switch" in d
        assert "conditions" in d
        assert "alerts" in d

    def test_json_direction_field(self):
        r = self._get_long_result()
        d = to_json_dict(r)
        assert d["signal"]["direction"] in ("LONG", "SHORT", "FLAT")

    def test_markdown_contains_signal_header(self):
        r = self._get_long_result()
        md = to_markdown(r)
        assert "SMC + VSA Signal" in md
        assert "TESTUSD" in md

    def test_markdown_contains_levels_when_signal(self):
        r = self._get_long_result()
        md = to_markdown(r)
        if r.direction != "FLAT":
            assert "Entry" in md
            assert "Stop Loss" in md
            assert "TP1" in md


class TestInsufficientData:
    def test_warning_on_few_bars(self):
        ltf = _make_df(n=30)
        htf = _make_htf_bullish()
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        assert any("Insufficient" in w for w in r.warnings)


class TestSignalDirectionInversion:
    """Verify Fix #1: sell-side grab is BULLISH, buy-side grab is BEARISH."""

    def test_sell_side_grab_only_fires_long_with_bullish_htf(self):
        ltf = _make_df(n=200)
        ltf = _inject_sell_side_grab(ltf)
        htf = _make_htf_bearish()  # bearish HTF — should NOT fire long
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        assert r.direction != "LONG", "Sell-side grab must NOT fire LONG when HTF is bearish"

    def test_buy_side_grab_only_fires_short_with_bearish_htf(self):
        ltf = _make_df(n=200)
        ltf = _inject_buy_side_grab(ltf)
        htf = _make_htf_bullish()  # bullish HTF — should NOT fire short
        r = calculate_signals(ltf_df=ltf, htf_df=htf, **_DEFAULT_KWARGS)
        assert r.direction != "SHORT", "Buy-side grab must NOT fire SHORT when HTF is bullish"
