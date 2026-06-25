# Terabits Skill & Tool Library

Structured library for the trading agent — native Terabits skills, imported external repos, and native tool mappings.

## Layout

```
skills/
├── skills-index.yaml              # Native Terabits skills (production roadmap)
├── external-skills-index.yaml     # Auto-generated index of imported skills
├── external/
│   ├── claude-trading-skills/     # tradermonty/claude-trading-skills (58 skills)
│   │   ├── _workflows/            # Multi-step YAML workflows
│   │   └── _agents/               # Agent definitions
│   └── finance-skills/            # himself65/finance-skills (25 skills)
│       └── opencli-plugins/       # TradingView screener, quote, news CLI
├── market-regime/                 # Native skill folders
├── risk-management/
└── ...

apps/web/src/lib/skills/
├── skill-library.ts               # Load SKILL.md from any source
├── tool-library.ts                # Map skills → native tools + execution mode
├── executor.ts                    # Run native, tool-delegated, or guidance skills
└── tool-declaration.ts            # execute_skill AI tool

vendor/                            # Git clones (refresh source)
├── finance-skills/
└── claude-trading-skills/
```

## Sync external repos

```bash
node scripts/sync-external-skills.mjs
```

Clones/updates `vendor/`, rsyncs into `skills/external/`, regenerates `external-skills-index.yaml`.

## Execution modes

| Mode | Behavior |
|------|----------|
| `native` | TypeScript implementation in `executor.ts` |
| `tool` | Delegates to a native tool (`analyze_chart`, `get_macro_data`, …) |
| `guidance` | Returns SKILL.md workflow; LLM follows with companion tools |
| `workflow` | Future: YAML workflow runner from `_workflows/` |

## Native tool catalog

Defined in `tool-library.ts` → `NATIVE_TOOL_CATALOG`:

- **Market data**: `get_asset_market_data`, `render_asset_chart`, `get_market_overview`
- **Chart analysis**: `analyze_chart`, `execute_skill`
- **Intel**: `search_market_intel`, `get_macro_data`, `get_fundamentals`
- **Knowledge**: `query_trading_knowledge`
- **Execution**: `broker_action`, `execute_trade`, `get_account_state`

## Markets terminal integration

When chat runs from the Markets tab (`markets-chat-panel.tsx`):

1. Client sends `sessionContext`: `{ chartSymbol, chartInterval, chartIndicators, tvSymbol }`
2. Chat API injects `buildMarketsChartContextPrompt()` into the system prompt
3. `analyze_chart` defaults symbol/interval/indicators from chart context when omitted
4. Default AI tools: `analyzeChart` + `deepResearch`

## Key mapped skills (Markets terminal)

| Skill ID | Mode | Primary tool |
|----------|------|--------------|
| `tradingview-chart-analyst` | tool | `analyze_chart` |
| `technical-analyst` | tool | `analyze_chart` |
| `tradingview-reader` | tool | `analyze_chart` |
| `breakout-trade-planner` | guidance | + `analyze_chart`, `query_trading_knowledge` |
| `trade-hypothesis-ideator` | guidance | + `analyze_chart`, `execute_skill` |
| `sepa-strategy` | guidance | + `analyze_chart`, `query_trading_knowledge` |
| `macro-regime-detector` | tool | `get_macro_data` |

## Adding a new skill mapping

1. Ensure SKILL.md exists under `skills/external/…` (sync script)
2. Add entry to `SKILL_TOOL_MAPPINGS` in `tool-library.ts`
3. For `native` mode, implement in `executor.ts`
4. Re-run sync if pulling from upstream repos

## Phase 2 (implemented)

- **TradingView HTTP tools** — `tradingview_screener`, `tradingview_quote`, `tradingview_news`, `tradingview_search` in `apps/web/src/lib/tradingview/`. Set `TRADINGVIEW_COOKIE` env for authenticated endpoints.
- **Workflow runner** — `execute_workflow` tool runs YAML pipelines from `_workflows/`
- **Modular system prompt** — `buildChatSystemInstruction()` composes scout prompt + plan + markets context

## Phase 3 (implemented)

- **Hyperliquid tools** — `hyperliquid_markets`, `hyperliquid_candles`, `hyperliquid_book`, `hyperliquid_funding` (public API, no auth)
- **TradingView options chain** — `tradingview_options_chain` (requires `TRADINGVIEW_COOKIE` or CDP)
- **CDP cookie harvest** — set `OPENCLI_CDP_ENDPOINT=http://127.0.0.1:9222` when TradingView desktop runs with remote debugging
- **Markets full analysis preset** — "Full agent analysis" button sends `analysisPreset: full-chart-analysis` with multi-tool orchestration prompt
- **Daily regime / swing presets** — workflow-driven scans from Markets chat empty state
- **Per-tool GenUI streaming** — each tool's `genui` payload streams immediately (chart TA, HL, TV screener, workflows, macro)
- **Chart analysis GenUI** — `buildChartAnalysisGenui` adds bias, levels, and suggested setup cards to `analyze_chart`
- **Daily regime scan preset** — runs `market-regime-daily` workflow + macro + chart context
- **Swing opportunity preset** — runs `swing-opportunity-daily` + TV screener + chart analysis
- **GenUI enrichment** — Hyperliquid and workflow tools auto-attach `genui` payloads for live metric cards

## Auth configuration

```bash
# Option A: static cookie from browser session
TRADINGVIEW_COOKIE="sessionid=...; ..."

# Option B: local TradingView desktop + CDP (macOS)
OPENCLI_CDP_ENDPOINT=http://127.0.0.1:9222
# Run once per session: opencli tradingview launch
```
