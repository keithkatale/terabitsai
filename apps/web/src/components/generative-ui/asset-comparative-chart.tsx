"use client";

import * as React from "react";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface DataPoint {
  time: string;
  val1: number;
  val2: number;
}

interface AssetComparativeChartProps {
  ticker1?: string;
  ticker2?: string;
  data?: DataPoint[];
  range?: string;
  dataSource?: string;
}

export function AssetComparativeChart({
  ticker1 = "AAPL",
  ticker2 = "MSFT",
  data,
  range = "6M",
  dataSource = "capital.com",
}: AssetComparativeChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const dataset = useMemo(() => {
    if (data && data.length > 0) return data;
    return [];
  }, [data]);

  if (dataset.length === 0) {
    return (
      <div className="my-3 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4 text-left text-xs text-amber-200">
        No live comparison data loaded. Ask the AI to compare {ticker1} and {ticker2} — it will fetch real Capital.com history.
      </div>
    );
  }

  const height = 150;
  const width = 380;
  const padding = 20;

  const points = useMemo(() => {
    const vals1 = dataset.map((d) => d.val1);
    const vals2 = dataset.map((d) => d.val2);
    const allVals = [...vals1, ...vals2];
    const minVal = Math.min(...allVals) * 0.98;
    const maxVal = Math.max(...allVals) * 1.02;
    const valRange = maxVal - minVal || 1;

    const scaleX = (idx: number) => padding + (idx / (dataset.length - 1)) * (width - 2 * padding);
    const scaleY = (val: number) => height - padding - ((val - minVal) / valRange) * (height - 2 * padding);

    const coords1 = dataset.map((d, i) => ({ x: scaleX(i), y: scaleY(d.val1) }));
    const coords2 = dataset.map((d, i) => ({ x: scaleX(i), y: scaleY(d.val2) }));

    const getPathStr = (c: { x: number; y: number }[]) => {
      if (c.length === 0) return "";
      let path = `M ${c[0].x} ${c[0].y}`;
      for (let i = 1; i < c.length; i++) {
        const cpX1 = c[i - 1].x + (c[i].x - c[i - 1].x) / 3;
        const cpY1 = c[i - 1].y;
        const cpX2 = c[i - 1].x + (2 * (c[i].x - c[i - 1].x)) / 3;
        const cpY2 = c[i].y;
        path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${c[i].x} ${c[i].y}`;
      }
      return path;
    };

    return {
      path1: getPathStr(coords1),
      path2: getPathStr(coords2),
      coords1,
      coords2,
    };
  }, [dataset, width, height]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || points.coords1.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    let nearestIdx = 0;
    let minDistance = Infinity;

    points.coords1.forEach((pt, i) => {
      const distance = Math.abs(pt.x - x);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIdx = i;
      }
    });

    setHoveredIndex(nearestIdx);
  };

  const activePoint = hoveredIndex !== null ? dataset[hoveredIndex] : dataset[dataset.length - 1];
  const activeCoord1 =
    hoveredIndex !== null ? points.coords1[hoveredIndex] : points.coords1[points.coords1.length - 1];
  const activeCoord2 =
    hoveredIndex !== null ? points.coords2[hoveredIndex] : points.coords2[points.coords2.length - 1];

  const pctDiff1 = ((activePoint.val1 - dataset[0].val1) / dataset[0].val1) * 100;
  const pctDiff2 = ((activePoint.val2 - dataset[0].val2) / dataset[0].val2) * 100;

  return (
    <div
      ref={containerRef}
      className="my-3 w-full rounded-2xl border border-zinc-900 bg-zinc-950/50 p-4 shadow-xl backdrop-blur-xl animate-fade-in text-left"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-100">
              Comparative Performance
            </span>
            <span className="rounded border border-emerald-500/20 bg-emerald-950/30 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
              Live · {dataSource}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded border border-sky-500/20 bg-sky-950/20 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-sky-400">
              {ticker1}
            </span>
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-500">VS</span>
            <span className="rounded border border-rose-500/20 bg-rose-950/20 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-rose-400">
              {ticker2}
            </span>
            <span className="text-[10px] text-zinc-500">· {range}</span>
          </div>
        </div>
      </div>

      <div className="relative h-[150px] overflow-hidden rounded-xl border border-zinc-900/40 bg-zinc-950/40">
        <svg
          className="h-full w-full overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id="gradient-blue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gradient-rose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </linearGradient>
          </defs>

          {points.coords1.length > 0 && (
            <path
              d={`${points.path1} L ${points.coords1[points.coords1.length - 1].x} ${height - padding} L ${points.coords1[0].x} ${height - padding} Z`}
              fill="url(#gradient-blue)"
            />
          )}
          {points.coords2.length > 0 && (
            <path
              d={`${points.path2} L ${points.coords2[points.coords2.length - 1].x} ${height - padding} L ${points.coords2[0].x} ${height - padding} Z`}
              fill="url(#gradient-rose)"
            />
          )}

          <path d={points.path1} fill="none" stroke="#38bdf8" strokeWidth={1.75} />
          <path d={points.path2} fill="none" stroke="#f43f5e" strokeWidth={1.75} />

          {hoveredIndex !== null && activeCoord1 && (
            <line
              x1={activeCoord1.x}
              y1={padding}
              x2={activeCoord1.x}
              y2={height - padding}
              stroke="#4f46e5"
              strokeWidth={1.2}
              strokeDasharray="2 2"
            />
          )}
        </svg>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3 rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-3 font-mono text-xs">
        <div className="border-r border-zinc-900/60 pr-1">
          <span className="text-[9px] font-extrabold uppercase text-zinc-500">{ticker1} ({activePoint.time})</span>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-sm font-extrabold text-zinc-200">${activePoint.val1.toFixed(2)}</span>
            <span className={cn("text-[9px] font-extrabold", pctDiff1 >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {pctDiff1 >= 0 ? "+" : ""}
              {pctDiff1.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="pl-1">
          <span className="text-[9px] font-extrabold uppercase text-zinc-500">{ticker2} ({activePoint.time})</span>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-sm font-extrabold text-zinc-200">${activePoint.val2.toFixed(2)}</span>
            <span className={cn("text-[9px] font-extrabold", pctDiff2 >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {pctDiff2 >= 0 ? "+" : ""}
              {pctDiff2.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
