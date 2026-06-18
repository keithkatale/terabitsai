---
name: tradingview-charts
description: Visual chart analysis on TradingView via computer-use (patterns, levels, indicators).
---

# TradingView Chart Analysis Skill

When performing **visual** chart analysis with **use_computer** / **analyze_tradingview_chart**:

1. Navigate to `https://www.tradingview.com/chart/`
2. Use the symbol search to load the requested ticker (confirm exchange if ambiguous).
3. Set the timeframe to what the user asked for (`1H`, `4H`, `1D`, etc.).
4. Apply the requested indicators (defaults: RSI, MACD, Volume) — remove clutter before screenshots.
5. Capture the chart viewport; note support/resistance, trend structure, and obvious patterns.
6. Summarize: bias (bullish/bearish/neutral), key levels, invalidation, and what would confirm the thesis.
7. Prefer publishing structured output with **write_market_insight** (expiration required) when the user wants journal-quality notes.

**Rules**

- Sessions may be pre-authenticated — **never** type passwords or bypass login walls creatively.
- If login is required, stop and report that chart capture is blocked.
- Use **get_tradingview_analysis** first for fast oscillator / MA summaries; use this skill when geometry and visual context matter.
