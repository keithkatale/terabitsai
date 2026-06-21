"use client";

import { useMemo, useState } from "react";
import { Briefcase, CircleUserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountTab } from "@/components/terminal/terminal-tabs/account-tab";
import { TradeBlotter, useTradeBlotter } from "@/components/terminal/trade-blotter";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { PortfolioGrowthChart } from "@/components/portfolio/portfolio-growth-chart";
import { SummaryCard } from "@/components/portfolio/summary-card";
import type { TradeData } from "@/components/terminal/types";
import type { LedgerSummaryResponse, TradingMode } from "@/lib/account/api";

export function InvestingSection({
  balance,
  summary,
  userEmail,
  accountLoading,
  tradingMode,
  positions,
  sidebarQuotes,
  onDeposit,
  onWithdraw,
  onSignOut,
  onClosePosition,
}: {
  balance?: { wallet_available: number } | null;
  summary: LedgerSummaryResponse | null;
  userEmail?: string;
  accountLoading: boolean;
  tradingMode: TradingMode;
  positions: TradeData[];
  sidebarQuotes: Record<string, { spot?: number; change24hPct?: number }>;
  onDeposit: () => void;
  onWithdraw: () => void;
  onSignOut: () => void;
  onClosePosition: (dealId: string) => void;
}) {
  const blotterEntries = useTradeBlotter();
  const simLabel = tradingMode === "demo" ? "Simulated · Demo" : "Simulated · Live";
  const [changePct, setChangePct] = useState(0);

  const walletAvailable = balance?.wallet_available ?? summary?.balance.wallet_available ?? 0;
  const investedValue = summary?.balance.invested_value_usd ?? 0;
  const totalBalance = summary?.balance.total_balance ?? walletAvailable;
  const unrealizedPnl = summary?.balance.unrealized_pnl_usd ?? 0;

  const liveTotalPnl = useMemo(() => {
    if (positions.length === 0) return unrealizedPnl;
    return positions.reduce((sum, pos) => {
      const live = sidebarQuotes[pos.symbol]?.spot ?? pos.entryPrice;
      const pnl =
        pos.direction === "BUY"
          ? (live - pos.entryPrice) * pos.size
          : (pos.entryPrice - live) * pos.size;
      return sum + pnl;
    }, 0);
  }, [positions, sidebarQuotes, unrealizedPnl]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-zinc-900/60 px-4 py-4">
        <div className="flex items-center gap-2">
          <CircleUserRound className="size-4 text-indigo-400" />
          <div>
            <h1 className="text-sm font-extrabold text-white">Investing</h1>
            <p className="text-[11px] text-zinc-500">
              {simLabel} portfolio growth, open positions, and agent trades.
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-3xl font-mono font-bold tabular-nums text-white">
              {accountLoading
                ? "…"
                : `$${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </h2>
            <span
              className={cn(
                "text-sm font-semibold",
                changePct >= 0 ? "text-emerald-400" : "text-red-400",
              )}
            >
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%
            </span>
            <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-400">
              {simLabel}
            </span>
          </div>

          <PortfolioGrowthChart
            mode={tradingMode}
            onChangePct={setChangePct}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard
              label="Wallet Available"
              value={walletAvailable}
              loading={accountLoading}
            />
            <SummaryCard
              label="Assets Managed"
              value={investedValue}
              loading={accountLoading}
            />
            <SummaryCard
              label="Unrealized P&L"
              value={liveTotalPnl}
              accent
              loading={accountLoading}
            />
          </div>
        </div>

        <AccountTab
          balance={balance}
          summary={summary}
          userEmail={userEmail}
          accountLoading={accountLoading}
          tradingMode={tradingMode}
          onDeposit={onDeposit}
          onWithdraw={onWithdraw}
          onSignOut={onSignOut}
          positions={positions}
        />

        <div className="mx-4 mb-4 rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-4 sm:mx-6">
          <div className="mb-3 flex items-center gap-2">
            <Briefcase className="size-4 text-indigo-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Open Positions
            </h3>
            <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-400">
              {positions.length} active
            </span>
          </div>
          {positions.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-600">
              No open positions. Fund your {tradingMode} wallet and trade from Command.
            </p>
          ) : (
            <div className="space-y-2">
              {positions.map((pos) => {
                const live = sidebarQuotes[pos.symbol]?.spot ?? pos.entryPrice;
                const pnl =
                  pos.direction === "BUY"
                    ? (live - pos.entryPrice) * pos.size
                    : (pos.entryPrice - live) * pos.size;

                return (
                  <div
                    key={pos.id}
                    className="flex items-center gap-3 rounded-lg border border-zinc-900/60 bg-zinc-950/60 p-3"
                  >
                    <AssetLogoIcon symbol={pos.symbol} size="sm" className="shrink-0 rounded-md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{pos.symbol}</span>
                        <span
                          className={cn(
                            "text-[10px] font-bold",
                            pos.direction === "BUY" ? "text-emerald-400" : "text-red-400",
                          )}
                        >
                          {pos.direction}
                        </span>
                        <span className="text-[10px] text-zinc-500">×{pos.size}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        Entry ${pos.entryPrice.toFixed(2)} · Mark ${live.toFixed(2)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "text-xs font-mono font-bold",
                          pnl >= 0 ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toFixed(2)}
                      </p>
                      <button
                        type="button"
                        onClick={() => onClosePosition(pos.id)}
                        className="mt-1 text-[10px] font-semibold text-zinc-500 hover:text-red-400"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mx-4 mb-6 h-72 overflow-hidden rounded-xl border border-zinc-900/60 bg-zinc-950/40 sm:mx-6">
          <TradeBlotter entries={blotterEntries} className="h-full" />
        </div>
      </div>
    </div>
  );
}

/** @deprecated use InvestingSection */
export const PortfolioSection = InvestingSection;

/** @deprecated use InvestingSection */
export const PersonalSection = InvestingSection;
