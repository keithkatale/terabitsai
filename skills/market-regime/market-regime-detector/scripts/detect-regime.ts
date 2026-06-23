/**
 * Market Regime Detector
 * Classifies market as uptrend, downtrend, or ranging
 * Autonomous skill for Terabits Trading Agent
 */

interface RegimeDetectorInput {
  symbols: string[];          // e.g., ['SPY', 'QQQ', 'BTCUSD']
  timeframes: string[];       // e.g., ['1D', '1W']
  lookback: number;           // bars to analyze (default 200)
}

interface RegimeDetectorOutput {
  regime: 'uptrend' | 'downtrend' | 'ranging';
  confidence: number;         // 0-100
  reasoning: string;
  recommended_strategy: string;
  symbol_breakdown: SymbolRegime[];
  next_review: string;        // ISO timestamp
}

interface SymbolRegime {
  symbol: string;
  regime: 'uptrend' | 'downtrend' | 'ranging';
  score: number;              // -5 to +5
  details: {
    price: number;
    sma20: number;
    sma50: number;
    sma200: number;
    adx: number;
    atr: number;
  };
}

export async function detectMarketRegime(
  input: RegimeDetectorInput
): Promise<RegimeDetectorOutput> {
  const symbolResults: SymbolRegime[] = [];

  // Analyze each symbol
  for (const symbol of input.symbols) {
    const result = await analyzeSymbolRegime(symbol, input.timeframes, input.lookback);
    symbolResults.push(result);
  }

  // Aggregate breadth
  const uptrendCount = symbolResults.filter(r => r.regime === 'uptrend').length;
  const downtrendCount = symbolResults.filter(r => r.regime === 'downtrend').length;

  let overallRegime: 'uptrend' | 'downtrend' | 'ranging';
  if (uptrendCount >= 2) {
    overallRegime = 'uptrend';
  } else if (downtrendCount >= 2) {
    overallRegime = 'downtrend';
  } else {
    overallRegime = 'ranging';
  }

  // Calculate confidence
  const maxAgreement = Math.max(uptrendCount, downtrendCount, input.symbols.length - uptrendCount - downtrendCount);
  const confidence = Math.round((maxAgreement / input.symbols.length) * 100);

  // Generate reasoning
  const reasoning = generateReasoning(symbolResults, overallRegime);

  // Recommend strategy
  const recommended_strategy = getRecommendedStrategy(overallRegime, confidence);

  return {
    regime: overallRegime,
    confidence,
    reasoning,
    recommended_strategy,
    symbol_breakdown: symbolResults,
    next_review: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
}

async function analyzeSymbolRegime(
  symbol: string,
  timeframes: string[],
  lookback: number
): Promise<SymbolRegime> {
  // Fetch OHLCV data from Capital.com
  const dailyData = await fetchCandles(symbol, '1D', lookback);
  const weeklyData = timeframes.includes('1W') ? await fetchCandles(symbol, '1W', 52) : null;

  // Calculate indicators
  const closes = dailyData.map(c => c.close);
  const highs = dailyData.map(c => c.high);
  const lows = dailyData.map(c => c.low);

  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const adx = calculateADX(highs, lows, closes, 14);
  const atr = calculateATR(highs, lows, closes, 14);

  const currentPrice = closes[closes.length - 1];

  // Score 5 criteria
  let score = 0;

  // 1. Price vs 200 SMA
  score += currentPrice > sma200[sma200.length - 1] ? 1 : -1;

  // 2. MA Alignment
  const bullishAlignment = sma20[sma20.length - 1] > sma50[sma50.length - 1] && sma50[sma50.length - 1] > sma200[sma200.length - 1];
  const bearishAlignment = sma20[sma20.length - 1] < sma50[sma50.length - 1] && sma50[sma50.length - 1] < sma200[sma200.length - 1];
  score += bullishAlignment ? 1 : (bearishAlignment ? -1 : 0);

  // 3. ADX Trend Strength
  const currentADX = adx[adx.length - 1];
  if (currentADX >= 25) {
    const recentSlope = (closes[closes.length - 1] - closes[closes.length - 20]) / closes[closes.length - 20];
    score += recentSlope > 0 ? 1 : -1;
  }

  // 4. Higher Highs / Lower Lows
  const hhll = detectHigherHighsLowerLows(highs, lows, 20);
  score += hhll;

  // 5. Weekly Confirmation
  if (weeklyData) {
    const weeklyScore = analyzeWeeklyRegime(weeklyData);
    if (Math.sign(weeklyScore) === Math.sign(score)) {
      score += Math.sign(score);  // Reinforce if aligned
    }
  }

  // Classify
  let regime: 'uptrend' | 'downtrend' | 'ranging';
  if (score >= 3) regime = 'uptrend';
  else if (score <= -3) regime = 'downtrend';
  else regime = 'ranging';

  return {
    symbol,
    regime,
    score,
    details: {
      price: currentPrice,
      sma20: sma20[sma20.length - 1],
      sma50: sma50[sma50.length - 1],
      sma200: sma200[sma200.length - 1],
      adx: currentADX,
      atr: atr[atr.length - 1]
    }
  };
}

function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
}

function calculateADX(highs: number[], lows: number[], closes: number[], period: number): number[] {
  // Simplified ADX calculation (full implementation in production)
  // Returns array of ADX values
  return [];  // TODO: Implement full ADX calculation
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const atr: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    if (i < period) {
      atr.push(tr);
    } else {
      const prevATR = atr[atr.length - 1];
      atr.push((prevATR * (period - 1) + tr) / period);
    }
  }
  return atr;
}

function detectHigherHighsLowerLows(highs: number[], lows: number[], lookback: number): number {
  const recentHighs = highs.slice(-lookback);
  const recentLows = lows.slice(-lookback);

  const lastHigh = recentHighs[recentHighs.length - 1];
  const lastLow = recentLows[recentLows.length - 1];

  const prevMaxHigh = Math.max(...recentHighs.slice(0, -1));
  const prevMinLow = Math.min(...recentLows.slice(0, -1));

  const higherHighs = lastHigh > prevMaxHigh;
  const higherLows = lastLow > prevMinLow;

  const lowerHighs = lastHigh < prevMaxHigh;
  const lowerLows = lastLow < prevMinLow;

  if (higherHighs && higherLows) return 1;
  if (lowerHighs && lowerLows) return -1;
  return 0;
}

function analyzeWeeklyRegime(weeklyData: any[]): number {
  // Simplified weekly analysis
  // Returns -5 to +5 score
  return 0;  // TODO: Implement weekly regime logic
}

function generateReasoning(results: SymbolRegime[], overallRegime: string): string {
  const lines: string[] = [];

  for (const result of results) {
    const { symbol, regime, score, details } = result;
    const priceVsSMA200 = details.price > details.sma200 ? 'above' : 'below';
    lines.push(
      `${symbol}: ${regime.toUpperCase()} (score ${score}) - ` +
      `Price ${priceVsSMA200} 200 SMA, ADX at ${details.adx.toFixed(1)}`
    );
  }

  return lines.join('\n');
}

function getRecommendedStrategy(regime: string, confidence: number): string {
  if (regime === 'uptrend') {
    return confidence >= 70 ? 'Trend Following (Aggressive)' : 'Trend Following (Cautious)';
  } else if (regime === 'downtrend') {
    return confidence >= 70 ? 'Short-Only or Stay Flat' : 'Defensive Positioning';
  } else {
    return 'Mean Reversion / Range Trading';
  }
}

async function fetchCandles(symbol: string, timeframe: string, bars: number): Promise<any[]> {
  // TODO: Implement Capital.com API call
  // This would call the Capital.com adapter
  return [];
}
