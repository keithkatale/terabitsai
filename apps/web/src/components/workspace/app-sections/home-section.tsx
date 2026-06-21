"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  Settings2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PortfolioGrowthChart } from "@/components/portfolio/portfolio-growth-chart";
import {
  AllocationLegend,
  PortfolioAllocationDonut,
  type AllocationSegment,
} from "@/components/portfolio/portfolio-allocation-donut";
import { RecentActivityList } from "@/components/account/recent-activity-list";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import type { TradeData } from "@/components/terminal/types";
import type { LedgerSummaryResponse, TradingMode } from "@/lib/account/api";

const CARD = "quant-card";

function formatUsd(value: number, compact = false) {
  if (compact && Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function WalletKpi({
  label,
  value,
  subtext,
  dotColor,
  loading,
  accentValue = false,
}: {
  label: string;
  value: string;
  subtext?: string;
  dotColor: string;
  loading?: boolean;
  accentValue?: boolean;
}) {
  return (
    <div className={cn(CARD, "flex flex-col gap-2 p-3")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--text-secondary)]">{label}</span>
        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
      </div>
      <p
        className={cn(
          "text-xl font-bold leading-none tabular-nums text-white",
          loading && "text-zinc-600",
          accentValue && "text-[var(--accent-green)]",
        )}
      >
        {loading ? "…" : value}
      </p>
      {subtext ? (
        <p
          className={cn(
            "text-[11px] font-medium",
            subtext.startsWith("+") ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
          )}
        >
          {subtext}
        </p>
      ) : null}
    </div>
  );
}

function FundButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="terminal-btn terminal-btn-primary inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
    >
      {icon}
      {label}
    </button>
  );
}

export function HomeSection({
  balance,
  summary,
  accountLoading,
  tradingMode,
  positions,
  sidebarQuotes,
  onDeposit,
  onWithdraw,
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
  onClosePosition: (dealId: string) => void;
}) {
  const [changePct, setChangePct] = useState(0);

  const walletAvailable = balance?.wallet_available ?? summary?.balance.wallet_available ?? 0;
  const investedValue = summary?.balance.invested_value_usd ?? 0;
  const totalBalance = summary?.balance.total_balance ?? walletAvailable + investedValue;
  const unrealizedPnl = summary?.balance.unrealized_pnl_usd ?? 0;
  const openPositions = summary?.portfolio?.open_positions_count ?? positions.length;

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

  const allocatedPct =
    totalBalance > 0 ? Math.round((investedValue / totalBalance) * 100) : 0;

  const allocationSegments = useMemo((): AllocationSegment[] => {
    const segments: AllocationSegment[] = [];

    if (walletAvailable > 0) {
      segments.push({ label: "Available cash", value: walletAvailable, color: "#3A4550" });
    }

    for (const pos of positions) {
      const live = sidebarQuotes[pos.symbol]?.spot ?? pos.entryPrice;
      const marketValue = live * pos.size;
      if (marketValue > 0) {
        segments.push({ label: pos.symbol, value: marketValue });
      }
    }

    if (segments.length === 0 && totalBalance > 0) {
      segments.push({ label: "Available cash", value: totalBalance, color: "#3A4550" });
    }

    return segments;
  }, [positions, sidebarQuotes, walletAvailable, totalBalance]);

  const recentEntries = summary?.recent_ledger_entries ?? [];

  const positionRows = useMemo(() => {
    return positions.map((pos) => {
      const live = sidebarQuotes[pos.symbol]?.spot ?? pos.entryPrice;
      const marketValue = live * pos.size;
      const pnl =
        pos.direction === "BUY"
          ? (live - pos.entryPrice) * pos.size
          : (pos.entryPrice - live) * pos.size;
      const allocPct = totalBalance > 0 ? (marketValue / totalBalance) * 100 : 0;
      return { pos, live, marketValue, pnl, allocPct };
    });
  }, [positions, sidebarQuotes, totalBalance]);

  return (
    <div className="quant-shell h-full min-h-0 overflow-y-auto pb-20 lg:pb-6">
      <div className="mx-auto max-w-[1400px] p-3 sm:p-4 lg:p-5">
        <h1 className="text-2xl font-bold leading-tight text-white sm:text-[28px]">Personal Area</h1>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-12">
          {/* Trading balance + growth chart */}
          <section className={cn(CARD, "flex min-h-[260px] flex-col p-4 xl:col-span-7")}>
            <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
              <div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-base font-medium text-white"
                >
                  Trading
                  <ChevronDown className="size-4 text-zinc-500" />
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-2xl font-medium tabular-nums text-[var(--accent-green-bright)]">
                    {accountLoading ? "…" : formatUsd(totalBalance)}
                  </p>
                  <TrendingUp className="size-3.5 text-[var(--accent-green-bright)]" strokeWidth={2.5} />
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      changePct >= 0 ? "text-white" : "text-[var(--accent-red)]",
                    )}
                  >
                    {changePct >= 0 ? "+" : ""}
                    {changePct.toFixed(2)}%
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Total balance · {tradingMode === "demo" ? "Demo" : "Live"} · Available{" "}
                  {formatUsd(walletAvailable)} + Allocated {formatUsd(investedValue)}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <PortfolioGrowthChart
                mode={tradingMode}
                onChangePct={setChangePct}
                className="h-full border-0 bg-transparent p-0"
                chartHeight={180}
                accent="cyan"
                hideHeader
              />
            </div>
          </section>

          {/* Wallet */}
          <section className={cn(CARD, "flex flex-col gap-3 p-4 xl:col-span-5")}>
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-zinc-400" />
              <h2 className="text-lg font-medium text-white">Wallet</h2>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <WalletKpi
                label="Portfolio Value"
                value={formatUsd(totalBalance)}
                subtext={
                  changePct >= 0
                    ? `+${changePct.toFixed(1)}% this month`
                    : `${changePct.toFixed(1)}% this month`
                }
                dotColor="#00E5FF"
                loading={accountLoading}
              />
              <WalletKpi
                label="Open Positions"
                value={String(openPositions)}
                subtext={`${positions.length} active`}
                dotColor="#FFD600"
                loading={accountLoading}
              />
              <div className="sm:col-span-2">
                <WalletKpi
                  label="Daily P&L"
                  value={`${liveTotalPnl >= 0 ? "+" : "−"}${formatUsd(Math.abs(liveTotalPnl))}`}
                  subtext={
                    totalBalance > 0
                      ? `${liveTotalPnl >= 0 ? "+" : ""}${((liveTotalPnl / totalBalance) * 100).toFixed(1)}% vs yesterday`
                      : undefined
                  }
                  dotColor="#00FF85"
                  loading={accountLoading}
                  accentValue
                />
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-2 sm:flex-row">
              <FundButton
                label="Deposit"
                icon={<ArrowDownToLine className="size-4 stroke-[2.5]" />}
                onClick={onDeposit}
              />
              <FundButton
                label="Withdraw"
                icon={<ArrowUpFromLine className="size-4 stroke-[2.5]" />}
                onClick={onWithdraw}
              />
            </div>
          </section>

          {/* Portfolio allocation */}
          <section className={cn(CARD, "flex flex-col gap-3 p-4 xl:col-span-4")}>
            <div className="flex flex-wrap items-center gap-4">
              <PortfolioAllocationDonut
                segments={allocationSegments}
                centerLabel={`${allocatedPct}%`}
                size={120}
              />
              <AllocationLegend segments={allocationSegments.filter((s) => s.value > 0)} />
            </div>

            <div className="mt-auto flex items-end justify-between gap-3 border-t border-white/5 pt-3">
              <div>
                <p className="text-base font-bold text-white">Portfolio</p>
                <p className="mt-0.5 text-xs text-zinc-400">Allocated</p>
                <p className="text-xl font-bold tabular-nums text-white">
                  {accountLoading ? "…" : formatUsd(investedValue, true)}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Free {formatUsd(walletAvailable, true)}
                </p>
              </div>
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-full bg-[#151A20] text-white transition-colors hover:bg-[#1c232b]"
                aria-label="Portfolio settings"
              >
                <Settings2 className="size-4" />
              </button>
            </div>
          </section>

          {/* Assets */}
          <section className={cn(CARD, "flex min-h-[220px] flex-col p-4 xl:col-span-4")}>
            <h2 className="text-sm font-medium text-white">Assets</h2>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              {positionRows.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  No assets allocated yet. Use Command to explore markets and open positions.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {positionRows.map(({ pos, marketValue, pnl, allocPct }) => (
                    <li
                      key={pos.id}
                      className="flex items-center gap-2.5 rounded-lg bg-black/30 p-2.5"
                    >
                      <AssetLogoIcon symbol={pos.symbol} size="sm" className="shrink-0 rounded-md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">{pos.symbol}</span>
                          <span
                            className={cn(
                              "text-[9px] font-bold uppercase",
                              pos.direction === "BUY" ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
                            )}
                          >
                            {pos.direction}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500">
                          {formatUsd(marketValue)} · {allocPct.toFixed(1)}% of balance
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "text-xs font-bold tabular-nums",
                            pnl >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
                          )}
                        >
                          {pnl >= 0 ? "+" : "−"}
                          {formatUsd(Math.abs(pnl))}
                        </p>
                        <button
                          type="button"
                          onClick={() => onClosePosition(pos.id)}
                          className="mt-0.5 text-[9px] font-semibold text-zinc-500 hover:text-[var(--accent-red)]"
                        >
                          Close
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Transactions */}
          <section className={cn(CARD, "flex min-h-[220px] flex-col p-4 xl:col-span-4")}>
            <h2 className="text-sm font-medium text-white">Transactions</h2>
            <div className="mt-2 min-h-0 flex-1">
              <RecentActivityList
                entries={recentEntries}
                loading={accountLoading}
                emptyMessage="No transactions yet. Deposit funds to get started."
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
