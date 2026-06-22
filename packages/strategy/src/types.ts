export type TradeDirection = "BUY" | "SELL";

export type MarketRegime = "trend" | "range" | "volatile";

export type TradeSetup = {
  symbol: string;
  direction: TradeDirection;
  entry: number;
  atrStop: number;
  stopDistance: number;
  targets: number[];
  confluenceScore: number;
  rationale: string[];
  regime: MarketRegime;
  timeframeBias: "bullish" | "bearish" | "neutral";
  timeframeSetup: "bullish" | "bearish" | "neutral";
  timeframeTrigger: "bullish" | "bearish" | "neutral";
};

export type ModuleVote = {
  module: string;
  direction: TradeDirection | "NEUTRAL";
  weight: number;
  score: number;
  reason: string;
};

export type ConfluenceResult = {
  symbol: string;
  buyScore: number;
  sellScore: number;
  votes: ModuleVote[];
  regime: MarketRegime;
  setup?: TradeSetup;
};

export type MtfCandles = {
  symbol: string;
  day: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
  hour: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
  m15: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
};
