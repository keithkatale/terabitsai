"use client";

import { cn } from "@/lib/utils";
import type { TvInterval } from "@/lib/chart/tradingview-spec";

const TIMEFRAMES: Array<{ id: TvInterval; label: string }> = [
  { id: "1", label: "1m" },
  { id: "5", label: "5m" },
  { id: "15", label: "15m" },
  { id: "60", label: "1H" },
  { id: "240", label: "4H" },
  { id: "D", label: "1D" },
  { id: "W", label: "1W" },
];

export function TimeframeSelector({
  value,
  onChange,
  className,
}: {
  value: TvInterval;
  onChange: (interval: TvInterval) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {TIMEFRAMES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors",
            value === id
              ? "bg-cyan-500/20 text-cyan-300"
              : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
