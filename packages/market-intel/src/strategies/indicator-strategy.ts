import { emaCrossSignal, macd, rsi } from "@quant/indicators";
import type { SignalAction } from "@quant/contracts";
import type { CapitalCandle } from "@quant/broker";

export type StrategySignal = {
  strategy: string;
  action: SignalAction;
  timeframe: string;
  confidence: number;
  reason: string;
  payload: Record<string, unknown>;
};

export function runIndicatorStrategy(candles: CapitalCandle[]): StrategySignal[] {
  if (candles.length < 30) return [];
  const closes = candles.map((c) => c.c);
  const signals: StrategySignal[] = [];
  const spot = closes[closes.length - 1];

  const rsiVal = rsi(closes, 14);
  if (rsiVal != null) {
    if (rsiVal < 30) {
      signals.push({
        strategy: "RSI_FADE",
        action: "BUY",
        timeframe: "1H",
        confidence: 0.68,
        reason: `RSI oversold at ${rsiVal.toFixed(1)} — mean-reversion setup`,
        payload: { rsi: rsiVal, spot }
      });
    } else if (rsiVal > 70) {
      signals.push({
        strategy: "RSI_FADE",
        action: "SELL",
        timeframe: "1H",
        confidence: 0.68,
        reason: `RSI overbought at ${rsiVal.toFixed(1)} — fade extension`,
        payload: { rsi: rsiVal, spot }
      });
    }
  }

  const cross = emaCrossSignal(closes, 20, 50);
  if (cross === "BULLISH_CROSS") {
    signals.push({
      strategy: "EMA_CROSS",
      action: "BUY",
      timeframe: "4H",
      confidence: 0.7,
      reason: "EMA 20/50 golden cross — momentum shift bullish",
      payload: { emaCross: cross, spot }
    });
  } else if (cross === "BEARISH_CROSS") {
    signals.push({
      strategy: "EMA_CROSS",
      action: "SELL",
      timeframe: "4H",
      confidence: 0.7,
      reason: "EMA 20/50 death cross — momentum shift bearish",
      payload: { emaCross: cross, spot }
    });
  }

  const macdVal = macd(closes);
  if (macdVal && Math.abs(macdVal.histogram) > 0) {
    const prevMacd = macd(closes.slice(0, -1));
    if (prevMacd && prevMacd.histogram < 0 && macdVal.histogram > 0) {
      signals.push({
        strategy: "MACD_CROSS",
        action: "BUY",
        timeframe: "1H",
        confidence: 0.66,
        reason: "MACD histogram bullish crossover",
        payload: { macd: macdVal, spot }
      });
    } else if (prevMacd && prevMacd.histogram > 0 && macdVal.histogram < 0) {
      signals.push({
        strategy: "MACD_CROSS",
        action: "SELL",
        timeframe: "1H",
        confidence: 0.66,
        reason: "MACD histogram bearish crossover",
        payload: { macd: macdVal, spot }
      });
    }
  }

  return signals;
}
