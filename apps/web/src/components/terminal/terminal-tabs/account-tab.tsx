"use client";

import { CircleUserRound, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { RecentActivityList } from "@/components/account/recent-activity-list";
import type { MarketTerminalProps } from "../types";

import type { TradingMode } from "@/lib/account/api";

type AccountTabProps = Pick<
  MarketTerminalProps,
  "balance" | "summary" | "userEmail" | "accountLoading" | "onDeposit" | "onWithdraw" | "onSignOut" | "positions"
> & {
  tradingMode: TradingMode;
};

export function AccountTab({
  balance,
  summary,
  userEmail,
  accountLoading,
  tradingMode,
  onDeposit,
  onWithdraw,
  onSignOut,
  positions,
}: AccountTabProps) {
  return (
    <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
      <div className="rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-6">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <CircleUserRound className="size-7 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">{userEmail ?? "User"}</p>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide",
                  tradingMode === "demo"
                    ? "bg-indigo-500/15 text-indigo-300"
                    : "bg-emerald-500/15 text-emerald-300",
                )}
              >
                {tradingMode}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
              {tradingMode === "demo" ? "Paper trading account" : "Live trading account"}
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-zinc-900/60 bg-zinc-950/60 p-4">
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Available</p>
            <p className="text-2xl font-mono font-bold text-white mt-1">
              ${(balance?.wallet_available ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-900/60 bg-zinc-950/60 p-4">
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Open positions</p>
            <p className="text-2xl font-mono font-bold text-indigo-400 mt-1">{positions.length}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onDeposit} className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer">
            Deposit
          </button>
          <button type="button" onClick={onWithdraw} className="flex-1 py-2.5 rounded-lg border border-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-900 cursor-pointer">
            Withdraw
          </button>
          <button type="button" onClick={onSignOut} className="px-4 py-2.5 rounded-lg border border-zinc-800 text-zinc-500 text-xs hover:text-white cursor-pointer">
            Sign out
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="size-4 text-indigo-400" />
          <h3 className="text-xs font-extrabold text-white uppercase">Recent activity</h3>
        </div>
        {accountLoading ? (
          <p className="text-xs text-zinc-600">Loading...</p>
        ) : (
          <RecentActivityList
            entries={summary?.recent_ledger_entries ?? []}
            emptyMessage={`No activity yet. Fund your ${tradingMode} wallet to start.`}
          />
        )}
      </div>
    </div>
  );
}
