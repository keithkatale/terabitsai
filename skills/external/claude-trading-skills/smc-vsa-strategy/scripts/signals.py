"""SMC + VSA Mechanical Strategy v2 — Pure signal calculation library.

All functions are stateless and operate on pandas DataFrames.  No I/O.
Import this module from the CLI entry-point or from tests.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, time
from typing import Optional

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class SignalResult:
    """Fully describes the most recent SMC+VSA signal on a single asset."""

    symbol: str
    generated_at: datetime

    # Timeframe metadata
    ltf_interval: str
    htf_interval: str

    # Latest LTF bar
    bar_timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float

    # HTF bias
    htf_bias: str          # "bullish" | "bearish" | "neutral"
    htf_close: float
    htf_ema50: float

    # Kill zone
    in_killzone: bool
    killzone_window: str   # e.g. "03:00-11:00"

    # Trigger conditions (individual flags)
    sell_side_liquidity_grab: bool
    buy_side_liquidity_grab: bool
    vsa_shakeout: bool
    vsa_no_demand: bool
    bullish_break: bool
    bearish_break: bool

    # Aggregate signal
    direction: str         # "LONG" | "SHORT" | "FLAT"
    trigger_description: str

    # Levels (None when FLAT)
    entry: Optional[float]
    stop_loss: Optional[float]
    risk_distance: Optional[float]
    tp1: Optional[float]
    tp1_rr: float
    runner_stop_initial: Optional[float]
    runner_stop_after_tp1: Optional[float]

    # Sizing
    equity: float
    risk_pct: float
    risk_dollars: Optional[float]
    point_value: float
    total_qty: Optional[int]
    tp1_qty: Optional[int]
    runner_qty: Optional[int]

    # Kill switch
    consecutive_losses: int
    max_losses: int
    kill_switch_active: bool

    # Alert JSON payloads
    entry_alert: Optional[str] = None
    tp1_alert: Optional[str] = None
    runner_alert: Optional[str] = None

    # Warnings
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Helper: EMA calculation
# ---------------------------------------------------------------------------

def _ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def _sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(period).mean()


# ---------------------------------------------------------------------------
# NYC kill zone check
# ---------------------------------------------------------------------------

def _in_killzone(
    ts: pd.Timestamp,
    killzone: str = "03:00-11:00",
    tz_name: str = "America/New_York",
) -> bool:
    """Return True if *ts* (tz-aware or tz-naive UTC) falls within the kill zone."""
    try:
        import pytz
        nyc = pytz.timezone(tz_name)
        if ts.tzinfo is None:
            ts = ts.tz_localize("UTC")
        ts_nyc = ts.astimezone(nyc)
        # Skip weekends
        if ts_nyc.weekday() >= 5:
            return False
        start_str, end_str = killzone.split("-")
        sh, sm = int(start_str[:2]), int(start_str[2:]) if len(start_str) == 4 else (int(start_str.split(":")[0]), int(start_str.split(":")[1]))
        eh, em = int(end_str[:2]), int(end_str[2:]) if len(end_str) == 4 else (int(end_str.split(":")[0]), int(end_str.split(":")[1]))
        bar_time = time(ts_nyc.hour, ts_nyc.minute)
        return time(sh, sm) <= bar_time < time(eh, em)
    except Exception:
        # Fall back to simple UTC-based check (offset by -5 for EST)
        try:
            utc_hour = ts.hour if hasattr(ts, "hour") else 0
            est_hour = (utc_hour - 5) % 24
            return 3 <= est_hour < 11
        except Exception:
            return False


# ---------------------------------------------------------------------------
# Core signal calculator
# ---------------------------------------------------------------------------

def calculate_signals(
    ltf_df: pd.DataFrame,
    htf_df: pd.DataFrame,
    symbol: str,
    equity: float,
    risk_pct: float,
    rr_target: float,
    lookback: int,
    point_value: float,
    killzone: str,
    max_losses: int,
    consecutive_losses: int,
) -> SignalResult:
    """
    Compute the SMC + VSA signal for the most recent completed LTF bar.

    Parameters
    ----------
    ltf_df : DataFrame
        OHLCV with DatetimeIndex.  Columns: open, high, low, close, volume (lowercase).
    htf_df : DataFrame
        OHLCV with DatetimeIndex at the higher timeframe.
    symbol : str
        Instrument ticker (used in output / alert messages only).
    equity : float
        Current account equity in USD.
    risk_pct : float
        Risk per trade as a percentage of equity (e.g. 1.0 = 1 %).
    rr_target : float
        Risk-to-reward ratio for TP1 (e.g. 3.0).
    lookback : int
        N-bar lookback for liquidity high/low detection (default 50).
    point_value : float
        USD value of one instrument point (1.0 for crypto/stocks, 50 for ES futures).
    killzone : str
        NYC kill zone window as "HH:MM-HH:MM" (e.g. "03:00-11:00").
    max_losses : int
        Consecutive-loss threshold for the kill switch.
    consecutive_losses : int
        Current number of consecutive losses (tracked externally).

    Returns
    -------
    SignalResult
    """
    now = datetime.utcnow()
    warnings: list[str] = []

    # Require at least lookback + 20 bars
    min_bars = max(lookback + 20, 70)
    if len(ltf_df) < min_bars:
        warnings.append(f"Insufficient LTF data: {len(ltf_df)} bars (need ≥ {min_bars})")

    # -----------------------------------------------------------------------
    # HTF bias — use latest available HTF bar
    # -----------------------------------------------------------------------
    htf_df = htf_df.copy()
    htf_df["ema50"] = _ema(htf_df["close"], 50)

    htf_latest = htf_df.iloc[-1]
    htf_close_val = float(htf_latest["close"])
    htf_ema_val = float(htf_latest["ema50"])

    if htf_close_val > htf_ema_val:
        htf_bias = "bullish"
    elif htf_close_val < htf_ema_val:
        htf_bias = "bearish"
    else:
        htf_bias = "neutral"

    htf_bullish = htf_bias == "bullish"
    htf_bearish = htf_bias == "bearish"

    # -----------------------------------------------------------------------
    # LTF indicators
    # -----------------------------------------------------------------------
    df = ltf_df.copy()
    df["spread"] = df["high"] - df["low"]
    df["sma_vol_20"] = _sma(df["volume"], 20)
    df["sma_spread_20"] = _sma(df["spread"], 20)

    # Liquidity levels: use shifted values (exclude current bar — same as Pine's high[1]/low[1])
    df["ltf_highest"] = df["high"].shift(1).rolling(lookback).max()
    df["ltf_lowest"] = df["low"].shift(1).rolling(lookback).min()

    # 10-bar close breakout levels (exclude current bar)
    df["ltf_highest_close"] = df["close"].shift(1).rolling(10).max()
    df["ltf_lowest_close"] = df["close"].shift(1).rolling(10).min()

    # VSA volume SMA is shifted by 1 for no-demand check
    df["sma_vol_20_prev"] = df["sma_vol_20"].shift(1)

    # -----------------------------------------------------------------------
    # Evaluate signals on the LAST completed bar
    # -----------------------------------------------------------------------
    bar = df.iloc[-1]
    prev_bar = df.iloc[-2] if len(df) >= 2 else bar

    bar_ts = bar.name  # DatetimeIndex timestamp

    o = float(bar["open"])
    h = float(bar["high"])
    lo = float(bar["low"])
    c = float(bar["close"])
    v = float(bar["volume"])

    ltf_highest = float(bar["ltf_highest"])
    ltf_lowest = float(bar["ltf_lowest"])
    ltf_highest_close = float(bar["ltf_highest_close"])
    ltf_lowest_close = float(bar["ltf_lowest_close"])
    sma_vol = float(bar["sma_vol_20"])
    sma_vol_prev = float(bar["sma_vol_20_prev"])
    sma_spread = float(bar["sma_spread_20"])
    bar_spread = h - lo

    # --- Liquidity sweeps ---
    sell_side_grab = (lo < ltf_lowest) and (c > ltf_lowest)
    buy_side_grab = (h > ltf_highest) and (c < ltf_highest)

    # --- VSA ---
    is_high_vol = v > sma_vol * 1.5
    vsa_shakeout = (
        is_high_vol
        and bar_spread > sma_spread
        and c > (lo + bar_spread * 0.6)
        and htf_bullish
    )
    vsa_no_demand = (
        v < sma_vol_prev * 0.5
        and bar_spread < sma_spread
        and c > o
        and htf_bearish
    )

    # --- 10-bar breakout ---
    # crossover: previous close was below threshold, current close is above
    prev_close = float(prev_bar["close"])
    prev_highest_close = float(prev_bar["ltf_highest_close"]) if "ltf_highest_close" in prev_bar else ltf_highest_close
    prev_lowest_close = float(prev_bar["ltf_lowest_close"]) if "ltf_lowest_close" in prev_bar else ltf_lowest_close

    bullish_break = (c > ltf_highest_close) and (prev_close <= prev_highest_close)
    bearish_break = (c < ltf_lowest_close) and (prev_close >= prev_lowest_close)

    # --- Kill zone ---
    in_kz = _in_killzone(bar_ts, killzone)

    # --- Kill switch ---
    kill_switch_active = consecutive_losses >= max_losses

    # -----------------------------------------------------------------------
    # Determine direction
    # -----------------------------------------------------------------------
    can_trade = in_kz and not kill_switch_active

    long_condition = (
        can_trade
        and htf_bullish
        and (sell_side_grab or vsa_shakeout)
        and bullish_break
    )
    short_condition = (
        can_trade
        and htf_bearish
        and (buy_side_grab or vsa_no_demand)
        and bearish_break
    )

    if long_condition and short_condition:
        # Rare edge: both fire on same bar — skip to FLAT
        long_condition = False
        short_condition = False
        warnings.append("Both LONG and SHORT conditions fired simultaneously — signal suppressed.")

    # -----------------------------------------------------------------------
    # Build trigger description
    # -----------------------------------------------------------------------
    if long_condition:
        direction = "LONG"
        parts = []
        if sell_side_grab:
            parts.append("Sell-Side Liquidity Grab")
        if vsa_shakeout:
            parts.append("VSA Shakeout")
        parts.append("10-bar Bullish Close Breakout")
        trigger_desc = " + ".join(parts)
    elif short_condition:
        direction = "SHORT"
        parts = []
        if buy_side_grab:
            parts.append("Buy-Side Liquidity Grab")
        if vsa_no_demand:
            parts.append("VSA No-Demand")
        parts.append("10-bar Bearish Close Breakout")
        trigger_desc = " + ".join(parts)
    else:
        direction = "FLAT"
        # Build reason why no signal
        reasons = []
        if not in_kz:
            reasons.append("outside kill zone")
        if kill_switch_active:
            reasons.append(f"kill switch active ({consecutive_losses}/{max_losses} losses)")
        if not (htf_bullish or htf_bearish):
            reasons.append("HTF bias neutral")
        if not (sell_side_grab or buy_side_grab or vsa_shakeout or vsa_no_demand):
            reasons.append("no liquidity grab or VSA signal")
        if not (bullish_break or bearish_break):
            reasons.append("no 10-bar breakout")
        trigger_desc = "No signal — " + ("; ".join(reasons) if reasons else "conditions not met")

    # -----------------------------------------------------------------------
    # Levels & sizing
    # -----------------------------------------------------------------------
    entry_price = stop_price = tp1_price = runner_stop_init = runner_stop_be = None
    risk_dist = risk_dollars = None
    total_qty = tp1_qty = runner_qty = None
    entry_alert = tp1_alert = runner_alert = None

    if direction == "LONG":
        proposed_sl = min(lo, ltf_lowest)
        risk_dist = c - proposed_sl
        if risk_dist > 0:
            entry_price = c
            stop_price = proposed_sl
            tp1_price = c + risk_dist * rr_target
            runner_stop_init = proposed_sl
            runner_stop_be = c  # after TP1 hit
            risk_dollars = equity * (risk_pct / 100)
            qty = max(1, round(risk_dollars / (risk_dist * point_value)))
            total_qty = qty
            tp1_qty = max(1, math.floor(qty / 2))
            runner_qty = qty - tp1_qty
            entry_alert = (
                f'{{"action":"buy","symbol":"{symbol}",'
                f'"qty":{qty},"stop":{stop_price:.5g},"target":{tp1_price:.5g}}}'
            )
            tp1_alert = f'{{"action":"partial_exit_long","symbol":"{symbol}"}}'
            runner_alert = f'{{"action":"exit_long_be","symbol":"{symbol}"}}'
        else:
            direction = "FLAT"
            trigger_desc = "LONG signal suppressed — zero or negative risk distance"
            warnings.append("Proposed stop was at or above entry — signal suppressed.")

    elif direction == "SHORT":
        proposed_sl = max(h, ltf_highest)
        risk_dist = proposed_sl - c
        if risk_dist > 0:
            entry_price = c
            stop_price = proposed_sl
            tp1_price = c - risk_dist * rr_target
            runner_stop_init = proposed_sl
            runner_stop_be = c
            risk_dollars = equity * (risk_pct / 100)
            qty = max(1, round(risk_dollars / (risk_dist * point_value)))
            total_qty = qty
            tp1_qty = max(1, math.floor(qty / 2))
            runner_qty = qty - tp1_qty
            entry_alert = (
                f'{{"action":"sell","symbol":"{symbol}",'
                f'"qty":{qty},"stop":{stop_price:.5g},"target":{tp1_price:.5g}}}'
            )
            tp1_alert = f'{{"action":"partial_exit_short","symbol":"{symbol}"}}'
            runner_alert = f'{{"action":"exit_short_be","symbol":"{symbol}"}}'
        else:
            direction = "FLAT"
            trigger_desc = "SHORT signal suppressed — zero or negative risk distance"
            warnings.append("Proposed stop was at or below entry — signal suppressed.")

    # -----------------------------------------------------------------------
    # Warnings
    # -----------------------------------------------------------------------
    if direction != "FLAT":
        if not in_kz:
            warnings.append("Signal is outside the NYC kill zone window — paper only.")
        if kill_switch_active:
            warnings.append(f"Kill switch is active ({consecutive_losses} consecutive losses).")

    return SignalResult(
        symbol=symbol,
        generated_at=now,
        ltf_interval=ltf_df.attrs.get("interval", "unknown"),
        htf_interval=htf_df.attrs.get("interval", "unknown"),
        bar_timestamp=bar_ts,
        open=o,
        high=h,
        low=lo,
        close=c,
        volume=v,
        htf_bias=htf_bias,
        htf_close=htf_close_val,
        htf_ema50=htf_ema_val,
        in_killzone=in_kz,
        killzone_window=killzone,
        sell_side_liquidity_grab=sell_side_grab,
        buy_side_liquidity_grab=buy_side_grab,
        vsa_shakeout=vsa_shakeout,
        vsa_no_demand=vsa_no_demand,
        bullish_break=bullish_break,
        bearish_break=bearish_break,
        direction=direction,
        trigger_description=trigger_desc,
        entry=entry_price,
        stop_loss=stop_price,
        risk_distance=risk_dist,
        tp1=tp1_price,
        tp1_rr=rr_target,
        runner_stop_initial=runner_stop_init,
        runner_stop_after_tp1=runner_stop_be,
        equity=equity,
        risk_pct=risk_pct,
        risk_dollars=risk_dollars,
        point_value=point_value,
        total_qty=total_qty,
        tp1_qty=tp1_qty,
        runner_qty=runner_qty,
        consecutive_losses=consecutive_losses,
        max_losses=max_losses,
        kill_switch_active=kill_switch_active,
        entry_alert=entry_alert,
        tp1_alert=tp1_alert,
        runner_alert=runner_alert,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------

def _fmt(value: Optional[float], decimals: int = 2) -> str:
    if value is None:
        return "—"
    return f"{value:,.{decimals}f}"


def _price_decimals(price: float) -> int:
    """Guess appropriate decimal places from price magnitude."""
    if price >= 1000:
        return 2
    elif price >= 10:
        return 3
    elif price >= 1:
        return 4
    else:
        return 6


def to_json_dict(result: SignalResult) -> dict:
    """Serialise a SignalResult to a plain dict (JSON-compatible)."""
    pd_ = _price_decimals(result.close)
    return {
        "symbol": result.symbol,
        "generated_at": result.generated_at.isoformat() + "Z",
        "ltf_interval": result.ltf_interval,
        "htf_interval": result.htf_interval,
        "current_bar": {
            "timestamp": str(result.bar_timestamp),
            "open": round(result.open, pd_),
            "high": round(result.high, pd_),
            "low": round(result.low, pd_),
            "close": round(result.close, pd_),
            "volume": round(result.volume, 4),
        },
        "htf_bias": result.htf_bias,
        "htf_close": round(result.htf_close, pd_),
        "htf_ema50": round(result.htf_ema50, pd_),
        "in_killzone": result.in_killzone,
        "killzone_window": result.killzone_window,
        "signal": {
            "direction": result.direction,
            "trigger": result.trigger_description,
            "entry": round(result.entry, pd_) if result.entry else None,
            "stop_loss": round(result.stop_loss, pd_) if result.stop_loss else None,
            "risk_distance": round(result.risk_distance, pd_) if result.risk_distance else None,
            "tp1": round(result.tp1, pd_) if result.tp1 else None,
            "tp1_rr": result.tp1_rr,
            "runner_stop_initial": round(result.runner_stop_initial, pd_) if result.runner_stop_initial else None,
            "runner_stop_after_tp1": round(result.runner_stop_after_tp1, pd_) if result.runner_stop_after_tp1 else None,
        },
        "sizing": {
            "equity": result.equity,
            "risk_pct": result.risk_pct,
            "risk_dollars": round(result.risk_dollars, 2) if result.risk_dollars else None,
            "point_value": result.point_value,
            "total_qty": result.total_qty,
            "tp1_qty": result.tp1_qty,
            "runner_qty": result.runner_qty,
        },
        "kill_switch": {
            "consecutive_losses": result.consecutive_losses,
            "max_allowed": result.max_losses,
            "active": result.kill_switch_active,
        },
        "conditions": {
            "sell_side_liquidity_grab": result.sell_side_liquidity_grab,
            "buy_side_liquidity_grab": result.buy_side_liquidity_grab,
            "vsa_shakeout": result.vsa_shakeout,
            "vsa_no_demand": result.vsa_no_demand,
            "bullish_break": result.bullish_break,
            "bearish_break": result.bearish_break,
        },
        "alerts": {
            "entry": result.entry_alert,
            "tp1": result.tp1_alert,
            "runner": result.runner_alert,
        },
        "warnings": result.warnings,
    }


def to_markdown(result: SignalResult) -> str:
    """Render a formatted trade card in Markdown."""
    pd_ = _price_decimals(result.close)

    def p(v):
        return _fmt(v, pd_) if v is not None else "—"

    ts_str = str(result.bar_timestamp)[:19]
    line = "━" * 45

    dir_symbol = {"LONG": "▲ LONG", "SHORT": "▼ SHORT", "FLAT": "◆ FLAT"}.get(result.direction, result.direction)

    bias_icon = {"bullish": "↑ BULLISH", "bearish": "↓ BEARISH", "neutral": "→ NEUTRAL"}.get(result.htf_bias, result.htf_bias.upper())
    kz_str = f"ACTIVE ({result.killzone_window} NYC)" if result.in_killzone else f"INACTIVE ({result.killzone_window} NYC)"

    lines = [
        f"## SMC + VSA Signal: {result.symbol} ({result.ltf_interval}) — {ts_str} UTC",
        line,
        f"**SIGNAL**    {dir_symbol}",
        f"**TRIGGER**   {result.trigger_description}",
        line,
        f"**HTF Bias**  {bias_icon}  ({result.htf_interval} close {p(result.htf_close)} vs EMA50 {p(result.htf_ema50)})",
        f"**Kill Zone** {kz_str}",
        line,
    ]

    if result.direction != "FLAT":
        risk_dist_pts = p(result.risk_distance)
        tp1_pts = p(result.tp1 - result.entry if result.tp1 and result.entry else None)
        lines += [
            f"**Entry**          {p(result.entry)}",
            f"**Stop Loss**      {p(result.stop_loss)}  (−{risk_dist_pts} pts)",
            f"**TP1**            {p(result.tp1)}  (+{tp1_pts} pts | {result.tp1_rr}R)",
            f"**Runner Stop**    {p(result.runner_stop_after_tp1)}  (BE after TP1)",
            line,
            f"**Position Size**  {result.total_qty} unit{'s' if (result.total_qty or 0) != 1 else ''}  "
            f"(TP1: {result.tp1_qty} / Runner: {result.runner_qty})",
            f"**Risk**           ${_fmt(result.risk_dollars, 2)}  ({result.risk_pct}% of ${_fmt(result.equity, 0)})",
            line,
        ]
    else:
        lines += [
            "**Entry**          —",
            "**Stop Loss**      —",
            "**TP1**            —",
            line,
        ]

    ks_str = (
        f"🛑 ACTIVE  ({result.consecutive_losses}/{result.max_losses} losses)"
        if result.kill_switch_active
        else f"OK  ({result.consecutive_losses}/{result.max_losses} consecutive losses)"
    )
    lines.append(f"**Kill Switch**    {ks_str}")

    if result.direction != "FLAT" and result.entry_alert:
        lines += [
            line,
            "**Alert Payloads**",
            f"Entry:  `{result.entry_alert}`",
        ]
        if result.tp1_alert:
            lines.append(f"TP1:    `{result.tp1_alert}`")
        if result.runner_alert:
            lines.append(f"Runner: `{result.runner_alert}`")

    if result.warnings:
        lines += [line, "**Warnings**"]
        for w in result.warnings:
            lines.append(f"⚠ {w}")

    # Individual condition flags
    cond_lines = []
    flag = lambda b: "✓" if b else "✗"
    cond_lines.append(
        f"{flag(result.sell_side_liquidity_grab)} Sell-Side Liq Grab  "
        f"{flag(result.buy_side_liquidity_grab)} Buy-Side Liq Grab  "
        f"{flag(result.vsa_shakeout)} VSA Shakeout  "
        f"{flag(result.vsa_no_demand)} VSA No-Demand  "
        f"{flag(result.bullish_break)} Bull Break  "
        f"{flag(result.bearish_break)} Bear Break"
    )
    lines += [line, "**Conditions**", cond_lines[0]]

    return "\n".join(lines)
