/**
 * Lightweight fundamental context for AI market analysis.
 * Expand with Alpha Vantage / CoinGecko as needed.
 */

export type FundamentalSnapshot = {
  symbol: string;
  assetClass: string;
  marketCap?: string;
  peRatio?: string;
  sector?: string;
  volume24h?: string;
  dominance?: string;
  notes: string[];
};

export async function fetchFundamentalSnapshot(
  symbol: string,
  assetClass: string,
): Promise<FundamentalSnapshot> {
  const notes: string[] = [];

  if (assetClass === "crypto") {
    notes.push("Crypto assets: monitor BTC correlation, funding rates, and on-chain volume.");
    return {
      symbol,
      assetClass,
      dominance: symbol.startsWith("BTC") ? "~50% market" : undefined,
      notes,
    };
  }

  if (assetClass === "stock") {
    notes.push("Equity: consider earnings calendar, sector rotation, and broad index trend.");
    return { symbol, assetClass, sector: "US Equities", notes };
  }

  if (assetClass === "etf") {
    const sector = symbol.includes("US") ? "Indices" : "ETFs";
    notes.push(`${sector}: macro sensitivity and risk-on/risk-off flows matter.`);
    return { symbol, assetClass, sector, notes };
  }

  return { symbol, assetClass, notes: ["Use multi-timeframe technical context."] };
}

export function formatFundamentalsForPrompt(snap: FundamentalSnapshot): string {
  const lines = [
    `Symbol: ${snap.symbol}`,
    `Asset class: ${snap.assetClass}`,
    snap.sector ? `Sector: ${snap.sector}` : null,
    snap.marketCap ? `Market cap: ${snap.marketCap}` : null,
    snap.peRatio ? `P/E: ${snap.peRatio}` : null,
    snap.volume24h ? `24h volume: ${snap.volume24h}` : null,
    ...snap.notes.map((n) => `- ${n}`),
  ].filter(Boolean);
  return lines.join("\n");
}
