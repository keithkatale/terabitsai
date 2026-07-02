import type { TvInterval } from "@/lib/chart/tradingview-spec";

export type MarketsAnalysisPreset = "full-chart-analysis" | "daily-regime-scan" | "swing-opportunity-scan";

export type MarketsChartSurface = "workspace" | "chat";

export type MarketsChartSessionContext = {
  chartSymbol?: string;
  chartInterval?: TvInterval | string;
  chartIndicators?: string[];
  chartRange?: string;
  chartStyle?: "candles" | "line" | "area" | "bars";
  tvSymbol?: string;
  displayName?: string;
  analysisPreset?: MarketsAnalysisPreset;
  /** workspace = asset chart + copilot sidebar (no chart embeds in chat) */
  surface?: MarketsChartSurface;
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
  const styleRaw = o.chartStyle;
  const chartStyle =
    styleRaw === "candles" || styleRaw === "line" || styleRaw === "area" || styleRaw === "bars"
      ? styleRaw
      : undefined;
  const surfaceRaw = o.surface;
  const surface =
    surfaceRaw === "workspace" || surfaceRaw === "chat" ? surfaceRaw : undefined;

  return {
    chartSymbol: typeof o.chartSymbol === "string" ? o.chartSymbol : undefined,
    chartInterval: typeof o.chartInterval === "string" ? o.chartInterval : undefined,
    chartIndicators: Array.isArray(o.chartIndicators)
      ? (o.chartIndicators as string[]).filter((i) => typeof i === "string")
      : undefined,
    chartRange: typeof o.chartRange === "string" ? o.chartRange : undefined,
    chartStyle,
    tvSymbol: typeof o.tvSymbol === "string" ? o.tvSymbol : undefined,
    displayName: typeof o.displayName === "string" ? o.displayName : undefined,
    analysisPreset,
    surface,
  };
}

export function isWorkspaceChartSurface(ctx: MarketsChartSessionContext | null | undefined): boolean {
  return ctx?.surface === "workspace";
}

/** Inject into system prompt when user is chatting from the Markets terminal. */
export function buildMarketsChartContextPrompt(ctx: MarketsChartSessionContext): string {
  const symbol = ctx.chartSymbol ?? "unknown";
  const interval = ctx.chartInterval ?? "D";
  const indicators = ctx.chartIndicators?.length ? ctx.chartIndicators.join(", ") : "none";
  const tv = ctx.tvSymbol ? `\n- TradingView symbol: ${ctx.tvSymbol}` : "";
  const range = ctx.chartRange ? `\n- Visible range: ${ctx.chartRange}` : "";
  const style = ctx.chartStyle ? `\n- Chart style: ${ctx.chartStyle}` : "";
  const workspace = isWorkspaceChartSurface(ctx);

  return `

MARKETS TERMINAL — ACTIVE CHART CONTEXT (authoritative for this turn):
- Symbol: ${symbol}${ctx.displayName ? ` (${ctx.displayName})` : ""}
- Interval: ${interval}
- Active indicators on chart: ${indicators}${tv}${range}${style}
- Surface: ${workspace ? "asset workspace (live chart left, copilot right)" : "markets console"}

MARKETS CHAT RULES:
1. The user is viewing this asset in an embedded TradingView chart (left pane) — treat ${symbol} as the primary subject unless they ask about something else.
2. For technical analysis — call \`analyze_chart\` with symbol="${symbol}", interval="${interval}"${ctx.chartIndicators?.length ? `, indicators=[${ctx.chartIndicators.map((i) => `"${i}"`).join(", ")}]` : ""}${ctx.chartRange ? `, range="${ctx.chartRange}"` : ""}${ctx.chartStyle ? `, style="${ctx.chartStyle}"` : ""}. This screenshots the same chart configuration the user sees and runs vision analysis on it.
3. ${workspace ? "**Do NOT embed charts in this sidebar chat** — no TradingViewChart, AssetPriceChart, render_asset_chart, or quant chart widgets. The live chart is already visible. Return TA via analysis GenUI only (bias, levels, setup cards) plus a 1–2 line summary." : "Deliver levels and bias via GenUI cards; chart embeds are allowed on the main Chat tab."}
4. Never invent prices; use tool output only.
5. Prefer \`execute_skill\` skill_id="workspace-chart-analyst" when the user asks to analyze the current chart or taps a chart-analysis prompt.
6. Use \`get_asset_market_data\` for live Capital.com quotes (numbers only — no chart widget in workspace).
7. Do not call \`render_asset_chart\` or \`render_comparative_chart\` in workspace — redundant with the live chart.
8. If the user asks for a trade idea, run the pre-trade checklist mentally before recommending.${buildMarketsAnalysisPresetPrompt(ctx)}`;
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

  return `

FULL CHART ANALYSIS PRESET — execute immediately without clarifying questions:
1. \`execute_skill\` skill_id="workspace-chart-analyst" with symbol="${symbol}", interval="${interval}", indicators from active chart
2. \`analyze_chart\` symbol="${symbol}" interval="${higherTf}" for higher-timeframe confluence (same symbol; omit chart embed in workspace)
3. \`get_asset_market_data\` for live quote from Capital.com catalog
4. \`query_trading_knowledge\` to validate any patterns identified
5. Return analysis GenUI only (levels, entry/stop/target, conviction) — no duplicate chart widgets in workspace sidebar`;
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
  range?: string;
  style?: string;
} {
  const symbol = String(args.symbol ?? chartCtx?.chartSymbol ?? "").trim();
  return {
    symbol,
    interval: (args.interval as string | undefined) ?? chartCtx?.chartInterval,
    indicators: Array.isArray(args.indicators)
      ? (args.indicators as string[])
      : chartCtx?.chartIndicators,
    range: (args.range as string | undefined) ?? chartCtx?.chartRange,
    style: (args.style as string | undefined) ?? chartCtx?.chartStyle,
  };
}
