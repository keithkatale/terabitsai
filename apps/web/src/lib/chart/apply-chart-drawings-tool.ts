import { Type } from "@google/genai";
import { normalizeChartDrawings } from "@/lib/chart/chart-drawings";

export const applyChartDrawingsDeclaration = {
  name: "apply_chart_drawings",
  description: `Draw technical analysis markup on the user's interactive price chart.

Use after analyze_chart when the user asks for levels, entries, stops, targets, or visual TA.
Drawings appear as animated overlays on the chart — prefer this over long text descriptions.
Prices must come from analyze_chart or get_asset_market_data — never invent levels.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: {
        type: Type.STRING,
        description: "Asset ticker e.g. BTCUSD, AAPL",
      },
      drawings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            price: { type: Type.NUMBER },
            priceTop: { type: Type.NUMBER },
            priceBottom: { type: Type.NUMBER },
            t1: { type: Type.NUMBER },
            p1: { type: Type.NUMBER },
            t2: { type: Type.NUMBER },
            p2: { type: Type.NUMBER },
            time: { type: Type.NUMBER },
            label: { type: Type.STRING },
            color: { type: Type.STRING },
            side: { type: Type.STRING },
          },
        },
        description:
          "Array of hline, zone, trendline, or marker drawings with verified prices",
      },
      clearPrevious: {
        type: Type.BOOLEAN,
        description: "Clear existing AI drawings before applying new ones (default true)",
      },
    },
    required: ["symbol", "drawings"],
  },
};

export function executeApplyChartDrawings(args: {
  symbol?: string;
  drawings?: unknown;
  clearPrevious?: boolean;
}) {
  const symbol = String(args.symbol ?? "").trim().toUpperCase();
  if (!symbol) {
    return { success: false as const, error: "symbol is required" };
  }

  const drawings = normalizeChartDrawings(args.drawings);
  if (drawings.length === 0) {
    return { success: false as const, error: "At least one valid drawing is required" };
  }

  return {
    success: true as const,
    symbol,
    chart_drawings: drawings,
    clearPrevious: args.clearPrevious !== false,
    message: `Applied ${drawings.length} chart drawing(s) on ${symbol}`,
  };
}
