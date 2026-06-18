/**
 * Normalize symbols across Finnhub / Alpaca (stocks vs crypto).
 */

export type MarketDataProvider =
  | "finnhub_stock"
  | "finnhub_crypto"
  | "alpaca_stock"
  | "alpaca_crypto"

const KNOWN_CRYPTO_BASE = new Set([
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "DOGE",
  "ADA",
  "AVAX",
  "DOT",
  "LINK",
  "MATIC",
  "POL",
  "LTC",
  "BCH",
  "UNI",
  "ATOM",
  "NEAR",
  "APT",
  "ARB",
  "OP",
])

/** Heuristic: crypto pair, exchange-prefixed pair, or known base asset. */
export function isLikelyCrypto(symbol: string): boolean {
  const s = symbol.trim().toUpperCase()
  if (!s) return false
  if (s.includes("/")) return true
  if (s.startsWith("BINANCE:")) return true
  if (s.endsWith("USDT")) return true
  if (s.endsWith("USD") && s.length > 3) {
    const base = s.slice(0, -3)
    if (KNOWN_CRYPTO_BASE.has(base)) return true
  }
  return KNOWN_CRYPTO_BASE.has(s)
}

/**
 * Map dashboard-style input to provider-specific symbol strings.
 */
export function resolveSymbol(
  input: string,
  provider: MarketDataProvider,
): string {
  const raw = input.trim().toUpperCase()
  const crypto = isLikelyCrypto(raw)

  switch (provider) {
    case "alpaca_stock":
      return raw.replace(/\//g, "").replace(/:.*/, "").slice(0, 16)
    case "alpaca_crypto": {
      if (raw.includes("/")) return raw
      const base = raw.replace(/USDT$/i, "").replace(/USD$/i, "") || raw
      return `${base}/USD`
    }
    case "finnhub_crypto": {
      if (raw.startsWith("BINANCE:")) return raw
      let base = raw
      if (raw.includes("/")) {
        base = raw.split("/")[0] ?? raw
      }
      base = base.replace(/USDT$/i, "").replace(/USD$/i, "") || base
      return `BINANCE:${base}USDT`
    }
    case "finnhub_stock": {
      if (crypto) {
        return resolveSymbol(input, "finnhub_crypto")
      }
      return raw.replace(/\//g, "").replace(/:.*/, "").slice(0, 16)
    }
    default:
      return raw
  }
}

/** Exchange hint for TradingView TA microservice (stocks vs crypto). */
export function defaultExchangeForSymbol(symbol: string): string {
  return isLikelyCrypto(symbol) ? "BINANCE" : process.env.DEFAULT_STOCK_EXCHANGE?.trim() || "NASDAQ"
}
