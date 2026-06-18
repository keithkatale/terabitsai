# Forex Trading Guide

Comprehensive guide for algorithmic forex trading strategies.

## Forex Market Characteristics

### Market Structure
- **Largest Market:** $7 trillion+ daily volume
- **24/5 Trading:** Mon 5 PM EST - Fri 5 PM EST
- **Decentralized:** No central exchange
- **Pairs:** All trades are two currencies (e.g., EUR/USD)
- **Leverage:** Up to 50:1 available (high risk)

### Currency Pairs

**Major Pairs** (Account for 80% volume):
- EUR/USD: Euro vs US Dollar (most liquid)
- GBP/USD: British Pound vs US Dollar
- USD/JPY: US Dollar vs Japanese Yen
- USD/CHF: US Dollar vs Swiss Franc

**Characteristics:**
- Very tight spreads (0.1-0.5 pips)
- High liquidity
- Most algorithmic trading opportunities

**Minor Pairs:**
- EUR/GBP, EUR/JPY, GBP/JPY, etc.
- Wider spreads (0.5-2 pips)
- Lower volume

**Exotic Pairs:**
- USD/TRY, USD/BRL, etc.
- Very wide spreads (2-10+ pips)
- Low liquidity
- Avoid for automated trading

## Trading Sessions and Liquidity

### Session Times (EST)

**Tokyo Session:** 7 PM Sun - 4 AM Mon
- High JPY volatility
- Lower EUR/USD volume
- Best pairs: USD/JPY

**London Session:** 3 AM - 12 PM
- HIGHEST volume overall
- EUR/USD most active
- Spreads tightest
- **BEST for algorithmic trading**

**New York Session:** 8 AM - 5 PM
- Second highest volume
- Good liquidity EUR/USD
- Often contradicts London trends (reversal patterns)

**Overlap (8 AM - 12 PM):** London + New York
- MAXIMUM liquidity
- MINIMUM spreads
- OPTIMAL for execution

**Outside sessions:** Spreads widen 50-200%

## Forex-Specific Trading Strategies

### 1. Support/Resistance Trading

**Setup:**
- Identify key support/resistance levels
- Pairs: Major pairs (EUR/USD, GBP/USD)
- Timeframe: 4H or Daily
- Entry: Bounce from support (long) or resistance (short)

**Entry Rules:**
```
Price approaches support level (within 5-10 pips)
Wait for confirmation:
- Doji or hammer (reversal candle)
- Bounce from level (price turns up)
- Volume confirmation
Enter on breakout of confirmation candle
```

**Stop Loss:** 1% below support
**Target:** Next resistance level

**Win Rate:** 55-65%
**Best In:** Ranging markets

### 2. Trend Following (Moving Average)

**Setup:**
- Pair: EUR/USD (most liquid)
- Timeframe: Daily or 4H
- Moving Averages: 50 and 200 period

**Entry Rules:**
```
Price > 50-period MA > 200-period MA (uptrend)
MACD histogram is positive and expanding
RSI > 50
Enter on close of confirmation candle above 50-MA
```

**Exit Rules:**
```
Price closes below 50-period MA
OR MACD crosses below signal line
OR RSI crosses below 50
Use trailing stop at 50-MA
```

**Win Rate:** 45-55%
**Best In:** Strong trending markets

### 3. News Trading

**Setup:**
- Monitor economic calendar (NFP, ECB rate, GDP)
- Before news: Identify support/resistance, set wider stops
- After news: Fade the initial spike (trade reversal)
- Timing: Release often followed by 30-min pullback

**Strategy: Fade News Spike**
```
NFP released: USD surges
Usually: Move too far, reverts
Entry: Opposite of initial move, 15-30 min after release
Risk: 3% of account
Reward: Quick 1-2% reversion
```

**Best Pairs:** USD pairs (USD/JPY, EUR/USD)
**Caution:** High slippage during releases (spreads 50x normal)

### 4. Carry Trade

**Setup:**
- Borrow currency with low interest rate
- Lend currency with high interest rate
- Keep position for weeks/months
- Collect interest differential

**Example:**
```
Interest rates:
- Swiss Franc: 1.5% (borrow at 1.6%)
- NZD: 4.5% (lend at 4.3%)
Trade: Long NZD/CHF
Annual interest earned: 2.7%
Cost: Spread + commissions (0.5%)
Net: 2.2% annual without price movement
Upside: If NZD appreciates
Downside: If NZD depreciates
```

**Duration:** Days to months
**Win Rate:** 70%+ if interest covers depreciation
**Risk:** Currency depreciation against you

### 5. Correlation-Based Arbitrage

**Setup:**
- Monitor correlated pairs
- EUR/USD vs EUR/GBP vs GBP/USD
- When prices diverge > normal: Trade reverting to mean
- Positions: 2-3 correlated pairs

**Example: Triangular Arbitrage**
```
Current prices:
EUR/USD = 1.1000
EUR/GBP = 0.8600
GBP/USD = 1.2800

Theoretical GBP/USD = 1.1000 / 0.8600 = 1.2791
Actual GBP/USD = 1.2800
Divergence: +9 pips (0.07% profit)

Trade: 
1. Buy EUR/USD, Sell EUR/GBP, Buy GBP/USD
2. Lock in spread difference
3. Close all positions simultaneously
4. Profit: Spread - fees - slippage
```

**Execution:** Requires fast execution (milliseconds)
**Difficulty:** Modern market makers eliminate these quickly

## Leverage and Margin in Forex

### Leverage Basics

**Leverage Multiplier:**
- 10:1 leverage: Control $100k with $10k
- 20:1 leverage: Control $100k with $5k
- 50:1 leverage: Control $100k with $2k

**Risk:** Account blow-up if moves against you

**Calculation:**
```
Account: $10,000
Leverage: 10:1
Position size: $100,000
1% move: Gain/lose $1,000 = 10% of account
2% move: Gain/lose $2,000 = 20% of account
5% move: Account wiped out
```

### Recommended Leverage

- **Beginners:** 2:1 max
- **Experienced:** 5:1 max
- **Pros:** 10:1+ (with risk controls)

**Reality:** Most retail traders use too much leverage and lose money

## Risk Management for Forex

### Position Sizing with Volatility

**Forex ATR-based sizing:**
```
Currency pair: EUR/USD
ATR (14): 0.0045 (45 pips)
Account: $10,000
Risk per trade: 2% = $200
Stop loss distance: 2 × ATR = 90 pips = $900
Position size: $200 / $900 × 100,000 = 22,222 units
```

### Spread Costs

**Impact on Strategy:**
- Bid-ask spread EUR/USD: 0.1 pips = $1 per 100k units
- Round trip (buy then sell): 0.2 pips = $2 cost
- Trading 10 times/month: $20/month per $100k
- Annual impact: 0.24% drag on returns

**Implication:** Need > 0.3% per trade to be profitable

### Currency Correlation

**High Correlation Pairs:**
- EUR/USD and GBP/USD: 0.85+ (move together)
- USD/JPY and EUR/USD: -0.75 (inverse)
- USD/CHF and USD/CAD: 0.70 (similar factors)

**Portfolio Management:**
- Don't hold highly correlated pairs
- Max 2-3 USD pairs simultaneously
- Include inverse pairs for hedging

## Data and Execution

### Data Sources

- **Free:** OANDA, Dukascopy, FXCM (historical data)
- **Premium:** Bloomberg, Reuters Terminal
- **APIs:** OANDA API, IB Forex, Pepperstone API

### Execution Best Practices

1. **Use Limit Orders:** Avoid market orders (slippage)
2. **Trade During Overlaps:** London + NY = tightest spreads
3. **Avoid News Releases:** Spreads widen 50x during events
4. **Check Economic Calendar:** Anticipate volatility spikes
5. **Broker Selection:** Low spread (< 1 pip), fast execution

### Common Forex Brokers for Automation

- **OANDA:** Good API, reasonable spreads, educational
- **Interactive Brokers:** Low commissions, professional
- **Pepperstone:** Tight spreads, fast execution
- **Saxo Bank:** Advanced API, professional features

## Backtesting Considerations

### Unique Challenges

1. **Overnight Gaps:** Forex closes weekends, opens Monday
2. **News Events:** Many moves around economic data
3. **Spread Variability:** Spreads widen during news/low volume
4. **Liquidity Changes:** Less liquid during Asia session

### Reality Adjustments

- Backtest spreads: 0.5 pips major pairs (0.1 actual)
- Commission: $2-3 per round trip per 100k units
- Slippage: 0.5-2% on market orders
- Expect 30-50% performance degradation

## Monitoring and Adjustments

### Session-Based Adjustments

```
Tokyo session (low EUR/USD volume):
- Reduce EUR/USD position size 50%
- Focus on USD/JPY instead

London session (peak EUR/USD):
- Increase position size
- Best execution quality

After major economic release:
- Spreads may remain wide for 30 min
- Avoid new entries for 15-30 min post-release
```

### Daily Monitoring

- Account equity
- Largest position size
- Unrealized P&L
- Spread widening (indicator of stress)

## Common Forex Mistakes

1. **Too Much Leverage:** Most dangerous in forex
2. **Trading News:** Spreads too wide, slippage massive
3. **Ignoring Correlations:** Holding 3 highly correlated pairs
4. **Wrong Timeframes:** Scalping with wide spreads loses money
5. **Underestimating Costs:** Spreads + commissions add up
6. **Not Using Stops:** One big move can wipe account
7. **Trading Exotics:** Too illiquid, costs too high
8. **Revenge Trading:** Increasing size after losses

## Recommended Setup for Forex Automation

```
Pairs: EUR/USD, GBP/USD (major pairs)
Strategy: Support/resistance + trend following
Position Size: 2% risk per trade
Stop Loss: 2 × ATR (minimum 50 pips)
Take Profit: 1:2.5 risk-reward
Leverage: 5:1 maximum
Trading Sessions: London 3 AM - 12 PM EST (peak)
No leverage: Before major economic data
Rebalance: Weekly based on correlation
Exit: Stop, target, or signal reversal
Max Daily Loss: 3% of account
```

This approach balances forex's opportunities with its risks.
