import type { LedgerSummaryResponse, TradingMode } from "@/lib/account/api";
import type { TradeData } from "@/components/terminal/types";

const CACHE_KEY = "quant:home-tab:v1";

export type HomeTabCache = {
  mode: TradingMode;
  summary: LedgerSummaryResponse | null;
  positions: TradeData[];
  chartPoints: Array<{ time: number; value: number }>;
  changePct: number;
  cachedAt: number;
};

function storageKey(mode: TradingMode) {
  return `${CACHE_KEY}:${mode}`;
}

export function readHomeTabCache(mode: TradingMode): HomeTabCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(mode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeTabCache;
    if (parsed.mode !== mode) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeHomeTabCache(mode: TradingMode, patch: Partial<Omit<HomeTabCache, "mode" | "cachedAt">>) {
  if (typeof window === "undefined") return;
  try {
    const existing = readHomeTabCache(mode);
    const next: HomeTabCache = {
      mode,
      summary: patch.summary ?? existing?.summary ?? null,
      positions: patch.positions ?? existing?.positions ?? [],
      chartPoints: patch.chartPoints ?? existing?.chartPoints ?? [],
      changePct: patch.changePct ?? existing?.changePct ?? 0,
      cachedAt: Date.now(),
    };
    sessionStorage.setItem(storageKey(mode), JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}
