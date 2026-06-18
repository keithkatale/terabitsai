export interface Candle {
  time: number; // unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FVG {
  startIndex: number; // index of Candle 1
  endIndex: number;   // index of Candle 3
  type: "BULLISH" | "BEARISH";
  top: number;
  bottom: number;
  mitigated: boolean;
  mitigatedAt?: number; // timestamp or index
}

export interface OrderBlock {
  candleIndex: number;
  type: "BULLISH" | "BEARISH";
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  mitigated: boolean;
}

export interface MarketStructureResult {
  fvgs: FVG[];
  orderBlocks: OrderBlock[];
  bos: boolean;
  choch: boolean;
}

/**
 * Detects Smart Money Concepts (SMC) structural indicators from candle charts.
 */
export function detectSMC(candles: Candle[]): MarketStructureResult {
  const fvgs: FVG[] = [];
  const orderBlocks: OrderBlock[] = [];
  let bos = false;
  let choch = false;

  if (candles.length < 3) {
    return { fvgs, orderBlocks, bos, choch };
  }

  // 1. Detect Fair Value Gaps (FVG)
  for (let i = 0; i < candles.length - 2; i++) {
    const c1 = candles[i];
    const c2 = candles[i + 1];
    const c3 = candles[i + 2];

    // Bullish FVG (Imbalance of Buyers)
    if (c3.low > c1.high) {
      // Large green second candle indicates rapid expansion
      if (c2.close > c2.open) {
        fvgs.push({
          startIndex: i,
          endIndex: i + 2,
          type: "BULLISH",
          top: c3.low,
          bottom: c1.high,
          mitigated: false
        });
      }
    }

    // Bearish FVG (Imbalance of Sellers)
    if (c3.high < c1.low) {
      // Large red second candle indicates rapid expansion
      if (c2.close < c2.open) {
        fvgs.push({
          startIndex: i,
          endIndex: i + 2,
          type: "BEARISH",
          top: c1.low,
          bottom: c3.high,
          mitigated: false
        });
      }
    }
  }

  // Check for FVG mitigation by subsequent candles
  for (const fvg of fvgs) {
    for (let j = fvg.endIndex + 1; j < candles.length; j++) {
      const candle = candles[j];
      if (fvg.type === "BULLISH") {
        if (candle.low <= fvg.bottom) {
          fvg.mitigated = true;
          fvg.mitigatedAt = j;
          break;
        }
      } else {
        if (candle.high >= fvg.top) {
          fvg.mitigated = true;
          fvg.mitigatedAt = j;
          break;
        }
      }
    }
  }

  // 2. Detect Order Blocks (OB)
  // A Bullish OB is the last bearish candle before a strong bullish impulse
  // A Bearish OB is the last bullish candle before a strong bearish impulse
  for (let i = 1; i < candles.length - 3; i++) {
    const cCurr = candles[i];
    const nextCandles = candles.slice(i + 1, i + 4);

    // Calculate strong bullish expansion
    const isBullishImpulse = nextCandles.every(c => c.close > c.open) && 
      (nextCandles[2].close - nextCandles[0].open > (candles[i].high - candles[i].low) * 1.5);

    // Calculate strong bearish expansion
    const isBearishImpulse = nextCandles.every(c => c.close < c.open) &&
      (nextCandles[0].open - nextCandles[2].close > (candles[i].high - candles[i].low) * 1.5);

    // Bullish OB
    if (cCurr.close < cCurr.open && isBullishImpulse) {
      orderBlocks.push({
        candleIndex: i,
        type: "BULLISH",
        open: cCurr.open,
        high: cCurr.high,
        low: cCurr.low,
        close: cCurr.close,
        volume: cCurr.volume,
        mitigated: false
      });
    }

    // Bearish OB
    if (cCurr.close > cCurr.open && isBearishImpulse) {
      orderBlocks.push({
        candleIndex: i,
        type: "BEARISH",
        open: cCurr.open,
        high: cCurr.high,
        low: cCurr.low,
        close: cCurr.close,
        volume: cCurr.volume,
        mitigated: false
      });
    }
  }

  // Check OB mitigation by subsequent candles
  for (const ob of orderBlocks) {
    for (let j = ob.candleIndex + 4; j < candles.length; j++) {
      const candle = candles[j];
      if (ob.type === "BULLISH") {
        if (candle.low <= ob.open) {
          ob.mitigated = true;
          break;
        }
      } else {
        if (candle.high >= ob.open) {
          ob.mitigated = true;
          break;
        }
      }
    }
  }

  // 3. Simple Market Structure Checks (BOS/CHOCH)
  // Let's assume BOS and CHOCH are true if we break swing points in recent history
  if (candles.length >= 10) {
    const lastThree = candles.slice(-3);
    const prevSeven = candles.slice(-10, -3);

    const prevSevenHigh = Math.max(...prevSeven.map(c => c.high));
    const prevSevenLow = Math.min(...prevSeven.map(c => c.low));

    const currentHigh = Math.max(...lastThree.map(c => c.high));
    const currentLow = Math.min(...lastThree.map(c => c.low));

    if (currentHigh > prevSevenHigh) {
      bos = true; // Broken previous range high
    }
    if (currentLow < prevSevenLow) {
      choch = true; // Broken previous range low (first structural shift)
    }
  }

  return { fvgs, orderBlocks, bos, choch };
}
