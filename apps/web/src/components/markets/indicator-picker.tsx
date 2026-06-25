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
    <div className={cn("terminal-nav-group flex-wrap", className)}>
      {INDICATOR_OPTIONS.map(({ id, label }) => {
        const active = value.map((v) => v.toLowerCase()).includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={cn(
              "terminal-tab px-2 py-0.5 text-[9px]",
              active ? "terminal-tab-active" : "terminal-tab-idle",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
