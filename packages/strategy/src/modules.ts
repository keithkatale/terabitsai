import {
  adx,
  atr,
  bollingerBands,
  detectDivergence,
  detectSMC,
  ema,
  ema200,
  emaCrossSignal,
  macd,
  macdSeries,
  obv,
  rsi,
  rsiSeries,
  stochastic,
  vwap,
} from "@quant/indicators";
import type { MtfCandles, ModuleVote, MarketRegime, TradeDirection } from "./types.js";

function biasFromEma(closes: number[]): "bullish" | "bearish" | "neutral" {
  if (closes.length < 50) return "neutral";
  const fast = ema(closes, 20);
  const slow = ema(closes, 50);
  const n = closes.length - 1;
  if (fast[n] > slow[n] * 1.001) return "bullish";
  if (fast[n] < slow[n] * 0.999) return "bearish";
  return "neutral";
}

export function detectRegime(candles: MtfCandles["hour"]): MarketRegime {
  if (candles.length < 30) return "range";
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const closes = candles.map((c) => c.c);
  const adxVal = adx(highs, lows, closes, 14);
  const bb = bollingerBands(closes, 20, 2);
  if (adxVal && adxVal.adx >= 25) return "trend";
  if (bb && bb.bandwidth > 8) return "volatile";
  return "range";
}

export function analyzeTrendModule(candles: MtfCandles["hour"]): ModuleVote {
  const closes = candles.map((c) => c.c);
  const cross = emaCrossSignal(closes, 20, 50);
  const e200 = ema200(closes);
  const spot = closes[closes.length - 1] ?? 0;
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const adxVal = adx(highs, lows, closes, 14);

  let direction: TradeDirection | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  const reasons: string[] = [];

  if (cross === "BULLISH_CROSS") {
    direction = "BUY";
    score += 25;
    reasons.push("EMA 20/50 bullish cross");
  } else if (cross === "BEARISH_CROSS") {
    direction = "SELL";
    score += 25;
    reasons.push("EMA 20/50 bearish cross");
  }

  if (e200 != null) {
    if (spot > e200) {
      if (direction === "BUY" || direction === "NEUTRAL") {
        direction = direction === "NEUTRAL" ? "BUY" : direction;
        score += 15;
        reasons.push("Price above EMA200");
      }
    } else if (spot < e200) {
      if (direction === "SELL" || direction === "NEUTRAL") {
        direction = direction === "NEUTRAL" ? "SELL" : direction;
        score += 15;
        reasons.push("Price below EMA200");
      }
    }
  }

  if (adxVal) {
    if (adxVal.adx >= 25) {
      score += 10;
      reasons.push(`Strong trend ADX ${adxVal.adx.toFixed(1)}`);
      if (adxVal.plusDi > adxVal.minusDi && direction !== "SELL") direction = "BUY";
      if (adxVal.minusDi > adxVal.plusDi && direction !== "BUY") direction = "SELL";
    }
  }

  return {
    module: "trend",
    direction,
    weight: 0.25,
    score: Math.min(100, score),
    reason: reasons.join("; ") || "No clear trend",
  };
}

export function analyzeMomentumModule(candles: MtfCandles["hour"], regime: MarketRegime): ModuleVote {
  const closes = candles.map((c) => c.c);
  const rsiVal = rsi(closes, 14);
  const macdVal = macd(closes);
  const rsiS = rsiSeries(closes, 14);
  const macdS = macdSeries(closes);
  const stoch = stochastic(
    candles.map((c) => c.h),
    candles.map((c) => c.l),
    closes
  );

  let direction: TradeDirection | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  const reasons: string[] = [];

  if (regime === "range" && rsiVal != null) {
    if (rsiVal < 30) {
      direction = "BUY";
      score += 30;
      reasons.push(`RSI oversold ${rsiVal.toFixed(1)}`);
    } else if (rsiVal > 70) {
      direction = "SELL";
      score += 30;
      reasons.push(`RSI overbought ${rsiVal.toFixed(1)}`);
    }
  } else if (macdVal) {
    if (macdVal.histogram > 0) {
      direction = "BUY";
      score += 20;
      reasons.push("MACD histogram positive");
    } else if (macdVal.histogram < 0) {
      direction = "SELL";
      score += 20;
      reasons.push("MACD histogram negative");
    }
  }

  const rsiDiv = detectDivergence(closes, rsiS);
  const macdDiv = detectDivergence(closes, macdS.macd);
  if (rsiDiv === "BULLISH" || macdDiv === "BULLISH") {
    direction = "BUY";
    score += 15;
    reasons.push("Bullish divergence");
  } else if (rsiDiv === "BEARISH" || macdDiv === "BEARISH") {
    direction = "SELL";
    score += 15;
    reasons.push("Bearish divergence");
  }

  if (stoch) {
    if (stoch.k < 20 && stoch.d < 20) {
      if (direction !== "SELL") direction = "BUY";
      score += 10;
      reasons.push("Stochastic oversold");
    } else if (stoch.k > 80 && stoch.d > 80) {
      if (direction !== "BUY") direction = "SELL";
      score += 10;
      reasons.push("Stochastic overbought");
    }
  }

  return {
    module: "momentum",
    direction,
    weight: 0.2,
    score: Math.min(100, score),
    reason: reasons.join("; ") || "Momentum neutral",
  };
}

export function analyzeVolatilityModule(candles: MtfCandles["hour"]): ModuleVote & { atrVal: number | null } {
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const closes = candles.map((c) => c.c);
  const atrVal = atr(highs, lows, closes, 14);
  const bb = bollingerBands(closes, 20, 2);
  const spot = closes[closes.length - 1] ?? 0;

  let direction: TradeDirection | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  const reasons: string[] = [];

  if (bb) {
    if (spot <= bb.lower) {
      direction = "BUY";
      score += 25;
      reasons.push("Price at lower Bollinger band");
    } else if (spot >= bb.upper) {
      direction = "SELL";
      score += 25;
      reasons.push("Price at upper Bollinger band");
    }
  }

  return {
    module: "volatility",
    direction,
    weight: 0.15,
    score: Math.min(100, score),
    reason: reasons.join("; ") || "Volatility neutral",
    atrVal,
  };
}

export function analyzeStructureModule(candles: MtfCandles["hour"]): ModuleVote {
  const smc = detectSMC(
    candles.map((c) => ({ open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v, time: c.t }))
  );
  const spot = candles[candles.length - 1]?.c ?? 0;

  let direction: TradeDirection | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  const reasons: string[] = [];

  for (const ob of smc.orderBlocks.slice(-3)) {
    if (spot >= ob.low && spot <= ob.high) {
      direction = ob.type === "BULLISH" ? "BUY" : "SELL";
      score += 20;
      reasons.push(`${ob.type.toLowerCase()} order block zone`);
      break;
    }
  }

  for (const fvg of smc.fvgs.slice(-3)) {
    const fvgLow = Math.min(fvg.top, fvg.bottom);
    const fvgHigh = Math.max(fvg.top, fvg.bottom);
    if (spot >= fvgLow && spot <= fvgHigh) {
      if (fvg.type === "BULLISH") {
        direction = direction === "SELL" ? "NEUTRAL" : "BUY";
        score += 15;
        reasons.push("Bullish FVG");
      } else {
        direction = direction === "BUY" ? "NEUTRAL" : "SELL";
        score += 15;
        reasons.push("Bearish FVG");
      }
    }
  }

  if (smc.bos) {
    if (direction === "NEUTRAL") {
      direction = spot > candles[candles.length - 2]?.c ? "BUY" : "SELL";
      score += 10;
      reasons.push("Break of structure detected");
    }
  }

  if (smc.choch && direction !== "NEUTRAL") {
    score += 5;
    reasons.push("Change of character confirms shift");
  }

  return {
    module: "structure",
    direction,
    weight: 0.2,
    score: Math.min(100, score),
    reason: reasons.join("; ") || "No SMC setup",
  };
}

export function analyzeVolumeModule(candles: MtfCandles["hour"]): ModuleVote {
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const closes = candles.map((c) => c.c);
  const volumes = candles.map((c) => c.v);
  const vwapVal = vwap(highs, lows, closes, volumes);
  const obvVal = obv(closes, volumes);
  const spot = closes[closes.length - 1] ?? 0;

  let direction: TradeDirection | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  const reasons: string[] = [];

  if (vwapVal != null) {
    if (spot > vwapVal * 1.002) {
      direction = "BUY";
      score += 15;
      reasons.push("Price above VWAP");
    } else if (spot < vwapVal * 0.998) {
      direction = "SELL";
      score += 15;
      reasons.push("Price below VWAP");
    }
  }

  if (obvVal > 0 && direction !== "SELL") {
    score += 10;
    reasons.push("Positive OBV flow");
  } else if (obvVal < 0 && direction !== "BUY") {
    score += 10;
    reasons.push("Negative OBV flow");
  }

  return {
    module: "volume",
    direction,
    weight: 0.1,
    score: Math.min(100, score),
    reason: reasons.join("; ") || "Volume neutral",
  };
}

export function getMtfBias(candles: MtfCandles): {
  bias: "bullish" | "bearish" | "neutral";
  setup: "bullish" | "bearish" | "neutral";
  trigger: "bullish" | "bearish" | "neutral";
} {
  return {
    bias: biasFromEma(candles.day.map((c) => c.c)),
    setup: biasFromEma(candles.hour.map((c) => c.c)),
    trigger: biasFromEma(candles.m15.map((c) => c.c)),
  };
}

export function mtfAgrees(
  direction: TradeDirection,
  mtf: ReturnType<typeof getMtfBias>
): boolean {
  const bullish = direction === "BUY";
  const biasOk = mtf.bias === "neutral" || (bullish ? mtf.bias === "bullish" : mtf.bias === "bearish");
  const setupOk = mtf.setup === "neutral" || (bullish ? mtf.setup === "bullish" : mtf.setup === "bearish");
  const triggerOk = mtf.trigger === "neutral" || (bullish ? mtf.trigger === "bullish" : mtf.trigger === "bearish");
  return biasOk && setupOk && triggerOk;
}
