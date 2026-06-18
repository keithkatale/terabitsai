# Trading Agent Guidelines

Guidelines and instructions for AI agents implementing trading strategies.

## Agent Capabilities

### Decision-Making Framework

1. **Market Analysis** - Analyze price action, indicators, patterns
2. **Signal Generation** - Generate entry/exit signals based on strategy
3. **Position Management** - Adjust position sizes, manage exits
4. **Risk Control** - Monitor and enforce risk limits
5. **Performance Tracking** - Track metrics and adjust strategy

### Core Rules (Non-Negotiable)

1. **Risk First** - Never risk > 2% per trade
2. **Stop Losses** - Always set stops before entering
3. **Position Limits** - Never exceed max position limits
4. **Diversification** - Maintain correlation discipline
5. **Black Swans** - Limit position sizes for tail risk

## Analysis Process

### Pre-Trade Checklist

```
1. Market Condition Assessment
   - Trend: Up, down, or ranging?
   - Volatility: Low, normal, or high?
   - Volume: Higher or lower than average?
   - Support/Resistance: Identify key levels

2. Signal Confirmation
   - Primary signal: Is it present?
   - Secondary confirmation: 2+ indicators aligned?
   - Volume confirmation: Is volume supporting move?
   - Location: Near support (long) or resistance (short)?

3. Risk Assessment
   - Stop loss distance: 2 × ATR or support level?
   - Position size: 2% of account max
   - Risk-reward: Minimum 1:2 ratio
   - Account risk: Total open risk < 3% of account

4. Market Environment
   - Is VIX elevated? (Reduce sizes)
   - Economic news coming? (Widen stops)
   - Is current strategy performing? (Adapt if needed)
   - Time of day optimal? (Check session)

5. Execution Check
   - Broker online and responsive?
   - Spreads normal or wide? (Exit if too wide)
   - Liquidity sufficient? (Can close position if needed)
   - Order type: Limit (preferred) or market?
```

## Strategy Implementation

### Momentum Trading Implementation

```python
if EMA12 > EMA26 and MACD > Signal and Price > 50MA:
    if RSI > 50:
        ENTER_LONG()
        SET_STOP(entry - 2*ATR)
        SET_TARGET(entry + 2.5*ATR)
        POSITION_SIZE = account_risk / stop_distance
```

### Mean Reversion Implementation

```python
if price_near_support() and RSI < 30:
    if volume > average_volume:
        ENTER_LONG()
        SET_STOP(support - 0.5%)
        SET_TARGET(resistance)
        HOLD_TIME = 1-5 days
```

### Risk Management Implementation

```python
# Check before every trade
if total_open_risk > 3% of account:
    SKIP_TRADE()
    
if VIX > 30:
    REDUCE_POSITION_SIZE(0.5)
    
if daily_loss > 3%:
    STOP_TRADING_TODAY()
    
if max_drawdown > 30%:
    STOP_ALL_TRADING()
    ALERT_USER()
```

## Order Execution Guidelines

### Entry Rules

1. **Wait for Confirmation** - Don't FOMO in
2. **Use Limit Orders** - Avoid slippage
3. **Account for Spread** - Add 0.5-1% buffer
4. **Check Liquidity** - Can you exit if needed?
5. **Verify Signal** - Multiple confirmations

### Exit Rules

1. **Take Profits** - Don't be greedy
2. **Cut Losses Quickly** - Protect capital
3. **Trail Winners** - Let big moves run
4. **Time Exits** - Don't hold losing trades
5. **Review Exits** - Learn from every trade

## Performance Monitoring

### Daily Metrics to Track

```
- Portfolio value (USD and %)
- Daily P&L
- Number of trades
- Win rate (today)
- Largest position
- Total open risk
- Unrealized P&L by position
```

### Weekly Metrics

```
- Win rate (7 days)
- Average win vs loss
- Sharpe ratio
- Max drawdown
- Total return %
- Trading activity log
```

### Monthly Review

```
- Strategy performance
- Indicator hit rate
- Parameter tuning needs
- Sector exposure
- Correlation monitoring
- Risk metrics analysis
- Adjustment decisions
```

## Signal Quality Assessment

### High Confidence Signals (Trade)

- ✅ 3+ indicators aligned
- ✅ Support/resistance level present
- ✅ Volume confirming
- ✅ Risk-reward > 1:2.5
- ✅ Price at key level

### Medium Confidence (Consider)

- ⚠️ 2 indicators aligned
- ⚠️ Support/resistance near
- ⚠️ Volume neutral
- ⚠️ Risk-reward 1:2
- ⚠️ Early stage signal

### Low Confidence (Skip)

- ❌ Single indicator signal
- ❌ No support/resistance
- ❌ Low volume
- ❌ Risk-reward < 1:1
- ❌ Counter to trend

## Market Regime Adaptation

### Trending Market Strategy

```
- Use momentum strategies
- Wider stops (2-3 × ATR)
- Larger position sizes
- Follow trend indicators
- Avoid range trading
```

### Range-Bound Market Strategy

```
- Use mean reversion
- Tighter stops (support/resistance)
- Normal position sizes
- Support/resistance critical
- Avoid trend strategies
```

### High Volatility Adjustments

```
- Reduce all position sizes 50%
- Use wider stops (3 × ATR)
- Limit leverage to 1x
- Avoid scalping
- Focus on major pairs/stocks
```

### Low Liquidity Handling

```
- Skip trades if spreads wide
- Reduce position sizes
- Use limit orders only
- Wait for better liquidity
- Monitor order execution
```

## Error Handling

### Critical Errors (Stop All Trading)

1. **Broker Connection Lost** - Wait for reconnection
2. **Position Size Miscalculation** - Manual override
3. **System Crash** - Check positions immediately after restart
4. **Exchange Halted** - Stop trading, wait for resumption
5. **Account Margin Call** - Liquidate excess positions

### Warning Conditions (Reduce Activity)

1. **Spreads Widening** - Wait for normalization
2. **Volume Declining** - Reduce position sizes
3. **Unexpected Slippage** - Skip scalping strategies
4. **High Error Rate** - Review and adjust parameters

## Agent Behavioral Rules

### Do's ✅

- Always use stop losses
- Confirm signals with multiple indicators
- Respect risk limits religiously
- Diversify across strategies/markets
- Track and review every trade
- Adapt to market conditions
- Use position sizing based on volatility
- Monitor account drawdowns daily
- Scale position sizes with risk/reward
- Close partial positions at targets

### Don'ts ❌

- Don't trade without stops
- Don't chase losses with bigger bets
- Don't ignore risk limits
- Don't hold all capital in one position
- Don't trade illiquid assets
- Don't use excessive leverage
- Don't ignore support/resistance
- Don't skip confirmation checks
- Don't trade against the trend without strong signal
- Don't hold losers hoping for recovery

## Decision Matrix

### Entry Decision

```
Condition                          Action
Signal strong + Confirmation       ENTER with standard size
Signal moderate + Confirmation     ENTER with 50% size
Signal weak + No confirmation      SKIP
Conflicting signals                SKIP
High slippage expected             SKIP/REDUCE
Drawdown > 20%                    REDUCE SIZE 50%
Drawdown > 30%                    REDUCE SIZE 75%
Daily loss > 3%                   STOP TRADING
```

### Exit Decision

```
Condition                          Action
Target hit                         CLOSE full position or partial
Stop hit                          CLOSE immediately
Signal reversed                   CLOSE position
Thesis invalidated                CLOSE immediately
Hold period exceeded              CLOSE or trail stop
Profit 1R+ and risk/reward poor   CLOSE and move on
Losing trade after 3-5 candles    CLOSE quickly
Extreme volatility spike          CLOSE excess positions
```

## Performance Goals

### Realistic Expectations

- **Year 1**: Break-even to 10% return (focus on learning)
- **Year 2**: 10-20% annual return (consistent strategy)
- **Year 3+**: 20-40% annual return (optimized strategy)
- **Sharpe ratio**: Target > 1.5 (good) or > 2.0 (excellent)
- **Max drawdown**: Keep < 30% (acceptable)
- **Win rate**: 50-70% depending on strategy

### Unachievable Goals (Avoid These)

- ❌ 100%+ annual returns (not sustainable)
- ❌ Win every trade (unrealistic)
- ❌ No drawdowns (impossible)
- ❌ Trade every day profitably (extremely difficult)
- ❌ Consistent daily gains (doesn't work that way)

## Continuous Improvement

### Weekly Review Questions

1. What strategies worked this week?
2. What signals had the highest win rate?
3. Where did I take unnecessary losses?
4. Did I respect risk limits?
5. What indicators were most reliable?

### Monthly Optimization

1. Update indicator parameters
2. Adjust position sizing based on volatility
3. Review correlation of holdings
4. Test new signals on historical data
5. Adjust strategy thresholds if needed

### Quarterly Adjustments

1. Major parameter changes
2. Strategy mix rebalancing
3. Risk limit adjustments
4. Performance vs. benchmark analysis
5. Technology/infrastructure upgrades
