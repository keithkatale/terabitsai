"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TradingModeToggle } from "@/components/account/trading-mode-toggle";
import { useAppAccount } from "@/contexts/app-account-context";
import { useHITLRequests } from "@/components/terminal/hitl-approval-modal";

const WALLET_PRIMARY_BUTTON =
  "relative inline-flex items-center justify-center overflow-hidden rounded-full border border-[#5988ff] bg-[#316bff] font-semibold text-white shadow-[0_8px_18px_rgba(49,107,255,0.32)] transition-all hover:bg-[#3f76ff] hover:shadow-[0_10px_24px_rgba(49,107,255,0.4)]";
const WALLET_SECONDARY_BUTTON =
  "inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.03] font-semibold text-white/85 backdrop-blur-sm transition-all hover:border-[#5988ff]/70 hover:bg-[#316bff]/10 hover:text-white";

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
        "flex items-center gap-2 rounded-full border px-3 py-1 shadow-[0_0_18px_rgba(49,107,255,0.08)]",
        mode === "demo"
          ? "border-[#5988ff]/40 bg-[#316bff]/10"
          : "border-emerald-400/30 bg-emerald-400/10",
      )}
    >
      <span
        className={cn(
          "text-[9px] font-extrabold uppercase tracking-[0.18em]",
          mode === "demo" ? "text-[#8fb0ff]" : "text-emerald-300",
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
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-white/10 bg-[#07070e]/95 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-md sm:px-4">
      {engineStatus !== "idle" ? (
        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
          Engine {engineStatus}
        </span>
      ) : null}
      {hitlRequests.length > 0 ? (
        <span className="rounded-full border border-yellow-300/25 bg-yellow-300/10 px-3 py-1 text-[10px] font-semibold text-yellow-200">
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
        className={cn(WALLET_PRIMARY_BUTTON, "gap-1.5 px-3 py-1 text-xs")}
      >
        <Plus className="size-3.5" />
        <span className="hidden sm:inline">Deposit</span>
      </button>
      <Link
        href="/pricing"
        className={cn(WALLET_SECONDARY_BUTTON, "px-3 py-1 text-xs")}
      >
        Pricing
      </Link>
    </div>
  );
}
