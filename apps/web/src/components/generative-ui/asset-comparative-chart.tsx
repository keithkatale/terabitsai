"use client";

import * as React from "react";
import { useState, useRef, useMemo } from "react";
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
}

export function AssetComparativeChart({
  ticker1 = "AAPL",
  ticker2 = "MSFT",
  data
}: AssetComparativeChartProps) {
  const [timeframe, setTimeframe] = useState<"1M" | "6M" | "1Y">("6M");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fallback high-fidelity mocked datasets based on chosen timeframe
  const dataset = useMemo(() => {
    if (data && data.length > 0) return data;

    const mockDataMap: Record<"1M" | "6M" | "1Y", DataPoint[]> = {
      "1M": [
        { time: "W1", val1: 100, val2: 100 },
        { time: "W2", val1: 104, val2: 101 },
        { time: "W3", val1: 102, val2: 105 },
        { time: "W4", val1: 108, val2: 103 },
        { time: "Now", val1: 112, val2: 106 },
      ],
      "6M": [
        { time: "Jan", val1: 100, val2: 100 },
        { time: "Feb", val1: 105, val2: 103 },
        { time: "Mar", val1: 103, val2: 108 },
        { time: "Apr", val1: 112, val2: 109 },
        { time: "May", val1: 118, val2: 114 },
        { time: "Jun", val1: 125, val2: 120 },
      ],
      "1Y": [
        { time: "Q1", val1: 100, val2: 100 },
        { time: "Q2", val1: 114, val2: 108 },
        { time: "Q3", val1: 108, val2: 120 },
        { time: "Q4", val1: 126, val2: 118 },
        { time: "End", val1: 138, val2: 132 },
      ]
    };

    return mockDataMap[timeframe];
  }, [data, timeframe]);

  // Compute SVG line paths coordinates
  const height = 150;
  const width = 380;
  const padding = 20;

  const points = useMemo(() => {
    if (dataset.length === 0) return { path1: "", path2: "", coords1: [], coords2: [] };

    const vals1 = dataset.map(d => d.val1);
    const vals2 = dataset.map(d => d.val2);
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
      for (let i = 0; i < c.length - 1; i++) {
        const cpX1 = c[i].x + (c[i + 1].x - c[i].x) / 3;
        const cpY1 = c[i].y;
        const cpX2 = c[i].x + (2 * (c[i + 1].x - c[i].x)) / 3;
        const cpY2 = c[i + 1].y;
        path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${c[i + 1].x} ${c[i + 1].y}`;
      }
      return path;
    };

    return {
      path1: getPathStr(coords1),
      path2: getPathStr(coords2),
      coords1,
      coords2
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

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const activePoint = hoveredIndex !== null ? dataset[hoveredIndex] : dataset[dataset.length - 1];
  const activeCoord1 = hoveredIndex !== null ? points.coords1[hoveredIndex] : points.coords1[points.coords1.length - 1];
  const activeCoord2 = hoveredIndex !== null ? points.coords2[hoveredIndex] : points.coords2[points.coords2.length - 1];

  const pctDiff1 = useMemo(() => {
    const start = dataset[0].val1;
    const end = activePoint.val1;
    return ((end - start) / start) * 100;
  }, [dataset, activePoint]);

  const pctDiff2 = useMemo(() => {
    const start = dataset[0].val2;
    const end = activePoint.val2;
    return ((end - start) / start) * 100;
  }, [dataset, activePoint]);

  return (
    <div 
      ref={containerRef}
      className="w-full bg-zinc-950/50 backdrop-blur-xl border border-zinc-900 rounded-2xl p-4 flex flex-col gap-3 shadow-xl animate-fade-in my-3 text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-indigo-400" />
            <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Comparative Performance</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-sky-500/20 bg-sky-950/20 text-sky-400 font-extrabold">{ticker1}</span>
            <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest">VS</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-rose-500/20 bg-rose-950/20 text-rose-400 font-extrabold">{ticker2}</span>
          </div>
        </div>

        <div className="bg-zinc-950 p-0.5 rounded-lg border border-zinc-900/60 flex gap-0.5">
          {(["1M", "6M", "1Y"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider transition-all cursor-pointer",
                timeframe === tf
                  ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400"
                  : "bg-transparent border border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full h-[150px] bg-zinc-950/40 rounded-xl border border-zinc-900/40 overflow-hidden select-none">
        <svg
          className="w-full h-full overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="gradient-blue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="gradient-rose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>
            <filter id="glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#1f1f2e" strokeWidth={1} strokeDasharray="3 3" />
          <line x1={padding} y1={padding} x2={width-padding} y2={padding} stroke="#11111c" strokeWidth={1} />
          <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#11111c" strokeWidth={1} />

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

          <path
            d={points.path1}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={1.75}
            filter="url(#glow)"
          />
          <path
            d={points.path2}
            fill="none"
            stroke="#f43f5e"
            strokeWidth={1.75}
            filter="url(#glow)"
          />

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

          {activeCoord1 && (
            <circle
              cx={activeCoord1.x}
              cy={activeCoord1.y}
              r={hoveredIndex !== null ? 4.5 : 3.5}
              fill="#38bdf8"
              stroke="#09090b"
              strokeWidth={2}
              className="transition-all duration-150"
            />
          )}
          {activeCoord2 && (
            <circle
              cx={activeCoord2.x}
              cy={activeCoord2.y}
              r={hoveredIndex !== null ? 4.5 : 3.5}
              fill="#f43f5e"
              stroke="#09090b"
              strokeWidth={2}
              className="transition-all duration-150"
            />
          )}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-3.5 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900/60 text-xs font-mono">
        <div className="flex flex-col gap-1 border-r border-zinc-900/60 pr-1">
          <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-wide leading-none">{ticker1} VALUE ({activePoint.time})</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-zinc-200 font-extrabold text-sm">${activePoint.val1.toFixed(1)}</span>
            <span className={cn("text-[9px] font-extrabold uppercase", pctDiff1 >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {pctDiff1 >= 0 ? "+" : ""}{pctDiff1.toFixed(1)}%
            </span>
          </div>
        </div>
        
        <div className="flex flex-col gap-1 pl-1">
          <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-wide leading-none">{ticker2} VALUE ({activePoint.time})</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-zinc-200 font-extrabold text-sm">${activePoint.val2.toFixed(1)}</span>
            <span className={cn("text-[9px] font-extrabold uppercase", pctDiff2 >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {pctDiff2 >= 0 ? "+" : ""}{pctDiff2.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
