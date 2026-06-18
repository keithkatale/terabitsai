# Risk Management Guide

Comprehensive risk management framework for automated trading.

## Core Risk Management Principles

1. **Never Risk the Account** - Max loss per trade should never blow up account
2. **Asymmetric Risk-Reward** - Win bigger than you lose
3. **Position Sizing** - Adjust for volatility
4. **Correlation Awareness** - Know what moves together
5. **Stress Testing** - Test against worst-case scenarios

## Position Sizing Methods

### Fixed Percentage Risk

**Method:** Risk = Account × Risk %

```
Account: $100,000
Risk per trade: 2% = $2,000
Stop loss distance: 50 pips = $500/pip
Position size: $2,000 / $500 = 4 pips/trade
```

**Advantages:**
- Simple to implement
- Scales with account growth
- Prevents catastrophic losses

**Disadvantages:**
- Ignores volatility (loses more in volatile markets)
- Fixed win rate may not suit strategy

### Volatility-Adjusted Sizing

**Method:** Position Size = (Account × Risk %) / (ATR × Multiplier)

```
Account: $100,000
Risk per trade: 2% = $2,000
ATR (14): 100 pips
Stop distance: 2 × ATR = 200 pips
Position size: $2,000 / (200 × 1) = 10 units
```

**Advantages:**
- Accounts for market volatility
- More consistent risk across markets
- Larger positions in calm markets, smaller in volatile

**Disadvantages:**
- More complex calculation
- Requires volatility calculation

### Optimal f (Fraction of Bankroll)

**Method:** Based on historical win rate and risk-reward

```
f = (Win Rate × Avg Win) - (Loss Rate × Avg Loss) / Avg Loss
```

**Advantages:**
- Mathematically optimal for long-term growth
- Accounts for strategy characteristics

**Disadvantages:**
- Prone to account blow-up (Kelly criterion: use f/4)
- Requires extensive historical data

**Recommended:** Use Kelly / 4 for safety margin

## Stop Loss Strategies

### ATR-Based Stop Loss

**Method:** Stop distance = N × ATR

```
Current price: 100
ATR (14): 2.5
Stop loss = 100 - (2 × 2.5) = 95
Risk per pip: 5 pips
```

**Best For:**
- Trend-following strategies
- Volatile markets
- Avoiding whipsaws

### Support/Resistance Stop Loss

**Method:** Place stop below support (long) or above resistance (short)

```
Entry: At support level (95)
Support (strong): 90
Stop loss: 89 (1 pip below support)
```

**Best For:**
- Mean reversion strategies
- Established support/resistance
- Higher conviction trades

### Time-Based Stop Loss

**Method:** Exit if trade doesn't move in direction within N candles

```
Entry signal: 3-candle pattern
Patience: 3-5 candles
No profit: Exit with small loss
```

**Best For:**
- Short-term strategies
- Timing-dependent setups
- Avoiding extended losses

### Trailing Stop Loss

**Method:** Stop follows price at fixed distance

```
Entry: 100
ATR: 2.5
Trailing stop: 2 × ATR = 5 pips below price
If price to 110: Stop moves to 105
If price to 105: Stop maintains at 105
Exit: If price touches 105
```

**Best For:**
- Trending markets
- Protecting profits
- Letting winners run

## Take Profit Strategies

### Partial Position Closing

**Method:** Close 1/3 at each resistance level

```
Entry: 100
Target 1 (1×ATR up): 102.5 - Close 33%
Target 2 (2×ATR up): 105 - Close 33%
Target 3 (3×ATR up): 107.5 - Close 33%
Remaining: Trailing stop
```

**Advantages:**
- Lock in profits incrementally
- Maintain upside exposure
- Reduces pressure on remaining position

### Risk-Reward Based Targets

**Method:** Target = Entry + (Entry - Stop) × Risk-Reward Ratio

```
Entry: 100
Stop: 95 (5 pip risk)
Target 1:1 = 105 (5 pip gain)
Target 1:2 = 110 (10 pip gain)
Target 1:3 = 115 (15 pip gain)
```

**Recommended Minimum:** 1:2 risk-reward ratio

### Resistance Level Targets

**Method:** Next resistance = Take profit

```
Entry: At support 95
First resistance: 100 - Sell 1/3
Second resistance: 105 - Sell 1/3
Third resistance: 110 - Sell 1/3
```

## Correlation and Portfolio Risk

### Measuring Correlation

**Correlation Scale:**
- +1.0: Perfect positive (move together)
- 0.0: No relationship
- -1.0: Perfect negative (inverse moves)

**Practical Thresholds:**
- > +0.7: Highly correlated, similar risk
- 0.3 to 0.7: Moderate correlation
- < 0.3: Low correlation, good diversification

### Portfolio Construction

**Maximum Correlated Exposure:**

```
Position 1 (BTC): 30% of portfolio
Position 2 (ETH): 20% of portfolio
Correlation BTC/ETH: 0.85 (highly correlated)
Combined crypto exposure: 50%
Remaining: 50% different assets (stocks, forex, etc.)
```

**Better Approach:**

```
Position 1 (Momentum strategy): 25%
Position 2 (Mean reversion): 25%
Position 3 (Arbitrage): 25%
Position 4 (Volatility): 25%
Correlation between strategies: < 0.5
Portfolio risk: Much lower than single strategy
```

## Leverage and Margin Risk

### Margin Calculation

**Maintenance Margin:** Minimum equity required = Position Value × Margin %

```
Stock position: $50,000
Margin requirement: 25%
Maintenance margin required: $12,500
Account equity: $15,000
Excess equity: $2,500
Can maintain position if account > $12,500
```

### Leverage Considerations

**Leverage Multiples:**
- 2x: Aggressive, suitable for institutions
- 3x: Very aggressive, high blow-up risk
- > 5x: Extremely risky, expects frequent profitable trades

**Recommended:** Start with no leverage, 1-2x max after experience

### Margin Call Prevention

1. **Monitor Equity Ratio** - Don't let it drop below 50%
2. **Set Position Limits** - Maximum leverage 2x account
3. **Track Correlation** - Don't lever multiple correlated assets
4. **Have Cash Buffer** - Keep 20-30% cash for emergencies

## Drawdown Management

### Maximum Drawdown Limits

**By Account Size:**
- Small account (< $10k): 15-20% max
- Medium account ($10k-$100k): 20-30% max
- Large account (> $100k): 30-40% max

**Strategy:**
1. Monitor equity daily
2. If equity drops 20%: Reduce position size 50%
3. If equity drops 30%: Stop trading, review strategy
4. If equity drops 40%: Pause all trading

### Recovery from Drawdown

**Required win rate to recover:**

```
20% drawdown: Need 25% gain to recover
30% drawdown: Need 43% gain to recover
40% drawdown: Need 67% gain to recover
50% drawdown: Need 100% gain to recover
```

**Implication:** Avoid large drawdowns - recovery takes time and larger wins

## Risk Limits Framework

### Daily Limits

```
Max daily loss: 3% of account
Max daily gain to take: 5% of account (move to trailing stop)
Reached: Stop trading for remainder of day
```

### Weekly Limits

```
Max weekly loss: 8% of account
Max correlation exposure: < 0.6
Rebalance if: Any position > 40% of portfolio
```

### Monthly Review

- Sharpe ratio analysis
- Drawdown duration
- Strategy performance vs. benchmark
- Adjust parameters or position sizing

## Black Swan Mitigation

### Tail Risk Hedging

**Insurance Strategy:**
- 95% of capital: Normal trading
- 5% of capital: Long volatility (VIX calls, long puts)

**Cost:** 0.5-1% annual, protects against 5-10% rare events

### Correlation Breaks

**Known Events:**
- Market crashes: All equities correlate to 0.9+
- Volatility spikes: Correlations break down
- Geopolitical events: Sector-specific correlation breaks

**Defense:**
- Hold uncorrelated assets (gold, long-dated bonds)
- Reduce leverage before known events
- Small position sizes in volatile periods

## Position Management During Trades

### Scaling In

**DCA (Dollar Cost Averaging)**
```
Signal triggered: BUY
Entry 1: 1/3 position at first support
Entry 2: 1/3 position at -1 ATR
Entry 3: 1/3 position at -2 ATR
Result: Lower average cost
```

### Scaling Out

**Profit Taking**
```
Large move: Scale out 1/3 at each target
Small move: Hold entire position
Reverse: Exit 100% if invalidated
```

### Mental Accounting

- **Avoid:** Taking losses as wins (closing with small gain)
- **Avoid:** Revenge trading after losses (increasing size)
- **Follow:** Mechanical rules, remove emotion

## Recommended Risk Management Setup

```
Position Size: 2% fixed risk per trade
Stop Loss: 2 × ATR below entry (long)
Take Profit: 1:2.5 risk-reward minimum
Max Daily Loss: 3% of account
Max Account Drawdown: 25-30%
Portfolio Diversification: 3-5 uncorrelated strategies
Leverage: 1x (no borrowing)
Rebalance: Weekly based on correlation
Review: Daily equity, monthly performance
```

This framework balances growth with capital preservation.
