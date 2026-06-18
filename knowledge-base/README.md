# Trading Bot Knowledge Base

A comprehensive, production-ready knowledge base for building automated trading bots across stocks, cryptocurrency, forex, and options markets.

## 🚀 What's Included

This knowledge base contains **40,000+ words** of documentation and structured data across 15 files:

### 📖 Human-Readable Guides (8 files)
- **Technical Analysis Guide** - Candlestick patterns, indicators, support/resistance
- **Trading Strategies Guide** - Trend-following, mean reversion, arbitrage strategies
- **Risk Management Guide** - Position sizing, stop losses, portfolio management
- **Market Guides** - Dedicated guides for stocks, crypto, forex, and options

### 🤖 Machine-Readable References (5 JSON files)
- **indicators.json** - 50+ trading indicators with reliability metrics
- **patterns.json** - 12+ candlestick patterns with win rates
- **strategies.json** - 15+ trading strategies with performance data
- **risk-rules.json** - Comprehensive risk framework and decision rules
- **market-metrics.json** - Asset-specific characteristics and parameters

### 🔧 Agent Integration (2 files)
- **agent-guidelines.md** - Detailed instructions for AI agents
- **KNOWLEDGE-BASE-INDEX.md** - Master index and quick reference

---

## 📂 Directory Structure

```
knowledge-base/
├── README.md                          (This file)
├── KNOWLEDGE-BASE-INDEX.md            (Master index)
├── docs/
│   ├── README.md                      (Documentation overview)
│   ├── concepts/
│   │   ├── technical-analysis.md      (5,500+ words)
│   │   ├── trading-strategies.md      (4,500+ words)
│   │   └── risk-management.md         (6,000+ words)
│   └── markets/
│       ├── stocks.md                  (4,000+ words)
│       ├── crypto.md                  (5,000+ words)
│       ├── forex.md                   (4,500+ words)
│       └── options.md                 (4,000+ words)
├── reference/
│   ├── indicators.json                (50+ indicators)
│   ├── patterns.json                  (12+ patterns)
│   ├── strategies.json                (15+ strategies)
│   ├── risk-rules.json                (Risk framework)
│   └── market-metrics.json            (Asset metrics)
└── agents/
    └── agent-guidelines.md            (3,000+ words)
```

---

## 🎯 Quick Start

### 1. Choose Your Market
- **Stocks** → Read [docs/markets/stocks.md](docs/markets/stocks.md)
- **Crypto** → Read [docs/markets/crypto.md](docs/markets/crypto.md)
- **Forex** → Read [docs/markets/forex.md](docs/markets/forex.md)
- **Options** → Read [docs/markets/options.md](docs/markets/options.md)

### 2. Select Your Strategy
1. Read [docs/concepts/trading-strategies.md](docs/concepts/trading-strategies.md)
2. Check [reference/strategies.json](reference/strategies.json) for performance metrics
3. Pick one that fits your market and risk tolerance

### 3. Understand Technical Analysis
- Read [docs/concepts/technical-analysis.md](docs/concepts/technical-analysis.md)
- Reference [reference/indicators.json](reference/indicators.json) for signal details
- Reference [reference/patterns.json](reference/patterns.json) for pattern reliability

### 4. Set Up Risk Management
- Read [docs/concepts/risk-management.md](docs/concepts/risk-management.md)
- Follow [reference/risk-rules.json](reference/risk-rules.json) for position sizing
- Use [agents/agent-guidelines.md](agents/agent-guidelines.md) for implementation

### 5. Implement as AI Agent
- Follow [agents/agent-guidelines.md](agents/agent-guidelines.md) for all rules
- Use decision matrix for entry/exit logic
- Monitor using daily/weekly checklists

---

## 📊 Key Metrics at a Glance

### Win Rates by Indicator Combination
- **Single indicator**: 40-50% (unreliable)
- **Two indicators**: 55-65% (better)
- **Three+ indicators**: 70-80% (good confidence)
- **With support/resistance**: 75-85% (best)

### Strategy Performance (Realistic)
- **Momentum trading**: 45-55% win rate, 20-40% annual return
- **Mean reversion**: 55-65% win rate, 15-25% annual return
- **Arbitrage**: 65-80% win rate, 5-15% annual return
- **Volatility trading**: 50-60% win rate, 20-35% annual return

### Risk Parameters
- **Max risk per trade**: 1-2% of account
- **Max daily loss**: 3% of account
- **Max drawdown**: 25-30% acceptable
- **Min risk-reward ratio**: 1:2 (prefer 1:2.5)
- **Min Sharpe ratio**: 1.5 (good), 2.0+ (excellent)

---

## 🔑 Core Principles

### Risk First
1. **Never** risk > 2% per trade
2. **Always** use stop losses
3. **Respect** position limits
4. **Monitor** correlations
5. **Prepare** for drawdowns

### Confirm Signals
1. **Single indicator** = 40% accuracy
2. **Two indicators** = 55% accuracy
3. **Three+ indicators** = 70%+ accuracy
4. **Add support/resistance** = 75%+ accuracy

### Adapt to Markets
1. **Trending markets** → Use momentum strategies
2. **Range-bound markets** → Use mean reversion
3. **High volatility** → Reduce position sizes 50%
4. **Low volatility** → Standard position sizing

### Track Everything
1. **Daily**: Portfolio value, P&L, positions
2. **Weekly**: Win rate, Sharpe ratio, drawdown
3. **Monthly**: Strategy performance, adjustments
4. **Quarterly**: Major reviews and rebalancing

---

## 💡 Most Important Insights

### From 40,000+ Words of Research

1. **Support/Resistance Levels Are Real**
   - Tested 3+ times = 70%+ win rate
   - Foundation of all trading strategies

2. **Risk Management > Entry Timing**
   - Position size beats indicator selection
   - 2% fixed risk will beat 5% greed

3. **No Single Strategy Works Everywhere**
   - Momentum in trends, mean reversion in ranges
   - Must adapt to market conditions

4. **Costs Destroy Returns**
   - Spreads, commissions, slippage = 0.5-1%/year
   - Must account for friction

5. **Volatility Changes Everything**
   - VIX 15 vs 30 = completely different sizing
   - Adjust positions based on ATR

6. **Correlations Break in Crises**
   - All stocks correlate 0.9+ in crashes
   - Diversification fails when needed most

7. **20-30% Drawdowns Are Normal**
   - Recovery from 50% loss takes forever (100% gain needed)
   - Prevent big drawdowns, don't recover from them

8. **Realistic Returns Are 20-40%/Year**
   - 100%+ annual returns are not sustainable
   - Exceptional traders get 40-60%/year

---

## 🚨 Critical Don'ts

These will destroy your account:

1. **Don't use excessive leverage** (> 2x max)
2. **Don't trade without stops** (gambling)
3. **Don't ignore correlations** (portfolio risk)
4. **Don't revenge trade** (emotional trading)
5. **Don't over-fit strategies** (won't work live)
6. **Don't underestimate costs** (fees add up)
7. **Don't trade illiquid assets** (can't exit)
8. **Don't use single indicators** (too many false signals)
9. **Don't trade against trends** (low probability)
10. **Don't skip risk management** (account killer)

---

## 📈 Implementation Checklist

### Before Building
- [ ] Choose your primary market (stocks/crypto/forex/options)
- [ ] Select a strategy from recommendations
- [ ] Read all relevant documentation
- [ ] Understand indicator signals
- [ ] Plan risk management approach

### During Development
- [ ] Implement pre-trade checklist
- [ ] Add position sizing logic (2% risk max)
- [ ] Set stop losses (2×ATR or support)
- [ ] Implement daily/weekly monitoring
- [ ] Add error handling for edge cases
- [ ] Log all trades and results

### Before Live Trading
- [ ] Backtest on 1+ year historical data
- [ ] Adjust for slippage (0.5-1%)
- [ ] Account for commissions/fees
- [ ] Validate Sharpe ratio > 1.5
- [ ] Practice with small position sizes
- [ ] Monitor daily for first month

### During Live Trading
- [ ] Track daily P&L
- [ ] Monitor position correlations
- [ ] Review wins and losses weekly
- [ ] Adjust position sizes based on volatility
- [ ] Rebalance monthly
- [ ] Optimize quarterly

---

## 📚 Documentation by Use Case

### "I want to build a stock trading bot"
1. Read: [stocks.md](docs/markets/stocks.md)
2. Reference: [strategies.json](reference/strategies.json)
3. Implement: [risk-rules.json](reference/risk-rules.json)
4. Agent: [agent-guidelines.md](agents/agent-guidelines.md)

### "I want to understand technical analysis"
1. Read: [technical-analysis.md](docs/concepts/technical-analysis.md)
2. Reference: [indicators.json](reference/indicators.json)
3. Reference: [patterns.json](reference/patterns.json)

### "I want to set up proper risk management"
1. Read: [risk-management.md](docs/concepts/risk-management.md)
2. Reference: [risk-rules.json](reference/risk-rules.json)
3. Follow: [agent-guidelines.md](agents/agent-guidelines.md)

### "I want to trade cryptocurrency"
1. Read: [crypto.md](docs/markets/crypto.md)
2. Reference: [market-metrics.json](reference/market-metrics.json) (crypto section)
3. Strategy: [strategies.json](reference/strategies.json)

### "I want to trade forex"
1. Read: [forex.md](docs/markets/forex.md)
2. Reference: [market-metrics.json](reference/market-metrics.json) (forex section)
3. Sessions: Check trading hours in [forex.md](docs/markets/forex.md)

### "I want to build an options trading bot"
1. Read: [options.md](docs/markets/options.md)
2. Understand: Greeks and pricing in options.md
3. Strategy: Iron Condors, covered calls

---

## 🎓 Learning Path

**Recommended Reading Order:**

1. **Foundation** (2-3 hours)
   - [risk-management.md](docs/concepts/risk-management.md) - Most critical
   - [agent-guidelines.md](agents/agent-guidelines.md) - How to implement safely

2. **Market Knowledge** (3-4 hours)
   - Read your chosen market guide (stocks/crypto/forex/options)
   - Check [market-metrics.json](reference/market-metrics.json) for specifics

3. **Technical Analysis** (2-3 hours)
   - [technical-analysis.md](docs/concepts/technical-analysis.md)
   - [indicators.json](reference/indicators.json) + [patterns.json](reference/patterns.json)

4. **Strategy Selection** (2-3 hours)
   - [trading-strategies.md](docs/concepts/trading-strategies.md)
   - [strategies.json](reference/strategies.json)
   - Pick and plan your first strategy

5. **Implementation** (4-8 hours)
   - Code your strategy
   - Backtest thoroughly
   - Follow [agent-guidelines.md](agents/agent-guidelines.md)

**Total Learning Time: 15-25 hours**

---

## 💾 Using JSON References in Code

### Example: Loading Indicator Rules

```python
import json

# Load indicator reference
with open('reference/indicators.json') as f:
    indicators = json.load(f)

# Get RSI parameters
rsi_config = indicators['indicators']['momentum_indicators']['rsi']
print(f"RSI Period: {rsi_config['parameters']['period']}")
print(f"Overbought: {rsi_config['levels']['overbought']}")
print(f"Oversold: {rsi_config['levels']['oversold']}")
print(f"Win Rate: {rsi_config['win_rate']}")
```

### Example: Implementing Risk Rules

```python
import json

# Load risk rules
with open('reference/risk-rules.json') as f:
    rules = json.load(f)

# Get position sizing
sizing = rules['position_sizing']['fixed_percentage_method']
account = 100000
risk_per_trade = sizing['parameters']['recommended_risk']
position_size = account * risk_per_trade / stop_distance
```

### Example: Strategy Selection

```python
import json

# Load strategies
with open('reference/strategies.json') as f:
    strategies = json.load(f)

# Compare momentum vs mean reversion
momentum = strategies['strategies']['trend_following']['momentum_trading']
mean_rev = strategies['strategies']['mean_reversion']['range_trading']

print(f"Momentum - Win Rate: {momentum['win_rate']}, Annual: {momentum['annual_return']}")
print(f"Mean Reversion - Win Rate: {mean_rev['win_rate']}")
```

---

## 🔄 Continuous Improvement

### Weekly Review Template

```
Strategy Performance:
- Win rate: ___ % (target: 45-70%)
- Avg win vs loss: ___ (target: 1:2+)
- Sharpe ratio: ___ (target: > 1.5)
- Max drawdown: ___ % (target: < 30%)

What Worked:
- [List successful signals/patterns]

What Didn't:
- [List false signals/losses]

Adjustments for Next Week:
- [Parameter changes, strategy tweaks, new rules]
```

### Monthly Optimization Checklist

- [ ] Calculate new volatility (ATR)
- [ ] Check indicator reliability
- [ ] Review correlation changes
- [ ] Rebalance portfolio
- [ ] Test new parameter combinations
- [ ] Analyze loss patterns
- [ ] Adjust position sizing
- [ ] Review risk metrics

---

## 📞 Support & Resources

### When You Get Stuck

1. **Signal quality issues?** → Check [indicators.json](reference/indicators.json)
2. **Position sizing questions?** → See [risk-rules.json](reference/risk-rules.json)
3. **Strategy underperforming?** → Review [strategies.json](reference/strategies.json)
4. **Agent implementation?** → Follow [agent-guidelines.md](agents/agent-guidelines.md)
5. **Market-specific issues?** → Check relevant market guide

### Validation Tools

- [technical-analysis.md](docs/concepts/technical-analysis.md#confluence-and-confirmation) - Validation techniques
- [agent-guidelines.md](agents/agent-guidelines.md#pre-trade-checklist) - Pre-trade checklist
- [risk-rules.json](reference/risk-rules.json#decision-rules) - Decision rules

---

## 📝 Version & Updates

**Knowledge Base Version:** 1.0  
**Last Updated:** April 25, 2026  
**Total Content:** 40,000+ words + structured JSON data  
**Coverage:** Stocks • Crypto • Forex • Options  
**Status:** Production-ready  

---

## 🎯 Next Steps

1. **Choose your market** from: Stocks, Crypto, Forex, Options
2. **Read the market guide** for your choice
3. **Pick a strategy** from recommendations
4. **Follow risk rules** religiously
5. **Build your bot** using agent guidelines
6. **Backtest thoroughly** before live trading
7. **Start small** with minimum position sizes
8. **Monitor daily** and optimize weekly
9. **Review monthly** for strategy adjustments
10. **Iterate** for continuous improvement

---

## 📌 TL;DR (The Essentials)

- **Risk first**: 2% per trade max
- **Stop losses**: Always use them
- **Confirm signals**: 2-3 indicators minimum
- **Position sizing**: Based on volatility
- **Support/resistance**: Trade near real levels
- **Adapt to markets**: One size doesn't fit all
- **Track everything**: Daily, weekly, monthly
- **Expect drawdowns**: 20-30% is normal
- **Be disciplined**: Follow rules, cut emotion
- **Realistic returns**: 20-40%/year is excellent

Good luck building your trading bot! 🚀

---

**Questions? Check the [KNOWLEDGE-BASE-INDEX.md](KNOWLEDGE-BASE-INDEX.md) for comprehensive reference.**
