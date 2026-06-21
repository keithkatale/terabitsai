import { useEffect, useRef, useState } from "react";
import { assetClassForSymbol } from "@/lib/market/watchlist";

export type QuoteSnapshot = {
  spot?: number;
  change24hPct?: number;
  bid?: number;
  ask?: number;
};

const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 120;

/**
 * Fetches live quotes for a symbol list in small parallel batches.
 * Only runs while `enabled` is true (e.g. when the Assets tab is active).
 */
export function useLazyQuotes(
  symbols: string[],
  enabled: boolean,
): Record<string, QuoteSnapshot> {
  const [quotes, setQuotes] = useState<Record<string, QuoteSnapshot>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || symbols.length === 0) return;

    let cancelled = false;
    const pending = symbols.filter((s) => !fetchedRef.current.has(s));

    const run = async () => {
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = pending.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (symbol) => {
            const assetClass = assetClassForSymbol(symbol);
            const res = await fetch(`/api/market/quote?symbol=${symbol}&assetClass=${assetClass}`);
            if (!res.ok) return null;
            const data = await res.json();
            return { symbol, data };
          }),
        );

        if (cancelled) return;

        setQuotes((prev) => {
          const next = { ...prev };
          for (const r of results) {
            if (r.status === "fulfilled" && r.value) {
              fetchedRef.current.add(r.value.symbol);
              next[r.value.symbol] = r.value.data;
            }
          }
          return next;
        });

        if (i + BATCH_SIZE < pending.length) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [symbols, enabled]);

  return quotes;
}
