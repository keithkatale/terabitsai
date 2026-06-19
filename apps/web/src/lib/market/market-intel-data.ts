export type SignalTimeframe = "5m" | "15m" | "1H" | "4H";

export interface LiveSignal {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  sector?: string;
  action: "BUY" | "SELL";
  strategy: string;
  timeframe: SignalTimeframe;
  reason: string;
  change24h: number;
}

export type FeedSentiment = "bullish" | "bearish" | "neutral";
export type FeedHorizon = "intraday" | "swing" | "position";

export interface MarketNewsItem {
  id: string;
  headline: string;
  summary: string;
  sentiment: FeedSentiment;
  symbols: string[];
  source: string;
  category: "macro" | "earnings" | "crypto" | "geopolitics" | "rates";
}

export interface InvestOpportunity {
  id: string;
  title: string;
  thesis: string;
  symbols: string[];
  horizon: FeedHorizon;
  conviction: 1 | 2 | 3 | 4 | 5;
  style: "growth" | "value" | "income" | "thematic";
}

export const INITIAL_SIGNALS: LiveSignal[] = [
  {
    id: "sig_btc_ob",
    symbol: "BTCUSD",
    name: "Bitcoin / USD",
    assetClass: "crypto",
    sector: "Crypto",
    action: "BUY",
    strategy: "SMC Order Block",
    timeframe: "15m",
    reason: "Bullish order block formed at $64.2k liquidity shelf",
    change24h: 3.42,
  },
  {
    id: "sig_eth_fvg",
    symbol: "ETHUSD",
    name: "Ethereum / USD",
    assetClass: "crypto",
    sector: "Crypto",
    action: "BUY",
    strategy: "Fair Value Gap",
    timeframe: "5m",
    reason: "FVG filled — support confirmed above prior swing low",
    change24h: 1.85,
  },
  {
    id: "sig_sol_macd",
    symbol: "SOLUSD",
    name: "Solana / USD",
    assetClass: "crypto",
    sector: "Crypto",
    action: "BUY",
    strategy: "MACD Crossover",
    timeframe: "1H",
    reason: "MACD golden cross on daily trend support",
    change24h: 5.12,
  },
  {
    id: "sig_btc_rsi",
    symbol: "BTCUSD",
    name: "Bitcoin / USD",
    assetClass: "crypto",
    sector: "Crypto",
    action: "SELL",
    strategy: "RSI Overbought Fade",
    timeframe: "4H",
    reason: "RSI at 82 on 4H — bearish divergence vs price",
    change24h: -1.2,
  },
  {
    id: "sig_aapl_ob_bear",
    symbol: "AAPL",
    name: "Apple Inc.",
    assetClass: "stock",
    sector: "Technology",
    action: "SELL",
    strategy: "SMC Order Block",
    timeframe: "1H",
    reason: "Bearish order block at daily high — supply zone",
    change24h: -0.85,
  },
  {
    id: "sig_tsla_ob_bull",
    symbol: "TSLA",
    name: "Tesla Inc.",
    assetClass: "stock",
    sector: "Consumer Cyclical",
    action: "BUY",
    strategy: "SMC Order Block",
    timeframe: "15m",
    reason: "Bullish OB at historical pivot — momentum resuming",
    change24h: 2.15,
  },
  {
    id: "sig_nvda_rsi",
    symbol: "NVDA",
    name: "Nvidia Corp.",
    assetClass: "stock",
    sector: "Technology",
    action: "SELL",
    strategy: "RSI Overbought Fade",
    timeframe: "1H",
    reason: "RSI 79 — distribution block on elevated volume",
    change24h: -2.4,
  },
  {
    id: "sig_msft_ema",
    symbol: "MSFT",
    name: "Microsoft Corp.",
    assetClass: "stock",
    sector: "Technology",
    action: "BUY",
    strategy: "EMA Golden Cross",
    timeframe: "1H",
    reason: "EMA 20/50 bullish cross — institutional trend intact",
    change24h: 1.1,
  },
  {
    id: "sig_eurusd_ob",
    symbol: "EURUSD",
    name: "Euro / US Dollar",
    assetClass: "stock",
    sector: "Forex",
    action: "BUY",
    strategy: "SMC Order Block",
    timeframe: "15m",
    reason: "London open bullish OB — dollar softness theme",
    change24h: 0.18,
  },
  {
    id: "sig_gold_fvg",
    symbol: "GOLD",
    name: "Gold CFD",
    assetClass: "stock",
    sector: "Commodities",
    action: "BUY",
    strategy: "Fair Value Gap",
    timeframe: "1H",
    reason: "Safe-haven bid — imbalance gap filled on pullback",
    change24h: 1.45,
  },
  {
    id: "sig_us100_break",
    symbol: "US100",
    name: "US Tech 100",
    assetClass: "stock",
    sector: "Indices",
    action: "BUY",
    strategy: "Breakout Retest",
    timeframe: "4H",
    reason: "All-time-high retest holding — breadth improving",
    change24h: 0.92,
  },
  {
    id: "sig_oil_rsi",
    symbol: "OIL",
    name: "Crude Oil CFD",
    assetClass: "stock",
    sector: "Commodities",
    action: "SELL",
    strategy: "RSI Overbought Fade",
    timeframe: "4H",
    reason: "Overbought RSI — trend exhaustion near resistance",
    change24h: -1.75,
  },
];

export const MARKET_NEWS_POOL: MarketNewsItem[] = [
  {
    id: "news_fed",
    headline: "Fed speakers lean cautious on near-term cuts",
    summary: "Multiple officials flagged sticky services inflation — rate path repriced slightly hawkish for Q3.",
    sentiment: "bearish",
    symbols: ["US100", "GOLD", "EURUSD"],
    source: "Macro Wire",
    category: "rates",
  },
  {
    id: "news_btc_etf",
    headline: "Spot BTC ETF inflows accelerate for third session",
    summary: "Institutional desks adding exposure as on-chain accumulation metrics turn positive.",
    sentiment: "bullish",
    symbols: ["BTCUSD", "ETHUSD"],
    source: "Crypto Desk",
    category: "crypto",
  },
  {
    id: "news_nvda",
    headline: "Semiconductor names lead pre-market bid",
    summary: "AI capex narrative intact — NVDA, MSFT cluster showing relative strength vs broad market.",
    sentiment: "bullish",
    symbols: ["NVDA", "MSFT", "US100"],
    source: "Equities Pulse",
    category: "earnings",
  },
  {
    id: "news_oil",
    headline: "Crude slips on inventory build surprise",
    summary: "EIA report showed larger-than-expected stockpile — energy complex under pressure.",
    sentiment: "bearish",
    symbols: ["OIL"],
    source: "Commodities",
    category: "macro",
  },
  {
    id: "news_gold",
    headline: "Gold holds bid as real yields ease",
    summary: "Safe-haven flows steady amid mixed risk sentiment — key support zone defended.",
    sentiment: "bullish",
    symbols: ["GOLD"],
    source: "Macro Wire",
    category: "macro",
  },
  {
    id: "news_eth",
    headline: "ETH staking ratio hits new cycle high",
    summary: "Reduced liquid supply supports medium-term scarcity thesis for Ethereum.",
    sentiment: "bullish",
    symbols: ["ETHUSD"],
    source: "On-Chain",
    category: "crypto",
  },
];

export const INVEST_OPPORTUNITIES_POOL: InvestOpportunity[] = [
  {
    id: "inv_ai_infra",
    title: "AI Infrastructure Basket",
    thesis: "Hyperscaler capex cycle + GPU supply constraints support semis & cloud leaders over 6–12M.",
    symbols: ["NVDA", "MSFT", "US100"],
    horizon: "position",
    conviction: 4,
    style: "thematic",
  },
  {
    id: "inv_btc_halving",
    title: "Bitcoin Supply Squeeze",
    thesis: "ETF demand + halving supply shock — accumulate on 1M pullbacks toward prior range highs.",
    symbols: ["BTCUSD"],
    horizon: "swing",
    conviction: 4,
    style: "growth",
  },
  {
    id: "inv_gold_hedge",
    title: "Gold as Portfolio Hedge",
    thesis: "Diversify equity beta with 5–10% gold allocation amid rate uncertainty and geopolitical risk.",
    symbols: ["GOLD"],
    horizon: "position",
    conviction: 3,
    style: "value",
  },
  {
    id: "inv_dividend",
    title: "Quality Dividend Compounders",
    thesis: "Mega-cap tech with buyback + dividend yield — MSFT, AAPL offer defensive growth blend.",
    symbols: ["MSFT", "AAPL"],
    horizon: "position",
    conviction: 3,
    style: "income",
  },
];

export const TRADING_STRATEGIES = [
  "SMC Order Block",
  "Fair Value Gap",
  "MACD Crossover",
  "RSI Overbought Fade",
  "RSI Oversold Bounce",
  "SMC Liquidity Sweep",
  "EMA Golden Cross",
  "EMA Death Cross",
  "BB Upper Rejection",
  "BB Lower Breakout",
  "Breakout Retest",
  "VWAP Reclaim",
] as const;

export const MARKET_PULSE_THEMES = [
  { label: "Risk Appetite", value: "Risk-On", tone: "bullish" as const },
  { label: "Volatility", value: "Elevated", tone: "neutral" as const },
  { label: "USD", value: "Softening", tone: "bearish" as const },
  { label: "Rates", value: "Higher for Longer", tone: "neutral" as const },
];
