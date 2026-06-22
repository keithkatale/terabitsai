import { CapitalBroker } from "@quant/broker";
import type { MtfCandles } from "./types.js";

const cache = new Map<string, { at: number; data: MtfCandles }>();
const CACHE_TTL_MS = 60_000;

export async function fetchMtfCandles(
  broker: CapitalBroker,
  symbol: string
): Promise<MtfCandles> {
  const key = symbol;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const [day, hour, m15] = await Promise.all([
    broker.fetchCandles(symbol, "DAY", 120),
    broker.fetchCandles(symbol, "HOUR", 200),
    broker.fetchCandles(symbol, "MINUTE_15", 120),
  ]);

  const data: MtfCandles = { symbol, day, hour, m15 };
  cache.set(key, { at: Date.now(), data });
  return data;
}

export function clearMtfCache(symbol?: string): void {
  if (symbol) cache.delete(symbol);
  else cache.clear();
}
