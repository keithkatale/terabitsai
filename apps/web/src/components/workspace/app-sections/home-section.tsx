"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronRight,
  Loader2,
  Settings2,
  TrendingDown,
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
  signedValue,
}: {
  label: string;
  value: string;
  subtext?: string;
  dotColor: string;
  loading?: boolean;
  signedValue?: number;
}) {
  const valueTone =
    signedValue != null
      ? signedValue >= 0
        ? "text-[var(--accent-green)]"
        : "text-[var(--accent-red)]"
      : "text-white";

  return (
    <div className={cn(CARD, "flex flex-col gap-2.5 p-4")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
      </div>
      <p
        className={cn(
          "text-2xl font-bold leading-none tabular-nums sm:text-[28px]",
          loading && "text-zinc-600",
          !loading && valueTone,
        )}
      >
        {loading ? "…" : value}
      </p>
      {subtext ? (
        <p
          className={cn(
            "text-[11px] font-medium",
            subtext.startsWith("+")
              ? "text-[var(--accent-green)]"
              : subtext.startsWith("−") || subtext.startsWith("-")
                ? "text-[var(--accent-red)]"
                : "text-zinc-500",
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
  accountRefreshing = false,
  positionsRefreshing = false,
  tradingMode,
  positions,
  sidebarQuotes,
  onDeposit,
  onWithdraw,
  onManagePosition,
}: {
  balance?: { wallet_available: number } | null;
  summary: LedgerSummaryResponse | null;
  userEmail?: string;
  accountLoading: boolean;
  accountRefreshing?: boolean;
  positionsRefreshing?: boolean;
  tradingMode: TradingMode;
  positions: TradeData[];
  sidebarQuotes: Record<string, { spot?: number; change24hPct?: number }>;
  onDeposit: () => void;
  onWithdraw: () => void;
  onManagePosition: (dealId: string) => void;
}) {
  const [changePct, setChangePct] = useState(0);
  const [chartRefreshing, setChartRefreshing] = useState(false);

  const accountInitialLoading = accountLoading && summary == null;
  const isBackgroundRefreshing =
    accountRefreshing || positionsRefreshing || chartRefreshing;

  const walletAvailable = balance?.wallet_available ?? summary?.balance.wallet_available ?? 0;
  const investedValue = summary?.balance.invested_value_usd ?? 0;
  const orderLocked = summary?.balance.order_locked ?? 0;
  const bookBalance =
    summary?.balance.total_balance ??
    walletAvailable + orderLocked + investedValue;
  const unrealizedPnl = summary?.balance.unrealized_pnl_usd ?? 0;
  const openPositions =
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
      const allocatedValue = Math.max(0, pos.margin + pnl);
      return { pos, live, allocatedValue, pnl, pnlPct };
    });
  }, [positions, sidebarQuotes]);

  const liveInvestedValue = useMemo(
    () => positionRows.reduce((sum, row) => sum + row.allocatedValue, 0),
    [positionRows],
  );
  const liveTotalBalance = walletAvailable + liveInvestedValue;
  const accountMovement = liveTotalBalance - bookBalance;
  const accountMovementPct =
    bookBalance > 0 ? (accountMovement / bookBalance) * 100 : 0;
  const liveTotalPnl = useMemo(() => {
    if (positionRows.length === 0) return unrealizedPnl;
    return positionRows.reduce((sum, row) => sum + row.pnl, 0);
  }, [positionRows, unrealizedPnl]);

  const allocatedPct =
    liveTotalBalance > 0
      ? Math.round((liveInvestedValue / liveTotalBalance) * 100)
      : 0;

  const allocationSegments = useMemo((): AllocationSegment[] => {
    const segments: AllocationSegment[] = [];

    if (walletAvailable > 0) {
      segments.push({ label: "Available cash", value: walletAvailable, color: "#3A4550" });
    }

    for (const { pos, pnlPct, allocatedValue } of positionRows) {
      if (allocatedValue > 0) {
        segments.push({
          label: pos.symbol,
          value: allocatedValue,
          changePct: pnlPct,
        });
      }
    }

    const allocatedInSegments = segments
      .filter((s) => s.label !== "Available cash")
      .reduce((sum, s) => sum + s.value, 0);
    const uninvestedInSegments = investedValue - allocatedInSegments;
    if (uninvestedInSegments > 0.01 && positionRows.length === 0) {
      segments.push({
        label: "Invested",
        value: uninvestedInSegments,
        color: "#7209B3",
      });
    }

    if (segments.length === 0) {
      segments.push({ label: "Available cash", value: 0, color: "#3A4550" });
    }

    return segments;
  }, [positionRows, walletAvailable, investedValue]);

  const recentEntries = summary?.recent_ledger_entries ?? [];

  const handleSegmentClick = (segment: AllocationSegment) => {
    const match = positionRows.find(({ pos }) => pos.symbol === segment.label);
    if (match) onManagePosition(match.pos.id);
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto pb-20 lg:pb-6">
      <div className="mx-auto max-w-[1400px] p-2 sm:p-3 lg:p-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold leading-tight text-white sm:text-xl">Personal Area</h1>
          {isBackgroundRefreshing ? (
            <Loader2
              className="size-4 shrink-0 animate-spin text-zinc-500"
              aria-label="Updating"
            />
          ) : null}
        </div>

        <div className="mt-2 grid grid-cols-1 gap-3 xl:grid-cols-12">
          <section className={cn(CARD, "flex min-h-[320px] flex-col p-3 xl:col-span-7")}>
            <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
              <div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm font-medium text-white"
                >
                  Trading
                  <ChevronDown className="size-3.5 text-zinc-500" />
                </button>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "text-xl font-medium tabular-nums",
                      accountMovement < 0
                        ? "text-[var(--accent-red)]"
                        : "text-[var(--accent-green-bright)]",
                    )}
                  >
                    {accountInitialLoading ? "…" : formatUsd(liveTotalBalance)}
                  </p>
                  {accountMovement >= 0 ? (
                    <TrendingUp
                      className="size-3.5 text-[var(--accent-green-bright)]"
                      strokeWidth={2.5}
                    />
                  ) : (
                    <TrendingDown className="size-3.5 text-[var(--accent-red)]" strokeWidth={2.5} />
                  )}
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      accountMovement >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
                    )}
                  >
                    {accountMovement >= 0 ? "+" : "−"}
                    {formatUsd(Math.abs(accountMovement))}
                    <span className="ml-1 text-zinc-500">
                      ({accountMovementPct >= 0 ? "+" : ""}
                      {accountMovementPct.toFixed(2)}% live)
                    </span>
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Mark-to-market · {tradingMode === "demo" ? "Demo" : "Live"} · Cash{" "}
                  {formatUsd(walletAvailable)} + Positions {formatUsd(liveInvestedValue)}
                  {liveTotalPnl !== 0 ? (
                    <span
                      className={cn(
                        " ml-1",
                        liveTotalPnl >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
                      )}
                    >
                      ({liveTotalPnl >= 0 ? "+" : "−"}
                      {formatUsd(Math.abs(liveTotalPnl))} open P&L)
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <PortfolioGrowthChart
                mode={tradingMode}
                onChangePct={setChangePct}
                onRefreshingChange={setChartRefreshing}
                liveTailValue={accountInitialLoading ? undefined : liveTotalBalance}
                liveAnchorValue={accountInitialLoading ? undefined : bookBalance}
                className="h-full border-0 bg-transparent p-0"
                chartHeight={240}
                showYAxis
                accent="cyan"
                hideHeader
              />
            </div>
          </section>

          <section className={cn(CARD, "flex flex-col gap-3 p-3 xl:col-span-5")}>
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-zinc-400" />
              <h2 className="text-lg font-medium text-white">Wallet</h2>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <WalletKpi
                label="Portfolio Value"
                value={formatUsd(liveTotalBalance)}
                subtext={
                  changePct >= 0
                    ? `+${changePct.toFixed(1)}% this month`
                    : `${changePct.toFixed(1)}% this month`
                }
                dotColor="#00E5FF"
                loading={accountInitialLoading}
              />
              <WalletKpi
                label="Open Positions"
                value={String(openPositions)}
                subtext={`${positions.length} active`}
                dotColor="#FFD600"
                loading={accountInitialLoading}
              />
              <div className="sm:col-span-2">
                <WalletKpi
                  label="Daily P&L"
                  value={`${liveTotalPnl >= 0 ? "+" : "−"}${formatUsd(Math.abs(liveTotalPnl))}`}
                  subtext={
                    liveTotalBalance > 0
                      ? `${liveTotalPnl >= 0 ? "+" : "−"}${Math.abs(
                          (liveTotalPnl / liveTotalBalance) * 100,
                        ).toFixed(1)}% of account`
                      : undefined
                  }
                  dotColor="#00FF85"
                  loading={accountInitialLoading}
                  signedValue={liveTotalPnl}
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

          <section className={cn(CARD, "flex flex-col gap-3 p-4 xl:col-span-4")}>
            <div className="flex flex-wrap items-center gap-4">
              <PortfolioAllocationDonut
                segments={allocationSegments}
                centerLabel={liveTotalBalance > 0 ? `${allocatedPct}%` : "$0"}
                size={120}
              />
              <AllocationLegend
                segments={allocationSegments.filter((s) => s.value > 0)}
                onItemClick={handleSegmentClick}
              />
            </div>

            <div className="mt-auto flex items-end justify-between gap-3 border-t border-white/5 pt-3">
              <div>
                <p className="text-base font-bold text-white">Portfolio</p>
                <p className="mt-0.5 text-xs text-zinc-400">Allocated (live)</p>
                <p className="text-xl font-bold tabular-nums text-white">
                  {accountInitialLoading ? "…" : formatUsd(liveInvestedValue, true)}
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

          <section className={cn(CARD, "flex min-h-[220px] flex-col p-4 xl:col-span-4")}>
            <h2 className="text-sm font-medium text-white">Assets</h2>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              {positionRows.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  No assets allocated yet. Use Investing to purchase at Capital.com prices.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {positionRows.map(({ pos, allocatedValue, pnl, pnlPct }) => (
                    <li key={pos.id}>
                      <button
                        type="button"
                        onClick={() => onManagePosition(pos.id)}
                        className="flex w-full items-center gap-2.5 rounded-lg bg-black/30 p-2.5 text-left transition-colors hover:bg-black/50"
                      >
                        <AssetLogoIcon symbol={pos.symbol} size="sm" className="shrink-0 rounded-md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{pos.symbol}</span>
                            <span
                              className={cn(
                                "text-[9px] font-bold uppercase",
                                pos.direction === "BUY"
                                  ? "text-[var(--accent-green)]"
                                  : "text-[var(--accent-red)]",
                              )}
                            >
                              {pos.direction}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500">
                            {formatUsd(allocatedValue)} live ·{" "}
                            {((allocatedValue / liveTotalBalance) * 100).toFixed(1)}% of account
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
                          <p
                            className={cn(
                              "text-[10px] font-semibold tabular-nums",
                              pnlPct >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
                            )}
                          >
                            {pnlPct >= 0 ? "+" : ""}
                            {pnlPct.toFixed(1)}%
                          </p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-zinc-600" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className={cn(CARD, "flex min-h-[220px] flex-col p-4 xl:col-span-4")}>
            <h2 className="text-sm font-medium text-white">Transactions</h2>
            <div className="mt-2 min-h-0 flex-1">
              <RecentActivityList
                entries={recentEntries}
                loading={accountInitialLoading}
                emptyMessage="No transactions yet. Deposit funds to get started."
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
