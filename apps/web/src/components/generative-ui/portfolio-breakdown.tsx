"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { PieChart, DollarSign, ArrowRight } from "lucide-react";

interface AllocationItem {
  category: string;
  percentage: number;
  value: number;
  color: string;
  description: string;
}

interface PortfolioBreakdownProps {
  items?: AllocationItem[];
  totalValue?: number;
}

export function PortfolioBreakdown({
  items,
  totalValue = 24500
}: PortfolioBreakdownProps) {
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const allocationData = useMemo(() => {
    if (items && items.length > 0) return items;

    return [
      {
        category: "Equities (Stocks/ETFs)",
        percentage: 50,
        value: totalValue * 0.50,
        color: "#6366f1", // Indigo
        description: "Primarily high-growth tech positions (AAPL, NVDA, TSLA) yielding strong long-term momentum index metrics."
      },
      {
        category: "Cryptocurrencies",
        percentage: 25,
        value: totalValue * 0.25,
        color: "#10b981", // Emerald
        description: "Exposure capped at major caps (BTCUSD, ETHUSD) taking tactical advantage of spot leverage CFDs."
      },
      {
        category: "Fixed Income Bonds",
        percentage: 15,
        value: totalValue * 0.15,
        color: "#f59e0b", // Amber
        description: "Treasury instruments and investment-grade corporate bonds serving as stability anchors."
      },
      {
        category: "Liquid Cash / Reserves",
        percentage: 10,
        value: totalValue * 0.10,
        color: "#ec4899", // Rose
        description: "Simulated paper funds parked in available capital reserves to capture sudden market dips instantly."
      }
    ];
  }, [items, totalValue]);

  // Compute standard SVG Donut strokes
  const radius = 60;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    let accumulatedPercent = 0;

    return allocationData.map((item, idx) => {
      const strokeLength = (item.percentage / 100) * circumference;
      const strokeOffset = circumference - ((accumulatedPercent / 100) * circumference);
      accumulatedPercent += item.percentage;

      return {
        ...item,
        strokeLength,
        strokeOffset,
        idx
      };
    });
  }, [allocationData, circumference]);

  const activeSegment = allocationData[activeIndex] || allocationData[0];

  return (
    <div className="w-full bg-zinc-950/50 backdrop-blur-xl border border-zinc-900 rounded-2xl p-4 flex flex-col gap-4 shadow-xl animate-fade-in my-3 text-left">
      {/* Title Header */}
      <div className="flex items-center gap-1.5 border-b border-zinc-900/40 pb-2.5">
        <PieChart className="size-3.5 text-emerald-400" />
        <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Asset Allocation Breakdown</span>
      </div>

      {/* Main Row: Donut Chart on Left, list on Right */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* SVG Donut */}
        <div className="relative size-[160px] shrink-0 select-none flex items-center justify-center">
          <svg className="size-full -rotate-90" viewBox="0 0 160 160">
            {/* Background circle track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="transparent"
              stroke="#0f0f18"
              strokeWidth={strokeWidth}
            />
            {/* Segment arcs */}
            {segments.map((seg) => (
              <circle
                key={seg.idx}
                className="transition-all duration-300 cursor-pointer hover:opacity-90 origin-center"
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={seg.idx === activeIndex ? strokeWidth + 3 : strokeWidth}
                strokeDasharray={`${seg.strokeLength} ${circumference}`}
                strokeDashoffset={seg.strokeOffset}
                strokeLinecap="round"
                onClick={() => setActiveIndex(seg.idx)}
              />
            ))}
          </svg>
          
          {/* Centered Total Cash Tag */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[9px] text-zinc-500 font-extrabold tracking-widest uppercase leading-none">Net Equity</span>
            <span className="text-sm font-mono font-bold text-white mt-1 leading-none">
              ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Legend Interactive list */}
        <div className="flex-1 w-full flex flex-col gap-1.5 self-stretch justify-center">
          {allocationData.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                "w-full flex items-center justify-between p-2 rounded-xl text-left border transition-all cursor-pointer group",
                activeIndex === idx
                  ? "bg-zinc-900/40 border-zinc-800 shadow-md"
                  : "bg-transparent border-transparent hover:bg-zinc-900/10"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-[11.5px] font-medium text-zinc-300 group-hover:text-white truncate">{item.category}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-right shrink-0 pl-1">
                <span className="text-zinc-200">{item.percentage}%</span>
                <span className="text-[10px] text-zinc-500">(${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Segment description detail Card */}
      <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-900/60 flex flex-col gap-1.5 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: activeSegment.color }} />
            <h4 className="text-[11px] font-extrabold text-white uppercase tracking-wide">{activeSegment.category} Analysis</h4>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
            <DollarSign className="size-3 text-zinc-500" />
            <span className="text-cyan-400">${activeSegment.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed font-sans mt-0.5">
          {activeSegment.description}
        </p>
      </div>
    </div>
  );
}
