import { detectSMC, type Candle } from "@quant/indicators";
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

function toCandles(raw: CapitalCandle[]): Candle[] {
  return raw.map((c) => ({
    time: c.t,
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
    volume: c.v
  }));
}

export function runSmcStrategy(candles: CapitalCandle[]): StrategySignal[] {
  if (candles.length < 10) return [];
  const smc = detectSMC(toCandles(candles));
  const signals: StrategySignal[] = [];
  const last = candles[candles.length - 1];
  const spot = last.c;

  const activeObs = smc.orderBlocks.filter((ob) => !ob.mitigated).slice(-3);
  for (const ob of activeObs) {
    const inZone = spot >= ob.low && spot <= ob.high;
    if (!inZone) continue;
    const action: SignalAction = ob.type === "BULLISH" ? "BUY" : "SELL";
    signals.push({
      strategy: "SMC_ORDER_BLOCK",
      action,
      timeframe: "1H",
      confidence: 0.72,
      reason: `${ob.type} order block zone — price retesting institutional level`,
      payload: { smc: { orderBlock: ob }, spot }
    });
  }

  const activeFvgs = smc.fvgs.filter((f) => !f.mitigated).slice(-2);
  for (const fvg of activeFvgs) {
    const inGap = spot >= fvg.bottom && spot <= fvg.top;
    if (!inGap) continue;
    signals.push({
      strategy: "SMC_FVG",
      action: fvg.type === "BULLISH" ? "BUY" : "SELL",
      timeframe: "1H",
      confidence: 0.65,
      reason: `${fvg.type} fair value gap — imbalance fill in progress`,
      payload: { smc: { fvg }, spot }
    });
  }

  if (smc.bos) {
    signals.push({
      strategy: "SMC_BOS",
      action: "WATCH",
      timeframe: "4H",
      confidence: 0.6,
      reason: "Break of structure detected — trend continuation likely",
      payload: { smc: { bos: true }, spot }
    });
  }

  if (smc.choch) {
    signals.push({
      strategy: "SMC_CHOCH",
      action: "WATCH",
      timeframe: "4H",
      confidence: 0.58,
      reason: "Change of character — potential trend reversal forming",
      payload: { smc: { choch: true }, spot }
    });
  }

  return signals;
}
