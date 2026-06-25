"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmoothAreaChart, type ChartPoint } from "@/components/ui/smooth-area-chart";
import type { TradingMode } from "@/lib/account/api";
import { PORTFOLIO_UPDATED_EVENT } from "@/lib/portfolio/portfolio-events";
import { SNAPSHOT_BUCKET_SEC } from "@/lib/portfolio/portfolio-chart-utils";
import { readHomeTabCache, writeHomeTabCache } from "@/lib/portfolio/home-tab-cache";

const TIMEFRAMES = ["LIVE", "1D", "1W", "1M", "3M", "YTD", "1Y"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

/** DB snapshots cover this window; newer data comes from live client samples. */
const LIVE_ZONE_SEC = SNAPSHOT_BUCKET_SEC;

function flatZeroLine(): Array<{ time: number; value: number }> {
  const now = Math.floor(Date.now() / 1000);
  const start = now - SNAPSHOT_BUCKET_SEC;
  return [
    { time: start, value: 0 },
    { time: now, value: 0 },
  ];
}

function stripLiveZone(points: Array<{ time: number; value: number }>): Array<{ time: number; value: number }> {
  const zoneStart = Math.floor(Date.now() / 1000) - LIVE_ZONE_SEC;
  return points.filter((p) => p.time < zoneStart);
}

function sliceByTimeframe(
  points: Array<{ time: number; value: number }>,
  timeframe: Timeframe,
): ChartPoint[] {
  if (points.length === 0) return flatZeroLine().map((p) => ({ time: p.time, close: p.value }));

  const now = Math.floor(Date.now() / 1000);
  let from = points[0]!.time;

  if (timeframe === "LIVE") {
    from = now - 24 * 3600;
  } else if (timeframe === "1D") from = now - 86400;
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

  const baseline = points[0] ?? { time: from, value: 0 };
  return [
    { time: baseline.time, close: 0 },
    { time: now, close: sliced[sliced.length - 1]?.close ?? baseline.value ?? 0 },
  ];
}

/**
 * Merge DB-backed history with rolling live mark-to-market samples.
 * Creates a visible slope from book balance → live P/L in the recent window.
 */
function mergeWithLiveSeries(
  historical: ChartPoint[],
  liveSamples: ChartPoint[],
  liveTailValue: number | undefined,
  liveAnchorValue: number | undefined,
): ChartPoint[] {
  const now = Math.floor(Date.now() / 1000);
  const zoneStart = now - LIVE_ZONE_SEC;

  const hist = historical.filter((p) => p.time < zoneStart);
  const anchorClose =
    liveAnchorValue ??
    (hist.length > 0 ? hist[hist.length - 1]!.close : liveTailValue ?? 0);

  const merged: ChartPoint[] = [...hist];

  const bridgeTime =
    hist.length > 0
      ? Math.max(hist[hist.length - 1]!.time, zoneStart)
      : zoneStart;
  merged.push({ time: bridgeTime, close: anchorClose });

  const sortedLive = [...liveSamples].sort((a, b) => a.time - b.time);
  for (const sample of sortedLive) {
    if (sample.time > bridgeTime) {
      merged.push(sample);
    }
  }

  if (liveTailValue != null && Number.isFinite(liveTailValue)) {
    const tip: ChartPoint = { time: now, close: liveTailValue };
    const last = merged[merged.length - 1];
    if (!last || last.time < now - 1 || last.close !== liveTailValue) {
      if (last && last.time >= now - 1) {
        merged[merged.length - 1] = tip;
      } else {
        merged.push(tip);
      }
    }
  }

  if (merged.length < 2 && historical.length >= 2) {
    return historical;
  }
  return merged.length >= 2 ? merged : historical;
}

export function PortfolioGrowthChart({
  mode,
  className,
  onChangePct,
  onRefreshingChange,
  liveTailValue,
  liveAnchorValue,
  chartHeight = 200,
  accent: accentProp,
  hideHeader = false,
  showYAxis = true,
}: {
  mode: TradingMode;
  className?: string;
  onChangePct?: (changePct: number) => void;
  onRefreshingChange?: (refreshing: boolean) => void;
  /** Live mark-to-market balance — updates chart tip without waiting for DB snapshots. */
  liveTailValue?: number;
  /** Ledger book balance — anchors the live zone before mark-to-market P/L. */
  liveAnchorValue?: number;
  chartHeight?: number;
  accent?: "bullish" | "bearish" | "neutral" | "cyan";
  hideHeader?: boolean;
  showYAxis?: boolean;
}) {
  const cached = readHomeTabCache(mode);
  const [points, setPoints] = useState<Array<{ time: number; value: number }>>(
    () => stripLiveZone(cached?.chartPoints ?? []),
  );
  const [changePct, setChangePct] = useState(cached?.changePct ?? 0);
  const [initialLoading, setInitialLoading] = useState(() => (cached?.chartPoints?.length ?? 0) === 0);
  const [liveSamples, setLiveSamples] = useState<ChartPoint[]>([]);
  const [liveTick, setLiveTick] = useState(0);
  const [timeframe, setTimeframe] = useState<Timeframe>("LIVE");
  const hasLoadedOnce = useRef((cached?.chartPoints?.length ?? 0) > 0);
  const lastSampleRef = useRef<{ time: number; close: number } | null>(null);

  const recordLiveSample = useCallback((value: number, forceTime?: number) => {
    if (!Number.isFinite(value)) return;
    const now = forceTime ?? Math.floor(Date.now() / 1000);
    const last = lastSampleRef.current;
    if (last && last.time === now && last.close === value) return;

    lastSampleRef.current = { time: now, close: value };
    setLiveSamples((prev) => {
      const next =
        prev.length > 0 && prev[prev.length - 1]!.time === now
          ? [...prev.slice(0, -1), { time: now, close: value }]
          : [...prev, { time: now, close: value }];
      return next.length > 240 ? next.slice(-240) : next;
    });
  }, []);

  useEffect(() => {
    if (liveTailValue == null || !Number.isFinite(liveTailValue)) return;
    recordLiveSample(liveTailValue);
  }, [liveTailValue, recordLiveSample]);

  useEffect(() => {
    if (liveTailValue == null || !Number.isFinite(liveTailValue)) return;
    const id = window.setInterval(() => {
      recordLiveSample(liveTailValue);
      setLiveTick((t) => t + 1);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [liveTailValue, recordLiveSample]);

  const setRefreshState = useCallback(
    (next: boolean) => {
      onRefreshingChange?.(next);
    },
    [onRefreshingChange],
  );

  const loadHistory = useCallback(
    async (silent = false) => {
      const isInitial = !hasLoadedOnce.current;
      if (isInitial && !silent) {
        setInitialLoading(true);
      } else if (!silent) {
        setRefreshState(true);
      }

      try {
        const res = await fetch(`/api/portfolio/history?mode=${mode}`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load history");
        const rawPoints =
          Array.isArray(json.points) && json.points.length > 0
            ? json.points
            : flatZeroLine();
        const nextPoints = stripLiveZone(rawPoints);
        setPoints(nextPoints);
        const pct = json.changePct ?? 0;
        setChangePct(pct);
        onChangePct?.(pct);
        writeHomeTabCache(mode, { chartPoints: nextPoints, changePct: pct });
        hasLoadedOnce.current = true;
      } catch {
        if (!hasLoadedOnce.current) {
          setPoints(flatZeroLine());
          setChangePct(0);
          onChangePct?.(0);
        }
      } finally {
        setInitialLoading(false);
        setRefreshState(false);
      }
    },
    [mode, onChangePct, setRefreshState],
  );

  useEffect(() => {
    void loadHistory(false);
  }, [loadHistory]);

  useEffect(() => {
    const onUpdate = () => void loadHistory(true);
    window.addEventListener(PORTFOLIO_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(PORTFOLIO_UPDATED_EVENT, onUpdate);
  }, [loadHistory]);

  const chartPoints = useMemo(() => {
    const sliced = sliceByTimeframe(points, timeframe);
    return mergeWithLiveSeries(sliced, liveSamples, liveTailValue, liveAnchorValue);
    // liveTick bumps time on the tip even when value is unchanged
  }, [points, timeframe, liveSamples, liveTailValue, liveAnchorValue, liveTick]);

  const liveChangePct = useMemo(() => {
    if (liveTailValue == null || liveTailValue <= 0) return changePct;
    const firstNonZero = chartPoints.find((p) => p.close > 0)?.close ?? 0;
    if (firstNonZero <= 0) return changePct;
    return Math.round(((liveTailValue - firstNonZero) / firstNonZero) * 10000) / 100;
  }, [chartPoints, liveTailValue, changePct]);

  useEffect(() => {
    if (liveTailValue != null) {
      onChangePct?.(liveChangePct);
    }
  }, [liveChangePct, liveTailValue, onChangePct]);

  const accent =
    accentProp ??
    (liveTailValue != null
      ? liveChangePct >= 0
        ? "bullish"
        : "bearish"
      : changePct >= 0
        ? "bullish"
        : "bearish");

  const showChart = hasLoadedOnce.current || points.length > 0 || liveSamples.length > 0;

  return (
    <div className={cn("rounded-xl border border-white/6 bg-[var(--terminal-surface)] p-4", className)}>
      {!hideHeader ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
            Portfolio Growth
          </h3>
          <div className="terminal-nav-group flex-wrap">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "terminal-tab px-2 py-0.5 text-[9px]",
                  timeframe === tf ? "terminal-tab-active" : "terminal-tab-idle",
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ minHeight: chartHeight }}>
        {initialLoading && !showChart ? (
          <div
            className="flex items-center justify-center text-xs text-zinc-500"
            style={{ height: chartHeight }}
          >
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading chart…
          </div>
        ) : (
          <SmoothAreaChart
            points={chartPoints}
            height={chartHeight}
            accent={accent}
            showZeroWhenEmpty
            forcePriceScaleZero
            showYAxis={showYAxis}
          />
        )}
      </div>
    </div>
  );
}
