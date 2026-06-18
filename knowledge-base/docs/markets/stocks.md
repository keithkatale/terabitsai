# Stock Trading Guide

Comprehensive guide for algorithmic stock trading strategies.

## Market Characteristics

### Trading Hours
- Regular: 9:30 AM - 4:00 PM EST (Monday-Friday)
- Pre-market: 4:00 AM - 9:30 AM EST (lower volume)
- After-hours: 4:00 PM - 8:00 PM EST (low liquidity)
- Recommended: Trade during regular hours for best liquidity

### Liquidity Patterns
- Opening 30 min: Very high volume, wide spreads initially
- 10 AM - 3 PM: Normal trading
- Final hour (3-4 PM): Volume spike, position closing
- Best for automation: Mid-day 10 AM - 2 PM

### Spreads
- Blue chips (AAPL, MSFT): 0.01-0.02%
- Mid-caps: 0.05-0.1%
- Small caps: 0.1-0.5%
- Impact: Costs add up quickly in frequent trading

## Stock Selection for Algorithms

### Criteria for Automated Trading

1. **Liquidity** - Average daily volume > $1M
2. **Price Range** - > $10 (avoid penny stocks)
3. **Beta** - 0.5-2.0 (not too stable, not too volatile)
4. **Market Cap** - > $500M (avoid illiquid companies)

### Universe Construction

**Screener Rules:**
```
Price > $10
Daily Volume > 1,000,000
Market Cap > $500M
Beta: 0.5 - 2.0
```

**Result:** ~500-1000 stocks eligible for automation

### Sector Considerations

- **Tech (FAANG):** High beta, momentum-driven, tight spreads
- **Finance:** Lower beta, news-driven, sensitive to rates
- **Energy:** Mean reversion, seasonal patterns
- **Healthcare:** Event-driven (FDA, earnings)
- **Consumer:** Economic sensitivity, demographic trends
- **Utilities:** Stable, dividend-driven, low volatility

## Algorithmic Trading Strategies for Stocks

### 1. Opening Range Breakout (ORB)

**Setup:**
- Define opening range: First 30 min of trading
- Track high and low of first 30 min
- Entry: Breakout above high or below low after 30 min
- Stop loss: Opposite of opening range
- Target: 1:3 risk-reward

**Win Rate:** 50-55%
**Best In:** Gap up/down situations
**Avoid:** Low volatility markets

### 2. Mean Reversion Around Support/Resistance

**Setup:**
- Identify key support/resistance levels
- RSI extremes (< 30 or > 70)
- Bollinger Band extremes
- Entry: Close to support (oversold) or resistance (overbought)
- Hold: 1-5 days

**Win Rate:** 55-65%
**Best In:** Range-bound markets
**Avoid:** Strong trends

### 3. Momentum + Moving Average Crossover

**Setup:**
- Buy: Price > 50-day MA AND RSI > 50
- Sell: Price < 50-day MA OR RSI < 50
- Timeframe: Daily
- Hold: Until reversal signal
- Size: 1-2% risk per trade

**Win Rate:** 45-55%
**Best In:** Trending markets
**Avoid:** Choppy, range-bound markets

### 4. Earnings Play

**Setup:**
- 3-5 days before earnings: Identify key levels
- Day before: Position based on volatility expectation
- Post-earnings: Fade moves (prices revert to fair value)
- Risk: Gap risk on earnings release (use wider stops)

**Win Rate:** 50-60% (directional is tough)
**Strategy:** Play volatility rather than direction

### 5. Dividend Capture

**Setup:**
- Buy 1-2 days before ex-dividend
- Hold through ex-date
- Sell day after
- Dividend yield > spread costs

**Win Rate:** ~70% (mechanistic)
**Best In:** High dividend stocks (utilities, REITs)
**Caution:** Tax implications, transaction costs

## Risk Management for Stocks

### Position Sizing
- Per stock: 1-3% of portfolio
- Sector max: 20% of portfolio
- Correlated holdings: Limit to 10% each

### Stop Loss Placement
- Support-based: 1-2% below key support
- ATR-based: 2 × ATR below entry
- Time-based: Exit if no profit in 3-5 days

### Market Risk Constraints
- **VIX > 30:** Reduce position size 50%
- **VIX > 40:** Reduce position size 75% or flat
- **Circuit breakers triggered:** Stop trading for remainder of day

### Sector Correlation

**High Correlation Pairs:**
- Oil companies (XLE)
- Banks (XLF)
- Tech stocks (XLK)
- Retail (XRT)

**Action:** If holding multiple from same sector, reduce total exposure

## Data and Execution

### Data Sources
- Reliable: Yahoo Finance API, Alpha Vantage, FRED
- Real-time: Bloomberg Terminal ($25k/year), Interactive Brokers
- Alternative: Polygon.io, IEX Cloud

### Order Execution

**For Automation:**
1. Use limit orders (not market orders)
2. Add 0.5-1% buffer to entry prices (slippage)
3. Assume commission: $0.50-2.00 per trade
4. Account for market impact on large orders

**Order Types:**
- Limit: Best for small orders
- TWAP: Executes over time to minimize impact
- VWAP: Volume-weighted average price

### Critical Timing

- First 15 min: High spreads, avoid
- 10 AM - 3 PM: Optimal execution
- Final hour: Volume spike, potentially wider spreads
- Pre/after-market: Avoid (low liquidity, large spreads)

## Backtesting Considerations

### Important Factors

1. **Slippage:** Assume 0.5-1% on limit orders
2. **Commissions:** $0.50-2.00 per round trip
3. **Market Impact:** Large orders move prices
4. **Survivorship Bias:** Some stocks delisted during period
5. **Regime Changes:** Market conditions change over time

### Reality Checks

- Backtest performance > Live performance (always)
- Expect 20-30% performance degradation
- Commissions/slippage: 0.5-1% per year
- Adjust backtest expectations accordingly

## Monitoring and Rebalancing

### Daily Checks
- Positions still meeting entry criteria?
- Risk metrics within limits?
- Market conditions changed (VIX, macro)?

### Weekly Review
- Win rate tracking
- Average win vs. average loss
- Correlation with S&P 500
- Sharpe ratio calculation

### Monthly Rebalance
- Adjust position sizes based on volatility
- Remove underperforming stocks
- Add new opportunities
- Review sector exposure

## Common Pitfalls

1. **Overfitting:** Strategy works in backtest but not live
2. **Ignoring costs:** Commissions and slippage destroy edge
3. **Survivorship bias:** Testing on dead stocks
4. **Not accounting for leverage:** Margin requirements can liquidate
5. **Ignoring liquidity:** Can't execute on illiquid stocks
6. **Correlation blindness:** Holding too many correlated stocks
7. **News/events:** Not accounting for earnings, splits, etc.

## Recommended Setup for New Traders

```
Universe: 100 liquid stocks with positive momentum
Strategy: Mean reversion around key support levels
Position Size: 1% risk per trade
Stop Loss: 2 × ATR below support
Take Profit: 1:3 risk-reward at next resistance
Holding Period: 1-5 days
Max Daily Loss: 3% of account
Rebalance: Weekly based on correlations
```

This setup balances consistency with growth potential.
