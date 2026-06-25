"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Droplets,
  TrendingDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import type { TradeData } from "@/components/terminal/types";

export type PositionAction = "dilute" | "liquidate" | "cash_out";

export type PositionActionRequest = {
  dealId: string;
  action: PositionAction;
  percent?: number;
};

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function PositionActionsSheet({
  position,
  markPrice,
  pnl,
  pnlPct,
  allocatedValue,
  open,
  busy,
  onClose,
  onConfirm,
}: {
  position: TradeData | null;
  markPrice: number;
  pnl: number;
  pnlPct: number;
  allocatedValue: number;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (request: PositionActionRequest) => void;
}) {
  const [action, setAction] = useState<PositionAction>("liquidate");
  const [dilutePct, setDilutePct] = useState(50);

  useEffect(() => {
    if (open) {
      setAction("liquidate");
      setDilutePct(50);
    }
  }, [open, position?.id]);

  const preview = useMemo(() => {
    if (!position) return null;
    const fraction = action === "dilute" ? dilutePct / 100 : 1;
    const releaseMargin = Math.round(position.margin * fraction * 100) / 100;
    const estPnl = Math.round(pnl * fraction * 100) / 100;
    const estProceeds = Math.max(0, releaseMargin + estPnl);
    return { releaseMargin, estPnl, estProceeds, fraction };
  }, [action, dilutePct, pnl, position]);

  if (!open || !position || !preview) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-white/10 bg-[#0a0d12] p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <AssetLogoIcon symbol={position.symbol} size="md" className="rounded-lg" />
            <div>
              <h3 className="text-lg font-bold text-white">{position.symbol}</h3>
              <p className="text-[11px] text-zinc-500">
                {position.direction} · {formatUsd(allocatedValue)} allocated
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-black/40 p-2.5">
            <p className="text-[10px] uppercase text-zinc-500">Mark</p>
            <p className="text-sm font-bold tabular-nums text-white">
              ${markPrice >= 1 ? markPrice.toFixed(2) : markPrice.toFixed(8)}
            </p>
          </div>
          <div className="rounded-xl bg-black/40 p-2.5">
            <p className="text-[10px] uppercase text-zinc-500">P&L</p>
            <p
              className={cn(
                "text-sm font-bold tabular-nums",
                pnl >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
              )}
            >
              {pnl >= 0 ? "+" : "−"}
              {formatUsd(Math.abs(pnl))}
            </p>
          </div>
          <div className="rounded-xl bg-black/40 p-2.5">
            <p className="text-[10px] uppercase text-zinc-500">Return</p>
            <p
              className={cn(
                "text-sm font-bold tabular-nums",
                pnlPct >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
              )}
            >
              {pnlPct >= 0 ? "+" : ""}
              {pnlPct.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {(
            [
              ["dilute", "Dilute", Droplets, "Reduce allocation partially"],
              ["liquidate", "Liquidate", TrendingDown, "Close entire position"],
              ["cash_out", "Cash out", ArrowDownToLine, "Close & return to wallet"],
            ] as const
          ).map(([id, label, Icon, hint]) => (
            <button
              key={id}
              type="button"
              disabled={busy}
              onClick={() => setAction(id)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors",
                action === id
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                  : "border-white/8 bg-black/30 text-zinc-400 hover:text-zinc-200",
              )}
            >
              <Icon className="size-4" />
              <span className="text-[11px] font-bold">{label}</span>
              <span className="text-[9px] leading-tight text-zinc-500">{hint}</span>
            </button>
          ))}
        </div>

        {action === "dilute" ? (
          <div className="mb-4 rounded-xl border border-white/8 bg-black/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">Amount to reduce</span>
              <span className="text-sm font-bold tabular-nums text-cyan-300">{dilutePct}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={dilutePct}
              onChange={(e) => setDilutePct(Number(e.target.value))}
              disabled={busy}
              className="w-full accent-cyan-500"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[25, 50, 75].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  disabled={busy}
                  onClick={() => setDilutePct(pct)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[10px] font-bold",
                    dilutePct === pct
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "bg-white/5 text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mb-4 rounded-xl border border-white/8 bg-black/40 p-3 text-xs">
          <div className="flex justify-between text-zinc-500">
            <span>Est. proceeds to wallet</span>
            <span className="font-bold tabular-nums text-white">
              {formatUsd(preview.estProceeds)}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-zinc-500">
            <span>Margin released</span>
            <span className="tabular-nums text-zinc-300">
              {formatUsd(preview.releaseMargin)}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-zinc-500">
            <span>Realized P&L</span>
            <span
              className={cn(
                "tabular-nums font-semibold",
                preview.estPnl >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
              )}
            >
              {preview.estPnl >= 0 ? "+" : "−"}
              {formatUsd(Math.abs(preview.estPnl))}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onConfirm({
              dealId: position.id,
              action,
              percent: action === "dilute" ? dilutePct : undefined,
            })
          }
          className={cn(
            "terminal-btn terminal-btn-primary w-full py-3 text-sm font-bold",
            action === "liquidate" && "bg-[var(--accent-red)]/90 hover:bg-[var(--accent-red)]",
          )}
        >
          {busy
            ? "Confirming on Capital.com…"
            : action === "dilute"
              ? `Dilute ${dilutePct}% at market`
              : action === "cash_out"
                ? "Cash out at market"
                : "Liquidate at market"}
        </button>
      </div>
    </div>
  );
}
