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
    <div className="inline-flex rounded-full border border-white/15 bg-white/[0.03] p-0.5 shadow-[0_0_18px_rgba(49,107,255,0.08)] backdrop-blur-sm">
      {(["demo", "live"] as const).map((value) => (
        <button
          key={value}
          type="button"
          {...(disabled ? { disabled: true } : {})}
          onClick={() => onChange(value)}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-all",
            mode === value
              ? "border border-[#5988ff] bg-[#316bff] text-white shadow-[0_6px_14px_rgba(49,107,255,0.28)]"
              : "border border-transparent text-white/55 hover:bg-[#316bff]/10 hover:text-white",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
