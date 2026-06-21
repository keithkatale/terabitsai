"use client";

import { useMemo, useState } from "react";
import { Layers, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ASSET_CATALOG } from "@/lib/catalog/asset-catalog";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { useLazyQuotes } from "@/hooks/use-lazy-quotes";

const CATEGORIES = Object.keys(ASSET_CATALOG);

export function AssetsSection({
  fallbackQuotes,
  onAnalyze,
  enabled = true,
}: {
  fallbackQuotes: Record<string, { spot?: number; change24hPct?: number }>;
  onAnalyze: (symbol: string, name: string) => void;
  enabled?: boolean;
}) {
  const [activeCategory, setActiveCategory] = useState("Crypto");
  const [search, setSearch] = useState("");

  const assets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? Object.values(ASSET_CATALOG)
          .flat()
          .filter(
            (a) =>
              a.symbol.toLowerCase().includes(q) ||
              a.name.toLowerCase().includes(q),
          )
      : ASSET_CATALOG[activeCategory] ?? [];

    return list.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [activeCategory, search]);

  const visibleSymbols = useMemo(() => assets.map((a) => a.symbol), [assets]);
  const liveQuotes = useLazyQuotes(visibleSymbols, enabled);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-zinc-900/60 px-4 py-4">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-indigo-400" />
          <div>
            <h1 className="text-sm font-extrabold text-white">Markets</h1>
            <p className="text-[11px] text-zinc-500">
              Browse tradable CFDs and launch simulated trades through Command.
            </p>
          </div>
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by symbol or name…"
            className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950/60 py-2.5 pl-10 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none"
          />
        </div>

        {!search.trim() ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors",
                  activeCategory === cat
                    ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/25"
                    : "border border-zinc-800/60 text-zinc-500 hover:text-zinc-300",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {assets.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-600">No assets match your search.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => {
              const quote = {
                ...fallbackQuotes[asset.symbol],
                ...liveQuotes[asset.symbol],
              };
              const change = quote?.change24hPct ?? 0;
              const spot = quote?.spot ?? 0;

              return (
                <button
                  key={asset.symbol}
                  type="button"
                  onClick={() => onAnalyze(asset.symbol, asset.name)}
                  className="flex items-center gap-3 rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-3 text-left transition-colors hover:border-indigo-500/30 hover:bg-zinc-950/70"
                >
                  <AssetLogoIcon
                    symbol={asset.symbol}
                    assetClass={asset.asset_class}
                    sector={asset.sector}
                    size="md"
                    className="rounded-lg shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">{asset.symbol}</p>
                    <p className="truncate text-[10px] text-zinc-500">{asset.name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-mono font-semibold text-zinc-300">
                      {spot > 0
                        ? `$${spot >= 1000 ? spot.toLocaleString(undefined, { maximumFractionDigits: 2 }) : spot.toFixed(spot < 10 ? 4 : 2)}`
                        : "—"}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] font-mono font-bold",
                        change >= 0 ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {change >= 0 ? "+" : ""}
                      {change.toFixed(2)}%
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
