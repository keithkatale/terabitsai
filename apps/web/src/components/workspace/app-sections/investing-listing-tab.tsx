"use client";

import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ASSET_CATALOG } from "@/lib/catalog/asset-catalog";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { useLazyQuotes, type QuoteSnapshot } from "@/hooks/use-lazy-quotes";
import { purchaseAssetAtMarket, type TradingMode } from "@/lib/account/api";
import { notifyPortfolioUpdated } from "@/lib/portfolio/portfolio-events";

const CATEGORIES = Object.keys(ASSET_CATALOG);
const ALLOCATION_PRESETS = [25, 50, 100, 250, 500];
const amountFont = "font-bold tabular-nums tracking-tight";

type InputMode = "usd" | "units";

function formatPrice(value: number) {
  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (value >= 10) return value.toFixed(2);
  if (value >= 1) return value.toFixed(3);
  return value.toFixed(4);
}

export function InvestingListingTab({
  mode,
  walletAvailable,
  enabled,
  onPurchased,
}: {
  mode: TradingMode;
  walletAvailable: number;
  enabled: boolean;
  onPurchased: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState("Crypto");
  const [search, setSearch] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [inputMode, setInputMode] = useState<InputMode>("usd");
  const [allocationUsd, setAllocationUsd] = useState("100");
  const [size, setSize] = useState("0.1");
  const [leverage, setLeverage] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const selectedAsset = useMemo(
    () => assets.find((a) => a.symbol === selectedSymbol) ?? null,
    [assets, selectedSymbol],
  );

  const selectedQuote: QuoteSnapshot | undefined = selectedSymbol
    ? liveQuotes[selectedSymbol]
    : undefined;

  const parsedAllocation = Number.parseFloat(allocationUsd);
  const parsedSize = Number.parseFloat(size);
  const executionPrice =
    side === "buy" ? selectedQuote?.ask : selectedQuote?.bid;

  const estimatedMargin =
    inputMode === "usd"
      ? Number.isFinite(parsedAllocation) && parsedAllocation > 0
        ? parsedAllocation
        : null
      : executionPrice && Number.isFinite(parsedSize) && parsedSize > 0
        ? (parsedSize * executionPrice) / leverage
        : null;

  const estimatedNotional =
    estimatedMargin != null ? estimatedMargin * leverage : null;

  const estimatedUnits =
    executionPrice && estimatedNotional != null
      ? estimatedNotional / executionPrice
      : null;

  const submitPurchase = async () => {
    if (!selectedSymbol || !executionPrice) {
      setError("Waiting for Capital.com quote — try again in a moment.");
      return;
    }

    if (inputMode === "usd") {
      if (!Number.isFinite(parsedAllocation) || parsedAllocation <= 0) {
        setError("Enter a valid dollar amount to allocate.");
        return;
      }
      if (parsedAllocation > walletAvailable) {
        setError(
          `Insufficient funds. You have $${walletAvailable.toFixed(2)} available.`,
        );
        return;
      }
    } else if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      setError("Enter a valid position size.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await purchaseAssetAtMarket(
        mode,
        inputMode === "usd"
          ? {
              symbol: selectedSymbol,
              side,
              leverage,
              allocationUsd: parsedAllocation,
            }
          : {
              symbol: selectedSymbol,
              side,
              leverage,
              size: parsedSize,
            },
      );
      setSuccess(
        `Capital.com confirmed: ${result.trade.direction} $${result.trade.allocationUsd.toFixed(2)} into ${result.trade.symbol} @ $${formatPrice(result.trade.entryPrice)} (deal ${result.trade.capitalDealId})`,
      );
      notifyPortfolioUpdated();
      onPurchased();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col border-b border-white/6 lg:border-b-0 lg:border-r">
        <div className="shrink-0 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search listings…"
              className="w-full rounded-xl border border-white/8 bg-black/30 py-2.5 pl-10 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
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
                      ? "border border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
                      : "border border-white/8 text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-0">
          {assets.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-600">No listings match your search.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {assets.map((asset) => {
                const quote = liveQuotes[asset.symbol];
                const change = quote?.change24hPct ?? 0;
                const selected = selectedSymbol === asset.symbol;

                return (
                  <button
                    key={asset.symbol}
                    type="button"
                    onClick={() => {
                      setSelectedSymbol(asset.symbol);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={cn(
                      "quant-card flex items-center gap-3 p-3 text-left transition-colors",
                      selected && "border-cyan-500/30 bg-cyan-500/5",
                    )}
                  >
                    <AssetLogoIcon
                      symbol={asset.symbol}
                      assetClass={asset.asset_class}
                      sector={asset.sector}
                      size="md"
                      className="shrink-0 rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-white">{asset.symbol}</p>
                      <p className="truncate text-[10px] text-zinc-500">{asset.name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("text-[11px] text-zinc-300", amountFont)}>
                        {quote?.spot ? `$${formatPrice(quote.spot)}` : "—"}
                      </p>
                      <p className="text-[9px] text-zinc-500">
                        {quote?.bid && quote?.ask
                          ? `${formatPrice(quote.bid)} / ${formatPrice(quote.ask)}`
                          : "Loading…"}
                      </p>
                      <p
                        className={cn(
                          "text-[10px]",
                          amountFont,
                          change >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]",
                        )}
                      >
                        {quote?.change24hPct != null
                          ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`
                          : "—"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-4 p-4 lg:w-[340px]">
        <div>
          <h3 className="text-sm font-semibold text-white">Manual purchase</h3>
          <p className="mt-1 text-[11px] text-zinc-500">
            Allocate USD at Capital.com {side === "buy" ? "ask" : "bid"} · {mode} wallet
          </p>
        </div>

        {!selectedAsset ? (
          <p className="text-sm text-zinc-500">Select a listing to buy or sell.</p>
        ) : (
          <>
            <div className="quant-card p-3">
              <div className="flex items-center gap-2">
                <AssetLogoIcon symbol={selectedAsset.symbol} size="sm" className="rounded-md" />
                <div>
                  <p className="text-sm font-bold text-white">{selectedAsset.symbol}</p>
                  <p className="text-[10px] text-zinc-500">{selectedAsset.name}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-zinc-500">Bid</p>
                  <p className={cn("text-xs text-white", amountFont)}>
                    {selectedQuote?.bid ? `$${formatPrice(selectedQuote.bid)}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500">Spot</p>
                  <p className={cn("text-xs text-white", amountFont)}>
                    {selectedQuote?.spot ? `$${formatPrice(selectedQuote.spot)}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500">Ask</p>
                  <p className={cn("text-xs text-white", amountFont)}>
                    {selectedQuote?.ask ? `$${formatPrice(selectedQuote.ask)}` : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {(["buy", "sell"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-xs font-bold uppercase tracking-wide",
                    side === s
                      ? s === "buy"
                        ? "border-[var(--accent-green)]/40 bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
                        : "border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 text-[var(--accent-red)]"
                      : "border-white/8 text-zinc-500",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex gap-1 rounded-xl border border-white/8 bg-black/30 p-1">
              {(
                [
                  ["usd", "Amount ($)"],
                  ["units", "Units"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInputMode(id)}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-[10px] font-semibold",
                    inputMode === id
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {inputMode === "usd" ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-medium text-zinc-500">
                    Allocate to {selectedAsset.symbol}
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={allocationUsd}
                    onChange={(e) => setAllocationUsd(e.target.value)}
                    className={cn(
                      "w-full rounded-xl border border-white/8 bg-black/30 px-3 py-2.5 text-zinc-100 outline-none focus:border-cyan-500/40",
                      amountFont,
                    )}
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ALLOCATION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAllocationUsd(String(preset))}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-[10px] font-semibold",
                        parsedAllocation === preset
                          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                          : "border-white/8 text-zinc-500 hover:text-zinc-300",
                      )}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-zinc-500">Size (units)</span>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className={cn(
                    "w-full rounded-xl border border-white/8 bg-black/30 px-3 py-2.5 text-zinc-100 outline-none focus:border-cyan-500/40",
                    amountFont,
                  )}
                />
              </label>
            )}

            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-500">Leverage ({leverage}x)</span>
              <input
                type="range"
                min={1}
                max={20}
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </label>

            <div className="quant-card space-y-1 p-3 text-[11px]">
              <div className="flex justify-between text-zinc-500">
                <span>Fill price</span>
                <span className={cn("text-white", amountFont)}>
                  {executionPrice ? `$${formatPrice(executionPrice)}` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Your allocation</span>
                <span className={cn("text-white", amountFont)}>
                  {estimatedMargin != null ? `$${estimatedMargin.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Est. units</span>
                <span className={cn("text-white", amountFont)}>
                  {estimatedUnits != null ? estimatedUnits.toFixed(4) : "—"}
                </span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Available</span>
                <span className={cn("text-white", amountFont)}>
                  ${walletAvailable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={busy || !executionPrice}
              onClick={submitPurchase}
              className="terminal-btn terminal-btn-primary flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  <span className="sr-only">Confirming on Capital.com…</span>
                </>
              ) : (
                `${side === "buy" ? "Buy" : "Sell"} ${selectedAsset.symbol}`
              )}
            </button>
          </>
        )}

        {success ? (
          <p className="text-xs font-medium text-[var(--accent-green)]">{success}</p>
        ) : null}
        {error ? <p className="text-xs font-medium text-[var(--accent-red)]">{error}</p> : null}
      </div>
    </div>
  );
}
