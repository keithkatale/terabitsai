# Smart Money Concepts (SMC) Trading Guide

Smart Money Concepts (SMC) is a trading methodology focused on tracking institutional activity ("Smart Money") by analyzing market structure, liquidity sweeps, and price imbalances. Rather than relying purely on retail indicators (like RSI or retail chart patterns), SMC seeks to understand where major banks and institutions place their orders and trigger stops.

---

## 1. Core Structural Elements

Market structure is the foundation of SMC. Price moves in cycles of trend continuation and trend reversal.

### 1.1 Break of Structure (BOS)
A **Break of Structure (BOS)** occurs when the price continues its existing trend by breaking and closing beyond a previous swing high (in an uptrend) or swing low (in a downtrend).

* **Bullish BOS:** Price closes above the previous swing high. Confirms trend continuation.
* **Bearish BOS:** Price closes below the previous swing low. Confirms trend continuation.

```
Bullish BOS:
          High (Broke!)
           / \      / \  <-- Closes above previous high
          /   \    /   \
  Swing  /     \  /
  High _/       \/
       /
```

### 1.2 Change of Character (CHOCH) / Market Structure Shift (MSS)
A **Change of Character (CHOCH)** is the first signal of a potential trend reversal. It occurs when price breaks and closes below the last swing low in an uptrend, or above the last swing high in a downtrend.

* **Bearish CHOCH:** In an uptrend, the price fails to make a higher high, and instead breaks below the last higher low (HL) that led to the highest high (HH).
* **Bullish CHOCH:** In a downtrend, the price fails to make a lower low, and instead breaks above the last lower high (LH) that led to the lowest low (LL).

---

## 2. Order Blocks (OB)

**Order Blocks (OB)** represent areas where institutions have accumulated massive buy or sell positions. When price returns to these zones, it often reacts strongly because unfilled institutional orders are resting there.

### 2.1 Bullish Order Block
* **Definition:** The last down-close (bearish) candle before a strong bullish expansion that breaks market structure (BOS or CHOCH).
* **Execution Rule:** Wait for price to return to the Bullish OB. Place limit buy orders at the open/50% (mean threshold) of the OB candle, with a stop loss placed just below the low of the OB.

### 2.2 Bearish Order Block
* **Definition:** The last up-close (bullish) candle before a strong bearish expansion that breaks market structure (BOS or CHOCH).
* **Execution Rule:** Wait for price to return to the Bearish OB. Place limit sell orders at the open/50% of the OB candle, with a stop loss placed just above the high of the OB.

---

## 3. Fair Value Gaps (FVG) / Imbalances

A **Fair Value Gap (FVG)** is an imbalance in price action created by a rapid, one-sided movement where buyers or sellers completely dominate the market, leaving no opportunity for two-way trading.

### 3.1 Detecting FVGs (3-Candle Sequence)
An FVG is detected across a sequence of three consecutive candles:

* **Bullish FVG (Imbalance of Buyers):**
  * Created when the **Low of Candle 3** is higher than the **High of Candle 1**.
  * The gap between Candle 1 High and Candle 3 Low is the Fair Value Gap (rest of the zone is unfilled).
  * This gap acts as a "magnet" where price is highly likely to retrace in the future to "fill" or "mitigate" the imbalance.

```
Candle 1: [High] ───┐
                    │  <─── Bullish FVG Zone (Unfilled Buying Imbalance)
Candle 3: [Low]  ───┘
```

* **Bearish FVG (Imbalance of Sellers):**
  * Created when the **High of Candle 3** is lower than the **Low of Candle 1**.
  * The gap between Candle 1 Low and Candle 3 High is the Bearish FVG.

### 3.2 Mitigation
An FVG is considered **mitigated** (filled) when price subsequently retraces back through the gap, tapping or fully covering the unfilled price area.

---

## 4. Liquidity Pools & Sweeps

Smart Money moves price to find liquidity. Liquidity exists where retail traders place their stop losses.

### 4.1 Sell-Side Liquidity (SSL)
* Located below relative equal lows (Double Bottoms) and swing lows.
* Institutions drive price below these lows to trigger retail sell stops (which are sell market orders). This allows institutions to buy massive positions at discount prices.
* **SMC Setup:** A **Liquidity Sweep** occurs when price briefly pierces below a swing low, grabs the SSL, and immediately reverses, closing back inside the range.

### 4.2 Buy-Side Liquidity (BSL)
* Located above relative equal highs (Double Tops) and swing highs.
* Retail stop losses for short positions are buy market orders.
* Institutions drive price above these highs to trigger retail buy stops, allowing them to sell their long positions or enter short positions at premium prices.

---

## 5. Premium vs. Discount Zones

Never buy high or sell low. SMC divides a trading range (from Swing Low to Swing High) into two halves:

1. **Premium Zone (Top 50%):** Area where prices are expensive. Ideal for finding Bearish Order Blocks and entering short positions.
2. **Discount Zone (Bottom 50%):** Area where prices are cheap. Ideal for finding Bullish Order Blocks and entering long positions.
3. **Equilibrium (Exact 50%):** Neutral pricing level.

* **Rule:** Only enter Longs in the **Discount Zone** (below 50% Fib retracement) and Shorts in the **Premium Zone** (above 50% Fib).

---

## 6. SMC Pre-Trade Checklist

When combining SMC into an AI agent decision matrix, follow this execution protocol:

1. **Identify the Major Trend (Daily/4H):** Are we making bullish BOS or bearish BOS?
2. **Locate the Trading Range:** Find the current Swing High and Swing Low.
3. **Mark Premium & Discount Zones:** Determine if the current price is below 50% (Discount - look for buys) or above 50% (Premium - look for sells).
4. **Locate Unmitigated OBs & FVGs:**
   * Is there an unmitigated Bullish OB sitting in the Discount Zone?
   * Is there an FVG resting just above or within the OB?
5. **Wait for Liquidity Sweep & CHOCH (15M/5M):**
   * Let price sweep Sell-Side Liquidity.
   * Look for a Bullish CHOCH (reversal) on the lower timeframe.
   * Enter on the retest of the lower timeframe Order Block.
