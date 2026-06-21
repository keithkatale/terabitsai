"use client";

import { cn } from "@/lib/utils";

export function SummaryCard({
  label,
  value,
  accent = false,
  loading = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="quant-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-mono tabular-nums",
          loading && "text-zinc-600",
          !loading && accent && value >= 0 && "text-[var(--accent-green)]",
          !loading && accent && value < 0 && "text-[var(--accent-red)]",
          !loading && !accent && "text-zinc-100",
        )}
      >
        {loading
          ? "…"
          : `${accent && value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </div>
    </div>
  );
}
