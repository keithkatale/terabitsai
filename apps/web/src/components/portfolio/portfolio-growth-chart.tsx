"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SmoothAreaChart, type ChartPoint } from "@/components/ui/smooth-area-chart";
import type { TradingMode } from "@/lib/account/api";

const TIMEFRAMES = ["LIVE", "1D", "1W", "1M", "3M", "YTD", "1Y"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

function sliceByTimeframe(
  points: Array<{ time: number; value: number }>,
  timeframe: Timeframe,
): ChartPoint[] {
  if (points.length === 0) return [];
  if (timeframe === "LIVE") {
    return points.map((p) => ({ time: p.time, close: p.value }));
  }

  const now = Math.floor(Date.now() / 1000);
  let from = points[0]!.time;

  if (timeframe === "1D") from = now - 86400;
  else if (timeframe === "1W") from = now - 7 * 86400;
  else if (timeframe === "1M") from = now - 30 * 86400;
  else if (timeframe === "3M") from = now - 90 * 86400;
  else if (timeframe === "YTD") {
    const d = new Date();
    from = Math.floor(Date.UTC(d.getUTCFullYear(), 0, 1) / 1000);
  } else if (timeframe === "1Y") from = now - 365 * 86400;

  const sliced = points.filter((p) => p.time >= from).map((p) => ({
    time: p.time,
    close: p.value,
  }));

  if (sliced.length >= 2) return sliced;
  return points.map((p) => ({ time: p.time, close: p.value }));
}

export function PortfolioGrowthChart({
  mode,
  className,
  onChangePct,
  chartHeight = 200,
  accent: accentProp,
  hideHeader = false,
}: {
  mode: TradingMode;
  className?: string;
  onChangePct?: (changePct: number) => void;
  chartHeight?: number;
  accent?: "bullish" | "bearish" | "neutral" | "cyan";
  hideHeader?: boolean;
}) {
  const [points, setPoints] = useState<Array<{ time: number; value: number }>>([]);
  const [changePct, setChangePct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>("LIVE");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portfolio/history?mode=${mode}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load history");
      setPoints(json.points ?? []);
      const pct = json.changePct ?? 0;
      setChangePct(pct);
      onChangePct?.(pct);
    } catch {
      setPoints([]);
      setChangePct(0);
      onChangePct?.(0);
    } finally {
      setLoading(false);
    }
  }, [mode, onChangePct]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const chartPoints = useMemo(
    () => sliceByTimeframe(points, timeframe),
    [points, timeframe],
  );

  const accent =
    accentProp ?? (changePct >= 0 ? "bullish" : "bearish");

  return (
    <div className={cn("rounded-xl border border-white/6 bg-[var(--terminal-surface)] p-4", className)}>
      {!hideHeader ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
            Portfolio Growth
          </h3>
          <div className="flex flex-wrap gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors",
                timeframe === tf
                  ? "bg-cyan-500/15 text-cyan-300"
                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300",
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div
          className="flex items-center justify-center text-xs text-zinc-500"
          style={{ height: chartHeight }}
        >
          Loading chart…
        </div>
      ) : (
        <SmoothAreaChart points={chartPoints} height={chartHeight} accent={accent} />
      )}
    </div>
  );
}
