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
  "SOLUSD"
] as const;

export const FULL_SCAN_BATCH_SIZE = 20;

export function sectorForSymbol(symbol: string, assetClass?: string): string | undefined {
  if (assetClass === "crypto" || symbol.endsWith("USD") && ["BTC", "ETH", "SOL"].some((c) => symbol.startsWith(c))) {
    return "Crypto";
  }
  if (["GOLD", "OIL", "SILVER"].includes(symbol)) return "Commodities";
  if (["US100", "US500", "US30", "DE40"].includes(symbol)) return "Indices";
  if (["EURUSD", "GBPUSD", "USDJPY"].includes(symbol)) return "Forex";
  if (["AAPL", "MSFT", "NVDA", "GOOGL", "META"].includes(symbol)) return "Technology";
  if (["JPM", "BAC", "GS"].includes(symbol)) return "Banks";
  return assetClass === "stock" ? "Stocks" : undefined;
}

export function assetClassForSymbol(symbol: string): string {
  if (symbol.endsWith("USD") && ["BTC", "ETH", "SOL", "XRP", "DOGE"].some((c) => symbol.startsWith(c))) {
    return "crypto";
  }
  if (["EURUSD", "GBPUSD", "USDJPY"].includes(symbol)) return "forex";
  if (["US100", "US500", "US30"].includes(symbol)) return "index";
  if (["GOLD", "OIL", "SILVER"].includes(symbol)) return "commodity";
  return "stock";
}
