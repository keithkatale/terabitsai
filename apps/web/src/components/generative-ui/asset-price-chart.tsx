"use client";

import * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { useChatWidgetAction } from "@/contexts/chat-widget-context";
import type { ChartCandle, ChartRange } from "@/lib/chat/chart-data-tool";

export type AssetPriceChartProps = {
  symbol?: string;
  displayName?: string;
  range?: ChartRange;
  variant?: "line" | "area";
  spot?: number;
  bid?: number;
  ask?: number;
  change24hPct?: number | null;
  high?: number;
  low?: number;
  marketStatus?: string;
  dataSource?: string;
  fetchedAt?: string;
  candleCount?: number;
  candles?: ChartCandle[];
};

const RANGES: ChartRange[] = ["1D", "1W", "1M", "3M", "6M", "1Y"];

function formatPrice(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AssetPriceChart({
  symbol = "BTCUSD",
  displayName = symbol,
  range: initialRange = "1M",
  variant = "area",
  spot = 0,
  bid,
  ask,
  change24hPct = null,
  high,
  low,
  marketStatus,
  dataSource = "capital.com",
  fetchedAt,
  candleCount,
  candles = [],
}: AssetPriceChartProps) {
  const [activeRange, setActiveRange] = useState<ChartRange>(initialRange);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onWidgetAction = useChatWidgetAction();

  const dataset = useMemo(() => {
    if (candles.length === 0) return [];
    return candles.filter((c) => Number.isFinite(c.c) && c.c > 0);
  }, [candles]);

  const width = 520;
  const height = 160;
  const padding = 16;

  const { path, areaPath, coords, minVal, maxVal } = useMemo(() => {
    if (dataset.length === 0) {
      return { path: "", areaPath: "", coords: [] as { x: number; y: number; price: number; t: number }[], minVal: 0, maxVal: 1 };
    }

    const prices = dataset.map((d) => d.c);
    const min = Math.min(...prices) * 0.998;
    const max = Math.max(...prices) * 1.002;
    const valRange = max - min || 1;

    const coords = dataset.map((d, i) => {
      const x = padding + (i / Math.max(1, dataset.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((d.c - min) / valRange) * (height - 2 * padding);
      return { x, y, price: d.c, t: d.t };
    });

    let line = coords.length ? `M ${coords[0].x.toFixed(2)} ${coords[0].y.toFixed(2)}` : "";
    for (let i = 1; i < coords.length; i++) {
      line += ` L ${coords[i].x.toFixed(2)} ${coords[i].y.toFixed(2)}`;
    }

    const area =
      coords.length > 0
        ? `${line} L ${coords[coords.length - 1].x.toFixed(2)} ${height - padding} L ${coords[0].x.toFixed(2)} ${height - padding} Z`
        : "";

    return { path: line, areaPath: area, coords, minVal: min, maxVal: max };
  }, [dataset, height, width]);

  const activePoint =
    hoveredIndex != null && coords[hoveredIndex]
      ? coords[hoveredIndex]
      : coords[coords.length - 1];

  const displaySpot = activePoint?.price ?? spot;
  const isUp = change24hPct != null ? change24hPct >= 0 : true;
  const strokeColor = isUp ? "#34d399" : "#f87171";
  const fillId = `asset-price-fill-${symbol.replace(/\W/g, "")}`;

  const handleRangeChange = useCallback(
    (next: ChartRange) => {
      if (next === activeRange) return;
      setActiveRange(next);
      onWidgetAction?.({
        type: "prompt",
        prompt: `Show ${symbol} price chart for ${next} using live Capital.com data`,
      });
    },
    [activeRange, onWidgetAction, symbol],
  );

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || coords.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let minDist = Infinity;
    coords.forEach((pt, i) => {
      const d = Math.abs(pt.x - x);
      if (d < minDist) {
        minDist = d;
        nearest = i;
      }
    });
    setHoveredIndex(nearest);
  };

  if (dataset.length === 0) {
    return (
      <div className="my-3 rounded-2xl border border-rose-500/20 bg-rose-950/10 p-4 text-left text-xs text-rose-300">
        No live candle data available for {symbol}. Check Capital.com credentials or try another range.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-3 w-full rounded-2xl border border-zinc-900 bg-zinc-950/50 p-4 shadow-xl backdrop-blur-xl animate-fade-in text-left"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="size-3.5 shrink-0 text-cyan-400" />
            <span className="truncate text-xs font-bold uppercase tracking-wider text-zinc-100">
              {displayName}
            </span>
            <span className="rounded border border-emerald-500/20 bg-emerald-950/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-400">
              Live · {dataSource}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-lg font-bold text-white">${formatPrice(displaySpot)}</span>
            {change24hPct != null ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-bold",
                  isUp ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {change24hPct >= 0 ? "+" : ""}
                {change24hPct.toFixed(2)}%
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            Bid {bid != null ? formatPrice(bid) : "—"} · Ask {ask != null ? formatPrice(ask) : "—"}
            {marketStatus ? ` · ${marketStatus}` : ""}
            {candleCount ? ` · ${candleCount} candles` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-0.5 rounded-lg border border-zinc-900/60 bg-zinc-950 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRangeChange(r)}
              className={cn(
                "rounded px-2 py-0.5 text-[9px] font-extrabold tracking-wider transition-all",
                activeRange === r
                  ? "border border-cyan-500/20 bg-cyan-500/10 text-cyan-400"
                  : "border border-transparent text-zinc-500 hover:text-zinc-300",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[160px] overflow-hidden rounded-xl border border-zinc-900/40 bg-zinc-950/40">
        <svg
          className="h-full w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={variant === "area" ? 0.35 : 0} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((g) => (
            <line
              key={g}
              x1={padding}
              x2={width - padding}
              y1={padding + (height - 2 * padding) * g}
              y2={padding + (height - 2 * padding) * g}
              stroke="#ffffff"
              strokeOpacity={0.04}
            />
          ))}

          {variant === "area" && areaPath ? (
            <path d={areaPath} fill={`url(#${fillId})`} stroke="none" />
          ) : null}
          {path ? (
            <path
              d={path}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {activePoint && hoveredIndex != null ? (
            <>
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={padding}
                y2={height - padding}
                stroke="#6366f1"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={4}
                fill={strokeColor}
                stroke="#09090b"
                strokeWidth={2}
              />
            </>
          ) : null}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-zinc-500">
        <span>
          Range low <span className="font-mono text-zinc-400">{low != null ? formatPrice(low) : "—"}</span>
        </span>
        <span>
          Range high <span className="font-mono text-zinc-400">{high != null ? formatPrice(high) : "—"}</span>
        </span>
        {fetchedAt ? (
          <span className="text-zinc-600">
            Updated {new Date(fetchedAt).toLocaleTimeString()}
          </span>
        ) : null}
      </div>
    </div>
  );
}
