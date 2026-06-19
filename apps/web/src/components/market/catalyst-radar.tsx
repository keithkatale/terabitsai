"use client";

import { cn } from "@/lib/utils";
import type { CatalystRadarItem } from "@quant/contracts";

export function CatalystRadar({
  items,
  onSymbolClick,
  selectedSymbol,
}: {
  items: CatalystRadarItem[];
  onSymbolClick: (symbol: string) => void;
  selectedSymbol?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500 px-2 py-4 text-center">
        Catalyst radar warming up — analysis in progress.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {items.map((item) => {
        const intensity = Math.abs(item.heat);
        const isHot = item.heat > 0.1;
        const isCold = item.heat < -0.1;
        return (
          <button
            key={item.symbol}
            type="button"
            onClick={() => onSymbolClick(item.symbol)}
            className={cn(
              "text-left terminal-card p-3.5 transition-all cursor-pointer hover:border-indigo-500/30",
              selectedSymbol === item.symbol && "ring-1 ring-indigo-500/40 border-indigo-500/35",
              isHot && "shadow-[0_0_24px_rgba(16,185,129,0.06)]",
              isCold && "shadow-[0_0_24px_rgba(239,68,68,0.06)]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-white tracking-tight">{item.symbol}</span>
              <span
                className={cn(
                  "terminal-badge",
                  isHot ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25" :
                    isCold ? "bg-red-500/15 text-red-300 border border-red-500/25" :
                    "bg-zinc-800/80 text-zinc-400 border border-zinc-700/50"
                )}
              >
                {item.impactScore}/10
              </span>
            </div>
            <div className="h-1.5 rounded-full mt-2.5 bg-zinc-800/80 overflow-hidden" title={`Sentiment heat: ${item.heat.toFixed(2)}`}>
              <div
                className={cn("h-full rounded-full transition-all", isHot ? "bg-emerald-400" : isCold ? "bg-red-400" : "bg-zinc-500")}
                style={{ width: `${Math.max(8, Math.round(intensity * 100))}%` }}
              />
            </div>
            <p className="text-xs text-zinc-400 mt-2.5 line-clamp-2 leading-snug">{item.headline}</p>
          </button>
        );
      })}
    </div>
  );
}
