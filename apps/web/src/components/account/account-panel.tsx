"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  LogOut,
  Plus,
  User,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RecentActivityList } from "@/components/account/recent-activity-list";
import type { LedgerSummaryResponse } from "@/lib/account/api";

type Props = {
  open: boolean;
  onClose: () => void;
  summary: LedgerSummaryResponse | null;
  userEmail?: string | null;
  onDeposit: () => void;
  onWithdraw: () => void;
  onSignOut: () => void;
  loading?: boolean;
};

export function AccountPanel({
  open,
  onClose,
  summary,
  userEmail,
  onDeposit,
  onWithdraw,
  onSignOut,
  loading,
}: Props) {
  if (!open) return null;

  const available = summary?.balance.wallet_available ?? 0;
  const locked = summary?.balance.order_locked ?? 0;
  const total = summary?.balance.total_balance ?? 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950/95 border border-zinc-900 rounded-2xl w-full max-w-lg p-6 relative shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-zinc-900 bg-zinc-950 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer"
        >
          <X className="size-4" />
        </button>

        <div className="space-y-1 pr-8">
          <span className="text-[10px] font-extrabold text-indigo-400 tracking-wider uppercase">
            Terabits AI
          </span>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Wallet className="size-5 text-indigo-400" />
            Your account
          </h2>
          {userEmail ? (
            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
              <User className="size-3" />
              {userEmail}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-3">
            <p className="text-[9px] text-zinc-500 font-bold uppercase">Available</p>
            <p className="text-sm font-mono font-bold text-emerald-400 mt-1">
              ${available.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-3">
            <p className="text-[9px] text-zinc-500 font-bold uppercase">In trades</p>
            <p className="text-sm font-mono font-bold text-amber-400 mt-1">
              ${locked.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-3">
            <p className="text-[9px] text-zinc-500 font-bold uppercase">Total</p>
            <p className="text-sm font-mono font-bold text-white mt-1">
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onDeposit}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wide",
              "bg-indigo-500/15 border border-indigo-500/30 text-indigo-400",
              "hover:bg-indigo-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            )}
          >
            <Plus className="size-3.5" />
            Deposit
          </button>
          <button
            onClick={onWithdraw}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wide",
              "bg-rose-500/10 border border-rose-500/25 text-rose-400",
              "hover:bg-rose-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            )}
          >
            <ArrowDownToLine className="size-3.5" />
            Withdraw
          </button>
        </div>

        <div className="border-t border-zinc-900/60 pt-3">
          <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wide mb-2">
            Recent activity
          </p>
          <RecentActivityList
            entries={summary?.recent_ledger_entries ?? []}
            loading={loading}
          />
        </div>

        <button
          onClick={onSignOut}
          className="w-full py-2 rounded-xl text-xs font-bold text-zinc-500 hover:text-red-400 border border-zinc-900 hover:border-zinc-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}
