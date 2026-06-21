"use client";

import { useMemo, useState } from "react";
import { Briefcase, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { InvestingListingTab } from "@/components/workspace/app-sections/investing-listing-tab";
import type { TradeData } from "@/components/terminal/types";
import type { LedgerSummaryResponse, TradingMode } from "@/lib/account/api";

type InvestingView = "listing" | "positions";

const amountFont = "font-bold tabular-nums tracking-tight";

export function InvestingSection({
  balance,
  summary,
  accountLoading,
  accountRefreshing = false,
  positionsRefreshing = false,
  tradingMode,
  positions,
  sidebarQuotes,
  onManagePosition,
  onRefresh,
  isActive,
}: {
  balance?: { wallet_available: number } | null;
  summary: LedgerSummaryResponse | null;
  accountLoading: boolean;
  accountRefreshing?: boolean;
  positionsRefreshing?: boolean;
  tradingMode: TradingMode;
  positions: TradeData[];
  sidebarQuotes: Record<string, { spot?: number; change24hPct?: number; bid?: number; ask?: number }>;
  onManagePosition: (dealId: string) => void;
  onRefresh: () => void;
  isActive: boolean;
}) {
  const [view, setView] = useState<InvestingView>("listing");
  const isBackgroundRefreshing = accountRefreshing || positionsRefreshing;

  const walletAvailable = balance?.wallet_available ?? summary?.balance.wallet_available ?? 0;
  const openCount =
    positions.length > 0
      ? positions.length
      : (summary?.portfolio?.open_positions_count ?? 0);

  const positionRows = useMemo(() => {
    return positions.map((pos) => {
      const live = pos.markPrice ?? sidebarQuotes[pos.symbol]?.spot ?? pos.entryPrice;
      const pnl =
        pos.pnl ??
        (pos.direction === "BUY"
          ? (live - pos.entryPrice) * pos.size
          : (pos.entryPrice - live) * pos.size);
      const pnlPct =
        pos.pnlPct ??
        (pos.margin > 0 ? (pnl / pos.margin) * 100 : 0);
      return { pos, live, pnl, pnlPct };
    });
  }, [positions, sidebarQuotes]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/6 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-cyan-400" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">Investing</h1>
                {isBackgroundRefreshing ? (
                  <Loader2 className="size-3.5 animate-spin text-zinc-500" aria-label="Updating" />
                ) : null}
              </div>
              <p className="text-[11px] text-zinc-500">
                Manual testing · Capital.com prices · {tradingMode === "demo" ? "Demo" : "Live"} wallet
              </p>
            </div>
          </div>
          <div className="flex gap-1 rounded-xl border border-white/8 bg-black/30 p-1">
            {(
              [
                ["listing", "Listing"],
                ["positions", `Positions (${openCount})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors",
                  view === id
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {view === "listing" ? (
          <InvestingListingTab
            mode={tradingMode}
            walletAvailable={walletAvailable}
            enabled={isActive && view === "listing"}
            onPurchased={onRefresh}
          />
        ) : (
          <div className="h-full overflow-y-auto p-4">
            {positionRows.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-500">
                No open positions. Use Listing to purchase at Capital.com prices.
              </p>
            ) : (
              <ul className="space-y-2">
                {positionRows.map(({ pos, live, pnl, pnlPct }) => (
                  <li key={pos.id}>
                    <button
                      type="button"
                      onClick={() => onManagePosition(pos.id)}
                      className="quant-card flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <AssetLogoIcon symbol={pos.symbol} size="sm" className="shrink-0 rounded-md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{pos.symbol}</span>
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase",
                              pos.direction === "BUY"
                                ? "text-[var(--accent-green)]"
                                : "text-[var(--accent-red)]",
                            )}
                          >
                            {pos.direction}
                          </span>
                        </div>
                        <p className={cn("text-xs text-zinc-500", amountFont)}>
                          Entry ${pos.entryPrice.toFixed(8)} · Capital mark ${live.toFixed(8)} ·{" "}
                          {pos.size} units
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "text-sm",
                            amountFont,
                            pnl >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
                          )}
                        >
                          {pnl >= 0 ? "+" : "−"}${Math.abs(pnl).toFixed(2)}
                        </p>
                        <p
                          className={cn(
                            "text-[10px] font-semibold tabular-nums",
                            pnlPct >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
                          )}
                        >
                          {pnlPct >= 0 ? "+" : ""}
                          {pnlPct.toFixed(1)}%
                        </p>
                        <p className="mt-1 text-[10px] font-semibold text-cyan-500/80">
                          Manage
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-zinc-600" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
