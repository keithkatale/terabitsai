"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";
import { assetClassForSymbol } from "@/lib/market/watchlist";
import { parseNaturalMarketQuery } from "@/lib/markets/natural-query";
import { useChartContext, type MarketsCategory } from "@/contexts/chart-context";
import { cn } from "@/lib/utils";
import { AssetRow } from "./asset-row";

const CATEGORIES: Array<{ id: MarketsCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "crypto", label: "Crypto" },
  { id: "stocks", label: "Stocks" },
  { id: "forex", label: "Forex" },
  { id: "commodities", label: "Commodities" },
  { id: "indices", label: "Indices" },
  { id: "etfs", label: "ETFs" },
];

function categoryForAsset(asset: ReturnType<typeof getCapitalAssetCatalog>[0]): MarketsCategory {
  if (asset.asset_class === "crypto") return "crypto";
  if (asset.asset_class === "stock") return "stocks";
  if (asset.sector === "Forex") return "forex";
  if (asset.sector === "Commodities") return "commodities";
  if (asset.sector === "Indices") return "indices";
  if (asset.sector === "ETFs") return "etfs";
  return "all";
}

export function AssetBrowser({ collapsed, onToggleCollapsed }: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const catalog = useMemo(() => getCapitalAssetCatalog(), []);
  const {
    symbol: activeSymbol,
    category,
    setCategory,
    setSymbol,
    watchlist,
    toggleWatchlist,
  } = useChartContext();

  const [search, setSearch] = useState("");
  const [quotes, setQuotes] = useState<Record<string, { spot?: number; change24hPct?: number }>>({});

  const nlResult = useMemo(() => {
    if (!search.trim() || search.trim().length <= 2) return null;
    return parseNaturalMarketQuery(search, catalog, 80);
  }, [search, catalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = catalog;

    if (category !== "all") {
      list = list.filter((a) => categoryForAsset(a) === category);
    }

    if (!q) return list.slice(0, 200);

    if (nlResult && nlResult.matchedSymbols.length > 0) {
      const set = new Set(nlResult.matchedSymbols);
      return list.filter((a) => set.has(a.symbol));
    }

    return list
      .filter(
        (a) =>
          a.symbol.toLowerCase().includes(q) ||
          a.display_name.toLowerCase().includes(q),
      )
      .slice(0, 120);
  }, [catalog, category, search, nlResult]);

  const fetchQuotes = useCallback(async (symbols: string[]) => {
    const batch = symbols.slice(0, 24);
    const results = await Promise.allSettled(
      batch.map(async (sym) => {
        const res = await fetch(
          `/api/market/quote?symbol=${sym}&assetClass=${assetClassForSymbol(sym)}`,
        );
        if (!res.ok) return null;
        const data = await res.json();
        return { symbol: sym, spot: data.spot, change24hPct: data.change24hPct };
      }),
    );
    const next: Record<string, { spot?: number; change24hPct?: number }> = {};
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        next[r.value.symbol] = { spot: r.value.spot, change24hPct: r.value.change24hPct };
      }
    }
    setQuotes((prev) => ({ ...prev, ...next }));
  }, []);

  useEffect(() => {
    const syms = filtered.slice(0, 24).map((a) => a.symbol);
    void fetchQuotes(syms);
    const id = setInterval(() => void fetchQuotes(syms), 60_000);
    return () => clearInterval(id);
  }, [filtered.map((a) => a.symbol).join(","), fetchQuotes]);

  const watchlistAssets = useMemo(
    () => watchlist.map((s) => catalog.find((a) => a.symbol === s)).filter(Boolean),
    [watchlist, catalog],
  );

  if (collapsed) {
    return (
      <div className="flex h-full w-10 shrink-0 flex-col items-center border-r border-white/6 bg-black/20 py-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.05] hover:text-cyan-400"
          title="Expand asset list"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex h-full w-[min(280px,32vw)] shrink-0 flex-col border-r border-white/6 bg-black/20">
      <div className="flex items-center justify-between gap-2 border-b border-white/6 px-3 py-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Markets</span>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
          title="Collapse"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      <div className="px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or ask: oversold tech…"
            className="w-full rounded-xl border border-white/8 bg-black/40 py-2 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/30 focus:outline-none"
          />
        </div>
        {nlResult?.interpretation ? (
          <p className="mt-1.5 text-[10px] leading-snug text-cyan-400/80">{nlResult.interpretation}</p>
        ) : null}
      </div>

      <div className="terminal-nav-group mx-3 mb-2 flex gap-1 overflow-x-auto scrollbar-none">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={cn(
              "terminal-tab shrink-0 px-2 py-1 text-[9px]",
              category === c.id ? "terminal-tab-active" : "terminal-tab-idle",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {watchlistAssets.length > 0 && !search ? (
        <div className="border-b border-white/6 px-2 pb-2">
          <p className="px-1 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-400/80">
            Watchlist
          </p>
          {watchlistAssets.map((asset) =>
            asset ? (
              <AssetRow
                key={`wl-${asset.symbol}`}
                asset={asset}
                quote={quotes[asset.symbol]}
                active={activeSymbol === asset.symbol}
                watchlisted
                onSelect={() => setSymbol(asset.symbol, asset.display_name)}
                onToggleWatchlist={() => toggleWatchlist(asset.symbol)}
              />
            ) : null,
          )}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {filtered.map((asset) => (
          <AssetRow
            key={asset.symbol}
            asset={asset}
            quote={quotes[asset.symbol]}
            active={activeSymbol === asset.symbol}
            watchlisted={watchlist.includes(asset.symbol)}
            onSelect={() => setSymbol(asset.symbol, asset.display_name)}
            onToggleWatchlist={() => toggleWatchlist(asset.symbol)}
          />
        ))}
        {filtered.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-zinc-500">No assets match</p>
        ) : null}
      </div>
    </aside>
  );
}
