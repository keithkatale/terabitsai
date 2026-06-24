"use client";

import { cn } from "@/lib/utils";
import { INDICATOR_CATALOG } from "@/lib/chart/tradingview-spec";

const INDICATOR_OPTIONS = Object.keys(INDICATOR_CATALOG).map((k) => ({
  id: k,
  label: k.toUpperCase(),
}));

export function IndicatorPicker({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (indicators: string[]) => void;
  className?: string;
}) {
  const toggle = (id: string) => {
    const label = id.toUpperCase();
    if (value.map((v) => v.toLowerCase()).includes(id)) {
      const next = value.filter((v) => v.toLowerCase() !== id);
      onChange(next.length ? next : ["RSI", "MACD"]);
    } else {
      onChange([...value, label]);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {INDICATOR_OPTIONS.map(({ id, label }) => {
        const active = value.map((v) => v.toLowerCase()).includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={cn(
              "rounded-lg border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors",
              active
                ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                : "border-white/8 text-zinc-500 hover:border-white/15 hover:text-zinc-300",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
