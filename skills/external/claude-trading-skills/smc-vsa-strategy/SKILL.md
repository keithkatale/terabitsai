---
name: smc-vsa-strategy
description: >
  Analyze any tradable asset (stocks, crypto, forex, futures, indices) using the SMC + VSA
  Mechanical Strategy v2. Detects liquidity sweeps, VSA shakeout/no-demand patterns, and
  10-bar close breakouts filtered by Higher-Timeframe EMA bias and NYC kill-zone windows.
  Calculates risk-adjusted position sizing (accounts for instrument point value), partial TP
  levels, trailing runner stops, and a consecutive-loss kill switch. Use when the user asks
  for SMC/VSA signal analysis, trade entry/stop/target levels, position sizing for a given
  asset, or wants to display current trade information from this strategy.
---

# SMC + VSA Mechanical Strategy v2

## Overview

This skill implements the full **Smart Money Concepts (SMC) + Volume Spread Analysis (VSA)
Mechanical Strategy v2** as a Python analysis tool. It ingests OHLCV data (via `yfinance` or
a user-supplied CSV) and produces structured trade signals complete with entry, stop-loss,
and two-leg exit levels (partial TP1 + runner), plus per-trade position sizing that accounts
for instrument point value.

### Core Signal Logic (ported from Pine Script)

| Layer | What is detected |
|---|---|
| **Macro Bias (HTF)** | 50-period EMA on a 4H chart — bullish if close > EMA, bearish if close < EMA |
| **Liquidity Sweep** | *Sell-side grab* (wick below N-bar low, closes above) → bullish. *Buy-side grab* (wick above N-bar high, closes below) → bearish |
| **VSA Shakeout** | High-volume, wide-spread bar closing in upper 40% of range when HTF is bullish |
| **VSA No-Demand** | Low-volume, narrow-spread up-close when HTF is bearish |
| **Entry Trigger** | 10-bar close breakout (crossover above highest close / crossunder below lowest close) |
| **Kill Zone** | NYC session 03:00–11:00 EST Mon–Fri (configurable) |

### Risk Management

- **Risk per trade**: configurable % of equity (default 1 %)
- **Stop-loss**: swing low/high of the signal bar
- **TP1**: entry + (risk distance × RR ratio, default 3×)
- **Runner stop**: entry price (breakeven) once TP1 is hit; otherwise original stop
- **Kill switch**: halts new entries after N consecutive losing positions (default 2)
- **Max intraday loss**: circuit-breaker at 5 % equity loss (informational — enforced by broker)
- **Point value**: position size accounts for `syminfo.pointvalue` (critical for futures)

---

## When to Use

- User asks: "Give me the SMC/VSA signal for BTC", "Analyze EURUSD with the SMC strategy"
- User wants entry/stop/target levels for any asset using this strategy
- User requests position sizing for a specific account size and risk %
- User wants to see a formatted trade card / trade information summary
- User wants to understand whether the current bar is inside the NYC kill zone

---

## Prerequisites

- **Python 3.10+** with `yfinance`, `pandas`, `numpy`, `pytz` installed
- No API keys required — `yfinance` is free for historical data
- For real-time execution, the user must supply live OHLCV data or connect a broker API

---

## Workflow

### Step 1: Run the signal analyser

```bash
python3 skills/external/claude-trading-skills/smc-vsa-strategy/scripts/analyze_smc_vsa.py \
  --symbol BTCUSD \
  --ltf-interval 15m \
  --htf-interval 4h \
  --equity 10000 \
  --risk-pct 1.0 \
  --rr-target 3.0 \
  --max-losses 2 \
  --lookback 50 \
  --output-dir reports/
```

**Key parameters**

| Flag | Default | Description |
|---|---|---|
| `--symbol` | required | Ticker (e.g. `BTCUSD`, `EURUSD=X`, `ES=F`, `AAPL`) |
| `--ltf-interval` | `15m` | Lower-timeframe candle interval |
| `--htf-interval` | `4h` | Higher-timeframe candle interval (macro bias) |
| `--equity` | `10000` | Account equity in USD |
| `--risk-pct` | `1.0` | Risk per trade as % of equity |
| `--rr-target` | `3.0` | TP1 risk-to-reward ratio |
| `--max-losses` | `2` | Consecutive-loss kill-switch threshold |
| `--lookback` | `50` | N-bar lookback for liquidity highs/lows |
| `--point-value` | `1.0` | Instrument point value (e.g. 50 for ES futures) |
| `--killzone` | `03:00-11:00` | NYC kill-zone window (HH:MM-HH:MM) |
| `--output-dir` | `reports/` | Directory for JSON + Markdown output |

### Step 2: Read and present the output

The script writes two files:

- `smc_vsa_<SYMBOL>_<YYYYMMDD_HHMMSS>.json` — machine-readable signal data
- `smc_vsa_<SYMBOL>_<YYYYMMDD_HHMMSS>.md` — formatted trade card

Present the Markdown trade card to the user and highlight:
1. **Current Signal** — LONG / SHORT / FLAT + confidence factors
2. **Entry Zone** — close of trigger bar (or current price)
3. **Stop-Loss** — swing low/high with pips/$ distance
4. **TP1** — first target and partial exit quantity
5. **Runner Target** — trailing stop once TP1 is hit
6. **Position Size** — contracts / shares / units
7. **Risk** — $ amount and % of equity
8. **Kill Zone Status** — whether the current bar is in the active window
9. **HTF Bias** — bullish / bearish based on EMA

### Step 3: Explain the signal to the user

After presenting the trade card, explain in plain language:
- Why the signal fired (which conditions triggered)
- What the HTF bias is and why it aligns (or doesn't)
- The specific liquidity grab or VSA pattern detected
- Any warnings (kill switch active, outside kill zone, etc.)

---

## Output Format

### JSON schema

```json
{
  "symbol": "BTCUSD",
  "generated_at": "2026-07-02T06:00:00Z",
  "ltf_interval": "15m",
  "htf_interval": "4h",
  "current_bar": {
    "timestamp": "2026-07-02T05:45:00Z",
    "open": 62100.5,
    "high": 62850.0,
    "low": 61900.0,
    "close": 62750.0,
    "volume": 1452.3
  },
  "htf_bias": "bullish",
  "htf_close": 62700.0,
  "htf_ema50": 60100.0,
  "in_killzone": true,
  "signal": {
    "direction": "LONG",
    "trigger": "sell_side_liquidity_grab + bullish_break",
    "entry": 62750.0,
    "stop_loss": 61850.0,
    "risk_distance": 900.0,
    "tp1": 65450.0,
    "tp1_rr": 3.0,
    "runner_stop_initial": 61850.0,
    "runner_stop_after_tp1": 62750.0
  },
  "sizing": {
    "equity": 10000,
    "risk_pct": 1.0,
    "risk_dollars": 100.0,
    "point_value": 1.0,
    "total_qty": 1,
    "tp1_qty": 1,
    "runner_qty": 0
  },
  "kill_switch": {
    "consecutive_losses": 0,
    "max_allowed": 2,
    "active": false
  },
  "conditions": {
    "sell_side_liquidity_grab": true,
    "buy_side_liquidity_grab": false,
    "vsa_shakeout": false,
    "vsa_no_demand": false,
    "bullish_break": true,
    "bearish_break": false
  }
}
```

### Markdown trade card example

```
## SMC + VSA Signal: BTCUSD (15m) — 2026-07-02 06:00 UTC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SIGNAL      ▶  LONG
TRIGGER        Sell-Side Liquidity Grab + 10-bar Close Breakout
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HTF Bias    ▶  BULLISH  (4H close 62700 > EMA50 60100)
Kill Zone   ▶  ACTIVE  (03:00–11:00 NYC)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entry          62,750.00
Stop Loss      61,850.00  (−900 pts)
TP1            65,450.00  (+2,700 pts | 3.0R)
Runner Stop    62,750.00  (BE after TP1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Position Size  1 unit  (split: TP1 1 / Runner 0)
Risk           $100.00  (1.0% of $10,000)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Kill Switch    OK  (0 / 2 consecutive losses)
```

---

## Strategy Reference

Full Pine Script source and mathematical derivations are in:

```
references/pine_script_source.pine       # Original v6 Pine Script
references/strategy_logic.md             # Plain-English logic walkthrough
```

---

## Resources

- `references/pine_script_source.pine` — verbatim Pine Script source for the strategy
- `references/strategy_logic.md` — plain-English description of every signal rule with edge cases
- `scripts/analyze_smc_vsa.py` — main CLI entry point
- `scripts/signals.py` — pure signal-calculation library (importable, no I/O)
- `scripts/tests/test_signals.py` — unit tests for signal logic
