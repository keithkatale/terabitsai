import type { TvInterval } from "@/lib/chart/tradingview-spec";

export type MarketsAnalysisPreset = "full-chart-analysis" | "daily-regime-scan" | "swing-opportunity-scan";

export type MarketsChartSessionContext = {
  chartSymbol?: string;
  chartInterval?: TvInterval | string;
  chartIndicators?: string[];
  tvSymbol?: string;
  displayName?: string;
  analysisPreset?: MarketsAnalysisPreset;
};

const ANALYSIS_PRESETS = new Set<MarketsAnalysisPreset>([
  "full-chart-analysis",
  "daily-regime-scan",
  "swing-opportunity-scan",
]);

export function parseMarketsChartContext(raw: unknown): MarketsChartSessionContext | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.chartSymbol && !o.tvSymbol) return null;
  const presetRaw = o.analysisPreset;
  const analysisPreset =
    typeof presetRaw === "string" && ANALYSIS_PRESETS.has(presetRaw as MarketsAnalysisPreset)
      ? (presetRaw as MarketsAnalysisPreset)
      : undefined;
  return {
    chartSymbol: typeof o.chartSymbol === "string" ? o.chartSymbol : undefined,
    chartInterval: typeof o.chartInterval === "string" ? o.chartInterval : undefined,
    chartIndicators: Array.isArray(o.chartIndicators)
      ? (o.chartIndicators as string[]).filter((i) => typeof i === "string")
      : undefined,
    tvSymbol: typeof o.tvSymbol === "string" ? o.tvSymbol : undefined,
    displayName: typeof o.displayName === "string" ? o.displayName : undefined,
    analysisPreset,
  };
}

/** Inject into system prompt when user is chatting from the Markets terminal. */
export function buildMarketsChartContextPrompt(ctx: MarketsChartSessionContext): string {
  const symbol = ctx.chartSymbol ?? "unknown";
  const interval = ctx.chartInterval ?? "D";
  const indicators = ctx.chartIndicators?.length ? ctx.chartIndicators.join(", ") : "RSI, MACD, Volume";
  const tv = ctx.tvSymbol ? `\n- TradingView symbol: ${ctx.tvSymbol}` : "";

  return `

MARKETS TERMINAL — ACTIVE CHART CONTEXT (authoritative for this turn):
- Symbol: ${symbol}${ctx.displayName ? ` (${ctx.displayName})` : ""}
- Interval: ${interval}
- Active indicators on chart: ${indicators}${tv}

MARKETS CHAT RULES:
1. The user is viewing this asset in the embedded TradingView terminal — treat ${symbol} as the primary subject unless they ask about something else.
2. For technical analysis, patterns, support/resistance, or entry setups — call \`analyze_chart\` with symbol="${symbol}", interval="${interval}", indicators=[${ctx.chartIndicators?.map((i) => `"${i}"`).join(", ") || '"RSI","MACD","Volume"'}].
3. You may call \`analyze_chart\` multiple times with different intervals (e.g. 4h then 1D) to build multi-timeframe confluence — like a professional trader zooming the chart.
4. Combine chart analysis with \`execute_skill\` (technical-analyst, breakout-trade-planner, vcp-screener, macro-regime-detector) and \`query_trading_knowledge\` for pattern validation.
5. Use \`get_asset_market_data\` / \`render_asset_chart\` for live Capital.com quotes; use \`analyze_chart\` for TradingView visual TA.
6. Present opportunities as GenUI/Quant UI — entry zone, stop, target, conviction score — not walls of text.
7. If the user asks for a trade idea, run the pre-trade checklist mentally before recommending.${buildMarketsAnalysisPresetPrompt(ctx)}`;
}

const HIGHER_TF: Record<string, string> = {
  "1": "60",
  "5": "60",
  "15": "240",
  "30": "240",
  "60": "240",
  "240": "D",
  "D": "W",
  "W": "M",
};

export function buildMarketsAnalysisPresetPrompt(ctx: MarketsChartSessionContext): string {
  if (ctx.analysisPreset === "full-chart-analysis") {
    return buildFullChartAnalysisPreset(ctx);
  }
  if (ctx.analysisPreset === "daily-regime-scan") {
    return buildDailyRegimeScanPreset(ctx);
  }
  if (ctx.analysisPreset === "swing-opportunity-scan") {
    return buildSwingOpportunityPreset(ctx);
  }
  return "";
}

function buildFullChartAnalysisPreset(ctx: MarketsChartSessionContext): string {
  const symbol = ctx.chartSymbol ?? "unknown";
  const interval = ctx.chartInterval ?? "D";
  const higherTf = HIGHER_TF[String(interval)] ?? "D";
  const hlCoin = inferHyperliquidCoinFromSymbol(symbol);

  return `

FULL CHART ANALYSIS PRESET — execute immediately without clarifying questions:
1. \`analyze_chart\` symbol="${symbol}" interval="${interval}" with active indicators
2. \`analyze_chart\` symbol="${symbol}" interval="${higherTf}" for higher-timeframe confluence
3. \`execute_skill\` skill_id="technical-analyst" with symbol and intervals
4. \`get_asset_market_data\` for live quote from Capital.com catalog
5. \`hyperliquid_markets\` coin="${hlCoin}" (on-chain perp context — tool returns GenUI metrics)
6. \`query_trading_knowledge\` to validate any patterns identified
7. Synthesize as GenUI: entry zone, stop, target, R:R, conviction score (0-1), key risks`;
}

function buildDailyRegimeScanPreset(ctx: MarketsChartSessionContext): string {
  const symbol = ctx.chartSymbol ?? "unknown";

  return `

DAILY REGIME SCAN PRESET — macro posture before new risk:
1. \`execute_workflow\` workflow_id="market-regime-daily" — breadth, uptrend participation, exposure posture
2. \`get_macro_data\` — Fear & Greed, VIX, rates context
3. \`get_market_overview\` — pulse on major indices/crypto if relevant
4. \`analyze_chart\` symbol="${symbol}" interval="D" — how does the active chart fit today's regime?
5. Present GenUI summary: exposure posture (allow/restrict/cash), regime label, and whether ${symbol} setups are favored today`;
}

function buildSwingOpportunityPreset(ctx: MarketsChartSessionContext): string {
  const symbol = ctx.chartSymbol ?? "unknown";
  const interval = ctx.chartInterval ?? "D";

  return `

SWING OPPORTUNITY SCAN PRESET — find actionable swing setups:
1. \`execute_workflow\` workflow_id="swing-opportunity-daily"
2. \`tradingview_screener\` market="america" columns="name,close,change,RSI|60,volume" sort="change:desc" limit=20 (or crypto market if ${symbol} is crypto)
3. \`analyze_chart\` symbol="${symbol}" interval="${interval}" — primary chart setup
4. \`execute_skill\` skill_id="breakout-trade-planner" or "trade-hypothesis-ideator" for structured plan
5. GenUI output: top 1-3 opportunities with entry/stop/target and conviction`;
}

/** Map catalog symbols to Hyperliquid perp coin names. */
export function inferHyperliquidCoinFromSymbol(symbol: string): string {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.endsWith("USD")) return s.slice(0, -3);
  if (s.endsWith("USDT")) return s.slice(0, -4);
  return s;
}

export function resolveAnalyzeChartDefaults(
  args: Record<string, unknown>,
  chartCtx: MarketsChartSessionContext | null,
): {
  symbol: string;
  interval?: string;
  indicators?: string[];
} {
  const symbol = String(args.symbol ?? chartCtx?.chartSymbol ?? "").trim();
  return {
    symbol,
    interval: (args.interval as string | undefined) ?? chartCtx?.chartInterval,
    indicators: Array.isArray(args.indicators)
      ? (args.indicators as string[])
      : chartCtx?.chartIndicators,
  };
}
