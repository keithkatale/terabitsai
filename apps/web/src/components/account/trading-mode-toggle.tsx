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
    <div className="terminal-nav-group">
      {(["demo", "live"] as const).map((value) => (
        <button
          key={value}
          type="button"
          {...(disabled ? { disabled: true } : {})}
          onClick={() => onChange(value)}
          className={cn(
            "terminal-tab px-3 py-1.5 text-[11px]",
            mode === value
              ? "terminal-tab-active"
              : "terminal-tab-idle",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
