/** Client-safe watchlist constants (mirrors @quant/market-intel/symbols — do not import barrel in client). */

export const HOT_SYMBOLS = [
  "BTCUSD",
  "ETHUSD",
  "US100",
  "GOLD",
  "AAPL",
  "NVDA",
  "MSFT",
  "GOOGL",
  "EURUSD",
  "OIL",
  "US500",
  "SOLUSD",
] as const;

export function assetClassForSymbol(symbol: string): string {
  if (symbol.endsWith("USD") && ["BTC", "ETH", "SOL", "XRP", "DOGE"].some((c) => symbol.startsWith(c))) {
    return "crypto";
  }
  if (["EURUSD", "GBPUSD", "USDJPY"].includes(symbol)) return "forex";
  if (["US100", "US500", "US30"].includes(symbol)) return "index";
  if (["GOLD", "OIL", "SILVER"].includes(symbol)) return "commodity";
  return "stock";
}
