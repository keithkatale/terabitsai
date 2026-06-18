# Cryptocurrency Trading Guide

Comprehensive guide for algorithmic crypto trading strategies.

## Crypto Market Characteristics

### Trading Features
- **24/7 Trading:** No closing hours
- **High Volatility:** 2-5x higher than stocks
- **Global Markets:** Trading across time zones
- **Multi-Asset:** BTC, ETH, altcoins, L2 tokens
- **Emerging Liquidity:** Growing but fragmented

### Key Differences from Stock Trading

1. **Liquidity:** Spreads 10-100x wider than stocks
2. **Volatility:** 50-300% annual returns or losses possible
3. **Regulation:** Changing rapidly (may halt trading)
4. **Custody:** Self-custody or exchange risk
5. **Execution:** Many exchanges, varying fees/spreads

### Market Hours & Liquidity Patterns

- **US Trading Hours (9:30 AM - 4:00 PM EST):** Increased volume
- **Asian Markets (8 PM - 8 AM EST):** Secondary peak
- **Weekend:** Often lower liquidity
- **Events:** Regulatory news, upgrades, whale movements

## Crypto Assets for Automation

### Tier 1: Major Cryptocurrencies

**Bitcoin (BTC)**
- Market cap: > $1 trillion
- Liquidity: Excellent across all exchanges
- Volatility: ~40% annual
- Correlation: Market leader, influences all others
- Best for: Trend following, arbitrage

**Ethereum (ETH)**
- Market cap: > $500 billion
- Liquidity: Very good
- Volatility: ~50-60% annual
- Correlation: 0.85 with BTC
- Best for: Momentum, staking-related strategies

### Tier 2: Established Altcoins

**Large Cap Altcoins** (Market cap > $10B)
- Solana (SOL), Polkadot (DOT), Ripple (XRP), Cardano (ADA)
- Better liquidity than small caps
- Higher volatility than BTC/ETH
- Correlation with BTC: 0.7-0.85
- Use: For diversification within crypto

### Tier 3: Small Cap & DeFi Tokens

**Caution Zone:**
- Extreme volatility (200-500% swings)
- Pump & dump risk
- Low liquidity (wide spreads)
- Use only: Tiny position sizes (< 1% portfolio)

## Crypto-Specific Trading Strategies

### 1. Grid Trading

**Setup:**
- Define price range (support to resistance)
- Place orders in grid pattern (e.g., every 2% move)
- Buy grid levels: 50%, 70%, 90% of range
- Sell grid levels: Same spacing above current price
- Automatic: Sells trigger when price rises through levels

**Example:**
```
BTC at 50,000, range 48,000-52,000
Grid size: 2% apart = $1,000 per level
Buy orders: 49,000, 47,000, 45,000
Sell orders: 51,000, 53,000, 55,000
Profit: Lock in gains on each grid level
```

**Best For:**
- Range-bound markets
- Passive income in sideways market
- 24/7 automated execution

**Avoid:**
- Strong trending markets (orders work against you)
- Low liquidity coins (slippage too high)

### 2. DCA (Dollar Cost Averaging)

**Setup:**
- Fixed investment amount (e.g., $100)
- Fixed interval (daily, weekly, hourly)
- Automatic execution
- Long-term accumulation

**Example:**
```
Buy $100 of BTC every day regardless of price
High price days: Buy 0.001 BTC
Low price days: Buy 0.002 BTC
Result: Lower average cost over time
```

**Best For:**
- Long-term accumulation
- Removing emotion from timing
- Passive investing

### 3. Momentum on Higher Timeframes

**Setup:**
- Daily or 4H timeframe
- MACD crossover as entry signal
- ATR-based stop loss
- 1:2.5 risk-reward targets

**Entry Rules:**
```
MACD fast > MACD slow AND MACD histogram expanding
Price > 20-period MA
RSI > 50 (confirmation)
Enter on close of confirmation candle
```

**Exit Rules:**
```
MACD crossover back down
Price closes below 20-period MA
RSI < 30 (reversal)
Profit target hit (1:2.5 RR)
```

**Win Rate:** 45-55%
**Best In:** Trending markets

### 4. Mean Reversion on Short Timeframes

**Setup:**
- 1H or 4H timeframe
- RSI extremes (< 20 or > 80)
- Bollinger Band extremes
- Quick holding period (1-5 hours)

**Entry Rules:**
```
RSI < 20 AND price touches lower Bollinger Band
OR
RSI > 80 AND price touches upper Bollinger Band
```

**Exit Rules:**
```
RSI crosses 50
Opposite extreme hit
Time stop: 5 candles
Profit target: 1:2 risk-reward
```

**Win Rate:** 55-65%
**Best In:** Range-bound, 24H markets

### 5. Arbitrage Across Exchanges

**Setup:**
- Monitor price across Binance, Coinbase, Kraken
- Price difference > friction (fees + transfer time)
- Buy on cheap exchange, sell on expensive exchange
- Execute transfer automatically

**Example:**
```
BTC $50,000 on Binance
BTC $50,500 on Coinbase
Profit opportunity: $500
Less: Binance fee (0.1%) = -$50
Less: Transfer fee = -$10
Less: Coinbase fee (0.1%) = -$50
Net: $390 profit per BTC = 0.78%
Break-even if transfer takes 30 min
Automated execution: High frequency possible
```

**Modern Challenge:** Spreads have tightened significantly, arbitrage harder

### 6. Volatility Trading

**Setup:**
- Monitor implied volatility index for crypto
- Buy when volatility low (underpriced options)
- Sell when volatility high
- Or: Sell options when IV high, buy when IV low

**For Spot:**
- High volatility: Reduce position size, tighter stops
- Low volatility: Increase position size, wider stops
- Breakout expected: Use wider stops

**Win Rate:** Depends on direction, volatility strategy is directionally neutral

## Crypto-Specific Risk Management

### Exchange Risk
- Counterparty risk: Keep < 50% on any single exchange
- Self-custody: Use hardware wallet for holdings
- Insurance: Some exchanges have fund insurance (read terms)

### Volatility Adjustment
- BTC volatility spikes: Reduce all sizes 50%
- Funding rates extreme: Close leveraged positions
- Liquidation events: Often mean reversals (exploit)

### Regulatory Risk
- Monitor: SEC, CFTC statements, proposed regulations
- Strategy: Reduce holdings 2-3 days before major announcements
- Long-term: Diversify across jurisdictions/assets

### On-Chain Metrics to Monitor

**Whale Activity:**
- Large transfers to/from exchanges: Often precede moves
- Accumulation: Whales buying = bullish
- Distribution: Whales selling = bearish

**Network Health:**
- Hash rate: Mining security indicator
- Transaction volume: Network adoption
- Active addresses: User growth metrics

## Execution Considerations

### Liquidity Limitations

**Coin Categories:**
- Major pairs (BTC, ETH): Execute $1M+ easily
- Large altcoins: Execute $100k+ with slippage
- Small altcoins: Execute $10k+ gets impacted
- Micro caps: Only $1-5k tradable without slippage

### Fee Structure

**Binance (typical exchange):**
- Maker: 0.1%, Taker: 0.1%
- Volume discounts available (VIP 1-3)
- Withdrawal fees: Blockchain dependent ($5-50)
- Trading 10x/day: 1% of trades lost to fees

**Impact on Strategy:**
- Limit strategies requiring frequent trades
- Account for 0.5-1% annual drag from fees
- Use fee-reduction programs

### Custody and Cold Storage

**For Automation:**
- Use exchange API (custody risk)
- Or: Self-custody with automated withdrawals (slower)
- Or: Hybrid (90% cold storage, 10% exchange for trading)

**Recommended:** 
- < $10k portfolio: Exchange-based okay
- $10k-$100k: 70% cold, 30% exchange
- > $100k: 95% cold, 5% trading capital

## Backtesting Crypto Strategies

### Key Adjustments

1. **Volatility Regime Changes:** Crypto volatility changes dramatically
2. **Black Swan Events:** More common in crypto (protocol failures, hacks)
3. **Survivor Bias:** Many coins die (use only existing ones at backtest date)
4. **Regulatory Changes:** Sudden rule changes affect trading

### Reality Checks

- Crypto backtest performance > Live performance (2-4x gap)
- Include black swan tests (20%+ daily moves)
- Test on oldest data (less sophisticated market)

## Monitoring Dashboards

### Daily Metrics

```
Portfolio value (USD)
Daily change (%)
Largest position
Most volatile holding
Exchange holdings distribution
```

### Risk Metrics

```
Max drawdown (current)
Volatility (30-day)
Sharpe ratio (current month)
Win rate
Average trade duration
```

### Crypto-Specific

```
BTC dominance (BTC % of total crypto market)
ETH dominance
Fear & Greed Index
Funding rates (leveraged positions)
Whale movements (large transfers)
```

## Common Crypto Trading Mistakes

1. **Leverage Trading:** Liquidations happen fast (avoid)
2. **Margin Calls:** Exchange lends money, forces sells
3. **Slippage Underestimation:** 0.5-2% on large orders
4. **Ignoring Custody:** Exchange bankruptcy = lost funds
5. **Small Cap Coins:** High manipulation, fake volume
6. **News-Based FOMO:** Buy high, sell low pattern
7. **Not Rebalancing:** Winners get oversized
8. **Withdrawal Delays:** Can't exit when needed

## Recommended Setup for Crypto Trading

```
Pair: BTC/ETH (highest liquidity)
Strategy: Momentum on 4H + Mean reversion on 1H
Position Size: 2-3% risk per trade
Stop Loss: 2 × ATR (adjusted for volatility)
Take Profit: 1:2.5 risk-reward
Holding Period: 4 hours - 3 days
Leverage: 0x (no borrowing)
Diversification: Max 30% BTC, 25% ETH, 15% large alts, 30% cash
Rebalance: Daily based on volatility
Exit Conditions: Stops, targets, or time-based
```

This balances growth with crypto's inherent volatility.
