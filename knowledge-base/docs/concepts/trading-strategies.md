# Trading Strategies Guide

Comprehensive guide to automated trading strategies for stocks, crypto, forex, and options.

## Strategy Categories

### 1. Trend-Following Strategies

**Momentum Trading**
- Enter in direction of established trend
- Use: MACD, ADX, MA crossovers
- Exit: When momentum indicators peak or support breaks
- Win Rate: 40-50%, but large winners compensate
- Best In: Strong trending markets
- Risk: Whipsaws at trend reversals

**Moving Average Crossover**
- Buy: Fast MA crosses above slow MA
- Sell: Fast MA crosses below slow MA
- Parameters: 20/50, 50/200, 12/26 for MACD
- Timeframe: 4H+ for automation
- Robustness: Robust in trending markets

### 2. Mean Reversion Strategies

**Range Trading**
- Buy at support, sell at resistance
- Use: Bollinger Bands, Support/Resistance levels
- Markets: 65-70% of time is range-bound
- Exit: Stop loss beyond level or moving average breakout
- Risk: Breakouts can be costly

**Pairs Trading (Statistical Arbitrage)**
- Long correlated asset A when underperforming B
- Short asset B when outperforming A
- Market neutral: Limits directional risk
- Beta: Close to zero
- Execution: Requires low latency infrastructure

**Fade Extreme RSI**
- Buy when RSI < 30 (oversold)
- Sell when RSI > 70 (overbought)
- Timeframe: Works better on 1H+
- Duration: Quick reversion, 1-5 candles typically
- Market condition: Range-bound markets

### 3. Arbitrage Strategies

**Index Arbitrage**
- Buy undervalued index components
- Short overvalued index futures
- Lock in spread before convergence
- Markets: Stock indices primarily
- Execution: High-frequency execution needed
- Profit: Small but consistent

**Cross-Exchange Arbitrage**
- Buy on exchange A at lower price
- Sell on exchange B at higher price
- Markets: Crypto markets (24/7), less in stocks
- Friction: Transfer fees, withdrawal delays
- Modern Challenge: Difficult due to low spreads in 2026

**Statistical Arbitrage**
- Identify correlated securities
- When divergence > threshold: long underperformer, short overperformer
- Exit: When prices reconverge
- Diversification: Multiple pairs reduce drawdown
- Edge: Exploits mean reversion over 1-30 day horizons

### 4. Volatility Strategies

**Volatility Mean Reversion**
- High VIX (crypto: DVOL) = buy opportunity
- Low volatility = risk environment shifting
- Strategy: Buy assets when IV elevated
- Inverse: Sell when IV contracts

**Straddle/Strangle (Options)**
- Buy call + put on earnings/events
- Profit if large move in either direction
- Risk: Time decay if move doesn't materialize
- Execution: Options markets only

**Volatility Breakout**
- Set stop loss distance = 2 × ATR
- Enter on breakout, tight stop
- Scale into winners
- Win Rate: 40-45%, large winners

### 5. News-Based Strategies

**Event-Driven**
- Trade on earnings, FDA decisions, economic data
- Crypto: Regulatory news, upgrades
- Pre-announcement positioning
- Post-announcement fade (news already priced in)

**Sentiment-Based**
- Monitor social media, option flow, whale movements
- Crypto: On-chain metrics, whale tracking
- Mean reversion after extremes (fear/greed index)

### 6. Time-Based Strategies

**Session Trading**
- NYSE open (first hour): High volatility
- NYSE close (last hour): Volume spike
- Forex: London open (GBP), US session overlap
- Crypto: 24/7, but more liquid at US hours

**Day-of-Week Effects**
- Monday: Often weak (weekend positioning)
- Thursday/Friday: Strength into weekend
- Month-end: Rebalancing flows
- Reduce position size around expiry

## Strategy Performance Metrics

### Win Rate vs. Risk-Reward

- High Win Rate (70%+) + Low RR (1:1): Moderate returns
- Moderate Win Rate (50-60%) + High RR (1:2-3): Strong returns
- Low Win Rate (40-45%) + Very High RR (1:4+): Largest returns if disciplined

### Return Metrics

- **Sharpe Ratio**: (Return - Risk-Free Rate) / Volatility
  - > 1.0: Good
  - > 2.0: Excellent
  - > 3.0: Institutional quality

- **Sortino Ratio**: Uses downside deviation instead of volatility
  - Penalizes drawdowns more than upswings
  - Higher than Sharpe typically

- **Calmar Ratio**: Return / Max Drawdown
  - > 1.0: Acceptable
  - > 2.0: Strong

### Drawdown Metrics

- **Max Drawdown**: Largest peak-to-trough decline
  - < 20%: Conservative
  - 20-40%: Moderate
  - > 40%: Aggressive

- **Consecutive Losses**: Biggest losing streak in trades
- **Recovery Time**: Candles to recover from max drawdown

## Strategy Selection by Market

### Stocks
- Best: Trend following, mean reversion around support/resistance
- Avoid: Arbitrage (low margins)
- Edge: Fundamental analysis + technical filters

### Cryptocurrency
- Best: Momentum, arbitrage, volatility
- Avoid: Long-term hold strategies (regulatory risk)
- Edge: 24/7 trading, global liquidity, volatility

### Forex
- Best: Trend following, carry trade, range trading
- Avoid: Rapid execution strategies (spread too wide)
- Edge: Leverage, currency fundamentals, central bank policies

### Options
- Best: Volatility strategies, event-driven
- Avoid: Directional bets (expensive, theta decay)
- Edge: Asymmetric payoffs, hedging

## Avoid These Mistakes

1. **Overfitting** - Strategy works in backtest but fails in live trading
2. **Ignoring Slippage** - Model assumes execution at exact prices
3. **Curve Fitting** - Too many parameters for data period
4. **Underestimating Fees** - Crypto 0.1%, stocks 0.005%, but add up
5. **Same Parameters Everywhere** - Market conditions change, adapt
6. **No Diversification** - Single strategy = single point of failure
7. **Ignoring Black Swans** - Limit position size for unexpected events
8. **No Risk Limits** - Account shouldn't blow up on one bad trade

## Portfolio Approach

**Optimal Setup:**
- 3-5 uncorrelated strategies
- Each strategy: ~20-30% of capital
- Portfolio Sharpe > individual strategies
- One drawdown doesn't destroy portfolio
- Diversification across: Markets, timeframes, logic
