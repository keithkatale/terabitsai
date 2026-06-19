"use client";

import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const TICKER_SYMBOLS = ["BTCUSD", "ETHUSD", "US100", "GOLD", "AAPL", "NVDA", "EURUSD"];

type PulseTheme = { label: string; value: string };

export function GlobalTickerStrip({
  sidebarQuotes,
  onSymbolClick,
}: {
  sidebarQuotes: Record<string, { spot?: number; change24hPct?: number }>;
  onSymbolClick?: (symbol: string) => void;
}) {
  const [pulse, setPulse] = useState<PulseTheme[]>([]);

  useEffect(() => {
    fetch("/api/intel/pulse")
      .then((r) => r.json())
      .then((data) => {
        if (data?.themes) setPulse(data.themes);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="shrink-0 border-b border-zinc-900/60 bg-zinc-950/60 overflow-hidden">
      <div className="flex items-center gap-6 px-4 py-2 overflow-x-auto scrollbar-none text-[10px] font-mono">
        {TICKER_SYMBOLS.map((sym) => {
          const q = sidebarQuotes[sym];
          const change = q?.change24hPct ?? 0;
          const spot = q?.spot;
          return (
            <button
              key={sym}
              type="button"
              onClick={() => onSymbolClick?.(sym)}
              className="flex items-center gap-2 shrink-0 hover:opacity-80 cursor-pointer"
            >
              <span className="font-bold text-zinc-400">{sym}</span>
              {spot != null ? (
                <span className="text-zinc-200">${spot >= 1000 ? spot.toLocaleString(undefined, { maximumFractionDigits: 0 }) : spot.toFixed(2)}</span>
              ) : null}
              <span className={cn("flex items-center gap-0.5 font-bold", change >= 0 ? "text-emerald-400" : "text-red-400")}>
                {change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            </button>
          );
        })}
        {pulse.length > 0 ? (
          <>
            <span className="text-zinc-700">|</span>
            {pulse.map((t) => (
              <span key={t.label} className="text-zinc-500 shrink-0">
                <span className="text-zinc-600 uppercase text-[8px] mr-1">{t.label}</span>
                <span className="text-indigo-400 font-bold">{t.value}</span>
              </span>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
