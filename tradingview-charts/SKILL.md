---
name: tradingview-charts
description: Visual chart analysis on TradingView via analyze_chart tool (patterns, levels, indicators).
---

# TradingView Chart Analysis Skill

When performing **visual** chart analysis, use the **`analyze_chart`** tool (TradingView data + Gemini vision).

## When to use

- User asks for technical analysis, chart patterns, support/resistance, trend structure
- User wants indicator reads (RSI, MACD, etc.) with visual context
- Wealth Monitor cycle needs a visual read on watched assets
- TA-only users seeking signals without depositing

## Workflow

1. Call `analyze_chart` with:
   - `symbol` — ticker (BTCUSD, AAPL, GOLD, US100, etc.)
   - `interval` — 1m, 5m, 15m, 1h, 4h, 1D, 1W
   - `indicators` — e.g. `["RSI", "MACD", "Volume"]`
   - `range` — visible window: 1W, 1M, 3M, 6M, 1Y
   - `question` — optional focus (e.g. "Is this a bull flag?")

2. The tool renders a TradingView chart, screenshots it, and returns structured analysis:
   - `bias` (bullish/bearish/neutral), `confidence`, `keyLevels`, `patterns`
   - `indicatorReads`, `invalidation`, `confirmation`, `reasoning`

3. An interactive TradingView chart widget appears in the workspace — the user sees what the AI analyzed.

4. For deeper exploration, call `analyze_chart` **multiple times** with different intervals/indicators (trader-style iteration):
   - Start with 1D + RSI/MACD for macro bias
   - Then 4H zoom for entry timing
   - Then 1h for precise levels

## Indicator defaults by regime

| Regime | Recommended indicators |
|--------|------------------------|
| Uptrend | EMA, MACD, Volume |
| Downtrend | RSI, MACD, Volume |
| Ranging | Bollinger, RSI, Stochastic |
| Breakout watch | Volume, ATR, MACD |

## Rules

- Use `analyze_chart` for **visual TA** — use `render_asset_chart` only for simple Capital.com price history.
- Data comes from **TradingView**, not Capital.com — ideal for TA-only users.
- Never invent price levels — all levels must come from tool `analysis.keyLevels`.
- Cross-check visual reads with numeric skills (`market-regime-detector`, `execute_skill`) before trade execution.
- Summarize findings: bias, key levels, invalidation, and what would confirm the thesis.

## Autonomous skill

The `tradingview-chart-analyst` skill runs automatically in Wealth Monitor cycles on watched symbols (BTCUSD, SPY by default).
