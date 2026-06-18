/**
 * Server-side Finnhub quotes for Terabits signal pipeline (no browser exposure).
 */

const BASE_URL = "https://finnhub.io/api/v1"

export interface Quote {
  c: number
  d: number
  dp: number
  h: number
  l: number
  o: number
  pc: number
  t: number
}

function apiToken(): string {
  const key =
    process.env.FINNHUB_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_FINNHUB_API_KEY?.trim()
  return key ?? ""
}

let lastRequestTime = 0
const MIN_REQUEST_INTERVAL_MS = 120

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now()
  const delta = now - lastRequestTime
  if (delta < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((r) =>
      setTimeout(r, MIN_REQUEST_INTERVAL_MS - delta),
    )
  }
  lastRequestTime = Date.now()
  return fetch(url)
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const token = apiToken()
  if (!token) return null
  const res = await rateLimitedFetch(
    `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`,
  )
  if (!res.ok) return null
  const data = (await res.json()) as Quote
  if (data.c === 0 && data.d === null) return null
  return data
}

export interface CandleResponse {
  s: string
  t: number[]
  o: number[]
  h: number[]
  l: number[]
  c: number[]
  v: number[]
}

/** Finnhub candlesticks: resolution 1, 5, 15, 30, 60, D, W */
export async function getStockCandles(
  symbol: string,
  resolution: string,
  fromUnix: number,
  toUnix: number,
): Promise<CandleResponse | null> {
  const token = apiToken()
  if (!token) return null
  const sym = symbol.trim().toUpperCase()
  const url = `${BASE_URL}/stock/candle?symbol=${encodeURIComponent(sym)}&resolution=${encodeURIComponent(resolution)}&from=${fromUnix}&to=${toUnix}&token=${encodeURIComponent(token)}`
  const res = await rateLimitedFetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as CandleResponse
  if (data.s !== "ok" || !Array.isArray(data.c)) return null
  return data
}

/**
 * Finnhub crypto candles — symbols like BINANCE:BTCUSDT, BINANCE:ETHUSDT.
 * Resolution same as stocks: 1, 5, 15, 30, 60, D, W.
 */
export async function getCryptoCandles(
  symbol: string,
  resolution: string,
  fromUnix: number,
  toUnix: number,
): Promise<CandleResponse | null> {
  const token = apiToken()
  if (!token) return null
  const sym = symbol.trim().toUpperCase()
  const url = `${BASE_URL}/crypto/candle?symbol=${encodeURIComponent(sym)}&resolution=${encodeURIComponent(resolution)}&from=${fromUnix}&to=${toUnix}&token=${encodeURIComponent(token)}`
  const res = await rateLimitedFetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as CandleResponse
  if (data.s !== "ok" || !Array.isArray(data.c)) return null
  return data
}

export async function fetchWatchlistQuotes(
  symbols: string[],
): Promise<
  Array<{
    symbol: string
    price: number | null
    change_pct: number | null
  }>
> {
  const out: Array<{
    symbol: string
    price: number | null
    change_pct: number | null
  }> = []
  for (const symbol of symbols) {
    try {
      const q = await getQuote(symbol)
      out.push({
        symbol,
        price: q?.c ?? null,
        change_pct: q?.dp ?? null,
      })
    } catch {
      out.push({ symbol, price: null, change_pct: null })
    }
  }
  return out
}
