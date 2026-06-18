# Technical Analysis Guide

Technical analysis is the study of historical price and volume data to identify patterns and predict future price movements.

## Core Principles

1. **Price Discounts Everything** - All available information is already reflected in price
2. **Prices Move in Trends** - Trends persist and can be exploited
3. **History Repeats** - Similar patterns produce similar outcomes

## Candlestick Patterns

### Single Candle Patterns

**Doji**
- Body is nearly nonexistent; open ≈ close
- Signals indecision in the market
- Significance increases after strong moves (potential reversal)
- Best on higher timeframes (1H, 4H, daily)

**Hammer**
- Small body at top, long lower wick (2x body size)
- Bullish reversal at support
- Shows buyers pushed price up from lows
- Confirms with volume and support level validation

**Shooting Star**
- Small body at bottom, long upper wick
- Bearish reversal at resistance
- Shows sellers pushed price down from highs
- Opposite of hammer

**Spinning Top**
- Small body with wicks on both sides
- Signals indecision/consolidation
- Can precede breakouts

### Two Candle Patterns

**Bullish Engulfing**
- First candle: bearish/small
- Second candle: bullish, completely engulfs first
- Strong reversal signal at support
- Volume confirmation strengthens signal

**Bearish Engulfing**
- First candle: bullish/small
- Second candle: bearish, completely engulfs first
- Reversal at resistance
- Opposite of bullish engulfing

### Multi-Candle Patterns

**Morning Star**
- Three candles: bearish, small doji, bullish
- Strong bullish reversal at support
- Gap down then recovery
- Often appears in downtrends

**Evening Star**
- Three candles: bullish, small doji, bearish
- Strong bearish reversal at resistance
- Gap up then selloff
- Opposite of morning star

**Three White Soldiers / Three Black Crows**
- Three consecutive same-direction candles
- Soldiers: three bullish candles = strong uptrend
- Crows: three bearish candles = strong downtrend
- Continuation patterns in established trends

## Technical Indicators

### Trend Indicators

**Moving Averages (MA)**
- Simple MA: Average of N periods
- Exponential MA: Recent prices weighted more
- Golden Cross: Fast MA crosses above slow MA = bullish
- Death Cross: Fast MA crosses below slow MA = bearish
- Use: 20-period (short), 50-period (medium), 200-period (long)

**MACD (Moving Average Convergence Divergence)**
- MACD Line: 12-period EMA - 26-period EMA
- Signal Line: 9-period EMA of MACD
- Histogram: MACD - Signal
- Signals: 
  - MACD crosses above signal = buy
  - MACD crosses below signal = sell
  - Divergence with price = potential reversal

**ADX (Average Directional Index)**
- Measures trend strength (0-100)
- ADX > 25: Strong trend
- ADX < 20: Weak/ranging market
- +DI / -DI: Direction of trend

### Momentum Indicators

**RSI (Relative Strength Index)**
- Scale: 0-100
- Overbought: > 70 (potential sell)
- Oversold: < 30 (potential buy)
- Divergence: Price makes new high but RSI doesn't = reversal signal
- Useful for identifying extremes and exhaustion

**Stochastic Oscillator**
- Two lines: %K (fast) and %D (slow)
- Overbought: > 80
- Oversold: < 20
- Signals: K crosses D
- Better for ranging markets

**CCI (Commodity Channel Index)**
- Measures deviation from average price
- > +100: Overbought
- < -100: Oversold
- Mean reversion tool

### Volatility Indicators

**Bollinger Bands**
- Middle: 20-period SMA
- Upper: SMA + 2×StdDev
- Lower: SMA - 2×StdDev
- Signals:
  - Price touches upper band = resistance
  - Price touches lower band = support
  - Band squeeze = low volatility, breakout incoming
  - Band expansion = increasing volatility

**ATR (Average True Range)**
- Measures volatility magnitude
- High ATR: High volatility
- Low ATR: Low volatility
- Use for position sizing and stop-loss placement

### Volume Indicators

**Volume Profile**
- Shows volume at each price level
- High Volume Nodes: Support/resistance areas
- Use for identifying key price levels

**Money Flow Index**
- Incorporates volume and price
- Similar to RSI but volume-weighted
- Useful for divergence analysis

## Support and Resistance Levels

### Identification Methods

1. **Previous Price Levels** - Prices previously touched multiple times
2. **Round Numbers** - Psychological levels (100, 1000, etc.)
3. **Fibonacci Levels** - 23.6%, 38.2%, 50%, 61.8%, 78.6%
4. **Pivot Points** - Calculated from previous day's OHLC
5. **Trend Lines** - Lines connecting highs or lows
6. **Moving Averages** - Dynamic support/resistance

### Level Strength

- **Touches**: 1-2 touches = weak, 3+ touches = strong
- **Volume**: High volume at level = stronger
- **Time**: Longer held = stronger
- **Confluence**: Multiple methods identifying same level = very strong

### Trading Applications

- **Entry**: Buy near support, sell near resistance
- **Stop Loss**: Place below support (long) or above resistance (short)
- **Profit Targets**: Identify next resistance (long) or support (short)

## Confluence and Confirmation

### Combining Indicators

Best signals require confirmation from multiple sources:
- Candlestick pattern + support/resistance level
- Indicator signal + volume increase
- Trend indicator + momentum indicator
- Multiple timeframe confirmation (higher TF = stronger signal)

### Reliability Statistics

- Single indicator signal: 40-50% accuracy
- Two indicator confirmation: 60-65% accuracy
- Three+ indicator confirmation + pattern + level: 70-80% accuracy
- Signals on higher timeframes: More reliable than lower TF

## Timeframe Considerations

- **1-min to 5-min**: High noise, unreliable for algorithms
- **15-min to 1-hour**: Good for intraday trading
- **4-hour to Daily**: Best for swing trading
- **Weekly/Monthly**: Trend identification and long-term support/resistance

Signal reliability increases significantly on 1H+ timeframes.

## Risk Management in Technical Analysis

1. **Validate Support/Resistance** - Use multiple confirmation methods
2. **Risk-Reward Ratio** - Minimum 1:2 (risk $1 to make $2)
3. **Position Sizing** - Based on volatility (ATR) and account risk
4. **Stop Loss Placement** - Below support (long) or above resistance (short)
5. **Time Exit** - If signal fails after 3-5 candles, exit with small loss
