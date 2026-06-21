"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

export type ChartPoint = { time: number; close: number };

const PAD_X = 10;
const PAD_Y_TOP = 16;
const PAD_Y_BOTTOM = 20;

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

function formatChartTick(tUnixSec: number, spanSec: number): string {
  const ms = tUnixSec * 1000;
  if (spanSec <= 24 * 3600) {
    return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (spanSec <= 7 * 86400) {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SmoothAreaChart({
  points,
  className,
  height = 180,
  accent = "neutral"
}: {
  points: ChartPoint[];
  className?: string;
  height?: number;
  accent?: "bullish" | "bearish" | "neutral" | "cyan";
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

  const spanSec = useMemo(() => {
    if (sortedPoints.length < 2) return 86400;
    return Math.max(60, sortedPoints[sortedPoints.length - 1]!.time - sortedPoints[0]!.time);
  }, [sortedPoints]);

  const bounds = useMemo(() => {
    if (sortedPoints.length === 0) return { minC: 0, maxC: 100 };
    const cs = sortedPoints.map((p) => p.close);
    return {
      minC: Math.min(...cs),
      maxC: Math.max(...cs)
    };
  }, [sortedPoints]);

  const mapped = useMemo(() => {
    if (sortedPoints.length === 0 || size.w <= 20) return [];
    const innerW = size.w - PAD_X * 2;
    const innerH = size.h - PAD_Y_TOP - PAD_Y_BOTTOM;
    const { minC, maxC } = bounds;
    const padV = (maxC - minC) * 0.08 || Math.max(maxC * 0.002, 0.05);
    const yMin = minC - padV;
    const yMax = maxC + padV;

    const t0 = sortedPoints[0]!.time;
    const t1 = sortedPoints[sortedPoints.length - 1]!.time;
    const spanT = Math.max(t1 - t0, 1);

    return sortedPoints.map((p) => {
      const nx = (p.time - t0) / spanT;
      const ny = (p.close - yMin) / Math.max(yMax - yMin, 1e-9);
      return {
        x: PAD_X + nx * innerW,
        y: PAD_Y_TOP + innerH * (1 - ny),
        time: p.time,
        close: p.close
      };
    });
  }, [sortedPoints, size.w, size.h, bounds]);

  const bottomY = size.h - PAD_Y_BOTTOM;

  const areaPath = useMemo(() => {
    if (mapped.length === 0) return "";
    const line = smoothLinePath(mapped);
    const first = mapped[0]!;
    const last = mapped[mapped.length - 1]!;
    return `${line} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }, [mapped, bottomY]);

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

  const xTicks = useMemo(() => {
    if (mapped.length < 2) return [];
    const picks = [0, Math.floor(mapped.length / 2), mapped.length - 1];
    return [...new Set(picks)].map((i) => mapped[i]!);
  }, [mapped]);

  if (points.length < 2) {
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
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.fillTop} />
            <stop offset="100%" stopColor={palette.fillBot} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD_X}
            x2={size.w - PAD_X}
            y1={PAD_Y_TOP + (size.h - PAD_Y_TOP - PAD_Y_BOTTOM) * f}
            y2={PAD_Y_TOP + (size.h - PAD_Y_TOP - PAD_Y_BOTTOM) * f}
            stroke="rgba(63, 63, 70, 0.15)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Gradient fill */}
        {areaPath && (
          <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        )}

        {/* Continuous line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={palette.stroke}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* X Axis ticks */}
        {xTicks.map((p, i) => (
          <text
            key={`${p.time}-${i}`}
            x={p.x}
            y={size.h - 4}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            fill="#71717a"
            fontSize={9}
            fontWeight="500"
            className="font-sans select-none"
          >
            {formatChartTick(p.time, spanSec)}
          </text>
        ))}

        {/* Hover elements */}
        {hoveredPt && (
          <g>
            <line
              x1={hoveredPt.x}
              x2={hoveredPt.x}
              y1={PAD_Y_TOP}
              y2={bottomY}
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
