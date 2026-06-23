# Terabits AI Trading Skills Library

**Architecture for autonomous trading agent knowledge and decision-making capabilities**

## Architecture Overview

This skill library provides structured knowledge modules that the Wealth Monitor and Command AI use to make informed trading decisions. Skills are invoked automatically during the monitor cycle and available on-demand in Command chat.

### Design Principles

1. **Modular Composition** — Each skill focuses on one aspect of trading (technical analysis, risk management, market regime, etc.)
2. **Autonomous-First** — Skills integrate with the Wealth Monitor → Command → Capital.com execution flow
3. **Capital.com Native** — Built specifically for CFD trading on Capital.com (no multi-broker abstractions)
4. **Knowledge + Execution** — Combines pattern recognition knowledge with direct trade execution
5. **Context Persistence** — Skills reference goal.md, chat history, and the knowledge base

## Skill Categories

### 1. **Market Regime Analysis**
Helps the agent understand current market conditions and adjust strategy accordingly.

- `market-regime-detector` — Classify market as uptrend/downtrend/ranging
- `volatility-analyzer` — Assess current volatility vs historical norms
- `correlation-tracker` — Monitor asset correlations for portfolio risk
- `sector-rotation-detector` — Identify which sectors are leading/lagging

### 2. **Technical Analysis**
Pattern recognition and indicator interpretation for entry/exit timing.

- `multi-timeframe-analyzer` — Analyze alignment across 1H/4H/1D/1W timeframes
- `support-resistance-identifier` — Find key price levels dynamically
- `trend-strength-scorer` — Quantify trend quality (ADX, slope, consistency)
- `reversal-pattern-detector` — Recognize chart patterns (H&S, double top, etc.)
- `breakout-validator` — Confirm genuine breakouts vs fakeouts

### 3. **Risk Management**
Position sizing, stop-loss placement, and portfolio heat calculation.

- `position-sizer` — Calculate units based on account balance, ATR, and goal risk limits
- `stop-loss-optimizer` — Place stops at technical levels (not arbitrary %)
- `portfolio-heat-calculator` — Sum total risk across all open positions
- `correlation-risk-adjuster` — Reduce size when opening correlated positions
- `drawdown-monitor` — Track consecutive losses and recommend pause

### 4. **Trade Planning**
Pre-trade checklists and trade structure design.

- `trade-hypothesis-builder` — Document thesis, catalyst, invalidation
- `entry-timing-optimizer` — Wait for pullback vs chase momentum
- `profit-target-calculator` — R-multiple targets based on setup quality
- `trade-journaling-assistant` — Auto-log trades to memory with screenshots

### 5. **Execution Quality**
Post-trade review and continuous improvement.

- `trade-postmortem-analyzer` — Why did the trade win/lose? Was process followed?
- `slippage-tracker` — Compare intended vs actual fills
- `execution-timing-reviewer` — Analyze entry/exit timing quality
- `win-rate-analyzer` — Calculate expectancy by setup type, timeframe, asset

### 6. **Capital.com Specific**
Integration with Capital.com API and CFD mechanics.

- `spread-cost-calculator` — Factor in bid-ask spread for each asset
- `overnight-funding-estimator` — Calculate rollover costs for multi-day holds
- `liquidity-checker` — Validate sufficient liquidity before sizing
- `margin-requirement-calculator` — Ensure account can support new position

### 7. **Knowledge Integration**
Connect trading decisions to the structured knowledge base.

- `pattern-lookup` — Query chart patterns from `chart-patterns.json`
- `indicator-explainer` — Interpret indicator readings from `indicators.json`
- `strategy-recommender` — Suggest strategies from `strategies.json` based on regime
- `psychology-coach` — Apply risk rules from `trading-psychology.json`

## Skill File Structure

```
skills/
├── README.md                       # This file
├── skills-index.yaml               # Canonical metadata registry
├── market-regime/
│   ├── market-regime-detector/
│   │   ├── SKILL.md                # Skill definition (triggers, workflow, outputs)
│   │   ├── references/
│   │   │   └── regime-indicators.md
│   │   └── scripts/
│   │       └── classify_regime.py   # Optional: executable logic
│   ├── volatility-analyzer/
│   └── ...
├── technical-analysis/
│   ├── multi-timeframe-analyzer/
│   ├── support-resistance-identifier/
│   └── ...
├── risk-management/
├── trade-planning/
├── execution-quality/
├── capital-com-specific/
└── knowledge-integration/
```

## Skill Metadata Schema

Every skill is registered in `skills-index.yaml`:

```yaml
skills:
  - id: market-regime-detector
    name: Market Regime Detector
    category: market-regime
    status: production  # production | beta | experimental
    autonomous: true    # Can Wealth Monitor invoke this automatically?
    description: >
      Classifies current market as uptrend, downtrend, or ranging
      using breadth, moving averages, and volatility indicators.
    triggers:
      - "Wealth Monitor cycle begins"
      - "User asks: What is the current market regime?"
    integrations:
      data_required:
        - capital_com_candles  # 1H, 4H, 1D data from Capital.com
      knowledge_refs:
        - strategies.json       # References regime-based strategies
    outputs:
      - regime: uptrend | downtrend | ranging
      - confidence: 0-100
      - reasoning: Natural language explanation
    workflows:
      - wealth-monitor-cycle
      - command-market-check
```

## Integration with Existing Systems

### 1. Wealth Monitor Cycle
When the monitor runs, it can invoke skills to enhance analysis:

```typescript
// In wealth-monitor.ts
const regime = await invokeSkill('market-regime-detector', {
  symbols: ['SPY', 'QQQ', 'BTCUSD'],
  timeframe: '1D'
});

const analysis = `
Market regime: ${regime.regime} (confidence: ${regime.confidence}%)
${regime.reasoning}

Based on this regime, recommended strategy: ${regime.recommended_strategy}
`;
```

### 2. Command AI Access
Skills are exposed as tools to Command AI (similar to broker_action):

```typescript
const skillExecutionDeclaration = {
  name: "execute_skill",
  description: "Run a trading skill for analysis or decision support",
  parameters: {
    skill_id: { type: Type.STRING },
    inputs: { type: Type.OBJECT }
  }
};
```

### 3. Knowledge Base Binding
Skills reference the existing knowledge base:

```markdown
# In SKILL.md for pattern-lookup
## Knowledge References
- `knowledge-base/reference/chart-patterns.json` — Pattern definitions
- `knowledge-base/docs/concepts/elliott-wave.md` — Wave theory context
```

## Skill Development Workflow

1. **Identify Gap** — Monitor logs show repeated manual analysis → candidate for skill
2. **Design Skill** — Create `SKILL.md` with triggers, inputs, outputs, workflow
3. **Add Knowledge** — Populate `references/` with relevant trading knowledge
4. **Implement Logic** — Optional: Add executable script in `scripts/`
5. **Register** — Add entry to `skills-index.yaml`
6. **Test** — Verify skill works in both Wealth Monitor and Command contexts
7. **Document** — Update this README with examples

## Skill Invocation Modes

### Mode 1: Autonomous (Wealth Monitor)
```typescript
// Automatic during monitor cycle
const skills = ['market-regime-detector', 'portfolio-heat-calculator', 'trend-strength-scorer'];
for (const skillId of skills) {
  const result = await executeSkill(skillId, context);
  analysisResults.push(result);
}
```

### Mode 2: On-Demand (Command Chat)
```
User: "What's the current trend strength on BTCUSD?"
Assistant: [calls execute_skill('trend-strength-scorer', { symbol: 'BTCUSD' })]
Assistant: "BTCUSD trend strength: 78/100 (strong uptrend). ADX at 35, 
           price above all key MAs, higher highs/higher lows intact."
```

### Mode 3: Embedded (Knowledge Base)
```typescript
// Skills reference structured knowledge
const pattern = await queryKnowledge('chart-patterns', { type: 'head_and_shoulders' });
// Returns pattern definition, reliability stats, trading playbook
```

## Priority Implementation Order

### Phase 1: Foundation (Week 1)
1. `market-regime-detector` — Essential for strategy selection
2. `position-sizer` — Core risk management
3. `portfolio-heat-calculator` — Prevent over-leveraging
4. `pattern-lookup` — Connect to existing knowledge base

### Phase 2: Technical Edge (Week 2)
5. `multi-timeframe-analyzer` — Improve entry timing
6. `support-resistance-identifier` — Better stop placement
7. `trend-strength-scorer` — Filter weak setups
8. `breakout-validator` — Reduce false signals

### Phase 3: Execution Quality (Week 3)
9. `trade-postmortem-analyzer` — Learning loop
10. `entry-timing-optimizer` — Reduce slippage
11. `win-rate-analyzer` — Strategy refinement
12. `execution-timing-reviewer` — Process adherence

### Phase 4: Advanced (Week 4+)
13. `correlation-tracker` — Portfolio-level risk
14. `sector-rotation-detector` — Asset selection
15. `spread-cost-calculator` — Cost optimization
16. `overnight-funding-estimator` — Hold duration decisions

## Testing Strategy

Each skill should be testable independently:

```bash
# Unit test: Skill logic with mock data
npm test skills/market-regime/market-regime-detector/

# Integration test: Skill + Capital.com API
npm test:integration skills/market-regime/market-regime-detector/

# System test: Skill invoked by Wealth Monitor
npm test:e2e -- --skill market-regime-detector
```

## Success Metrics

Skills improve decision quality when:

1. **Wealth Monitor Citations** — Monitor reasoning references skill outputs
2. **Reduced Manual Intervention** — Fewer user corrections needed
3. **Improved Win Rate** — Measurable via `win-rate-analyzer` skill
4. **Better Risk Adherence** — Fewer violations of goal risk limits
5. **Faster Analysis** — Monitor cycle completes in <60s with skills

## Next Steps

1. **Review this architecture** — Confirm it aligns with your workflow
2. **Select Phase 1 skills** — Start with 4 foundational skills
3. **Create first skill** — I'll build `market-regime-detector` as reference implementation
4. **Integrate with monitor** — Wire skills into `wealth-monitor.ts`
5. **Iterate** — Add skills based on actual trading needs

---

**References:**
- [tradermonty/claude-trading-skills](https://github.com/tradermonty/claude-trading-skills) — Skill patterns
- Existing knowledge base: `knowledge-base/reference/*.json`
- Wealth Monitor: `apps/web/src/lib/autonomous/wealth-monitor.ts`
