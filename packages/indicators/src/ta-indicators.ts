/**
 * Classic technical indicators for strategy engines.
 */

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < slow + signal) return null;
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(fastEma[i] - slowEma[i]);
  }
  const signalLine = ema(macdLine, signal);
  const last = macdLine.length - 1;
  const m = macdLine[last];
  const s = signalLine[last];
  return { macd: m, signal: s, histogram: m - s };
}

export function emaCrossSignal(
  closes: number[],
  fastPeriod = 20,
  slowPeriod = 50
): "BULLISH_CROSS" | "BEARISH_CROSS" | "NONE" {
  if (closes.length < slowPeriod + 2) return "NONE";
  const fast = ema(closes, fastPeriod);
  const slow = ema(closes, slowPeriod);
  const n = closes.length - 1;
  const prevFast = fast[n - 1];
  const prevSlow = slow[n - 1];
  const curFast = fast[n];
  const curSlow = slow[n];
  if (prevFast <= prevSlow && curFast > curSlow) return "BULLISH_CROSS";
  if (prevFast >= prevSlow && curFast < curSlow) return "BEARISH_CROSS";
  return "NONE";
}
