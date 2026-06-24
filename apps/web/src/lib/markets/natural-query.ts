import type { AssetRow } from "@/lib/catalog/types";

export type NaturalQueryResult = {
  query: string;
  matchedSymbols: string[];
  interpretation: string;
};

const CRYPTO_KEYWORDS = ["crypto", "bitcoin", "btc", "ethereum", "eth", "altcoin", "coin"];
const STOCK_KEYWORDS = ["stock", "equity", "share", "nasdaq", "tech"];
const FOREX_KEYWORDS = ["forex", "fx", "currency", "eur", "gbp", "jpy"];
const COMMODITY_KEYWORDS = ["gold", "oil", "silver", "commodity", "commodities"];
const OVERSOLD_KEYWORDS = ["oversold", "rsi below", "beaten down", "dip"];
const BREAKOUT_KEYWORDS = ["breakout", "breaking", "resistance", "break"];

function matchesClass(query: string, asset: AssetRow): boolean {
  const q = query.toLowerCase();
  if (CRYPTO_KEYWORDS.some((k) => q.includes(k))) return asset.asset_class === "crypto";
  if (STOCK_KEYWORDS.some((k) => q.includes(k))) return asset.asset_class === "stock";
  if (FOREX_KEYWORDS.some((k) => q.includes(k))) return asset.sector === "Forex";
  if (COMMODITY_KEYWORDS.some((k) => q.includes(k))) return asset.sector === "Commodities";
  return true;
}

function symbolMentioned(query: string, asset: AssetRow): boolean {
  const sym = asset.symbol.toLowerCase();
  const name = asset.display_name.toLowerCase();
  const q = query.toLowerCase();
  return q.includes(sym) || q.includes(sym.replace("usd", "")) || name.split(" ")[0].length > 3 && q.includes(name.split(" ")[0].toLowerCase());
}

/**
 * Lightweight NL filter — full technical screening comes from AI + chart analysis.
 */
export function parseNaturalMarketQuery(
  query: string,
  catalog: AssetRow[],
  limit = 12,
): NaturalQueryResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query: trimmed, matchedSymbols: [], interpretation: "Enter a search query." };
  }

  const q = trimmed.toLowerCase();
  let interpretation = "Matching assets in catalog";

  if (OVERSOLD_KEYWORDS.some((k) => q.includes(k))) {
    interpretation = "Oversold candidates — open charts for AI RSI/MACD confirmation";
  } else if (BREAKOUT_KEYWORDS.some((k) => q.includes(k))) {
    interpretation = "Breakout watchlist — AI will validate structure on each chart";
  }

  const scored = catalog
    .map((asset) => {
      let score = 0;
      if (symbolMentioned(trimmed, asset)) score += 10;
      if (matchesClass(trimmed, asset)) score += 2;
      if (asset.symbol.toLowerCase().startsWith(trimmed.replace(/[^a-z0-9]/gi, ""))) score += 5;
      if (asset.display_name.toLowerCase().includes(q)) score += 3;
      return { asset, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) {
    const fuzzy = catalog
      .filter((a) => matchesClass(trimmed, a))
      .slice(0, limit);
    return {
      query: trimmed,
      matchedSymbols: fuzzy.map((a) => a.symbol),
      interpretation,
    };
  }

  return {
    query: trimmed,
    matchedSymbols: scored.map((s) => s.asset.symbol),
    interpretation,
  };
}
