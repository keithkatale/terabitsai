/**
 * Alpaca Market Data v2 — historical bars (server-side only).
 */

const DEFAULT_BASE = "https://data.alpaca.markets"

export interface AlpacaBar {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

function credentials(): { keyId: string; secret: string } | null {
  const keyId =
    process.env.ALPACA_API_KEY_ID?.trim() ||
    process.env.ALPACA_API_KEY?.trim() ||
    ""
  const secret =
    process.env.ALPACA_API_SECRET_KEY?.trim() ||
    process.env.ALPACA_SECRET_KEY?.trim() ||
    ""
  if (!keyId || !secret) return null
  return { keyId, secret }
}

function baseUrl(): string {
  return (
    process.env.ALPACA_DATA_BASE_URL?.trim()?.replace(/\/$/, "") ||
    DEFAULT_BASE
  )
}

/** Map UI timeframe hints to Alpaca `timeframe` query param. */
export function mapTimeframeToAlpaca(tf: string): string {
  const t = tf.trim().toLowerCase()
  if (t === "1m" || t === "1min") return "1Min"
  if (t === "5m" || t === "5min") return "5Min"
  if (t === "15m" || t === "15min") return "15Min"
  if (t === "1h" || t === "60m") return "1Hour"
  if (t === "4h") return "4Hour"
  if (t === "1d" || t === "1day" || t === "d") return "1Day"
  if (t === "1w" || t === "1week" || t === "w") return "1Week"
  return "1Day"
}

export async function getAlpacaBars(
  symbol: string,
  timeframe: string,
  limit = 120,
): Promise<{ bars: AlpacaBar[]; symbol: string } | null> {
  const auth = credentials()
  if (!auth) return null
  const sym = symbol.trim().toUpperCase()
  const tf = mapTimeframeToAlpaca(timeframe)
  const cap = Math.min(1000, Math.max(1, Math.floor(limit)))
  const url = `${baseUrl()}/v2/stocks/${encodeURIComponent(sym)}/bars?timeframe=${encodeURIComponent(tf)}&limit=${cap}&adjustment=raw&feed=iex`

  const res = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": auth.keyId,
      "APCA-API-SECRET-KEY": auth.secret,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.warn("[alpaca] bars failed", res.status, body.slice(0, 200))
    return null
  }
  const data = (await res.json()) as {
    bars?: Array<{
      t: string
      o: number
      h: number
      l: number
      c: number
      v: number
    }>
    symbol?: string
  }
  const bars = (data.bars ?? []).map((b) => ({
    t: b.t,
    o: b.o,
    h: b.h,
    l: b.l,
    c: b.c,
    v: b.v,
  }))
  return { bars, symbol: data.symbol ?? sym }
}

/**
 * Alpaca crypto bars (US crypto feed) — symbols like BTC/USD, ETH/USD.
 * Endpoint: /v1beta3/crypto/us/bars
 */
export async function getAlpacaCryptoBars(
  symbol: string,
  timeframe: string,
  limit = 120,
): Promise<{ bars: AlpacaBar[]; symbol: string } | null> {
  const auth = credentials()
  if (!auth) return null
  const raw = symbol.trim().toUpperCase()
  const sym =
    raw.includes("/") ? raw : `${raw.replace(/USD$/, "")}/USD`
  const tf = mapTimeframeToAlpaca(timeframe)
  const cap = Math.min(1000, Math.max(1, Math.floor(limit)))
  const url = `${baseUrl()}/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(tf)}&limit=${cap}`

  const res = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": auth.keyId,
      "APCA-API-SECRET-KEY": auth.secret,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.warn("[alpaca] crypto bars failed", res.status, body.slice(0, 200))
    return null
  }
  const data = (await res.json()) as {
    bars?: Record<
      string,
      Array<{
        t: string
        o: number
        h: number
        l: number
        c: number
        v: number
      }>
    >
  }
  const keyed = data.bars?.[sym] ?? data.bars?.[symbol.trim()] ?? []
  const bars = keyed.map((b) => ({
    t: b.t,
    o: b.o,
    h: b.h,
    l: b.l,
    c: b.c,
    v: b.v,
  }))
  return { bars, symbol: sym }
}
