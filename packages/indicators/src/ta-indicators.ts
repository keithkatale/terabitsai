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

export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    out.push(sum / period);
  }
  return out;
}

export function rsiSeries(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function rsi(closes: number[], period = 14): number | null {
  const series = rsiSeries(closes, period);
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return series[i];
  }
  return null;
}

export function macdSeries(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const macd: (number | null)[] = new Array(closes.length).fill(null);
  const signal: (number | null)[] = new Array(closes.length).fill(null);
  const histogram: (number | null)[] = new Array(closes.length).fill(null);

  if (closes.length < slow) return { macd, signal, histogram };

  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(fastEma[i] - slowEma[i]);
    macd[i] = macdLine[i];
  }

  const signalLine = ema(macdLine, signalPeriod);
  for (let i = 0; i < closes.length; i++) {
    signal[i] = signalLine[i];
    if (macd[i] != null && signal[i] != null) {
      histogram[i] = macd[i]! - signal[i]!;
    }
  }
  return { macd, signal, histogram };
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: number; signal: number; histogram: number } | null {
  const series = macdSeries(closes, fast, slow, signal);
  const last = closes.length - 1;
  const m = series.macd[last];
  const s = series.signal[last];
  const h = series.histogram[last];
  if (m == null || s == null || h == null) return null;
  return { macd: m, signal: s, histogram: h };
}

export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number | null {
  const series = atrSeries(highs, lows, closes, period);
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return series[i];
  }
  return null;
}

export function atrSeries(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;

  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }

  let atrVal = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period] = atrVal;
  for (let i = period; i < trs.length; i++) {
    atrVal = (atrVal * (period - 1) + trs[i]) / period;
    out[i + 1] = atrVal;
  }
  return out;
}

export function adx(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): { adx: number; plusDi: number; minusDi: number } | null {
  const result = adxSeries(highs, lows, closes, period);
  const last = closes.length - 1;
  if (result.adx[last] == null) return null;
  return {
    adx: result.adx[last]!,
    plusDi: result.plusDi[last] ?? 0,
    minusDi: result.minusDi[last] ?? 0,
  };
}

export function adxSeries(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): { adx: (number | null)[]; plusDi: (number | null)[]; minusDi: (number | null)[] } {
  const len = closes.length;
  const adxOut: (number | null)[] = new Array(len).fill(null);
  const plusDi: (number | null)[] = new Array(len).fill(null);
  const minusDi: (number | null)[] = new Array(len).fill(null);

  if (len < period * 2) return { adx: adxOut, plusDi, minusDi };

  const plusDm: number[] = [];
  const minusDm: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < len; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
  }

  let smoothTr = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlus = plusDm.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinus = minusDm.slice(0, period).reduce((a, b) => a + b, 0);

  const dx: number[] = [];
  for (let i = period; i < tr.length; i++) {
    if (i > period) {
      smoothTr = smoothTr - smoothTr / period + tr[i];
      smoothPlus = smoothPlus - smoothPlus / period + plusDm[i];
      smoothMinus = smoothMinus - smoothMinus / period + minusDm[i];
    }
    const pdi = smoothTr === 0 ? 0 : (100 * smoothPlus) / smoothTr;
    const mdi = smoothTr === 0 ? 0 : (100 * smoothMinus) / smoothTr;
    plusDi[i + 1] = pdi;
    minusDi[i + 1] = mdi;
    const sum = pdi + mdi;
    dx.push(sum === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / sum);
  }

  if (dx.length < period) return { adx: adxOut, plusDi, minusDi };

  let adxVal = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  adxOut[period * 2] = adxVal;
  for (let i = period; i < dx.length; i++) {
    adxVal = (adxVal * (period - 1) + dx[i]) / period;
    adxOut[i + period + 1] = adxVal;
  }

  return { adx: adxOut, plusDi, minusDi };
}

export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod = 14,
  dPeriod = 3
): { k: number; d: number } | null {
  if (closes.length < kPeriod + dPeriod) return null;
  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < closes.length; i++) {
    const sliceH = highs.slice(i - kPeriod + 1, i + 1);
    const sliceL = lows.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...sliceH);
    const lowest = Math.min(...sliceL);
    const range = highest - lowest;
    kValues.push(range === 0 ? 50 : ((closes[i] - lowest) / range) * 100);
  }
  const dValues = sma(kValues, dPeriod).filter((v) => !Number.isNaN(v));
  if (kValues.length === 0 || dValues.length === 0) return null;
  return { k: kValues[kValues.length - 1], d: dValues[dValues.length - 1] };
}

export function bollingerBands(
  closes: number[],
  period = 20,
  stdDev = 2
): { upper: number; middle: number; lower: number; bandwidth: number } | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, v) => sum + (v - middle) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = middle + stdDev * sd;
  const lower = middle - stdDev * sd;
  const bandwidth = middle === 0 ? 0 : ((upper - lower) / middle) * 100;
  return { upper, middle, lower, bandwidth };
}

export function vwap(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[]
): number | null {
  if (closes.length === 0) return null;
  let cumVol = 0;
  let cumTpVol = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    const vol = volumes[i] ?? 0;
    cumVol += vol;
    cumTpVol += tp * vol;
  }
  return cumVol === 0 ? closes[closes.length - 1] : cumTpVol / cumVol;
}

export function obv(closes: number[], volumes: number[]): number {
  if (closes.length < 2) return volumes[0] ?? 0;
  let total = 0;
  for (let i = 1; i < closes.length; i++) {
    const vol = volumes[i] ?? 0;
    if (closes[i] > closes[i - 1]) total += vol;
    else if (closes[i] < closes[i - 1]) total -= vol;
  }
  return total;
}

export function detectDivergence(
  prices: number[],
  indicator: (number | null)[],
  lookback = 20
): "BULLISH" | "BEARISH" | "NONE" {
  if (prices.length < lookback) return "NONE";
  const start = prices.length - lookback;
  const priceSlice = prices.slice(start);
  const indSlice = indicator.slice(start).filter((v): v is number => v != null);
  if (indSlice.length < 4) return "NONE";

  const priceLow1 = Math.min(...priceSlice.slice(0, Math.floor(lookback / 2)));
  const priceLow2 = Math.min(...priceSlice.slice(Math.floor(lookback / 2)));
  const priceHigh1 = Math.max(...priceSlice.slice(0, Math.floor(lookback / 2)));
  const priceHigh2 = Math.max(...priceSlice.slice(Math.floor(lookback / 2)));

  const indLow1 = Math.min(...indSlice.slice(0, Math.floor(indSlice.length / 2)));
  const indLow2 = Math.min(...indSlice.slice(Math.floor(indSlice.length / 2)));
  const indHigh1 = Math.max(...indSlice.slice(0, Math.floor(indSlice.length / 2)));
  const indHigh2 = Math.max(...indSlice.slice(Math.floor(indSlice.length / 2)));

  if (priceLow2 < priceLow1 && indLow2 > indLow1) return "BULLISH";
  if (priceHigh2 > priceHigh1 && indHigh2 < indHigh1) return "BEARISH";
  return "NONE";
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

export function ema200(closes: number[]): number | null {
  if (closes.length < 200) return null;
  const series = ema(closes, 200);
  return series[series.length - 1];
}
