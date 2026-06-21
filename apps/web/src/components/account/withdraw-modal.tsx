"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, RefreshCcwIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { postWithdrawal, type TradingMode } from "@/lib/account/api";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: TradingMode;
  walletAvailable: number;
  onSuccess: (amount: number) => void;
};

export function WithdrawModal({
  open,
  onClose,
  mode,
  walletAvailable,
  onSuccess,
}: Props) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = useMemo(() => {
    const raw = amount.trim().replace(/,/g, "");
    if (!raw) return null;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [amount]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (parsedAmount == null) {
      setError("Enter a valid amount.");
      return;
    }
    if (parsedAmount > walletAvailable + 1e-4) {
      setError(
        `Amount exceeds available balance ($${walletAvailable.toFixed(2)}).`
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await postWithdrawal(mode, parsedAmount);
      onSuccess(parsedAmount);
      setAmount("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setBusy(false);
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
          <span className="text-[10px] font-extrabold text-rose-400 tracking-wider uppercase">
            {mode === "demo" ? "Demo wallet" : "Live wallet"}
          </span>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
            <ArrowDownToLine className="size-5 text-rose-400" />
            Withdraw funds
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            {mode === "demo"
              ? "Transfer simulated cash out of your paper margin account."
              : "Request a withdrawal from your live wallet balance."}
          </p>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-3.5 text-xs font-mono">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">
            Available to withdraw
          </span>
          <p className="text-lg font-bold text-emerald-400 mt-1">
            ${walletAvailable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wide">
            Amount (USD)
          </span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-zinc-950/60 border border-zinc-900 focus:border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-mono outline-none text-zinc-200 font-bold"
          />
          <button
            type="button"
            onClick={() => setAmount(walletAvailable.toFixed(2))}
            className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
          >
            Withdraw max
          </button>
        </div>

        {error ? (
          <p className="text-xs text-red-400 font-medium">{error}</p>
        ) : null}

        <button
          onClick={handleSubmit}
          disabled={busy || parsedAmount == null}
          className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:opacity-95 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 border border-rose-400/20 disabled:opacity-40 cursor-pointer"
        >
          {busy ? (
            <>
              <RefreshCcwIcon className="size-3.5 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <ArrowDownToLine className="size-4" />
              Confirm withdrawal
            </>
          )}
        </button>
      </div>
    </div>
  );
}
