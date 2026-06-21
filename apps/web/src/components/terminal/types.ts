import type { LiveSignal } from "@/lib/market/market-intel-data";
import type { LedgerSummaryResponse, TradingMode } from "@/lib/account/api";
import type { ChartPoint } from "@/components/ui/smooth-area-chart";

export interface TradeData {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  entryPrice: number;
  closePrice?: number;
  size: number;
  leverage: number;
  margin: number;
  tp: number | null;
  sl: number | null;
  pnl?: number;
  pnlPct?: number | null;
  markPrice?: number;
  capitalDealId?: string;
  status: "OPEN" | "CLOSED";
  timestamp: number;
}

export type TerminalTabId =
  | "account"
  | "markets"
  | "intelligence"
  | "news"
  | "sectors"
  | `asset:${string}`;

export interface MarketTerminalProps {
  leftOpen: boolean;
  activeSymbol: string;
  activeCategory: string;
  setActiveSymbol: (s: string) => void;
  setActiveCategory: (c: string) => void;
  selectedTimeframe: string;
  setSelectedTimeframe: (tf: string) => void;
  candlePoints: ChartPoint[];
  sidebarQuotes: Record<string, { spot?: number; bid?: number; ask?: number; change24hPct?: number }>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  positions: TradeData[];
  tradeDirection: "BUY" | "SELL";
  setTradeDirection: (d: "BUY" | "SELL") => void;
  tradeSize: number;
  setTradeSize: (n: number) => void;
  tradeLeverage: number;
  setTradeLeverage: (n: number) => void;
  activeQuoteSpot: number;
  activeQuoteBid: number;
  activeQuoteAsk: number;
  activeQuoteChange: number;
  balance: { wallet_available: number } | null | undefined;
  summary: LedgerSummaryResponse | null;
  userEmail?: string;
  accountLoading: boolean;
  tradingMode: TradingMode;
  onDeposit: () => void;
  onWithdraw: () => void;
  onSignOut: () => void;
  onTradeExecute: (trade: {
    id: string;
    symbol: string;
    direction: "BUY" | "SELL";
    price: number;
    size: number;
    leverage: number;
    margin: number;
    tp: number | null;
    sl: number | null;
    timestamp: number;
  }) => void;
  onClosePosition: (id: string) => void;
  onCardClick: (symbol: string, assetClass?: string, sector?: string) => void;
  onSignalClick: (sig: LiveSignal) => void;
  onSymbolFromFeed: (symbol: string) => void;
  onAskAi: (prompt: string) => void;
  onAnalyzeWithAi: () => void;
}
