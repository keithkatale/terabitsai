"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TradingModeToggle } from "@/components/account/trading-mode-toggle";
import { useAppAccount } from "@/contexts/app-account-context";
import { useHITLRequests } from "@/components/terminal/hitl-approval-modal";

function WalletSummaryPill({
  mode,
  available,
  loading,
}: {
  mode: "demo" | "live";
  available: number;
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1",
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

/** Wallet-tab toolbar — trading mode, balance, deposit, pricing (moved from app top bar). */
export function WalletActionsBar() {
  const {
    tradingMode,
    setTradingMode,
    balance,
    loading: accountLoading,
    openDeposit,
  } = useAppAccount();

  const hitlRequests = useHITLRequests();
  const [engineStatus, setEngineStatus] = useState<"idle" | "running" | "scanning">("idle");

  const walletAvailable = balance?.wallet_available ?? 0;
  const accountInitialLoading = accountLoading && balance == null;

  useEffect(() => {
    let cancelled = false;

    const loadEngineMeta = async () => {
      try {
        const statusRes = await fetch("/api/engine/status", { credentials: "include" });
        if (cancelled || !statusRes.ok) return;

        const status = (await statusRes.json()) as { mode?: string };
        setEngineStatus(
          status.mode === "running" || status.mode === "scanning"
            ? (status.mode as "running" | "scanning")
            : "idle",
        );
      } catch {
        // Non-fatal
      }
    };

    void loadEngineMeta();
    const interval = setInterval(loadEngineMeta, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-white/[0.06] bg-[var(--terminal-surface)] px-3 py-2 sm:px-4">
      {engineStatus !== "idle" ? (
        <span className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
          Engine {engineStatus}
        </span>
      ) : null}
      {hitlRequests.length > 0 ? (
        <span className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-2 py-1 text-[10px] font-semibold text-yellow-300">
          {hitlRequests.length} approval{hitlRequests.length === 1 ? "" : "s"}
        </span>
      ) : null}
      <TradingModeToggle
        mode={tradingMode}
        onChange={setTradingMode}
        disabled={accountInitialLoading}
      />
      <WalletSummaryPill
        mode={tradingMode}
        available={walletAvailable}
        loading={accountInitialLoading}
      />
      <button
        type="button"
        onClick={openDeposit}
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
  );
}
