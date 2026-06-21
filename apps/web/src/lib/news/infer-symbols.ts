const SYMBOL_HINTS: Array<{ pattern: RegExp; symbol: string }> = [
  { pattern: /\bbitcoin\b|\bbtc\b/i, symbol: "BTCUSD" },
  { pattern: /\bethereum\b|\beth\b/i, symbol: "ETHUSD" },
  { pattern: /\bnvidia\b|\bnvda\b/i, symbol: "NVDA" },
  { pattern: /\bapple\b|\baapl\b/i, symbol: "AAPL" },
  { pattern: /\bgoogle\b|\balphabet\b|\bgoogl\b/i, symbol: "GOOGL" },
  { pattern: /\bmicrosoft\b|\bmsft\b/i, symbol: "MSFT" },
  { pattern: /\bmeta\b|\bfb\b|\bfacebook\b/i, symbol: "META" },
  { pattern: /\btesla\b|\btsla\b/i, symbol: "TSLA" },
  { pattern: /\bamazon\b|\bamzn\b/i, symbol: "AMZN" },
  { pattern: /\bs&p\b|\bsp 500\b|\bus500\b/i, symbol: "US500" },
  { pattern: /\bnasdaq\b|\bus100\b/i, symbol: "US100" },
  { pattern: /\bgold\b|\bxau\b/i, symbol: "GOLD" },
  { pattern: /\boil\b|\bcrude\b|\bwti\b/i, symbol: "OIL" },
  { pattern: /\beuro\b|\beurusd\b/i, symbol: "EURUSD" },
  { pattern: /\bsolana\b|\bsol\b/i, symbol: "SOLUSD" },
  { pattern: /\bjpmorgan\b|\bjpm\b/i, symbol: "JPM" },
];

export function parseSymbolsFromCategory(category: string | null | undefined): string[] {
  if (!category?.startsWith("symbols:")) return [];
  return category
    .slice(8)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export function inferNewsSymbols(text: string, extra: string[] = []): string[] {
  const found = new Set(extra.map((s) => s.toUpperCase()));
  for (const { pattern, symbol } of SYMBOL_HINTS) {
    if (pattern.test(text)) found.add(symbol);
  }
  return [...found];
}

export function resolveNewsSymbols(input: {
  headline: string;
  summary: string;
  symbol?: string | null;
  category?: string | null;
  documentSymbols?: string[];
}): string[] {
  const fromCategory = parseSymbolsFromCategory(input.category);
  const fromText = inferNewsSymbols(`${input.headline} ${input.summary}`, input.documentSymbols ?? []);
  const primary = input.symbol ? [input.symbol.toUpperCase()] : [];
  return [...new Set([...fromCategory, ...primary, ...fromText])].slice(0, 4);
}

export function assetClassForNewsSymbol(symbol: string): string | undefined {
  if (["BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "DOGEUSD"].includes(symbol)) return "crypto";
  if (["EURUSD", "GBPUSD", "USDJPY"].includes(symbol)) return "forex";
  if (["US100", "US500", "US30"].includes(symbol)) return "index";
  if (["GOLD", "OIL", "SILVER"].includes(symbol)) return "commodity";
  return "stock";
}
