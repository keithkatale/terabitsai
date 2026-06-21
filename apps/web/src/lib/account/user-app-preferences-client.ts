import type { TradingMode } from "@/lib/account/api";

const STORAGE_KEY = "terabits-trading-mode";

export function readCachedTradingMode(): TradingMode {
  if (typeof window === "undefined") return "demo";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "live" ? "live" : "demo";
}

export function writeCachedTradingMode(mode: TradingMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}
