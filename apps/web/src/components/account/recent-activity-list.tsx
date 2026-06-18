"use client";

import { cn } from "@/lib/utils";
import type { RecentLedgerEntry } from "@/lib/ledger/types";

export function RecentActivityList({
  entries,
  loading,
  emptyMessage = "No activity yet.",
}: {
  entries: RecentLedgerEntry[];
  loading?: boolean;
  emptyMessage?: string;
}) {
  if (loading) {
    return (
      <p className="text-[11px] text-zinc-500 animate-pulse">Loading activity…</p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-[11px] text-zinc-500 text-center py-4">{emptyMessage}</p>
    );
  }

  const formatMoney = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  };

  return (
    <ul className="divide-y divide-zinc-900/60 max-h-[220px] overflow-y-auto">
      {entries.map((tx) => (
        <li
          key={tx.id}
          className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-zinc-200 capitalize">
              {tx.title}
            </p>
            {tx.subtitle ? (
              <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                {tx.subtitle}
              </p>
            ) : null}
            <p className="mt-0.5 text-[9px] text-zinc-600">
              {new Date(tx.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
          <p
            className={cn(
              "shrink-0 text-[11px] font-bold font-mono tabular-nums",
              tx.direction === "in" && "text-emerald-400",
              tx.direction === "out" && "text-red-400",
              tx.direction === "neutral" && "text-zinc-400"
            )}
          >
            {tx.direction === "in" ? "+" : tx.direction === "out" ? "−" : ""}
            {formatMoney(tx.amount, tx.currency)}
          </p>
        </li>
      ))}
    </ul>
  );
}
