"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CreditCard, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { postDeposit, type TradingMode } from "@/lib/account/api";
import {
  ensureDodoOverlayCheckout,
  openDodoOverlayCheckout,
} from "@/lib/funding/dodo-overlay-checkout";
import type { CheckoutEvent } from "dodopayments-checkout";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: TradingMode;
  accountId: string | null;
  currentBalance: number;
  onSuccess: (amount: number, gateway: string) => void;
};

const LIVE_PRESETS = [20, 50, 100, 250, 500, 999] as const;
const DEMO_PRESETS = [1000, 5000, 10000, 50000] as const;
const MIN_DEPOSIT = 20;
const MAX_LIVE_DEPOSIT = 999;

/** Matches home page balance / trading figures (DM Sans, not mono). */
const amountFont = "text-sm font-bold tabular-nums tracking-tight";

function formatPresetLabel(amt: number) {
  return `$${amt.toLocaleString()}`;
}

function validateLiveAmount(parsed: number): string | null {
  if (!Number.isFinite(parsed) || parsed < MIN_DEPOSIT) {
    return `Minimum deposit is $${MIN_DEPOSIT}.`;
  }
  if (parsed > MAX_LIVE_DEPOSIT) {
    return `Maximum deposit is $${MAX_LIVE_DEPOSIT}.`;
  }
  return null;
}

export function DepositFundsFlow({
  open,
  onClose,
  mode,
  accountId,
  currentBalance,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<"select" | "demo" | "card">(mode === "demo" ? "demo" : "select");
  const [amount, setAmount] = useState(mode === "demo" ? "5000" : "100");
  const [gateway, setGateway] = useState("ACH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardEnabled, setCardEnabled] = useState(false);
  const [dodoCheckoutMode, setDodoCheckoutMode] = useState<"test" | "live">("test");

  const pendingAmountRef = useRef<number | null>(null);
  const checkoutHandlerRef = useRef<(event: CheckoutEvent) => void>(() => {});

  useEffect(() => {
    if (!open) return;
    setStep(mode === "demo" ? "demo" : "select");
    setAmount(mode === "demo" ? "5000" : "100");
    setError(null);
    setBusy(false);
  }, [open, mode]);

  useEffect(() => {
    if (!open || mode !== "live") return;
    void fetch("/api/funding/meta")
      .then((r) => r.json())
      .then((d: { cardDeposits?: boolean; dodoCheckoutMode?: "test" | "live" }) => {
        setCardEnabled(Boolean(d.cardDeposits));
        setDodoCheckoutMode(d.dodoCheckoutMode === "live" ? "live" : "test");
        if (d.cardDeposits) setStep("card");
      })
      .catch(() => {
        setCardEnabled(false);
      });
  }, [open, mode]);

  checkoutHandlerRef.current = (event: CheckoutEvent) => {
    switch (event.event_type) {
      case "checkout.opened":
      case "checkout.form_ready":
        setBusy(false);
        break;
      case "checkout.closed":
        setBusy(false);
        if (pendingAmountRef.current != null) {
          onSuccess(pendingAmountRef.current, "card");
          pendingAmountRef.current = null;
        }
        break;
      case "checkout.error":
        setBusy(false);
        setError(
          typeof event.data?.message === "string"
            ? event.data.message
            : "Checkout failed. Please try again.",
        );
        pendingAmountRef.current = null;
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (!open || mode !== "live" || !cardEnabled) return;
    ensureDodoOverlayCheckout(dodoCheckoutMode, (event) => {
      checkoutHandlerRef.current(event);
    });
  }, [open, mode, cardEnabled, dodoCheckoutMode]);

  if (!open) return null;

  const parsed = Number.parseFloat(amount);
  const liveAmountError = mode === "live" || step === "card" ? validateLiveAmount(parsed) : null;
  const validAmount = Number.isFinite(parsed) && parsed > 0 && !liveAmountError;

  const submitDemo = async () => {
    if (!accountId || !validAmount) return;
    setBusy(true);
    setError(null);
    try {
      await postDeposit("demo", parsed, gateway);
      onSuccess(parsed, gateway);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setBusy(false);
    }
  };

  const submitCard = async () => {
    const validationError = validateLiveAmount(parsed);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError(null);
    pendingAmountRef.current = parsed;
    try {
      const res = await fetch("/api/funding/dodo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: "live", amountUsd: parsed, fundingMethod: "card" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Checkout failed");
      if (!json.checkoutUrl) throw new Error("No checkout URL returned");
      await openDodoOverlayCheckout(json.checkoutUrl);
    } catch (e) {
      pendingAmountRef.current = null;
      setError(e instanceof Error ? e.message : "Checkout failed");
      setBusy(false);
    }
  };

  const renderAmountPicker = (presets: readonly number[], max?: number) => (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {presets.map((amt) => (
          <button
            key={amt}
            type="button"
            onClick={() => setAmount(String(amt))}
            className={cn(
              "rounded-xl border py-2.5 transition-all cursor-pointer",
              amountFont,
              amount === String(amt)
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                : "border-white/8 bg-black/30 text-zinc-400 hover:border-white/12 hover:text-zinc-200",
            )}
          >
            {formatPresetLabel(amt)}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="deposit-custom-amount" className="text-[11px] font-medium text-zinc-500">
          Custom amount{max ? ` ($${MIN_DEPOSIT}–$${max})` : ""}
        </label>
        <input
          id="deposit-custom-amount"
          type="number"
          min={max ? MIN_DEPOSIT : 1}
          max={max}
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={cn(
            "w-full rounded-xl border border-white/8 bg-black/30 px-4 py-2.5 text-zinc-100 outline-none focus:border-cyan-500/40",
            amountFont,
          )}
        />
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <div className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/8 bg-[var(--terminal-surface)] p-5 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg border border-white/8 bg-black/40 p-1.5 text-zinc-400 transition-all hover:bg-black/60 hover:text-white"
        >
          <X className="size-4" />
        </button>

        {step !== "select" && mode === "live" && !cardEnabled ? (
          <button
            type="button"
            onClick={() => setStep("select")}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </button>
        ) : null}

        <div className="space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
            {mode === "demo" ? "Demo account" : "Live account"}
          </span>
          <h2 className="text-lg font-bold tracking-tight text-white">
            {step === "select" ? "Add funds" : step === "demo" ? "Instant demo credit" : "Card deposit"}
          </h2>
          <p className={cn("text-xs text-zinc-500", amountFont, "font-medium")}>
            Available ${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        {step === "select" && mode === "live" && !cardEnabled ? (
          <div className="space-y-2">
            <button
              type="button"
              disabled
              className="quant-card flex w-full items-center gap-3 p-4 text-left opacity-50 cursor-not-allowed"
            >
              <CreditCard className="size-5 text-cyan-400" />
              <div>
                <p className="text-sm font-semibold text-white">Credit / debit card</p>
                <p className="text-[11px] text-zinc-500">Not configured on this environment</p>
              </div>
            </button>
          </div>
        ) : null}

        {step === "demo" || mode === "demo" ? (
          <>
            {renderAmountPicker(DEMO_PRESETS)}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-zinc-400">
                Simulated method
              </span>
              <div className="grid grid-cols-3 gap-2">
                {["ACH", "Crypto", "Card"].map((gw) => (
                  <button
                    key={gw}
                    type="button"
                    onClick={() => setGateway(gw)}
                    className={cn(
                      "rounded-xl border py-2 text-xs font-bold transition-all cursor-pointer",
                      gateway === gw
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                        : "border-white/8 bg-black/30 text-zinc-400",
                    )}
                  >
                    {gw}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={submitDemo}
              disabled={busy || !validAmount}
              className="terminal-btn terminal-btn-primary flex h-11 w-full items-center justify-center text-sm font-semibold disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-5 animate-spin" /> : "Add demo funds"}
            </button>
          </>
        ) : null}

        {step === "card" && mode === "live" ? (
          <>
            {renderAmountPicker(LIVE_PRESETS, MAX_LIVE_DEPOSIT)}
            <button
              type="button"
              onClick={submitCard}
              disabled={busy || !validAmount}
              className="terminal-btn terminal-btn-primary flex h-11 w-full items-center justify-center text-sm font-semibold disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                "Continue to checkout"
              )}
            </button>
          </>
        ) : null}

        {liveAmountError && (step === "card" || mode === "live") ? (
          <p className="text-xs font-medium text-[var(--accent-red)]">{liveAmountError}</p>
        ) : null}
        {error ? <p className="text-xs font-medium text-[var(--accent-red)]">{error}</p> : null}
      </div>
    </div>
  );
}
