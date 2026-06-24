"use client";

import { Star } from "lucide-react";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { cn } from "@/lib/utils";
import type { AssetRow } from "@/lib/catalog/types";

function formatPrice(spot: number) {
  if (spot >= 1000) return spot.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (spot >= 1) return spot.toFixed(2);
  return spot.toFixed(4);
}

export function AssetRow({
  asset,
  quote,
  active,
  watchlisted,
  onSelect,
  onToggleWatchlist,
}: {
  asset: AssetRow;
  quote?: { spot?: number; change24hPct?: number };
  active?: boolean;
  watchlisted?: boolean;
  onSelect: () => void;
  onToggleWatchlist: () => void;
}) {
  const change = quote?.change24hPct ?? 0;
  const bullish = change >= 0;

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-xl border transition-colors",
        active
          ? "border-cyan-500/30 bg-cyan-500/10"
          : "border-transparent hover:border-white/8 hover:bg-white/[0.03]",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
      >
        <AssetLogoIcon symbol={asset.symbol} className="size-7 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold text-zinc-100">
            {asset.symbol.replace("USD", "")}
          </span>
          <span className="block truncate text-[10px] text-zinc-500">
            {asset.display_name.replace(" CFD", "").slice(0, 24)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[11px] font-mono font-semibold text-zinc-200">
            {quote?.spot != null ? formatPrice(quote.spot) : "—"}
          </span>
          <span
            className={cn(
              "block text-[10px] font-mono font-semibold",
              bullish ? "text-emerald-400" : "text-rose-400",
            )}
          >
            {quote?.spot != null ? `${bullish ? "+" : ""}${change.toFixed(2)}%` : ""}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleWatchlist();
        }}
        className="mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 opacity-0 transition-opacity hover:bg-white/[0.06] group-hover:opacity-100"
        aria-label={watchlisted ? "Remove from watchlist" : "Add to watchlist"}
      >
        <Star
          className={cn("size-3.5", watchlisted ? "fill-amber-400 text-amber-400" : "")}
        />
      </button>
    </div>
  );
}
