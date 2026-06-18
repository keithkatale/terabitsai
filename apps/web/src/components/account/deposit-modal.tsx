"use client";

import { useState } from "react";
import { DollarSign, RefreshCcwIcon, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { postDemoDeposit } from "@/lib/account/api";

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string | null;
  currentBalance: number;
  onSuccess: (amount: number, gateway: string) => void;
};

export function DepositModal({
  open,
  onClose,
  accountId,
  currentBalance,
  onSuccess,
}: Props) {
  const [depositAmount, setDepositAmount] = useState("5000");
  const [depositGateway, setDepositGateway] = useState("ACH");
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    const amt = parseFloat(depositAmount);
    if (!accountId || isNaN(amt) || amt <= 0) return;

    setIsDepositing(true);
    setError(null);
    try {
      await postDemoDeposit(amt, depositGateway);
      onSuccess(amt, depositGateway);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950/95 border border-zinc-900 rounded-2xl w-full max-w-md p-6 relative shadow-2xl flex flex-col gap-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-zinc-900 bg-zinc-950 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer"
        >
          <X className="size-4" />
        </button>

        <div className="space-y-1">
          <span className="text-[10px] font-extrabold text-indigo-400 tracking-wider uppercase">
            Demo wallet
          </span>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
            <DollarSign className="size-5 text-indigo-400" />
            Fund account
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            Add simulated capital to your Terabits AI paper margin account.
          </p>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-3.5 flex items-center justify-between text-xs font-mono">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 font-bold block leading-none">
              ACCOUNT
            </span>
            <span className="text-zinc-300 font-bold">
              {accountId ? `${accountId.substring(0, 16)}…` : "—"}
            </span>
          </div>
          <div className="text-right space-y-1">
            <span className="text-[10px] text-zinc-500 font-bold block leading-none">
              AVAILABLE
            </span>
            <span className="text-emerald-400 font-bold">
              ${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wide">
            Amount
          </span>
          <div className="grid grid-cols-4 gap-2">
            {[1000, 5000, 10000, 50000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setDepositAmount(String(amt))}
                className={cn(
                  "py-2 rounded-xl text-xs font-bold font-mono transition-all border cursor-pointer",
                  depositAmount === String(amt)
                    ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400"
                    : "bg-zinc-950/60 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                )}
              >
                +${(amt / 1000).toFixed(0)}k
              </button>
            ))}
          </div>
          <input
            type="number"
            min="1"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="w-full bg-zinc-950/60 border border-zinc-900 focus:border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-mono outline-none text-zinc-200 font-bold"
          />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wide">
            Payment method (simulated)
          </span>
          <div className="grid grid-cols-3 gap-2">
            {["ACH", "Crypto", "Card"].map((gw) => (
              <button
                key={gw}
                type="button"
                onClick={() => setDepositGateway(gw)}
                className={cn(
                  "py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                  depositGateway === gw
                    ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400"
                    : "bg-zinc-950/60 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                )}
              >
                {gw}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="text-xs text-red-400 font-medium">{error}</p>
        ) : null}

        <button
          onClick={handleSubmit}
          disabled={isDepositing || !depositAmount || Number(depositAmount) <= 0}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:opacity-95 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 border border-indigo-400/20 disabled:opacity-40 cursor-pointer"
        >
          {isDepositing ? (
            <>
              <RefreshCcwIcon className="size-3.5 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Zap className="size-4" />
              Fund demo wallet
            </>
          )}
        </button>
      </div>
    </div>
  );
}
