# Market Regime Detector

**Category:** Market Regime Analysis  
**Status:** Production  
**Autonomous:** Yes  
**Priority:** 1

## Purpose

Classifies the current market as **uptrend**, **downtrend**, or **ranging** using breadth indicators, moving average analysis, and volatility measures. This regime classification informs strategy selection, position sizing, and risk management across the entire autonomous trading system.

## When to Use This Skill

### Automatic Triggers
- **Wealth Monitor Cycle Begins** — Invoked at the start of every monitor cycle to assess market conditions
- **Goal Strategy Requires Regime Adaptation** — When goal.md specifies regime-based strategy switching

### Manual Triggers
- User asks: "What is the current market regime?"
- User asks: "Should I be trading right now given market conditions?"
- User asks: "What strategy fits the current market?"

## Required Integrations

### Data Sources
1. **Capital.com OHLCV Candles**
   - Symbols: SPY, QQQ, BTCUSD (or user-specified breadth proxies)
   - Timeframes: 1D (primary), 1W (confirmation)
   - Lookback: 200 bars minimum for moving averages

### Knowledge References
- `knowledge-base/reference/strategies.json` — Regime-based strategy selection
- `knowledge-base/reference/indicators.json` — MA, ADX calculation methods

## Workflow

### 1. Data Collection
```typescript
// Fetch 1D and 1W candles for breadth proxies
const symbols = ['SPY', 'QQQ', 'BTCUSD'];
const timeframes = ['1D', '1W'];
const data = await fetchMultiTimeframeCandles(symbols, timeframes, 200);
```

### 2. Calculate Indicators
For each symbol:
- **20 SMA** (short-term trend)
- **50 SMA** (intermediate trend)
- **200 SMA** (long-term trend)
- **ADX (14)** (trend strength)
- **ATR (14)** (volatility)

### 3. Regime Classification Logic

#### Uptrend Criteria (Score +1 each)
- ✅ Price > 200 SMA
- ✅ 20 SMA > 50 SMA > 200 SMA (bullish alignment)
- ✅ ADX > 25 (strong trend)
- ✅ Price making higher highs & higher lows (last 20 bars)
- ✅ 1W timeframe confirms uptrend

**Score 4-5 → Uptrend (High Confidence)**  
**Score 3 → Uptrend (Medium Confidence)**

#### Downtrend Criteria (Score -1 each)
- ❌ Price < 200 SMA
- ❌ 20 SMA < 50 SMA < 200 SMA (bearish alignment)
- ❌ ADX > 25 (strong trend, but bearish)
- ❌ Price making lower highs & lower lows (last 20 bars)
- ❌ 1W timeframe confirms downtrend

**Score -4 to -5 → Downtrend (High Confidence)**  
**Score -3 → Downtrend (Medium Confidence)**

#### Ranging Criteria
- ↔️ Score between -2 and +2
- ADX < 25 (weak trend)
- Price oscillating around 50 SMA

**Score -2 to +2 → Ranging**

### 4. Breadth Aggregation
Average the regime scores across all symbols:
- If 2+ symbols agree on uptrend → **Uptrend**
- If 2+ symbols agree on downtrend → **Downtrend**
- Otherwise → **Ranging**

### 5. Confidence Calculation
```
Confidence = (Number of Agreeing Symbols / Total Symbols) × 100
```

Example:
- SPY: Uptrend (score 4)
- QQQ: Uptrend (score 5)
- BTC: Ranging (score 1)
- **Result: Uptrend, 67% confidence**

### 6. Strategy Recommendation
Query `strategies.json` for regime-specific strategies:

| Regime | Recommended Strategies |
|--------|------------------------|
| **Uptrend** | - Trend Following<br>- Breakout Trading<br>- Buy Dips<br>- Pyramid into Winners |
| **Downtrend** | - Short-Only<br>- Fade Rallies<br>- Stay Flat (if no short capability)<br>- Defensive Sectors Only |
| **Ranging** | - Mean Reversion<br>- Support/Resistance Trading<br>- Neutral Options Strategies<br>- Reduce Position Size |

## Output Format

```json
{
  "regime": "uptrend",
  "confidence": 67,
  "reasoning": "SPY and QQQ both above 200 SMA with bullish MA alignment. ADX at 32 indicates strong trend. However, BTCUSD is ranging with ADX at 18.",
  "recommended_strategy": "Trend Following",
  "symbol_breakdown": [
    { "symbol": "SPY", "regime": "uptrend", "score": 4 },
    { "symbol": "QQQ", "regime": "uptrend", "score": 5 },
    { "symbol": "BTCUSD", "regime": "ranging", "score": 1 }
  ],
  "next_review": "2026-06-25T00:00:00Z"
}
```

## Example Usage

### In Wealth Monitor Cycle
```typescript
// Called automatically during monitor cycle
const regime = await executeSkill('market-regime-detector', {
  symbols: goal.breadth_proxies || ['SPY', 'QQQ'],
  timeframes: ['1D', '1W']
});

// Use regime to adjust risk
if (regime.regime === 'downtrend' && regime.confidence > 70) {
  // Reduce max position size or go flat
  goal.max_position_pct = 0.5;  // Half normal size
  goal.max_open_positions = 1;   // Conservative
}

// Log reasoning to chat
logMonitorDirective(`
Market Regime: ${regime.regime.toUpperCase()} (${regime.confidence}% confidence)

${regime.reasoning}

Strategy adjustment: ${regime.recommended_strategy}
`);
```

### In Command Chat
```
User: What's the market regime right now?

AI: [Executes market-regime-detector skill]

Market Regime: UPTREND (67% confidence)

Analysis:
• SPY: Price at 450.23, above 200 SMA (432.10) with bullish MA alignment (20>50>200)
• QQQ: Price at 380.45, above 200 SMA (365.20) with strong ADX at 35
• BTCUSD: Ranging between 28K-32K with weak ADX at 18

Recommended Strategy: Trend Following
- Look for breakout setups above consolidation
- Buy dips to key moving averages (20/50 SMA)
- Trail stops using swing lows
- Target 2-3R on trending moves

Risk Adjustment: Normal position sizing (2% risk per trade)
```

## Testing & Validation

### Unit Tests
- [ ] Uptrend classification with all 5 criteria met
- [ ] Downtrend classification with all 5 criteria met
- [ ] Ranging classification with mixed signals
- [ ] Multi-symbol breadth aggregation logic
- [ ] Confidence calculation accuracy

### Integration Tests
- [ ] Fetch live data from Capital.com API
- [ ] Calculate all 5 indicators correctly
- [ ] Query strategies.json successfully
- [ ] Return valid JSON output format

### Edge Cases
- [ ] Missing data for one symbol (graceful degradation)
- [ ] All symbols disagree (default to ranging)
- [ ] API rate limits or timeouts
- [ ] Invalid timeframe requested

## Performance Expectations

- **Execution Time:** < 5 seconds (including API calls)
- **API Calls:** 6-9 requests (3 symbols × 2-3 timeframes)
- **Cache Duration:** 1 hour (regime rarely changes intraday)

## Related Skills

- `volatility-analyzer` — Adds volatility context to regime
- `trend-strength-scorer` — Deeper dive into trend quality
- `strategy-recommender` — Implements recommended strategy
- `portfolio-heat-calculator` — Adjusts sizing based on regime

## References

See `references/` folder for:
- `regime-classification-methodology.md` — Detailed scoring logic
- `ma-crossover-patterns.md` — Moving average interpretation
- `adx-thresholds.md` — Trend strength guidelines

## Changelog

### v1.0.0 (2026-06-24)
- Initial implementation
- 3-symbol breadth model (SPY, QQQ, BTC)
- Confidence scoring and strategy recommendations
