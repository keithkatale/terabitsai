"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { useLazyQuotes } from "@/hooks/use-lazy-quotes";
export type AssetCatalogItem = {
  symbol: string;
  name: string;
  asset_class?: string;
  sector?: string;
};

export type AssetCatalogGroup = {
  label: string;
  assets: AssetCatalogItem[];
};

function formatPrice(spot: number, symbol: string): string {
  if (spot >= 1000) {
    return spot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (spot >= 1) return spot.toFixed(2);
  return spot.toFixed(4);
}

function AssetRow({ asset, quote }: { asset: AssetCatalogItem; quote?: { spot?: number; change24hPct?: number } }) {
  const spot = quote?.spot;
  const change = quote?.change24hPct;
  const hasPrice = spot != null && Number.isFinite(spot);

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-zinc-900/50 bg-zinc-950/50 px-2.5 py-2 transition-colors hover:border-zinc-800/80 hover:bg-zinc-900/40">
      <AssetLogoIcon
        symbol={asset.symbol}
        assetClass={asset.asset_class}
        sector={asset.sector}
        size="sm"
        className="shrink-0 rounded-md"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-zinc-100">{asset.symbol}</p>
        <p className="truncate text-[10px] text-zinc-500">{asset.name}</p>
      </div>
      <div className="shrink-0 text-right">
        {hasPrice ? (
          <>
            <p className="text-[11px] font-mono font-semibold text-zinc-200">
              ${formatPrice(spot, asset.symbol)}
            </p>
            {change != null && Number.isFinite(change) ? (
              <p
                className={cn(
                  "text-[10px] font-semibold",
                  change >= 0 ? "text-emerald-400" : "text-red-400",
                )}
              >
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[10px] text-zinc-600">…</p>
        )}
      </div>
    </div>
  );
}

export function AssetCatalogGrid({
  groups,
  title = "Available Assets by Class",
}: {
  groups: AssetCatalogGroup[];
  title?: string;
}) {
  const allSymbols = useMemo(
    () => groups.flatMap((g) => g.assets.map((a) => a.symbol)),
    [groups],
  );
  const quotes = useLazyQuotes(allSymbols, true);

  const totalCount = allSymbols.length;

  return (
    <div className="w-full rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-[10px] font-medium text-zinc-500">{totalCount} assets</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div key={group.label} className="min-w-0">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
              {group.label}
            </p>
            <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
              {group.assets.map((asset) => (
                <AssetRow key={asset.symbol} asset={asset} quote={quotes[asset.symbol]} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
