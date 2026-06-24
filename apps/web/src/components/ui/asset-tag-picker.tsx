"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { cn } from "@/lib/utils";
import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";
import type { TaggedAsset } from "@/components/ui/input-bar";

const CATALOG = getCapitalAssetCatalog();

const CATEGORY_ORDER = ["Crypto", "Stocks", "Forex", "Indices", "Commodities", "ETFs"] as const;

function categoryForItem(item: (typeof CATALOG)[number]): string {
  if (item.asset_class === "crypto") return "Crypto";
  if (item.sector === "Forex") return "Forex";
  if (item.sector === "Indices") return "Indices";
  if (item.sector === "Commodities") return "Commodities";
  if (item.sector === "ETFs") return "ETFs";
  return "Stocks";
}

function displayName(item: (typeof CATALOG)[number]) {
  return item.display_name.replace(" CFD", "").replace(" / USD", "");
}

type Props = {
  taggedAssets: TaggedAsset[];
  maxTaggedAssets: number;
  onToggleAsset: (symbol: string) => void;
  className?: string;
};

export function AssetTagPicker({
  taggedAssets,
  maxTaggedAssets,
  onToggleAsset,
  className,
}: Props) {
  const [query, setQuery] = useState("");
  const taggedSet = useMemo(() => new Set(taggedAssets.map((t) => t.symbol)), [taggedAssets]);
  const atLimit = taggedAssets.length >= maxTaggedAssets;

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = CATALOG.filter((item) => {
      if (!q) return true;
      const name = displayName(item).toLowerCase();
      return item.symbol.toLowerCase().includes(q) || name.includes(q);
    });

    const map = new Map<string, typeof CATALOG>();
    for (const item of filtered) {
      const cat = categoryForItem(item);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }

    return CATEGORY_ORDER.filter((cat) => map.has(cat)).map((cat) => ({
      category: cat,
      items: map.get(cat)!,
    }));
  }, [query]);

  return (
    <div className={cn("flex w-[min(92vw,380px)] flex-col", className)}>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search assets…"
          className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-8 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-cyan-500/40"
        />
      </div>

      <p className="mb-2 px-0.5 text-[10px] text-zinc-500">
        Tag up to {maxTaggedAssets} assets for focused analysis ({taggedAssets.length}/{maxTaggedAssets})
      </p>

      <div className="max-h-[min(52vh,320px)] overflow-y-auto overscroll-contain pr-0.5">
        {grouped.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-500">No assets match your search.</p>
        ) : (
          grouped.map(({ category, items }) => (
            <div key={category} className="mb-3 last:mb-0">
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {category}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const selected = taggedSet.has(item.symbol);
                  const disabled = !selected && atLimit;
                  return (
                    <li key={item.symbol}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onToggleAsset(item.symbol)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                          selected
                            ? "bg-cyan-500/15 text-cyan-100"
                            : "text-zinc-200 hover:bg-white/[0.06]",
                          disabled && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <AssetLogoIcon
                          symbol={item.symbol}
                          assetClass={item.asset_class}
                          sector={item.sector ?? undefined}
                          size="sm"
                          className="size-7 shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{displayName(item)}</span>
                          <span className="font-mono text-[10px] text-zinc-500">{item.symbol}</span>
                        </span>
                        {selected ? (
                          <Check className="size-4 shrink-0 text-cyan-400" strokeWidth={2.5} />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
