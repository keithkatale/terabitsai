# SMC + VSA Mechanical Strategy v2 — Logic Reference

## Architecture Overview

The strategy has three independent filter layers that must all align for a trade:

```
Layer 1: Macro Bias (HTF EMA)        ← "Are we in a bullish or bearish environment?"
Layer 2: Setup Signal (Sweep / VSA)  ← "Has smart money just grabbed liquidity?"
Layer 3: Entry Trigger (LTF Break)   ← "Is price now confirming the reversal?"
```

A LONG fires when: `HTF Bullish AND (Sell-Side Sweep OR VSA Shakeout) AND 10-bar Bull Break AND Kill Zone AND No Kill Switch`

A SHORT fires when: `HTF Bearish AND (Buy-Side Sweep OR VSA No-Demand) AND 10-bar Bear Break AND Kill Zone AND No Kill Switch`

---

## Layer 1: Macro Bias (Higher Timeframe EMA)

**Timeframe**: 4H (default, configurable via `--htf-interval`)
**Indicator**: 50-period Exponential Moving Average of close

```
htf_bullish_bias = htf_close > htf_ema_50
htf_bearish_bias = htf_close < htf_ema_50
```

**Rationale**: The HTF EMA acts as a trend filter. Trading against the 4H trend dramatically reduces edge; this single filter eliminates the majority of counter-trend losing trades.

---

## Layer 2: Setup Signals

### 2a. Sell-Side Liquidity Grab (Bullish)

```
sell_side_grab = (low < lowest_low_of_prev_N_bars) AND (close > lowest_low_of_prev_N_bars)
```

**What it means**: Price swept below the most recent support / swing lows (triggering stop-loss orders placed there), then immediately recovered above that level within the same bar. This is the classic "stop hunt" that institutional traders use to fill large buy orders at artificially depressed prices.

**Direction**: BULLISH — indicates buy-side institutional accumulation.

**Critical note (Fix #1)**: The original strategy had the direction inverted. A sweep of SELL-SIDE liquidity (below lows) is bullish, not bearish.

### 2b. Buy-Side Liquidity Grab (Bearish)

```
buy_side_grab = (high > highest_high_of_prev_N_bars) AND (close < highest_high_of_prev_N_bars)
```

**What it means**: Price swept above the most recent resistance / swing highs (triggering buy-stop orders and stop-runs on shorts), then closed back below that level. Institutions distributed into the artificial demand spike.

**Direction**: BEARISH — indicates sell-side institutional distribution.

### 2c. VSA Shakeout (Bullish)

```
vsa_shakeout = (volume > sma_volume_20 * 1.5)                    # Unusually high volume
            AND (spread > sma_spread_20)                           # Wide-range bar
            AND (close > low + spread * 0.6)                       # Closes in upper 40%
            AND htf_bullish_bias                                    # Aligned with HTF trend
```

**What it means**: A high-volume, wide-range bar that closes in its upper portion signals that smart money absorbed selling pressure (a "shakeout" of weak hands). The strong close indicates buyers won the intrabar battle.

**Direction**: BULLISH (only active when HTF bias is bullish).

### 2d. VSA No-Demand (Bearish)

```
vsa_no_demand = (volume < sma_volume_20_prev * 0.5)              # Half the average volume
             AND (spread < sma_spread_20)                          # Narrow range
             AND (close > open)                                    # Up-close bar
             AND htf_bearish_bias                                  # Aligned with HTF trend
```

**What it means**: An up-close bar on extremely low volume and narrow range means there is no real buying demand — the weak rally is unsupported and likely to fail. Smart money is not participating in the move up.

**Direction**: BEARISH (only active when HTF bias is bearish).

---

## Layer 3: Entry Trigger (10-Bar Close Breakout)

```
ltf_highest_close = highest(close[1], 10)   # highest of previous 10 bars' closes
ltf_lowest_close  = lowest(close[1], 10)    # lowest of previous 10 bars' closes

bullish_break = close crosses above ltf_highest_close   # current close > 10-bar high
bearish_break = close crosses below ltf_lowest_close    # current close < 10-bar low
```

**Important caveat**: This is a 10-bar **close** breakout, NOT a structural Change-of-Character (CHoCH). It is a momentum confirmation that price is following through in the direction of the setup. The setup (sweep/VSA) must have occurred on a recent bar for the signal to be meaningful.

---

## Kill Zone Filter

The strategy only takes trades during the NYC Killzone: **03:00–11:00 Eastern Time, Monday–Friday**.

This maps to approximately:
- 08:00–16:00 UTC in winter (UTC-5)
- 07:00–15:00 UTC in summer (UTC-4, daylight saving)

**Rationale**: The London-New York overlap (roughly 08:00–12:00 EST) produces the highest institutional order flow and the most reliable liquidity grabs. Trading outside these hours exposes the strategy to thin, manipulated markets.

---

## Position Sizing (Fix #2)

```python
risk_amount   = equity * (risk_pct / 100)
qty           = max(1, round(risk_amount / (risk_distance * point_value)))
tp1_qty       = max(1, floor(qty / 2))
runner_qty    = qty - tp1_qty
```

**Why `point_value` matters**: For ES futures, 1 point = $50. Without accounting for point value, a 10-point stop on ES would appear to risk $10 instead of $500. The formula ensures `risk_amount` always equals the user's intended % of equity regardless of the instrument.

---

## Exit Logic (Fix #3)

### TP1 (Partial Exit)
- **Quantity**: `tp1_qty` (floor of half the total position)
- **Price**: `entry + risk_distance * rr_target` (default 3R)
- **Stop**: original `stop_loss_price` while waiting for TP1

### Runner (Trailing Exit)
- **Quantity**: `runner_qty` (total minus tp1_qty)
- **Stop before TP1**: original `stop_loss_price` (same as TP1 stop)
- **Stop after TP1 is hit**: entry price (breakeven)

**Why fixed quantities (Fix #3)**: Using `qty_percent` against a shrinking position after a partial exit leads to incorrect fill quantities. Fixed contract counts set at entry time eliminate this bug.

---

## Kill Switch (Fix #4)

```
daily_losses  resets to 0 at the start of each new day
consecutive_losses increments only when a COMPLETE POSITION closes in a loss
    (equity at close < equity at open of that position)
consecutive_losses resets to 0 when a COMPLETE POSITION closes in profit
```

New entries are blocked when `consecutive_losses >= max_daily_loss` (default 2).

**Why this matters (Fix #4)**: A two-leg exit (TP1 + runner) was previously counted as two separate closed trades. The original kill switch would fire after a single losing trade if that trade used partial exits, because the second leg would trigger the second "loss" count. The corrected logic tracks equity at position open and checks equity at the moment the position fully closes to zero.

---

## Alert Webhook Payloads

When a signal fires, the strategy emits JSON alert messages suitable for forwarding to a broker webhook:

**Entry (Long)**:
```json
{"action": "buy", "symbol": "BTCUSD", "qty": 2, "stop": 61850.0, "target": 65450.0}
```

**Entry (Short)**:
```json
{"action": "sell", "symbol": "BTCUSD", "qty": 2, "stop": 63500.0, "target": 59600.0}
```

**Partial Exit (Long TP1)**:
```json
{"action": "partial_exit_long", "symbol": "BTCUSD"}
```

**Runner Exit (Breakeven Stop)**:
```json
{"action": "exit_long_be", "symbol": "BTCUSD"}
```
