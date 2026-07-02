import { Type } from "@google/genai";
import { buildChartAnalysisGenui } from "@/lib/genui/chart-analysis-genui";
import { keyLevelsToDrawings } from "@/lib/chart/chart-drawings";
import { analyzeChartVision } from "./analyze-chart-vision";
import { persistChartInsight } from "./chart-insights-persistence";
import { renderTradingViewChart } from "./render-tradingview";
import { snapshotUrl } from "./snapshot-cache";
import { buildChartSpec, type ChartSpec } from "./tradingview-spec";

export const analyzeChartDeclaration = {
  name: "analyze_chart",
  description: `Perform visual technical analysis on a TradingView chart.

Use this when the user wants chart analysis, pattern recognition, support/resistance levels,
indicator reads, or trader-style visual review. Data comes from TradingView (not Capital.com).

Declare what to show — the system renders the exact chart, screenshots it, and returns structured analysis.
Call multiple times with different intervals/indicators to explore like a trader (e.g. 4H then 1D zoom).

Default indicators: RSI, MACD. Available: rsi, macd, volume, ema, sma, bollinger, stoch, atr, adx, obv, vwap, ichimoku, pivot.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: {
        type: Type.STRING,
        description: "Asset ticker e.g. BTCUSD, AAPL, GOLD, EURUSD, US100",
      },
      interval: {
        type: Type.STRING,
        description: "Timeframe: 1m, 5m, 15m, 1h, 4h, 1D, 1W",
      },
      indicators: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Indicators to overlay e.g. ['RSI', 'MACD', 'Volume']",
      },
      range: {
        type: Type.STRING,
        description: "Visible range hint: 1D, 1W, 1M, 3M, 6M, 1Y",
      },
      style: {
        type: Type.STRING,
        enum: ["candles", "line", "area", "bars"],
        description: "Chart style (default candles)",
      },
      question: {
        type: Type.STRING,
        description: "Optional specific question to focus the analysis on",
      },
    },
    required: ["symbol"],
  },
};

export function buildTradingViewChartGenui(
  spec: ChartSpec,
  snapshotHash: string,
  analysis?: { summary?: string; bias?: string; confidence?: number },
) {
  return {
    view: [
      {
        type: "component" as const,
        name: "TradingViewChart",
        props: {
          symbol: spec.symbol,
          displayName: spec.displayName,
          interval: spec.interval,
          indicators: spec.indicators,
          range: spec.range,
          style: spec.style,
          theme: spec.theme,
          snapshotUrl: snapshotUrl(snapshotHash),
          analysisSummary: analysis?.summary,
          bias: analysis?.bias,
          confidence: analysis?.confidence,
        },
      },
    ],
  };
}

export async function executeAnalyzeChart(args: {
  symbol: string;
  interval?: string;
  indicators?: string[];
  range?: string;
  style?: string;
  theme?: string;
  question?: string;
  userId?: string;
  /** When false, omit TradingViewChart embed from GenUI (workspace sidebar). */
  embedChartInChat?: boolean;
}) {
  const spec = buildChartSpec({
    symbol: args.symbol,
    interval: args.interval,
    indicators: args.indicators,
    range: args.range,
    style: args.style,
    theme: args.theme,
  });

  const { buffer, hash, source } = await renderTradingViewChart(spec);
  const analysis = await analyzeChartVision(buffer, spec);

  if (args.question) {
    analysis.summary = `${analysis.summary} (Focus: ${args.question})`;
  }

  let insightId: string | undefined;
  if (args.userId) {
    const saved = await persistChartInsight({
      userId: args.userId,
      spec,
      analysis,
      snapshotHash: hash,
      source,
    });
    insightId = saved?.id;
  }

  const embedChart = args.embedChartInChat !== false;
  const analysisGenui = buildChartAnalysisGenui(spec.symbol, spec.interval, analysis);
  const chartEmbedGenui = embedChart
    ? buildTradingViewChartGenui(spec, hash, {
        summary: analysis.summary,
        bias: analysis.bias,
        confidence: analysis.confidence,
      }).view
    : [];

  return {
    success: true as const,
    symbol: spec.symbol,
    display_name: spec.displayName,
    interval: spec.interval,
    indicators: spec.indicators,
    range: spec.range,
    data_source: "tradingview" as const,
    render_source: source,
    snapshot_hash: hash,
    snapshot_url: snapshotUrl(hash),
    analysis,
    chart_drawings: keyLevelsToDrawings(analysis.keyLevels),
    clearPrevious: true,
    insight_id: insightId,
    analyzed_current_chart: !embedChart,
    genui: {
      view: [...chartEmbedGenui, ...analysisGenui.view],
    },
  };
}

/** Skill executor entry point for tradingview-chart-analyst */
export async function executeTradingViewChartAnalyst(inputs: {
  symbols?: string[];
  interval?: string;
  indicators?: string[];
  range?: string;
  style?: string;
  userId?: string;
  embedChartInChat?: boolean;
}): Promise<Record<string, unknown>> {
  const symbols = inputs.symbols?.length ? inputs.symbols : ["BTCUSD"];
  const results: Record<string, unknown> = {};

  for (const symbol of symbols.slice(0, 3)) {
    try {
      const result = await executeAnalyzeChart({
        symbol,
        interval: inputs.interval ?? "1D",
        indicators: inputs.indicators ?? [],
        range: inputs.range,
        style: inputs.style,
        userId: inputs.userId,
        embedChartInChat: inputs.embedChartInChat,
      });
      results[symbol] = result.analysis;
    } catch (err) {
      results[symbol] = {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    symbols_analyzed: Object.keys(results),
    analyses: results,
  };
}
