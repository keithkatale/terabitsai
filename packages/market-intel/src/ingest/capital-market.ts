import { CapitalBroker, type CapitalCandle, type CapitalQuote } from "@quant/broker";

let broker: CapitalBroker | null = null;

function getBroker(): CapitalBroker | null {
  try {
    if (!broker) broker = CapitalBroker.fromEnv();
    return broker;
  } catch {
    return null;
  }
}

export async function fetchQuote(symbol: string): Promise<CapitalQuote | null> {
  const b = getBroker();
  if (!b) return null;
  try {
    return await b.fetchQuote(symbol);
  } catch {
    return null;
  }
}

export async function fetchCandles(
  symbol: string,
  resolution: "MINUTE_5" | "MINUTE_15" | "HOUR" | "DAY" = "HOUR",
  max = 200
): Promise<CapitalCandle[]> {
  const b = getBroker();
  if (!b) return [];
  try {
    return await b.fetchCandles(symbol, resolution, max);
  } catch {
    return [];
  }
}

export async function fetchQuotesBatch(symbols: string[]): Promise<Map<string, CapitalQuote>> {
  const out = new Map<string, CapitalQuote>();
  for (const sym of symbols) {
    const q = await fetchQuote(sym);
    if (q) out.set(sym, q);
  }
  return out;
}
