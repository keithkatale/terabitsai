import type { ChartAnalysis } from "@/lib/chart/tradingview-spec";

export type ChartDrawingColor = "support" | "resistance" | "entry" | "stop" | "target" | "pivot";

export type ChartDrawing =
  | {
      type: "hline";
      price: number;
      label?: string;
      color?: ChartDrawingColor;
    }
  | {
      type: "zone";
      priceTop: number;
      priceBottom: number;
      label?: string;
      color?: ChartDrawingColor;
    }
  | {
      type: "trendline";
      t1: number;
      p1: number;
      t2: number;
      p2: number;
      label?: string;
      color?: ChartDrawingColor;
    }
  | {
      type: "marker";
      time: number;
      price: number;
      label: string;
      side: "buy" | "sell";
    };

export function normalizeChartDrawings(raw: unknown): ChartDrawing[] {
  if (!Array.isArray(raw)) return [];
  const out: ChartDrawing[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    if (d.type === "hline" && typeof d.price === "number") {
      out.push({
        type: "hline",
        price: d.price,
        label: typeof d.label === "string" ? d.label : undefined,
        color: isDrawingColor(d.color) ? d.color : undefined,
      });
    } else if (
      d.type === "zone" &&
      typeof d.priceTop === "number" &&
      typeof d.priceBottom === "number"
    ) {
      out.push({
        type: "zone",
        priceTop: d.priceTop,
        priceBottom: d.priceBottom,
        label: typeof d.label === "string" ? d.label : undefined,
        color: isDrawingColor(d.color) ? d.color : undefined,
      });
    } else if (
      d.type === "trendline" &&
      typeof d.t1 === "number" &&
      typeof d.p1 === "number" &&
      typeof d.t2 === "number" &&
      typeof d.p2 === "number"
    ) {
      out.push({
        type: "trendline",
        t1: d.t1,
        p1: d.p1,
        t2: d.t2,
        p2: d.p2,
        label: typeof d.label === "string" ? d.label : undefined,
        color: isDrawingColor(d.color) ? d.color : undefined,
      });
    } else if (
      d.type === "marker" &&
      typeof d.time === "number" &&
      typeof d.price === "number" &&
      typeof d.label === "string" &&
      (d.side === "buy" || d.side === "sell")
    ) {
      out.push({
        type: "marker",
        time: d.time,
        price: d.price,
        label: d.label,
        side: d.side,
      });
    }
  }
  return out;
}

function isDrawingColor(v: unknown): v is ChartDrawingColor {
  return (
    v === "support" ||
    v === "resistance" ||
    v === "entry" ||
    v === "stop" ||
    v === "target" ||
    v === "pivot"
  );
}

export function keyLevelsToDrawings(
  keyLevels: ChartAnalysis["keyLevels"],
): ChartDrawing[] {
  return keyLevels.map((level) => ({
    type: "hline" as const,
    price: level.price,
    label: level.note ?? level.type,
    color:
      level.type === "support"
        ? "support"
        : level.type === "resistance"
          ? "resistance"
          : "pivot",
  }));
}

export function extractToolChartDrawings(
  output: unknown,
): { symbol: string; drawings: ChartDrawing[]; clearPrevious?: boolean } | null {
  if (!output || typeof output !== "object") return null;
  const obj = output as {
    chart_drawings?: unknown;
    symbol?: unknown;
    clearPrevious?: unknown;
  };
  if (!obj.chart_drawings) return null;
  const symbol = typeof obj.symbol === "string" ? obj.symbol : "";
  if (!symbol) return null;
  return {
    symbol,
    drawings: normalizeChartDrawings(obj.chart_drawings),
    clearPrevious: obj.clearPrevious === true,
  };
}

export const DRAWING_COLORS: Record<ChartDrawingColor, string> = {
  support: "#10b981",
  resistance: "#ef4444",
  entry: "#22d3ee",
  stop: "#f97316",
  target: "#a3e635",
  pivot: "#a78bfa",
};
