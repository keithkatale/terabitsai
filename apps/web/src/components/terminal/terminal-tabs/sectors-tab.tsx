"use client";

import { useMemo } from "react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { ASSET_CATALOG } from "@/lib/catalog/asset-catalog";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { RippleGraph } from "@/components/market/ripple-graph";

const SECTOR_LENSES = [
  { id: "Technology", label: "Technology", symbols: ["AAPL", "MSFT", "NVDA", "GOOGL", "META"] },
  { id: "Banks", label: "Banks & Finance", symbols: ["JPM", "BAC", "GS", "EURUSD", "GBPUSD"] },
  { id: "Crypto", label: "Crypto", symbols: ["BTCUSD", "ETHUSD", "SOLUSD", "DOGEUSD"] },
  { id: "Commodities", label: "Commodities", symbols: ["GOLD", "OIL", "SILVER"] },
  { id: "Indices", label: "Indices", symbols: ["US100", "US500", "US30", "DE40"] },
] as const;

export function SectorsTab({
  sidebarQuotes,
  activeSymbol,
  onSymbolClick,
  feedSignals,
}: {
  sidebarQuotes: Record<string, { spot?: number; change24hPct?: number }>;
  activeSymbol?: string;
  onSymbolClick: (symbol: string) => void;
  feedSignals?: Array<{ symbol: string; strategy: string; action: string; reason: string; sector?: string | null }>;
}) {
  const sectorSignals = useMemo(() => {
    type FeedSignal = NonNullable<typeof feedSignals>[number];
    const map = new Map<string, FeedSignal[]>();
    for (const lens of SECTOR_LENSES) {
      const symbols = lens.symbols as readonly string[];
      const matched = (feedSignals ?? []).filter(
        (s) => symbols.includes(s.symbol) || s.sector === lens.id,
      );
      map.set(lens.id, matched.slice(0, 4));
    }
    return map;
  }, [feedSignals]);

  return (
    <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Layers className="size-4 text-indigo-400" />
        <h2 className="text-sm font-extrabold text-white">Sector Lenses</h2>
      </div>

      {SECTOR_LENSES.map((lens) => {
        const catalogAssets = ASSET_CATALOG[lens.id === "Banks" ? "Forex" : lens.id] ?? [];
        const symbols = lens.symbols;
        const signals = sectorSignals.get(lens.id) ?? [];

        return (
          <section key={lens.id} className="rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-4 space-y-3">
            <h3 className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider">{lens.label}</h3>
            <div className="flex flex-wrap gap-2">
              {symbols.map((sym) => {
                const q = sidebarQuotes[sym];
                const change = q?.change24hPct ?? 0;
                const name = catalogAssets.find((a) => a.symbol === sym)?.name ?? sym;
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => onSymbolClick(sym)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800/60 bg-zinc-950/60 hover:border-indigo-500/30 cursor-pointer"
                  >
                    <AssetLogoIcon symbol={sym} size="sm" className="rounded-md" />
                    <div className="text-left">
                      <p className="text-[10px] font-mono font-bold text-white">{sym}</p>
                      <p className={cn("text-[9px] font-mono", change >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {change >= 0 ? "+" : ""}
                        {change.toFixed(2)}%
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            {signals.length > 0 ? (
              <div className="space-y-2 border-t border-zinc-900/40 pt-3">
                {signals.map((sig, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSymbolClick(sig.symbol)}
                    className="w-full text-left p-2 rounded-lg bg-zinc-900/30 hover:bg-zinc-900/50 cursor-pointer"
                  >
                    <span className="text-[10px] font-mono font-bold text-indigo-300">{sig.symbol}</span>
                    <span className="text-[10px] text-zinc-500 ml-2">{sig.strategy}</span>
                    <p className="text-[10px] text-zinc-600 mt-0.5 line-clamp-1">{sig.reason}</p>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
      {activeSymbol ? <RippleGraph symbol={activeSymbol} /> : null}
    </div>
  );
}
