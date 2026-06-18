/**
 * Programmatic technical summary — prefers optional TradingView-TA microservice,
 * otherwise derives RSI / trend hints from Finnhub candles.
 */

import { getCryptoCandles, getStockCandles } from "@/lib/market/finnhub-client"
import { isLikelyCrypto, resolveSymbol } from "@/lib/market/symbol-utils"
import { rsi as wildersRsiLib, sma as smaLib } from "@/lib/scanner/indicators"

export type TvInterval =
  | "1m"
  | "5m"
  | "15m"
  | "1h"
  | "4h"
  | "1d"
  | "1W"

function intervalToFinnhubResolution(
  interval: TvInterval,
): "1" | "5" | "15" | "60" | "D" | "W" {
  switch (interval) {
    case "1m":
      return "1"
    case "5m":
      return "5"
    case "15m":
      return "15"
    case "1h":
      return "60"
    case "4h":
      return "60"
    case "1d":
      return "D"
    case "1W":
      return "W"
    default:
      return "D"
  }
}

async function fetchFromTradingViewTaService(
  symbol: string,
  exchange: string,
  interval: TvInterval,
): Promise<Record<string, unknown> | null> {
  const base = process.env.TRADINGVIEW_TA_SERVICE_URL?.trim()
  if (!base) return null
  const url = `${base.replace(/\/$/, "")}/analyze`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol: symbol.trim().toUpperCase(),
      exchange: exchange.trim(),
      interval,
    }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) return null
  return (await res.json()) as Record<string, unknown>
}

export async function getTradingViewAnalysis(
  symbol: string,
  exchange: string,
  interval: TvInterval,
): Promise<{
  source: "tradingview_ta_service" | "finnhub_fallback"
  summary: { recommendation: string; buy: number; sell: number; neutral: number }
  oscillators: Record<string, { value: number; signal: string }>
  moving_averages: Record<string, { value: number; signal: string }>
  notes?: string[]
}> {
  const remote = await fetchFromTradingViewTaService(symbol, exchange, interval)
  if (remote && typeof remote === "object" && remote.summary) {
    const s = remote.summary as Record<string, unknown>
    return {
      source: "tradingview_ta_service",
      summary: {
        recommendation: String(s.recommendation ?? "NEUTRAL"),
        buy: Number(s.buy ?? 0),
        sell: Number(s.sell ?? 0),
        neutral: Number(s.neutral ?? 0),
      },
      oscillators: (remote.oscillators ?? {}) as Record<
        string,
        { value: number; signal: string }
      >,
      moving_averages: (remote.moving_averages ?? {}) as Record<
        string,
        { value: number; signal: string }
      >,
      notes: Array.isArray(remote.notes)
        ? remote.notes.map((x) => String(x))
        : undefined,
    }
  }

  const res = intervalToFinnhubResolution(interval)
  const to = Math.floor(Date.now() / 1000)
  const span =
    res === "W"
      ? 86400 * 365
      : res === "D"
        ? 86400 * 400
        : res === "60"
          ? 86400 * 120
          : 86400 * 14
  const from = to - span
  const crypto = isLikelyCrypto(symbol)
  const fhSym = crypto
    ? resolveSymbol(symbol, "finnhub_crypto")
    : resolveSymbol(symbol, "finnhub_stock")
  const candles = crypto
    ? await getCryptoCandles(fhSym, res, from, to)
    : await getStockCandles(fhSym, res, from, to)
  const closes =
    candles?.c?.filter((x) => typeof x === "number" && Number.isFinite(x)) ?? []
  const rsi = wildersRsiLib(closes)
  const ma50 = smaLib(closes, 50)
  const ma200 = smaLib(closes, 200)
  const last = closes.length ? closes[closes.length - 1]! : null

  let recommendation = "NEUTRAL"
  let buy = 0
  let sell = 0
  let neutral = 1
  const notes: string[] = []

  if (rsi != null) {
    notes.push(`RSI(14) ≈ ${rsi.toFixed(1)}`)
    if (rsi < 30) {
      recommendation = "BUY"
      buy = 1
      neutral = 0
    } else if (rsi > 70) {
      recommendation = "SELL"
      sell = 1
      neutral = 0
    }
  }
  if (last != null && ma50 != null && ma200 != null) {
    notes.push(`SMA50 ${ma50.toFixed(2)} vs SMA200 ${ma200.toFixed(2)}`)
    if (last > ma50 && ma50 > ma200 && recommendation === "NEUTRAL") {
      recommendation = "BUY"
      buy = 1
      neutral = 0
    }
    if (last < ma50 && ma50 < ma200 && recommendation === "NEUTRAL") {
      recommendation = "SELL"
      sell = 1
      neutral = 0
    }
  }

  if (notes.length === 0) {
    notes.push(
      "Insufficient Finnhub history for indicators — configure TRADINGVIEW_TA_SERVICE_URL for full TradingView-TA parity.",
    )
  }

  const oscillators: Record<string, { value: number; signal: string }> = {}
  if (rsi != null) {
    oscillators.RSI = {
      value: rsi,
      signal:
        rsi > 70 ? "overbought" : rsi < 30 ? "oversold" : "neutral",
    }
  }

  const moving_averages: Record<string, { value: number; signal: string }> = {}
  if (ma50 != null && last != null) {
    moving_averages.SMA_50 = {
      value: ma50,
      signal: last >= ma50 ? "price_above" : "price_below",
    }
  }
  if (ma200 != null && last != null) {
    moving_averages.SMA_200 = {
      value: ma200,
      signal: last >= ma200 ? "price_above" : "price_below",
    }
  }

  return {
    source: "finnhub_fallback",
    summary: { recommendation, buy, sell, neutral },
    oscillators,
    moving_averages,
    notes,
  }
}
