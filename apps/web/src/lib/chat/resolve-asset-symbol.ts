import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";
import type { AssetRow } from "@/lib/catalog/types";

const ALIASES: Record<string, string> = {
  BTC: "BTCUSD",
  BITCOIN: "BTCUSD",
  ETH: "ETHUSD",
  ETHEREUM: "ETHUSD",
  SOL: "SOLUSD",
  SOLANA: "SOLUSD",
  XRP: "XRPUSD",
  RIPPLE: "XRPUSD",
  DOGE: "DOGEUSD",
  DOGECOIN: "DOGEUSD",
  ADA: "ADAUSD",
  CARDANO: "ADAUSD",
  AVAX: "AVAXUSD",
  AVALANCHE: "AVAXUSD",
  GOLD: "GOLD",
  SILVER: "SILVER",
  OIL: "OIL_CRUDE",
  CRUDE: "OIL_CRUDE",
  SPX: "US500",
  SP500: "US500",
  NASDAQ: "US100",
  NDX: "US100",
  DOW: "US30",
  AAPL: "AAPL",
  APPLE: "AAPL",
  MSFT: "MSFT",
  MICROSOFT: "MSFT",
  TSLA: "TSLA",
  TESLA: "TSLA",
  NVDA: "NVDA",
  NVIDIA: "NVDA",
  AMZN: "AMZN",
  AMAZON: "AMZN",
  GOOGL: "GOOGL",
  GOOGLE: "GOOGL",
  META: "META",
  FACEBOOK: "META",
};

function normalizeToken(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function resolveAssetSymbol(query: string): AssetRow | undefined {
  const catalog = getCapitalAssetCatalog();
  const raw = query.trim();
  if (!raw) return undefined;

  const upper = raw.toUpperCase();
  const token = normalizeToken(raw);

  const direct = catalog.find(
    (a) => a.symbol.toUpperCase() === upper || a.symbol.toUpperCase() === token
  );
  if (direct) return direct;

  const aliasSymbol = ALIASES[token] ?? ALIASES[upper];
  if (aliasSymbol) {
    const aliased = catalog.find((a) => a.symbol === aliasSymbol);
    if (aliased) return aliased;
  }

  const lower = raw.toLowerCase();
  return catalog.find(
    (a) =>
      a.display_name.toLowerCase().includes(lower) ||
      a.symbol.toLowerCase().includes(lower)
  );
}
