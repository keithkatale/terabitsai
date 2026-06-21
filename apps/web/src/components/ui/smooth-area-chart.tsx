"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

export type ChartPoint = { time: number; close: number };

const PAD_X_RIGHT = 10;
const PAD_Y_LEFT = 44;
const PAD_Y_TOP = 12;
/** Reserved band for x-axis time labels (below the plot). */
const PAD_X_AXIS_HEIGHT = 16;
/** Gap between the lowest plot point and the x-axis labels. */
const PAD_PLOT_GAP = 10;

function formatYTick(value: number): string {
  if (value >= 10_000) {
    return `$${(value / 1000).toFixed(0)}k`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  if (value >= 100) {
    return `$${value.toFixed(0)}`;
  }
  return `$${value.toFixed(2)}`;
}

function smoothLinePath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const NICE_X_INTERVALS_SEC = [
  60, 120, 300, 600, 900, 1800, 3600, 2 * 3600, 3 * 3600, 4 * 3600, 6 * 3600, 8 * 3600,
  12 * 3600, 86400, 2 * 86400, 3 * 86400, 7 * 86400, 14 * 86400, 30 * 86400, 60 * 86400,
  90 * 86400, 180 * 86400, 365 * 86400,
] as const;

const MIN_X_TICKS = 7;
const MAX_X_TICKS = 15;
const IDEAL_X_TICKS = 10;
const MIN_X_LABEL_PX = 48;

export function chooseXTickInterval(spanSec: number, chartWidthPx: number): number {
  const widthMinInterval = (spanSec * MIN_X_LABEL_PX) / Math.max(chartWidthPx, 1);

  let bestInterval = NICE_X_INTERVALS_SEC[NICE_X_INTERVALS_SEC.length - 1]!;
  let bestScore = Infinity;

  for (const interval of NICE_X_INTERVALS_SEC) {
    if (interval < widthMinInterval) continue;

    const count = spanSec / interval;
    if (count < MIN_X_TICKS - 0.5 || count > MAX_X_TICKS + 0.5) continue;

    const score = Math.abs(count - IDEAL_X_TICKS);
    if (score < bestScore) {
      bestScore = score;
      bestInterval = interval;
    }
  }

  if (bestScore < Infinity) return bestInterval;

  const ideal = Math.max(spanSec / IDEAL_X_TICKS, widthMinInterval);
  return NICE_X_INTERVALS_SEC.reduce((best, interval) =>
    Math.abs(interval - ideal) < Math.abs(best - ideal) ? interval : best,
  );
}

function formatChartTick(tUnixSec: number, intervalSec: number, spanSec: number): string {
  const ms = tUnixSec * 1000;
  const d = new Date(ms);

  if (intervalSec >= 90 * 86400 || spanSec > 400 * 86400) {
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  if (intervalSec >= 86400) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (intervalSec >= 3600) {
    return d.toLocaleString(undefined, {
      month: spanSec > 2 * 86400 ? "short" : undefined,
      day: spanSec > 2 * 86400 ? "numeric" : undefined,
      hour: "numeric",
      minute: intervalSec >= 2 * 3600 ? undefined : "2-digit",
    });
  }
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function filterCrowdedXTicks(
  ticks: Array<{ x: number; time: number }>,
  minPx: number,
): Array<{ x: number; time: number }> {
  if (ticks.length <= 1) return ticks;

  const filtered: Array<{ x: number; time: number }> = [];
  for (const tick of ticks) {
    if (filtered.length === 0 || tick.x - filtered[filtered.length - 1]!.x >= minPx) {
      filtered.push(tick);
    }
  }

  if (filtered.length > MAX_X_TICKS) {
    const step = (filtered.length - 1) / (MAX_X_TICKS - 1);
    const thinned: typeof filtered = [];
    for (let i = 0; i < MAX_X_TICKS; i++) {
      thinned.push(filtered[Math.round(i * step)]!);
    }
    return thinned;
  }

  return filtered;
}

export function SmoothAreaChart({
  points,
  className,
  height = 180,
  accent = "neutral",
  showZeroWhenEmpty = false,
  forcePriceScaleZero = false,
  showYAxis = false,
  tickIntervalSec,
}: {
  points: ChartPoint[];
  className?: string;
  height?: number;
  accent?: "bullish" | "bearish" | "neutral" | "cyan";
  showZeroWhenEmpty?: boolean;
  forcePriceScaleZero?: boolean;
  showYAxis?: boolean;
  /** Preferred x-axis label spacing (e.g. 600 for 10-minute buckets). */
  tickIntervalSec?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const gradId = `quant-fill-${uid}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 320, h: height });
  const [hover, setHover] = useState<{ x: number; idx: number } | null>(null);

  // ResizeObserver to ensure responsiveness
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0) {
        setSize({
          w: Math.floor(entry.contentRect.width),
          h: height
        });
      }
    });

    ro.observe(el);
    const r = el.getBoundingClientRect();
    if (r.width > 0) {
      setSize({ w: Math.floor(r.width), h: height });
    }

    return () => ro.disconnect();
  }, [height]);

  const sortedPoints = useMemo(() => {
    return [...points].sort((a, b) => a.time - b.time);
  }, [points]);

  const displayPoints = useMemo(() => {
    if (sortedPoints.length >= 2) return sortedPoints;
    if (!showZeroWhenEmpty) return sortedPoints;
    const now = Math.floor(Date.now() / 1000);
    const start = sortedPoints[0]?.time ?? now - 90 * 86_400;
    const endVal = sortedPoints[sortedPoints.length - 1]?.close ?? 0;
    return [
      { time: Math.min(start, now - 86_400), close: 0 },
      { time: now, close: endVal },
    ];
  }, [sortedPoints, showZeroWhenEmpty]);

  const spanSec = useMemo(() => {
    if (displayPoints.length < 2) return 86400;
    return Math.max(60, displayPoints[displayPoints.length - 1]!.time - displayPoints[0]!.time);
  }, [displayPoints]);

  const bounds = useMemo(() => {
    if (displayPoints.length === 0) return { minC: 0, maxC: 100, yMin: 0, yMax: 100 };
    const cs = displayPoints.map((p) => p.close);
    const minC = Math.min(...cs);
    const maxC = Math.max(...cs);
    const padV = forcePriceScaleZero ? 0 : (maxC - minC) * 0.08 || Math.max(maxC * 0.002, 0.05);
    const yMin = forcePriceScaleZero ? 0 : minC - padV;
    const yMax = maxC + (forcePriceScaleZero ? maxC * 0.05 : padV);
    return { minC, maxC, yMin, yMax };
  }, [displayPoints, forcePriceScaleZero]);

  const padLeft = showYAxis ? PAD_Y_LEFT : 0;

  const layout = useMemo(() => {
    const plotBottomY = size.h - PAD_X_AXIS_HEIGHT - PAD_PLOT_GAP;
    const innerH = Math.max(plotBottomY - PAD_Y_TOP, 1);
    const xLabelY = size.h - 4;
    return { plotBottomY, innerH, xLabelY };
  }, [size.h]);

  const mapped = useMemo(() => {
    if (displayPoints.length === 0 || size.w <= 20) return [];
    const innerW = size.w - padLeft - PAD_X_RIGHT;
    const { innerH } = layout;
    const { yMin, yMax } = bounds;

    const t0 = displayPoints[0]!.time;
    const t1 = displayPoints[displayPoints.length - 1]!.time;
    const spanT = Math.max(t1 - t0, 1);

    return displayPoints.map((p) => {
      const nx = (p.time - t0) / spanT;
      const ny = (p.close - yMin) / Math.max(yMax - yMin, 1e-9);
      return {
        x: padLeft + nx * innerW,
        y: PAD_Y_TOP + innerH * (1 - ny),
        time: p.time,
        close: p.close,
      };
    });
  }, [displayPoints, size.w, size.h, bounds, padLeft, layout]);

  const { plotBottomY, xLabelY } = layout;
  const clipId = `plot-clip-${uid}`;

  const areaPath = useMemo(() => {
    if (mapped.length === 0) return "";
    const line = smoothLinePath(mapped);
    const first = mapped[0]!;
    const last = mapped[mapped.length - 1]!;
    return `${line} L ${last.x} ${plotBottomY} L ${first.x} ${plotBottomY} Z`;
  }, [mapped, plotBottomY]);

  const linePath = useMemo(() => {
    return mapped.length ? smoothLinePath(mapped) : "";
  }, [mapped]);

  const palette = useMemo(() => {
    if (accent === "bullish") {
      return {
        stroke: "#10b981", // Emerald green
        fillTop: "rgba(16, 185, 129, 0.18)",
        fillBot: "rgba(16, 185, 129, 0.01)"
      };
    } else if (accent === "bearish") {
      return {
        stroke: "#ef4444", // Red
        fillTop: "rgba(239, 68, 68, 0.18)",
        fillBot: "rgba(239, 68, 68, 0.01)"
      };
    } else if (accent === "cyan") {
      return {
        stroke: "#2EC9FF",
        fillTop: "rgba(46, 201, 255, 0.22)",
        fillBot: "rgba(46, 201, 255, 0.01)",
      };
    } else {
      return {
        stroke: "#6366f1", // Indigo
        fillTop: "rgba(99, 102, 241, 0.15)",
        fillBot: "rgba(99, 102, 241, 0.01)"
      };
    }
  }, [accent]);

  const onMove = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      if (mapped.length < 2) return;
      const svg = e.currentTarget;
      const inv = svg.getScreenCTM()?.inverse();
      if (!inv) return;
      const loc = new DOMPoint(e.clientX, e.clientY).matrixTransform(inv);
      const mx = loc.x;

      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < mapped.length; i++) {
        const d = Math.abs(mapped[i]!.x - mx);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      setHover({ x: mapped[best]!.x, idx: best });
    },
    [mapped]
  );

  const onLeave = useCallback(() => setHover(null), []);

  const hoveredPt = hover != null ? mapped[hover.idx] : null;

  const yTicks = useMemo(() => {
    if (!showYAxis || mapped.length === 0) return [];
    const { innerH } = layout;
    const { yMin, yMax } = bounds;
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const frac = i / steps;
      const value = yMin + (yMax - yMin) * frac;
      return {
        y: PAD_Y_TOP + innerH * (1 - frac),
        label: formatYTick(value),
      };
    });
  }, [showYAxis, mapped.length, layout, bounds]);

  const xAxisIntervalSec = useMemo(
    () => tickIntervalSec ?? chooseXTickInterval(spanSec, size.w),
    [tickIntervalSec, spanSec, size.w],
  );

  const xTicks = useMemo(() => {
    if (displayPoints.length < 2 || size.w <= 20) return [];

    const t0 = displayPoints[0]!.time;
    const t1 = displayPoints[displayPoints.length - 1]!.time;
    const spanT = Math.max(t1 - t0, 1);
    const innerW = size.w - padLeft - PAD_X_RIGHT;
    const interval = xAxisIntervalSec;

    const timeToX = (time: number) => padLeft + ((time - t0) / spanT) * innerW;

    const ticks: Array<{ x: number; time: number }> = [];
    let nextTick = Math.ceil(t0 / interval) * interval;
    while (nextTick <= t1) {
      ticks.push({ x: timeToX(nextTick), time: nextTick });
      nextTick += interval;
    }

    if (ticks.length === 0) {
      return [
        { x: timeToX(t0), time: t0 },
        { x: timeToX(t1), time: t1 },
      ];
    }

    const minGapSec = interval * 0.55;
    const first = ticks[0]!;
    const last = ticks[ticks.length - 1]!;

    if (t0 < first.time - minGapSec) {
      ticks.unshift({ x: timeToX(t0), time: t0 });
    }
    if (t1 > last.time + minGapSec) {
      ticks.push({ x: timeToX(t1), time: t1 });
    }

    return filterCrowdedXTicks(ticks, MIN_X_LABEL_PX);
  }, [displayPoints, size.w, padLeft, xAxisIntervalSec]);

  if (displayPoints.length < 2 && !showZeroWhenEmpty) {
    return (
      <div className={cn("flex flex-col items-center justify-center border border-zinc-900/60 bg-zinc-950/20 rounded-xl", className)} style={{ height }}>
        <p className="text-zinc-500 text-xs font-medium">Insufficient historical data</p>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={cn("relative w-full select-none", className)}>
      <svg
        width="100%"
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full overflow-visible"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={padLeft}
              y={PAD_Y_TOP}
              width={Math.max(size.w - padLeft - PAD_X_RIGHT, 1)}
              height={Math.max(plotBottomY - PAD_Y_TOP, 1)}
            />
          </clipPath>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.fillTop} />
            <stop offset="100%" stopColor={palette.fillBot} />
          </linearGradient>
        </defs>

        {/* Plot floor — separates chart from x-axis labels */}
        <line
          x1={padLeft}
          x2={size.w - PAD_X_RIGHT}
          y1={plotBottomY}
          y2={plotBottomY}
          stroke="rgba(63, 63, 70, 0.2)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />

        {/* Grid lines */}
        {!showYAxis
          ? [0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={padLeft}
                x2={size.w - PAD_X_RIGHT}
                y1={PAD_Y_TOP + layout.innerH * f}
                y2={PAD_Y_TOP + layout.innerH * f}
                stroke="rgba(63, 63, 70, 0.15)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))
          : null}

        {/* Y axis ticks */}
        {yTicks.map((tick, i) => (
          <g key={`y-${i}`}>
            <line
              x1={padLeft}
              x2={size.w - PAD_X_RIGHT}
              y1={tick.y}
              y2={tick.y}
              stroke="rgba(63, 63, 70, 0.1)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={padLeft - 6}
              y={tick.y + 3}
              textAnchor="end"
              fill="#71717a"
              fontSize={9}
              fontWeight="500"
              className="font-sans select-none tabular-nums"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* Gradient fill + line (clipped so splines never overlap x-axis) */}
        <g clipPath={`url(#${clipId})`}>
          {areaPath ? (
            <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
          ) : null}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke={palette.stroke}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </g>

        {/* X Axis ticks */}
        {xTicks.map((p, i) => (
          <text
            key={`${p.time}-${i}`}
            x={p.x}
            y={xLabelY}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            fill="#71717a"
            fontSize={9}
            fontWeight="500"
            className="font-sans select-none"
          >
            {formatChartTick(p.time, xAxisIntervalSec, spanSec)}
          </text>
        ))}

        {/* Hover elements */}
        {hoveredPt && (
          <g>
            <line
              x1={hoveredPt.x}
              x2={hoveredPt.x}
              y1={PAD_Y_TOP}
              y2={plotBottomY}
              stroke={palette.stroke}
              strokeOpacity={0.3}
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={hoveredPt.x}
              cy={hoveredPt.y}
              r={4.5}
              fill="#09090b"
              stroke={palette.stroke}
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {/* Floating tooltip */}
      {hoveredPt && (
        <div
          className={cn(
            "pointer-events-none absolute z-20 -translate-x-1/2 rounded-xl border bg-zinc-950/90 backdrop-blur-md px-3 py-1.5 text-[11px] font-semibold tracking-wide shadow-2xl transition-all duration-75 flex flex-col gap-0.5",
            accent === "bullish"
              ? "border-emerald-500/30 shadow-emerald-500/5"
              : accent === "bearish"
                ? "border-red-500/30 shadow-red-500/5"
                : accent === "cyan"
                  ? "border-cyan-400/30 shadow-cyan-500/5"
                  : "border-cyan-500/30 shadow-cyan-500/5"
          )}
          style={{
            left: `${(hoveredPt.x / size.w) * 100}%`,
            top: 2
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Price</span>
            <span className="text-zinc-100 tabular-nums">
              ${hoveredPt.close >= 1000 ? hoveredPt.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : hoveredPt.close.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-medium leading-none select-none">
            {new Date(hoveredPt.time * 1000).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit"
            })}
          </span>
        </div>
      )}
    </div>
  );
}
