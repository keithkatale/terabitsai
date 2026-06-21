"use client";

import { useMemo, useState } from "react";
import { Briefcase } from "lucide-react";
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
  tradingMode,
  positions,
  sidebarQuotes,
  onClosePosition,
  onRefresh,
  isActive,
}: {
  balance?: { wallet_available: number } | null;
  summary: LedgerSummaryResponse | null;
  accountLoading: boolean;
  tradingMode: TradingMode;
  positions: TradeData[];
  sidebarQuotes: Record<string, { spot?: number; change24hPct?: number; bid?: number; ask?: number }>;
  onClosePosition: (dealId: string) => void;
  onRefresh: () => void;
  isActive: boolean;
}) {
  const [view, setView] = useState<InvestingView>("listing");

  const walletAvailable = balance?.wallet_available ?? summary?.balance.wallet_available ?? 0;
  const openCount = summary?.portfolio?.open_positions_count ?? positions.length;

  const positionRows = useMemo(() => {
    return positions.map((pos) => {
      const live = sidebarQuotes[pos.symbol]?.spot ?? pos.entryPrice;
      const pnl =
        pos.direction === "BUY"
          ? (live - pos.entryPrice) * pos.size
          : (pos.entryPrice - live) * pos.size;
      return { pos, live, pnl };
    });
  }, [positions, sidebarQuotes]);

  return (
    <div className="quant-shell flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/6 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-cyan-400" />
            <div>
              <h1 className="text-lg font-bold text-white">Investing</h1>
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
                {positionRows.map(({ pos, live, pnl }) => (
                  <li key={pos.id} className="quant-card flex items-center gap-3 p-3">
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
                        Entry ${pos.entryPrice.toFixed(2)} · Mark ${live.toFixed(2)} · {pos.size}{" "}
                        units · {pos.leverage}x
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
                      <button
                        type="button"
                        onClick={() => onClosePosition(pos.id)}
                        className="mt-1 text-[10px] font-semibold text-zinc-500 hover:text-[var(--accent-red)]"
                      >
                        Close
                      </button>
                    </div>
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
