"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChartCandle, ChartRange } from "@/lib/chat/chart-data-tool";
import { chooseXTickInterval } from "@/components/ui/smooth-area-chart";
import { ChartAnnotationLayer, type ChartPlotMetrics } from "@/components/chart/chart-annotation-layer";
import type { ChartDrawing } from "@/lib/chart/chart-drawings";
import { useChartDrawings } from "@/contexts/chart-drawings-context";

const PAD_X_RIGHT = 10;
const PAD_Y_LEFT = 52;
const PAD_Y_TOP = 12;
const PAD_X_AXIS_HEIGHT = 20;
const PAD_PLOT_GAP = 8;

function formatYTick(value: number): string {
  if (value >= 10_000) return `$${(value / 1000).toFixed(0)}k`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  if (value >= 100) return `$${value.toFixed(0)}`;
  return `$${value.toFixed(2)}`;
}

function formatChartTick(tUnixSec: number, intervalSec: number, spanSec: number): string {
  const d = new Date(tUnixSec * 1000);
  if (intervalSec >= 86400) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (intervalSec >= 3600) {
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" });
  }
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const INTERVAL_TO_RANGE: Record<string, ChartRange> = {
  "60": "1W",
  "240": "1M",
  D: "3M",
  W: "6M",
};

export function AnnotatedPriceChart({
  symbol,
  interval = "D",
  className,
  drawings: externalDrawings,
}: {
  symbol: string;
  interval?: string;
  className?: string;
  drawings?: ChartDrawing[];
}) {
  const uid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 400, h: 320 });
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { drawings: contextDrawings, overlayVisible, symbol: drawingSymbol } = useChartDrawings();

  const range = INTERVAL_TO_RANGE[interval] ?? "3M";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ symbol, range });
    fetch(`/api/market/chart?${params}`)
      .then((r) => r.json())
      .then((json: { success?: boolean; candles?: ChartCandle[]; error?: string }) => {
        if (cancelled) return;
        if (!json.success || !json.candles?.length) {
          setError(json.error ?? "No chart data");
          setCandles([]);
        } else {
          setCandles(json.candles);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load chart");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        setSize({
          w: Math.floor(entry.contentRect.width),
          h: Math.floor(entry.contentRect.height),
        });
      }
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    }
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(
    () => [...candles].sort((a, b) => a.t - b.t),
    [candles],
  );

  const bounds = useMemo(() => {
    if (sorted.length === 0) return { yMin: 0, yMax: 100 };
    const lows = sorted.map((c) => c.l);
    const highs = sorted.map((c) => c.h);
    const minP = Math.min(...lows);
    const maxP = Math.max(...highs);
    const padV = (maxP - minP) * 0.08 || Math.max(maxP * 0.002, 0.05);
    return { yMin: minP - padV, yMax: maxP + padV };
  }, [sorted]);

  const plotBottomY = size.h - PAD_X_AXIS_HEIGHT - PAD_PLOT_GAP;
  const innerH = Math.max(plotBottomY - PAD_Y_TOP, 1);
  const innerW = Math.max(size.w - PAD_Y_LEFT - PAD_X_RIGHT, 1);
  const t0 = sorted[0]?.t ?? 0;
  const t1 = sorted[sorted.length - 1]?.t ?? t0 + 1;
  const spanT = Math.max(t1 - t0, 1);
  const spanSec = spanT;

  const plotMetrics: ChartPlotMetrics | null = useMemo(() => {
    if (sorted.length === 0) return null;
    return {
      width: size.w,
      height: size.h,
      padLeft: PAD_Y_LEFT,
      padRight: PAD_X_RIGHT,
      padTop: PAD_Y_TOP,
      plotBottomY,
      t0,
      t1,
      yMin: bounds.yMin,
      yMax: bounds.yMax,
    };
  }, [sorted.length, size.w, size.h, plotBottomY, t0, t1, bounds]);

  const candleWidth = useMemo(() => {
    if (sorted.length < 2) return 4;
    return Math.max(2, Math.min(12, (innerW / sorted.length) * 0.7));
  }, [sorted.length, innerW]);

  const candleRects = useMemo(() => {
    return sorted.map((c) => {
      const nx = (c.t - t0) / spanT;
      const cx = PAD_Y_LEFT + nx * innerW;
      const rangeY = Math.max(bounds.yMax - bounds.yMin, 1e-9);
      const yOpen = PAD_Y_TOP + innerH * (1 - (c.o - bounds.yMin) / rangeY);
      const yClose = PAD_Y_TOP + innerH * (1 - (c.c - bounds.yMin) / rangeY);
      const yHigh = PAD_Y_TOP + innerH * (1 - (c.h - bounds.yMin) / rangeY);
      const yLow = PAD_Y_TOP + innerH * (1 - (c.l - bounds.yMin) / rangeY);
      const bullish = c.c >= c.o;
      return { cx, yOpen, yClose, yHigh, yLow, bullish };
    });
  }, [sorted, t0, spanT, innerH, bounds]);

  const yTicks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const frac = i / steps;
      const value = bounds.yMin + (bounds.yMax - bounds.yMin) * frac;
      return {
        y: PAD_Y_TOP + innerH * (1 - frac),
        label: formatYTick(value),
      };
    });
  }, [bounds, innerH]);

  const xTicks = useMemo(() => {
    if (sorted.length < 2) return [];
    const intervalSec = chooseXTickInterval(spanSec, innerW);
    const ticks: Array<{ x: number; label: string }> = [];
    const start = Math.ceil(t0 / intervalSec) * intervalSec;
    for (let t = start; t <= t1; t += intervalSec) {
      const nx = (t - t0) / spanT;
      ticks.push({
        x: PAD_Y_LEFT + nx * innerW,
        label: formatChartTick(t, intervalSec, spanSec),
      });
    }
    return ticks;
  }, [sorted.length, spanSec, innerW, t0, t1, spanT]);

  const activeDrawings = useMemo(() => {
    if (externalDrawings?.length) return externalDrawings;
    if (drawingSymbol?.toUpperCase() === symbol.toUpperCase()) return contextDrawings;
    return [];
  }, [externalDrawings, contextDrawings, drawingSymbol, symbol]);

  if (loading) {
    return (
      <div
        ref={wrapRef}
        className={cn("flex h-full min-h-[200px] items-center justify-center", className)}
      >
        <Loader2 className="size-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error || sorted.length === 0) {
    return (
      <div
        ref={wrapRef}
        className={cn("flex h-full min-h-[200px] items-center justify-center text-xs text-zinc-500", className)}
      >
        {error ?? "No chart data available"}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={cn("relative h-full min-h-[200px] w-full", className)}>
      <svg width={size.w} height={size.h} className="block">
        <defs>
          <clipPath id={`candle-clip-${uid}`}>
            <rect x={PAD_Y_LEFT} y={PAD_Y_TOP} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {yTicks.map((tick, i) => (
          <g key={`y-${i}`}>
            <line
              x1={PAD_Y_LEFT}
              y1={tick.y}
              x2={size.w - PAD_X_RIGHT}
              y2={tick.y}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
            />
            <text x={PAD_Y_LEFT - 6} y={tick.y + 3} textAnchor="end" fill="#71717a" fontSize={10}>
              {tick.label}
            </text>
          </g>
        ))}

        <g clipPath={`url(#candle-clip-${uid})`}>
          {candleRects.map((c, i) => {
            const bodyTop = Math.min(c.yOpen, c.yClose);
            const bodyH = Math.max(Math.abs(c.yClose - c.yOpen), 1);
            const color = c.bullish ? "#10b981" : "#ef4444";
            return (
              <g key={i}>
                <line x1={c.cx} y1={c.yHigh} x2={c.cx} y2={c.yLow} stroke={color} strokeWidth={1} />
                <rect
                  x={c.cx - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyH}
                  fill={color}
                  opacity={c.bullish ? 0.9 : 1}
                />
              </g>
            );
          })}
        </g>

        {xTicks.map((tick, i) => (
          <text
            key={`x-${i}`}
            x={tick.x}
            y={size.h - 4}
            textAnchor="middle"
            fill="#71717a"
            fontSize={9}
          >
            {tick.label}
          </text>
        ))}
      </svg>

      {plotMetrics ? (
        <ChartAnnotationLayer
          drawings={activeDrawings}
          plot={plotMetrics}
          visible={overlayVisible}
        />
      ) : null}
    </div>
  );
}
