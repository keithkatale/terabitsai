import { getCompanyDomain } from "@/lib/market/company-domain";

export const FLAG_MAP: Record<string, string> = {
  eur: "eu",
  usd: "us",
  gbp: "gb",
  jpy: "jp",
  aud: "au",
  cad: "ca",
  chf: "ch",
  nzd: "nz",
  cny: "cn",
  hkd: "hk",
  sgd: "sg",
  sek: "se",
  mxn: "mx"
};

const KNOWN_CRYPTOS = new Set([
  "BTC", "ETH", "SOL", "ADA", "XRP", "DOGE", "DOT", "AVAX", "MATIC", "LTC", "LINK", "SHIB", 
  "TRX", "UNI", "XLM", "BCH", "ATOM", "XMR", "ETC", "FIL", "LDO", "HBAR", "NEAR", "APT", 
  "QNT", "VET", "GRT", "FTM", "ALGO", "THETA", "MANA", "SAND", "EOS", "FLOW", "IMX", 
  "CHZ", "APE", "CRV", "GALA", "MKR", "LUNC", "PEPE", "WIF", "BONK", "SUI", "TON", 
  "RNDR", "RUNE", "OP", "ARB", "FET", "AGIX", "FLOKI", "JASMY", "NOT", "ONDO", "SAFE", 
  "AR", "PYTH", "BRETT", "STRK", "ENS", "CORE", "PENDLE", "JUP", "SEI", "MINA", "BEAM", 
  "BGB", "BTT", "ENA", "TIA", "KAS", "ORDI", "INJ", "AEVO", "DYDX", "COMP"
]);

/**
 * Robust centralized generator for rotating multi-CDN logo sources.
 */
export function getAssetLogoUrls(
  symbol: string,
  domain?: string | null,
  assetClass?: string | null,
  sector?: string | null
): string[] {
  const urls: string[] = [];
  const sym = symbol.toUpperCase();
  const cls = assetClass?.toLowerCase();
  const sec = sector?.toLowerCase();

  // 1. Forex Flags
  if (
    sec === "forex" ||
    (sym.length === 6 &&
      (sym.startsWith("EUR") ||
        sym.startsWith("USD") ||
        sym.startsWith("GBP") ||
        sym.startsWith("JPY") ||
        sym.startsWith("AUD") ||
        sym.startsWith("CAD") ||
        sym.startsWith("CHF") ||
        sym.startsWith("NZD")))
  ) {
    const baseCurrency = sym.substring(0, 3).toLowerCase();
    const flagCode = FLAG_MAP[baseCurrency];
    if (flagCode) {
      urls.push(`https://flagcdn.com/w80/${flagCode}.png`);
    }
  }

  // 2. Cryptocurrencies
  if (cls === "crypto" || KNOWN_CRYPTOS.has(sym) || sym.endsWith("USD") || sym.endsWith("-USD")) {
    const coin = sym.replace("USD", "").replace("-USD", "").toLowerCase();
    urls.push(
      `https://assets.coincap.io/assets/icons/${coin}@2x.png`,
      `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${coin}.png`,
      `https://raw.githubusercontent.com/bybit-exchange/assets/master/crypto/color/${coin}.png`
    );
  }

  // 3. Stocks & ETFs
  if (cls === "stock" || cls === "etf" || (!cls && !sec)) {
    const resolvedDomain = domain || getCompanyDomain(sym);
    if (resolvedDomain) {
      const d = resolvedDomain.trim().toLowerCase();
      urls.push(
        `https://logo.clearbit.com/${d}`,
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`,
        `https://icons.duckduckgo.com/ip3/${d}.ico`
      );
    }
  }

  // Deduplicate and filter empty
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

/**
 * Ordered third-party logo URLs. If all fail, UI should show ticker initials.
 * Left for backwards compatibility, delegates to getAssetLogoUrls.
 */
export function companyLogoSources(
  domain: string,
  ticker?: string,
  finnhubLogo?: string | null,
  assetClass?: string
): string[] {
  const raw: string[] = [];

  const hub = finnhubLogo?.trim();
  if (hub && /^https?:\/\//i.test(hub)) {
    raw.push(hub);
  }

  if (ticker) {
    raw.push(...getAssetLogoUrls(ticker, domain, assetClass));
  } else if (domain) {
    const d = domain.trim().toLowerCase();
    raw.push(
      `https://logo.clearbit.com/${d}`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${d}.ico`
    );
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of raw) {
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}
