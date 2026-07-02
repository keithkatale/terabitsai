import { createHash } from "crypto";

/** TradingView widget interval codes */
export type TvInterval =
  | "1"
  | "5"
  | "15"
  | "30"
  | "60"
  | "240"
  | "D"
  | "W"
  | "M";

export type ChartStyle = "candles" | "line" | "area" | "bars";
export type ChartTheme = "dark" | "light";

export interface ChartSpec {
  /** TradingView symbol, e.g. NASDAQ:AAPL or BINANCE:BTCUSDT */
  symbol: string;
  /** Display label for UI */
  displayName?: string;
  interval: TvInterval;
  /** Friendly indicator names or raw TV study IDs */
  indicators: string[];
  /** Visible range hint: 1D, 1W, 1M, 3M, 6M, 1Y, YTD, ALL */
  range?: string;
  style?: ChartStyle;
  theme?: ChartTheme;
}

export interface ChartAnalysis {
  bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
  keyLevels: Array<{ price: number; type: "support" | "resistance" | "pivot"; note?: string }>;
  patterns: string[];
  indicatorReads: Array<{ name: string; read: string; signal: "bullish" | "bearish" | "neutral" }>;
  invalidation: string;
  confirmation: string;
  reasoning: string;
}

/** Map friendly names -> TradingView study IDs */
export const INDICATOR_CATALOG: Record<string, string> = {
  rsi: "RSI@tv-basicstudies",
  macd: "MACD@tv-basicstudies",
  volume: "Volume@tv-basicstudies",
  ema: "MAExp@tv-basicstudies",
  sma: "MASimple@tv-basicstudies",
  bollinger: "BB@tv-basicstudies",
  bb: "BB@tv-basicstudies",
  stoch: "Stochastic@tv-basicstudies",
  stochastic: "Stochastic@tv-basicstudies",
  atr: "ATR@tv-basicstudies",
  adx: "ADX@tv-basicstudies",
  obv: "OBV@tv-basicstudies",
  vwap: "VWAP@tv-basicstudies",
  ichimoku: "IchimokuCloud@tv-basicstudies",
  pivot: "PivotPointsStandard@tv-basicstudies",
};

const INTERVAL_ALIASES: Record<string, TvInterval> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "60": "60",
  "4h": "240",
  "240": "240",
  "1d": "D",
  "d": "D",
  "1w": "W",
  "w": "W",
  "1mth": "M",
  "1mo": "M",
  "month": "M",
};

/** Resolve user-friendly interval to TradingView interval code */
export function normalizeInterval(raw?: string): TvInterval {
  if (!raw) return "D";
  const key = raw.trim().toLowerCase();
  if (key in INTERVAL_ALIASES) return INTERVAL_ALIASES[key];
  const upper = raw.trim().toUpperCase();
  if (["1", "5", "15", "30", "60", "240", "D", "W", "M"].includes(upper)) {
    return upper as TvInterval;
  }
  return "D";
}

/** Resolve indicator name to TV study ID */
export function resolveStudyId(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.includes("@tv-basicstudies") || trimmed.includes("@")) {
    return trimmed;
  }
  const key = trimmed.toLowerCase().replace(/[\s_-]+/g, "");
  return INDICATOR_CATALOG[key] ?? null;
}

/** Resolve list of indicators to TV study IDs (empty when none selected). */
export function resolveStudies(indicators?: string[]): string[] {
  if (!indicators?.length) return [];
  const studies = indicators
    .map(resolveStudyId)
    .filter((s): s is string => Boolean(s));
  return studies.length ? [...new Set(studies)] : [];
}

const STYLE_MAP: Record<ChartStyle, string> = {
  candles: "1",
  line: "2",
  area: "3",
  bars: "0",
};

/** Map common tickers to TradingView exchange:symbol format */
export function resolveTradingViewSymbol(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.includes(":")) return trimmed;

  const cryptoMap: Record<string, string> = {
    BTCUSD: "BINANCE:BTCUSDT",
    BTC: "BINANCE:BTCUSDT",
    ETHUSD: "BINANCE:ETHUSDT",
    ETH: "BINANCE:ETHUSDT",
    SOLUSD: "BINANCE:SOLUSDT",
    SOL: "BINANCE:SOLUSDT",
    XRPUSD: "BINANCE:XRPUSDT",
    DOGEUSD: "BINANCE:DOGEUSDT",
    ADAUSD: "BINANCE:ADAUSDT",
    AVAXUSD: "BINANCE:AVAXUSDT",
    LINKUSD: "BINANCE:LINKUSDT",
  };

  const indexMap: Record<string, string> = {
    US100: "NASDAQ:NDX",
    US500: "SP:SPX",
    SPX: "SP:SPX",
    SPY: "AMEX:SPY",
    QQQ: "NASDAQ:QQQ",
    DXY: "TVC:DXY",
    VIX: "CBOE:VIX",
  };

  const commodityMap: Record<string, string> = {
    GOLD: "TVC:GOLD",
    XAUUSD: "OANDA:XAUUSD",
    SILVER: "TVC:SILVER",
    XAGUSD: "OANDA:XAGUSD",
    OIL: "TVC:USOIL",
    USOIL: "TVC:USOIL",
    BRENT: "TVC:UKOIL",
  };

  const forexMap: Record<string, string> = {
    EURUSD: "FX:EURUSD",
    GBPUSD: "FX:GBPUSD",
    USDJPY: "FX:USDJPY",
    AUDUSD: "FX:AUDUSD",
    USDCAD: "FX:USDCAD",
  };

  if (cryptoMap[trimmed]) return cryptoMap[trimmed];
  if (indexMap[trimmed]) return indexMap[trimmed];
  if (commodityMap[trimmed]) return commodityMap[trimmed];
  if (forexMap[trimmed]) return forexMap[trimmed];

  // Stocks: assume NASDAQ for short tickers, NYSE otherwise
  if (/^[A-Z]{1,5}$/.test(trimmed) && !trimmed.endsWith("USD")) {
    return `NASDAQ:${trimmed}`;
  }

  return trimmed;
}

/** Build a normalized ChartSpec from tool args */
export function buildChartSpec(args: {
  symbol: string;
  interval?: string;
  indicators?: string[];
  range?: string;
  style?: string;
  theme?: string;
  displayName?: string;
}): ChartSpec {
  const tvSymbol = resolveTradingViewSymbol(args.symbol);
  const style = (args.style?.toLowerCase() as ChartStyle) || "candles";
  const theme = (args.theme?.toLowerCase() as ChartTheme) || "dark";

  return {
    symbol: tvSymbol,
    displayName: args.displayName ?? args.symbol.toUpperCase(),
    interval: normalizeInterval(args.interval),
    indicators: resolveStudies(args.indicators),
    range: args.range ?? "3M",
    style: ["candles", "line", "area", "bars"].includes(style) ? style : "candles",
    theme: theme === "light" ? "light" : "dark",
  };
}

export function chartStyleCode(style?: ChartStyle): string {
  return STYLE_MAP[style ?? "candles"] ?? "1";
}

/** Stable hash for screenshot caching */
export function specHash(spec: ChartSpec): string {
  const payload = JSON.stringify({
    symbol: spec.symbol,
    interval: spec.interval,
    indicators: [...spec.indicators].sort(),
    range: spec.range,
    style: spec.style,
    theme: spec.theme,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/** Build query string for chart-frame page */
export function specToQueryParams(spec: ChartSpec): URLSearchParams {
  const params = new URLSearchParams();
  params.set("symbol", spec.symbol);
  params.set("interval", spec.interval);
  params.set("studies", spec.indicators.join(","));
  if (spec.range) params.set("range", spec.range);
  if (spec.style) params.set("style", spec.style);
  if (spec.theme) params.set("theme", spec.theme);
  if (spec.displayName) params.set("displayName", spec.displayName);
  return params;
}
