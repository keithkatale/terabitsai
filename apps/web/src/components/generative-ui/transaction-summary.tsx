"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, TrendingDown, DollarSign } from "lucide-react";

interface TransactionItem {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  description: string;
}

interface TransactionSummaryProps {
  items?: TransactionItem[];
  totalAmount?: number;
  title?: string;
}

export function TransactionSummary({
  items,
  totalAmount = 4850,
  title = "Monthly Transaction Summary"
}: TransactionSummaryProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [activeIdx, setActiveIdx] = useState<number>(0);

  const transactions = useMemo(() => {
    if (items && items.length > 0) return items;

    return [
      {
        category: "Trading Commissions",
        amount: totalAmount * 0.38,
        percentage: 38,
        color: "#6366f1", // Indigo
        description: "Standard swap spreads, overnight leverage rollover rates, and contract commissions across short positions."
      },
      {
        category: "Market Data Feeds",
        amount: totalAmount * 0.24,
        percentage: 24,
        color: "#38bdf8", // Sky Blue
        description: "Real-time Level 2 order book API subscriptions, sub-millisecond NASDAQ quotes, and news terminal streaming hooks."
      },
      {
        category: "SaaS & AI Infrastructure",
        amount: totalAmount * 0.22,
        percentage: 22,
        color: "#10b981", // Emerald
        description: "Cloud compute nodes for strategy optimization, PineScript backtesting workers, and LLM reasoning tokens."
      },
      {
        category: "Advisory & Research",
        amount: totalAmount * 0.16,
        percentage: 16,
        color: "#f59e0b", // Amber
        description: "Quant newsletter memberships, professional macro analyst reports, and risk auditing platform fees."
      }
    ];
  }, [items, totalAmount]);

  const height = 140;
  const width = 360;
  const paddingX = 30;
  const paddingY = 20;

  // Render SVG Bars
  const barData = useMemo(() => {
    const maxVal = Math.max(...transactions.map(t => t.amount));
    const maxScale = maxVal * 1.15 || 1;
    const barCount = transactions.length;
    const usableWidth = width - 2 * paddingX;
    const barWidth = Math.min(24, (usableWidth / barCount) - 16);
    const spacing = (usableWidth - (barWidth * barCount)) / (barCount - 1 || 1);

    return transactions.map((t, idx) => {
      const x = paddingX + idx * (barWidth + spacing);
      const barHeight = (t.amount / maxScale) * (height - 2 * paddingY);
      const y = height - paddingY - barHeight;

      return {
        ...t,
        x,
        y,
        w: barWidth,
        h: barHeight,
        idx
      };
    });
  }, [transactions, width, height]);

  const activeTransaction = transactions[activeIdx] || transactions[0];

  return (
    <div className="w-full bg-zinc-950/50 backdrop-blur-xl border border-zinc-900 rounded-2xl p-4 flex flex-col gap-4 shadow-xl animate-fade-in my-3 text-left">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-zinc-900/40 pb-2.5">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="size-3.5 text-indigo-400" />
          <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
          <TrendingDown className="size-3 text-rose-500" />
          <span>Total Expenses</span>
        </div>
      </div>

      {/* Main Section: Bar chart SVG */}
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="relative w-full sm:w-[180px] h-[140px] bg-zinc-950/40 rounded-xl border border-zinc-900/40 overflow-hidden select-none flex items-center justify-center">
          <svg className="size-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
            <defs>
              {/* Vertical gradients matching each color */}
              {barData.map((bar) => (
                <linearGradient key={`grad-${bar.idx}`} id={`bar-grad-${bar.idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={bar.color} stopOpacity="1" />
                  <stop offset="100%" stopColor={bar.color} stopOpacity="0.25" />
                </linearGradient>
              ))}
              <filter id="bar-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Grid horizontal guidelines */}
            <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#11111c" strokeWidth={1} />
            <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="#1f1f2e" strokeWidth={1} strokeDasharray="3 3" />
            <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#11111c" strokeWidth={1.5} />

            {/* Bars rendering */}
            {barData.map((bar) => {
              const isHovered = hoveredIdx === bar.idx;
              const isActive = activeIdx === bar.idx;
              
              return (
                <g 
                  key={bar.idx}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(bar.idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => setActiveIdx(bar.idx)}
                >
                  {/* Invisible broad hitbox for ease of click/hover */}
                  <rect
                    x={bar.x - 8}
                    y={paddingY}
                    width={bar.w + 16}
                    height={height - 2 * paddingY}
                    fill="transparent"
                  />
                  {/* Active highlight background column */}
                  {isActive && (
                    <rect
                      x={bar.x - 4}
                      y={paddingY - 4}
                      width={bar.w + 8}
                      height={height - 2 * paddingY + 8}
                      fill="rgba(99, 102, 241, 0.04)"
                      stroke="rgba(99, 102, 241, 0.1)"
                      strokeWidth={1}
                      rx="6"
                    />
                  )}
                  {/* Actual SVG Bar */}
                  <rect
                    x={bar.x}
                    y={bar.y}
                    width={bar.w}
                    height={Math.max(4, bar.h)}
                    fill={`url(#bar-grad-${bar.idx})`}
                    rx="3"
                    className="transition-all duration-300"
                    filter={(isHovered || isActive) ? "url(#bar-glow)" : undefined}
                    style={{
                      transformOrigin: `${bar.x + bar.w / 2}px ${height - paddingY}px`,
                      transform: isHovered ? "scaleY(1.04)" : "scaleY(1)"
                    }}
                  />
                  {/* Category mini initial label */}
                  <text
                    x={bar.x + bar.w / 2}
                    y={height - 6}
                    textAnchor="middle"
                    fill={(isHovered || isActive) ? "#e4e4e7" : "#52525b"}
                    fontSize="8"
                    fontWeight="800"
                    className="font-mono uppercase transition-colors"
                  >
                    {bar.category.substring(0, 3)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Categories list on the right */}
        <div className="flex-1 w-full flex flex-col gap-1.5 self-stretch justify-center">
          {transactions.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={cn(
                "w-full flex items-center justify-between p-2 rounded-xl text-left border transition-all cursor-pointer group",
                activeIdx === idx
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
                <span className="text-[10px] text-zinc-500">(${item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Expense Detail Analysis Card */}
      <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-900/60 flex flex-col gap-1.5 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: activeTransaction.color }} />
            <h4 className="text-[11px] font-extrabold text-white uppercase tracking-wide">{activeTransaction.category} Breakdown</h4>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
            <DollarSign className="size-3 text-zinc-500" />
            <span className="text-indigo-400">${activeTransaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed font-sans mt-0.5">
          {activeTransaction.description}
        </p>
      </div>
    </div>
  );
}
