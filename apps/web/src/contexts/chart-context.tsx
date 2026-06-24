"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  buildChartSpec,
  resolveTradingViewSymbol,
  type TvInterval,
} from "@/lib/chart/tradingview-spec";

const STORAGE_KEY = "terabits:markets-chart:v1";

export type MarketsCategory =
  | "all"
  | "crypto"
  | "stocks"
  | "forex"
  | "commodities"
  | "indices"
  | "etfs";

type PersistedChartPrefs = {
  symbol: string;
  displayName: string;
  interval: TvInterval;
  indicators: string[];
  watchlist: string[];
};

function readPrefs(): Partial<PersistedChartPrefs> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedChartPrefs) : {};
  } catch {
    return {};
  }
}

function writePrefs(prefs: PersistedChartPrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota */
  }
}

export type ChartContextValue = {
  symbol: string;
  tvSymbol: string;
  displayName: string;
  interval: TvInterval;
  indicators: string[];
  category: MarketsCategory;
  watchlist: string[];
  aiPanelOpen: boolean;
  browserCollapsed: boolean;
  setSymbol: (symbol: string, displayName?: string) => void;
  setInterval: (interval: TvInterval) => void;
  setIndicators: (indicators: string[]) => void;
  setCategory: (category: MarketsCategory) => void;
  toggleWatchlist: (symbol: string) => void;
  setAiPanelOpen: (open: boolean) => void;
  setBrowserCollapsed: (collapsed: boolean) => void;
};

const ChartContext = createContext<ChartContextValue | null>(null);

const DEFAULT_SYMBOL = "BTCUSD";
const DEFAULT_INTERVAL: TvInterval = "D";
const DEFAULT_INDICATORS = ["RSI", "MACD", "Volume"];

export function ChartProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbolState] = useState(DEFAULT_SYMBOL);
  const [displayName, setDisplayName] = useState("Bitcoin");
  const [interval, setIntervalState] = useState<TvInterval>(DEFAULT_INTERVAL);
  const [indicators, setIndicatorsState] = useState<string[]>(DEFAULT_INDICATORS);
  const [category, setCategory] = useState<MarketsCategory>("all");
  const [watchlist, setWatchlist] = useState<string[]>(["BTCUSD", "ETHUSD", "AAPL", "NVDA"]);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [browserCollapsed, setBrowserCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const prefs = readPrefs();
    if (prefs.symbol) setSymbolState(prefs.symbol);
    if (prefs.displayName) setDisplayName(prefs.displayName);
    if (prefs.interval) setIntervalState(prefs.interval);
    if (prefs.indicators?.length) setIndicatorsState(prefs.indicators);
    if (prefs.watchlist?.length) setWatchlist(prefs.watchlist);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writePrefs({ symbol, displayName, interval, indicators, watchlist });
  }, [hydrated, symbol, displayName, interval, indicators, watchlist]);

  const tvSymbol = useMemo(
    () => buildChartSpec({ symbol, interval, indicators, displayName }).symbol,
    [symbol, interval, indicators, displayName],
  );

  const setSymbol = useCallback((next: string, name?: string) => {
    setSymbolState(next.toUpperCase());
    setDisplayName(name ?? next.toUpperCase());
    setAiPanelOpen(true);
  }, []);

  const setInterval = useCallback((next: TvInterval) => {
    setIntervalState(next);
  }, []);

  const setIndicators = useCallback((next: string[]) => {
    setIndicatorsState(next.length ? next : DEFAULT_INDICATORS);
  }, []);

  const toggleWatchlist = useCallback((sym: string) => {
    const upper = sym.toUpperCase();
    setWatchlist((prev) =>
      prev.includes(upper) ? prev.filter((s) => s !== upper) : [...prev, upper],
    );
  }, []);

  const value = useMemo(
    () => ({
      symbol,
      tvSymbol,
      displayName,
      interval,
      indicators,
      category,
      watchlist,
      aiPanelOpen,
      browserCollapsed,
      setSymbol,
      setInterval,
      setIndicators,
      setCategory,
      toggleWatchlist,
      setAiPanelOpen,
      setBrowserCollapsed,
    }),
    [
      symbol,
      tvSymbol,
      displayName,
      interval,
      indicators,
      category,
      watchlist,
      aiPanelOpen,
      browserCollapsed,
      setSymbol,
      setInterval,
      setIndicators,
      toggleWatchlist,
    ],
  );

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
}

export function useChartContext(): ChartContextValue {
  const ctx = useContext(ChartContext);
  if (!ctx) {
    throw new Error("useChartContext must be used within ChartProvider");
  }
  return ctx;
}

export { resolveTradingViewSymbol };
