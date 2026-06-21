"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TradingModeToggle } from "@/components/account/trading-mode-toggle";
import type { TradingMode } from "@/lib/account/api";

function WalletSummaryPill({
  mode,
  available,
  loading,
}: {
  mode: TradingMode;
  available: number;
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        "hidden items-center gap-1.5 rounded-lg border px-2.5 py-1 sm:flex",
        mode === "demo"
          ? "border-cyan-500/20 bg-cyan-500/5"
          : "border-emerald-500/20 bg-emerald-500/5",
      )}
    >
      <span
        className={cn(
          "text-[9px] font-extrabold uppercase tracking-wider",
          mode === "demo" ? "text-cyan-400" : "text-emerald-400",
        )}
      >
        {mode}
      </span>
      <span className="text-xs font-mono font-bold text-zinc-100">
        {loading
          ? "…"
          : `$${available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </span>
    </div>
  );
}

export function AppTopBar({
  tradingMode,
  onTradingModeChange,
  walletAvailable,
  accountLoading,
  onDeposit,
  engineStatus,
  pendingHitl,
}: {
  tradingMode: TradingMode;
  onTradingModeChange: (mode: TradingMode) => void;
  walletAvailable: number;
  accountLoading?: boolean;
  onDeposit: () => void;
  engineStatus?: "idle" | "running" | "scanning";
  pendingHitl?: number;
}) {
  return (
    <div className="flex w-full items-center justify-end gap-2 bg-[var(--terminal-surface)] px-3 py-1.5">
      <div className="flex items-center gap-2 sm:gap-3">
        {engineStatus && engineStatus !== "idle" ? (
          <span className="hidden rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300 md:inline">
            Engine {engineStatus}
          </span>
        ) : null}
        {pendingHitl && pendingHitl > 0 ? (
          <span className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-2 py-1 text-[10px] font-semibold text-yellow-300">
            {pendingHitl} approval{pendingHitl === 1 ? "" : "s"}
          </span>
        ) : null}
        <TradingModeToggle
          mode={tradingMode}
          onChange={onTradingModeChange}
          disabled={accountLoading}
        />
        <WalletSummaryPill
          mode={tradingMode}
          available={walletAvailable}
          loading={accountLoading}
        />
        <button
          type="button"
          onClick={onDeposit}
          className="terminal-btn terminal-btn-primary inline-flex items-center gap-1.5 px-2.5 py-1 text-xs"
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">Deposit</span>
        </button>
        <Link
          href="/pricing"
          className="terminal-btn terminal-btn-ghost border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs backdrop-blur-sm"
        >
          Pricing
        </Link>
      </div>
    </div>
  );
}
