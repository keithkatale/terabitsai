# Options Trading Guide

Comprehensive guide for algorithmic options trading strategies.

## Options Basics

### Call vs Put

**Call Option:**
- Right to BUY at strike price
- Buyer: Profits if price > strike price
- Seller: Profits if price < strike price
- Premium: Amount paid/received upfront

**Put Option:**
- Right to SELL at strike price
- Buyer: Profits if price < strike price
- Seller: Profits if price > strike price
- Premium: Amount paid/received upfront

### Option Pricing (Greeks)

**Delta (Δ)**
- Change in option price per $1 move in stock
- Call Delta: 0 to 1 (ITM calls near 1, OTM near 0)
- Put Delta: 0 to -1 (ITM puts near -1, OTM near 0)
- Directional exposure: Delta × position size

**Gamma (Γ)**
- Change in Delta per $1 move in stock
- High Gamma = Delta changes quickly
- High Gamma = Risk if you're wrong (gamma burn)

**Theta (Θ)**
- Time decay per day
- Positive Theta: You make money from time passing
- Negative Theta: You lose money from time passing
- Sell options: Positive Theta, time decay is friend

**Vega (ν)**
- Change in option price per 1% IV change
- High Vega: Make money if IV expands
- Low Vega: Insulated from volatility changes
- Useful: Sell high IV, buy low IV

**Rho (ρ)**
- Change in option price per 1% interest rate change
- Smallest impact for most trades
- Generally ignored for shorter-term trading

## Algorithmic Options Strategies

### 1. Covered Call (Income Strategy)

**Setup:**
- Own 100 shares per contract
- Sell 1 call per 100 shares
- Capture premium income
- Keep shares if price stays below strike

**Example:**
```
Own 100 shares of AAPL at $150
Current price: $152
Sell 1 call, strike $155, expiration 30 days
Premium received: $2 = $200
Profit scenarios:
- Price < $155: Keep shares + $200 premium
- Price > $155: Shares called away at $155 × 100 = $15,500 + $200 premium
Downside: Shares called away if price rallies
```

**Best For:**
- Generating income on held positions
- Reducing cost basis
- Low conviction outlook

### 2. Cash-Secured Put (Income Strategy)

**Setup:**
- Have cash to buy 100 shares at strike price
- Sell put option
- If assigned: Buy shares, keep premium
- If not assigned: Keep premium

**Example:**
```
TSLA trading at $250
Sell 1 put, strike $240, expiration 30 days
Premium: $4 = $400 received
Scenarios:
- Stock stays > $240: Keep $400, no shares
- Stock falls to $230: Forced to buy at $240, pay $23,600 - $400 = $23,200
Effective cost basis: $236 per share
```

**Best For:**
- Buying stocks at discounted prices
- Income while waiting
- Positive outlook with margin of safety

### 3. Bull Call Spread (Limited Risk, Limited Reward)

**Setup:**
- Buy call at lower strike (long)
- Sell call at higher strike (short)
- Net debit paid upfront (max loss)
- Max profit: Difference between strikes - net debit

**Example:**
```
AAPL at $150
Buy $150 call, sell $155 call
Buy premium: $3
Sell premium: $1.50
Net debit: $1.50 per share = $150 total risk
Max profit: ($155 - $150 - $1.50) × 100 = $350
Breakeven: $150 + $1.50 = $151.50
```

**Best For:**
- Limited risk trading
- Bullish outlook with cost reduction
- Win rate higher than naked calls

**Risk:** Limited to net debit paid
**Reward:** Limited to spread width - net debit

### 4. Iron Condor (Range-Bound Strategy)

**Setup:**
- Sell call spread (above current price)
- Sell put spread (below current price)
- Profit if price stays between strikes
- Theta decay is friend (time works for you)

**Example:**
```
SPY at $400
Sell $402 call / buy $405 call = $0.50 credit
Sell $398 put / buy $395 put = $0.50 credit
Total credit: $1.00 = $100 per contract
Max profit: $100 (if SPY stays between $398-$402)
Max loss: $300 (if SPY moves beyond spreads)
Risk/reward: 3:1 (bad ratio, don't do this)
```

**Better setup:**
- Wider range (less loss risk)
- Closer strikes (higher probability)
- Credit > max loss (positive expectation)

**Best For:**
- Range-bound markets
- Vega positive (IV expansion helps)
- High win rate (70%+) but small winners

### 5. Straddle/Strangle (Volatility Play)

**Setup:**
- Straddle: Buy call + put at SAME strike
- Strangle: Buy call + put at DIFFERENT strikes (OTM)
- Profit if large move in EITHER direction
- Lose money if no move (theta decay)

**Example:**
```
AAPL at $150, before earnings
Buy $150 call: $3
Buy $150 put: $3
Total debit: $6
Breakeven: $144 or $156
Need 4% move to profit
Win if: Large gap up or down
Loss if: Small or no move
```

**Best For:**
- Earnings plays
- FDA decisions
- Events with expected volatility spike

**Timing:** Buy before event, sell after (don't hold through expiration)

### 6. Calendar Spread (Time Decay Play)

**Setup:**
- Sell near-term option (short theta)
- Buy longer-term option (long gamma)
- Profit from theta decay of short option
- Roll position as short expires

**Example:**
```
Sell 30-day call: Receive $2
Buy 60-day call: Pay $3
Net debit: $1
Profit: Short call expires worthless, keep premium
Loss: Stock moves sharply (long call loses less than short gains)
```

**Best For:**
- Stable stocks with predictable moves
- Consistent income generation
- Neutral outlook

## Greeks-Based Trading

### Delta Hedging

**Concept:** Buy/sell stock to offset option delta
**Use:** Reduce directional exposure, isolate other Greeks

**Example:**
```
Long 10 calls (delta 0.60 each) = delta +6.0
Buy 600 shares
Total delta = 0 (delta neutral)
Now profit from:
- Gamma (stock moves more)
- Theta decay is enemy
- Vega (IV expansion good)
```

### Vega Trading (Volatility)

**Strategy:** Sell high IV, buy low IV

**Implementation:**
```
VIX = 15 (low, underpriced volatility)
Buy straddle, wait for volatility spike
OR
VIX = 30 (high, overpriced volatility)
Sell straddle/condor, profit from IV crush
```

### Theta Trading (Time Decay)

**Strategy:** Sell options to collect theta

**Implementation:**
```
Covered calls: +theta
Cash-secured puts: +theta
Short straddle: Very high +theta (high risk)
Iron condor: +theta (limited risk better)
```

## Risk Management for Options

### Position Sizing

**Greeks-based sizing:**
```
Max delta per position: 200-300 (0.2-0.3 × account)
Max vega per account: 5-10k (IV change impact)
Max theta per position: +200 (time decay benefit)
Max gamma exposure: Limit to 10% account change
```

### Stop Losses

**Option-specific stops:**
- Close if loss > 50% of premium paid
- Close if profit target hit (don't get greedy)
- Close if thesis invalidated
- Time stop: Exit 3-5 days before expiration

### Avoid These Mistakes

1. **Naked Calls:** Unlimited loss potential (don't do)
2. **Selling Without Stop:** Assignment risk uncontrolled
3. **Holding to Expiration:** Time decay accelerates near expiry
4. **Ignoring IV Rank:** Same price, different profitability
5. **Too Many Legs:** 4+ leg spreads hard to manage
6. **Betting on Miracles:** Don't hold OTM options for miracle reversal

## Backtesting Options Strategies

### Key Challenges

1. **IV Modeling:** How does IV change with stock price?
2. **Bid-Ask Spread:** Options have wider spreads than stock
3. **Liquidity:** Not all strikes are liquid
4. **Slippage:** Wide slippage on options (1-2%)
5. **Assignment Risk:** Can be assigned unexpectedly

### Data Requirements

- Stock price history (OHLCV)
- Implied volatility time series
- Option bid-ask spreads (hard to get)
- Volume at each strike
- Dividend dates (affect put prices)
- Corporate actions (splits, etc.)

## Practical Execution

### Best Brokers for Options Automation

- **Interactive Brokers:** Professional tools, low commissions
- **E*TRADE:** Good options, research tools
- **TD Ameritrade:** Wide variety of options
- **Tastyworks:** Modern, options-focused

### Order Execution Tips

1. **Use Limit Orders:** Never market orders on options
2. **Target Bid-Ask Midpoint:** Better fills than extremes
3. **Size Matters:** Large spreads on illiquid options
4. **Time of Day:** Best liquidity 10 AM - 3 PM
5. **Close to Expiration:** Avoid last trading day (wide spreads)

### Market Hours for Options

- **Pre-market:** Limited options trading
- **Regular Hours (9:30 AM - 4 PM):** Full trading
- **After-hours:** Very limited
- **Best execution:** 10 AM - 3 PM EST

## Recommended Setup for Options Automation

```
Strategy: Iron Condor on liquid index (SPY, QQQ)
Timeframe: 45 days to expiration
Entry: 30-40 days before expiration
Strikes: 1 standard deviation (70% probability ITM)
Max width: $3 spread = manageable risk
Credit collected: > 1/3 max risk
Exit: 50% max profit or 21 days to expiration
Position size: 1-2 contracts to start
Max loss per contract: $300
Risk management: Stop at 2x credit received (6% account loss)
Greeks: Net short vega, net short theta
```

This approach balances theta decay benefits with risk control.
