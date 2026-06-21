"use client";

import { cn } from "@/lib/utils";
import type { TradingMode } from "@/lib/account/api";

export function TradingModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: TradingMode;
  onChange: (mode: TradingMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-xl border border-white/8 bg-black/40 p-1">
      {(["demo", "live"] as const).map((value) => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer disabled:opacity-50",
            mode === value
              ? value === "demo"
                ? "bg-cyan-500/15 text-cyan-300"
                : "bg-emerald-500/15 text-emerald-300"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
