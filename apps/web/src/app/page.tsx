"use client";

import { useEffect, useState, useMemo, useRef, useCallback, useId } from "react";
import InputBar from "@/components/ui/input-bar";
import { cn } from "@/lib/utils";
import { SmoothAreaChart } from "@/components/ui/smooth-area-chart";
import { capitalAdapter } from "@/lib/execution/capital-adapter";
import QuickTradeDialog from "@/components/ui/quick-trade-dialog";

import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import {
  ensurePlatformAccount,
  getAccountBalance,
  postDeposit,
  postTradeAdjustment,
  postTradeReserve,
  postTradeRelease,
  type PlatformAccount,
  type BalanceSummary
} from "@/lib/ledger";

import {
  ImageIcon,
  FileUp,
  MonitorIcon,
  CircleUserRound,
  ArrowUpIcon,
  Paperclip,
  PlusIcon,
  CopyIcon,
  RefreshCcwIcon,
  SparklesIcon,
  TrendingUp,
  TrendingDown,
  Search,
  Briefcase,
  LineChart,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  DollarSign,
  Activity,
  Menu,
  X,
} from "lucide-react";

import { ChatMessage as ChatMessageBubble } from "@/components/ai-elements/message";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";

// Self-contained custom Figma SVG icon component
const Figma = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12zm0 7h3.5a3.5 3.5 0 1 1-3.5 3.5zm0 7.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zm-7-7A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5zM5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
  </svg>
);

// --- Message Parts Structural Model ---
interface MessagePart {
  type: "reasoning" | "text" | "trade-execution";
  text: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
}

// --- Trade Execution Card (Wow Factor!) ---
interface TradeData {
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
  status: "OPEN" | "CLOSED";
  timestamp: number;
}


// --- Asset Catalog Definitions (Fully dynamic, ported from capital-assets) ---
const rawCapitalCatalog = getCapitalAssetCatalog();

const ASSET_CATALOG: Record<string, Array<{ symbol: string; name: string; asset_class?: string; sector?: string }>> = {
  Crypto: [],
  Stocks: [],
  Forex: [],
  Indices: [],
  Commodities: [],
  ETFs: [],
};

const LEFT_POOL_ASSETS: Array<{ symbol: string; name: string; asset_class?: string; sector?: string }> = [];
const RIGHT_POOL_ASSETS: Array<{ symbol: string; name: string; asset_class?: string; sector?: string }> = [];

rawCapitalCatalog.forEach((item) => {
  let cat = "Stocks";
  if (item.asset_class === "crypto") cat = "Crypto";
  else if (item.sector === "Forex") cat = "Forex";
  else if (item.sector === "Indices") cat = "Indices";
  else if (item.sector === "Commodities") cat = "Commodities";
  else if (item.sector === "ETFs") cat = "ETFs";

  const assetObj = {
    symbol: item.symbol,
    name: item.display_name,
    asset_class: item.asset_class,
    sector: item.sector ?? undefined,
  };

  if (ASSET_CATALOG[cat]) {
    ASSET_CATALOG[cat].push(assetObj);
  }

  if (cat === "Crypto" || cat === "Stocks") {
    LEFT_POOL_ASSETS.push(assetObj);
  } else {
    RIGHT_POOL_ASSETS.push(assetObj);
  }
});

function generateSparklinePoints(symbol: string, change24hPct: number, count = 12) {
  const hash = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const points: { x: number; y: number }[] = [];
  
  for (let i = 0; i < count; i++) {
    const x = (i / (count - 1)) * 100;
    const noise = Math.sin(i * 1.2 + hash) * 12 + Math.cos(i * 2.1 - hash) * 6;
    const trend = (change24hPct) * (i / (count - 1)) * 12;
    let y = 50 - trend + noise;
    y = Math.max(15, Math.min(85, y));
    points.push({ x, y });
  }
  return points;
}

const MiniSparkline = ({ points, isPositive }: { points: { x: number; y: number }[]; isPositive: boolean }) => {
  const id = useId();
  if (points.length === 0) return null;
  const pathData = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  const areaData = `${pathData} L 100 100 L 0 100 Z`;
  const color = isPositive ? "#10b981" : "#ef4444"; // emerald vs red
  const gradientId = `grad-${id.replace(/:/g, "-")}`;

  return (
    <svg className="w-full h-11" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {/* Area under curve */}
      <path d={areaData} fill={`url(#${gradientId})`} />
      {/* Curve line */}
      <path d={pathData} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

interface LiveSignal {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  sector?: string;
  action: "BUY" | "SELL";
  strategy: string;
  timeframe: "5m" | "15m" | "1H" | "4H";
  reason: string;
  change24h: number;
}

const INITIAL_SIGNALS: LiveSignal[] = [
  // ROW 1: Crypto (Track 1)
  {
    id: "sig_btc_ob",
    symbol: "BTCUSD",
    name: "Bitcoin / USD",
    assetClass: "crypto",
    sector: "Crypto",
    action: "BUY",
    strategy: "SMC Order Block",
    timeframe: "15m",
    reason: "Bullish Order Block formed at $64.2k",
    change24h: 3.42
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
    reason: "FVG Liquidity void filled, support confirmed",
    change24h: 1.85
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
    change24h: 5.12
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
    reason: "RSI at 82 on 4H chart, bearish divergence",
    change24h: -1.20
  },
  {
    id: "sig_doge_sweep",
    symbol: "DOGEUSD",
    name: "Dogecoin / USD",
    assetClass: "crypto",
    sector: "Crypto",
    action: "BUY",
    strategy: "SMC Liquidity Sweep",
    timeframe: "15m",
    reason: "Liquidity sweep of sell-side low pool",
    change24h: 0.45
  },

  // ROW 2: Stocks (Track 2)
  {
    id: "sig_aapl_ob_bear",
    symbol: "AAPL",
    name: "Apple Inc.",
    assetClass: "stock",
    sector: "Technology",
    action: "SELL",
    strategy: "SMC Order Block",
    timeframe: "1H",
    reason: "Bearish Order Block formed at daily high",
    change24h: -0.85
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
    reason: "Bullish Order Block at historical pivot",
    change24h: 2.15
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
    reason: "RSI at 79, institutional block distribution",
    change24h: -2.40
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
    reason: "EMA 20 crossing EMA 50 on daily momentum",
    change24h: 1.10
  },
  {
    id: "sig_amzn_bb",
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    assetClass: "stock",
    sector: "Consumer Cyclical",
    action: "BUY",
    strategy: "BB Lower Breakout",
    timeframe: "4H",
    reason: "Rejection of Bollinger Bands lower deviation",
    change24h: 1.62
  },

  // ROW 3: Forex & Commodities (Track 3)
  {
    id: "sig_eurusd_ob",
    symbol: "EURUSD",
    name: "Euro / US Dollar",
    assetClass: "stock",
    sector: "Forex",
    action: "BUY",
    strategy: "SMC Order Block",
    timeframe: "15m",
    reason: "Bullish Order Block at London session open",
    change24h: 0.18
  },
  {
    id: "sig_gbpusd_sweep",
    symbol: "GBPUSD",
    name: "British Pound / USD",
    assetClass: "stock",
    sector: "Forex",
    action: "SELL",
    strategy: "SMC Liquidity Sweep",
    timeframe: "1H",
    reason: "Liquidity sweep of Asia high resistance",
    change24h: -0.32
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
    reason: "Institutional buy imbalance gap filled",
    change24h: 1.45
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
    reason: "RSI overbought, strong trend exhaustion",
    change24h: -1.75
  },
  {
    id: "sig_usdjpy_ema",
    symbol: "USDJPY",
    name: "US Dollar / Japanese Yen",
    assetClass: "stock",
    sector: "Forex",
    action: "SELL",
    strategy: "EMA Death Cross",
    timeframe: "15m",
    reason: "EMA 20/50 bearish crossing on hourly support",
    change24h: -0.25
  }
];

interface SignalCardProps {
  sig: LiveSignal;
  sidebarQuotes: Record<string, any>;
  flashingSignalId: string | null;
  onClick: (sig: LiveSignal) => void;
}

const SignalCard = ({ sig, sidebarQuotes, flashingSignalId, onClick }: SignalCardProps) => {
  const isBuy = sig.action === "BUY";
  const q = sidebarQuotes[sig.symbol];
  const spot = q?.spot ?? 100.0;
  const change = q?.change24hPct ?? sig.change24h;
  const isFlashing = flashingSignalId === sig.id;

  return (
    <div
      onClick={() => onClick(sig)}
      className={cn(
        "signal-card transition-all duration-700",
        isBuy ? "signal-card-glow-buy" : "signal-card-glow-sell",
        isFlashing && (isBuy 
          ? "shadow-[0_0_25px_rgba(16,185,129,0.4)] border-emerald-500/45 bg-[#0d1721]/80 scale-[1.02] z-20" 
          : "shadow-[0_0_25px_rgba(239,68,68,0.4)] border-red-500/45 bg-[#170d13]/80 scale-[1.02] z-20"
        )
      )}
    >
      {/* Top Section */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 min-w-0">
          <AssetLogoIcon
            symbol={sig.symbol}
            assetClass={sig.assetClass}
            sector={sig.sector}
            size="sm"
            className="rounded-md shrink-0 w-6 h-6 border border-zinc-900/60 bg-zinc-900/40 flex items-center justify-center"
          />
          <div className="min-w-0">
            <p className="font-mono font-bold text-xs text-white leading-none tracking-tight">{sig.symbol}</p>
            <p className="text-[9px] text-zinc-500 font-bold leading-none mt-1 truncate max-w-[90px]">
              {sig.name.replace(" CFD", "").replace(" / USD", "")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-zinc-900/80 text-zinc-400 border border-zinc-800 tracking-wider font-mono">
            {sig.timeframe}
          </span>
          <span className={cn(
            "text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide font-mono",
            isBuy ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/10" : "text-red-400 bg-red-500/10 border border-red-500/10"
          )}>
            {sig.action}
          </span>
        </div>
      </div>

      {/* Middle/Strategy Section */}
      <div className="my-1 text-left">
        <p className="font-sans font-extrabold text-[11px] text-zinc-300 leading-tight truncate">
          {sig.strategy}
        </p>
        <p className="text-[9px] text-zinc-500 leading-tight font-medium mt-0.5 truncate">
          {sig.reason}
        </p>
      </div>

      {/* Bottom Price/Change Section */}
      <div className="flex items-center justify-between border-t border-zinc-900/40 pt-1.5 mt-0.5">
        <span className="font-mono font-bold text-xs text-zinc-100">
          ${spot >= 1000 
            ? spot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
            : spot.toFixed(3)
          }
        </span>
        <span className={cn(
          "text-[9px] font-bold font-mono leading-none flex items-center gap-0.5",
          change >= 0 ? "text-emerald-400" : "text-red-400"
        )}>
          {change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {change >= 0 ? "+" : ""}{change.toFixed(2)}%
        </span>
      </div>
    </div>
  );
};

// --- Main Home Component ---
export default function Home() {
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Layout Collapsible & Resizable States
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(290);
  const [rightWidth, setRightWidth] = useState(330);
  const [isResizing, setIsResizing] = useState<"left" | "right" | null>(null);

  // Handle panel column resizing drag events
  const startResize = useCallback((side: "left" | "right", e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(side);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing === "left") {
        const newWidth = e.clientX;
        if (newWidth >= 280 && newWidth <= 600) {
          setLeftWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing]);

  // Active Market selected symbol and category
  const [activeSymbol, setActiveSymbol] = useState("BTCUSD");
  const [activeCategory, setActiveCategory] = useState("Crypto");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1M");
  const [candlePoints, setCandlePoints] = useState<any[]>([]);
  const [activeQuote, setActiveQuote] = useState<any>(null);
  const [sidebarQuotes, setSidebarQuotes] = useState<Record<string, any>>({});

  // Real candles mapping for sidebar card charts (Figma specification)
  const [cardCandles, setCardCandles] = useState<Record<string, { x: number; y: number }[]>>({});

  // Proactive Signals States
  const [liveSignals, setLiveSignals] = useState<LiveSignal[]>(INITIAL_SIGNALS);
  const [flashingSignalId, setFlashingSignalId] = useState<string | null>(null);

  // Utility to map raw historic candles to standard x,y percentage coordinates with comfortable margin padding
  const convertCandlesToSparklinePoints = useCallback((points: any[]) => {
    if (points.length === 0) return [];
    const closes = points.map((p) => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    return points.map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      // Invert Y axis for SVGs (0 is top), add 15% top/bottom safety padding
      const y = 15 + ((max - p.close) / range) * 70;
      return { x, y };
    });
  }, []);

  // Click handler to select asset, set category, and set a beautiful prompt to analyze the asset
  const handleCardClick = useCallback((symbol: string, assetClass?: string, sector?: string) => {
    setActiveSymbol(symbol);
    
    let cat = "Stocks";
    if (assetClass === "crypto") cat = "Crypto";
    else if (sector === "Forex") cat = "Forex";
    else if (sector === "Indices") cat = "Indices";
    else if (sector === "Commodities") cat = "Commodities";
    else if (sector === "ETFs") cat = "ETFs";
    
    setActiveCategory(cat);
    
    // Autofill the narrow input box with an analytical prompt
    setValue(`Analyze ${symbol} trend and recommend a simulated trading strategy.`);
  }, []);

  const handleSignalClick = useCallback((sig: LiveSignal) => {
    setActiveSymbol(sig.symbol);
    
    let cat = "Stocks";
    if (sig.assetClass === "crypto") cat = "Crypto";
    else if (sig.sector === "Forex") cat = "Forex";
    else if (sig.sector === "Indices") cat = "Indices";
    else if (sig.sector === "Commodities") cat = "Commodities";
    else if (sig.sector === "ETFs") cat = "ETFs";
    
    setActiveCategory(cat);
    
    // Autofill the narrow input box with a specialized strategy discussion prompt
    setValue(`Perform a detailed multi-agent team analysis on ${sig.symbol} regarding the recent ${sig.strategy} signal on the ${sig.timeframe} timeframe.`);
  }, []);

  // Memoized signal groupings
  const cryptoSignals = useMemo(() => liveSignals.filter((sig) => sig.sector === "Crypto"), [liveSignals]);
  const stockSignals = useMemo(() => liveSignals.filter((sig) => sig.assetClass === "stock" && sig.sector !== "Forex" && sig.sector !== "Commodities"), [liveSignals]);
  const forexSignals = useMemo(() => liveSignals.filter((sig) => sig.sector === "Forex" || sig.sector === "Commodities"), [liveSignals]);

  // Card Face renderer helper to draw high fidelity 3D flipping card elements matching Figma specification
  const renderCardFace = useCallback((asset: { symbol: string; name: string; asset_class?: string; sector?: string }) => {
    const q = sidebarQuotes[asset.symbol];
    const spot = q?.spot || 100;
    const change = q?.change24hPct ?? 0;
    const points = cardCandles[asset.symbol] || generateSparklinePoints(asset.symbol, change);
    const isPositive = change >= 0;
    const absChange = spot * (change / 100);

    return (
      <div className="flex flex-col h-full justify-between select-none text-left">
        {/* Top Segment: Thumbnail + Name (Figma style) */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <AssetLogoIcon
              symbol={asset.symbol}
              assetClass={asset.asset_class}
              sector={asset.sector}
              size="sm"
              className="rounded-xl shadow-md border border-zinc-900/60 bg-zinc-900/40 w-8 h-8 flex items-center justify-center"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-sans font-extrabold text-sm text-zinc-100 truncate leading-tight">
              {asset.name.replace(" CFD", "").replace(" / USD", "")}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase font-mono leading-none">
                {asset.symbol}
              </p>
              <span className="text-[8px] font-extrabold px-1 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 uppercase tracking-wider scale-90 origin-left">
                {asset.asset_class === "crypto" ? "Crypto" : asset.sector || "Stock"}
              </span>
            </div>
          </div>
        </div>

        {/* Content Segment: Price + Trend indicator */}
        <div className="mt-3 flex flex-col">
          <p className="font-mono font-bold text-lg text-white leading-none tracking-tight">
            ${spot >= 1000 
              ? spot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
              : spot.toFixed(3)
            }
          </p>
          <div className="flex items-center gap-1 mt-1.5">
            {isPositive ? (
              <TrendingUp className="size-3.5 text-emerald-400 shrink-0" />
            ) : (
              <TrendingDown className="size-3.5 text-red-400 shrink-0" />
            )}
            <p className={cn(
              "text-xs font-bold font-mono leading-none",
              isPositive ? "text-emerald-400" : "text-red-400"
            )}>
              {isPositive ? "+" : ""}{absChange.toFixed(2)} ({isPositive ? "+" : ""}{change.toFixed(2)}%)
            </p>
          </div>
        </div>

        {/* Chart Container Segment: Light Grid SVG Sparkline (Figma style with actual data) */}
        <div className="mt-3 w-full h-[95px] relative bg-zinc-950/20 rounded-xl overflow-hidden border border-zinc-900/30 flex items-center justify-center">
          {/* Subtle Grid Lines matching Figma spec */}
          <div className="absolute inset-0 flex flex-col justify-between p-1.5 pointer-events-none opacity-[0.1]">
            <div className="w-full border-b border-zinc-700" />
            <div className="w-full border-b border-zinc-700" />
            <div className="w-full border-b border-zinc-700" />
            <div className="w-full border-b border-zinc-700" />
          </div>
          <div className="absolute inset-0 flex justify-between p-1.5 pointer-events-none opacity-[0.03]">
            <div className="h-full border-r border-zinc-700" />
            <div className="h-full border-r border-zinc-700" />
            <div className="h-full border-r border-zinc-700" />
            <div className="h-full border-r border-zinc-700" />
            <div className="h-full border-r border-zinc-700" />
          </div>

          <div className="absolute inset-0 p-1.5">
            <MiniSparkline points={points} isPositive={isPositive} />
          </div>
        </div>

        {/* Bottom Timeframe Segment: Pill selectors decoration (Figma style) */}
        <div className="mt-3 flex items-center justify-between border-t border-zinc-900/40 pt-2 text-[9px] font-bold text-zinc-500 font-mono tracking-wider">
          {["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"].map((tf) => {
            const isSelected = tf === "1D";
            return (
              <span
                key={tf}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors duration-200",
                  isSelected 
                    ? "bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-extrabold"
                    : "hover:text-zinc-300"
                )}
              >
                {tf}
              </span>
            );
          })}
        </div>
      </div>
    );
  }, [sidebarQuotes, cardCandles]);

  // --- PREMIUM CAROUSEL 3D FLIP CARD STATES (Landing Page attract screen) ---
  const [leftSlots, setLeftSlots] = useState(() => {
    return Array.from({ length: 4 }).map((_, i) => {
      const front = LEFT_POOL_ASSETS[i % LEFT_POOL_ASSETS.length];
      const back = LEFT_POOL_ASSETS[(i + 4) % LEFT_POOL_ASSETS.length];
      return {
        front,
        back,
        isFlipped: false,
        activeSide: "front" as "front" | "back",
      };
    });
  });

  const [rightSlots, setRightSlots] = useState(() => {
    return Array.from({ length: 4 }).map((_, i) => {
      const front = RIGHT_POOL_ASSETS[i % RIGHT_POOL_ASSETS.length];
      const back = RIGHT_POOL_ASSETS[(i + 4) % RIGHT_POOL_ASSETS.length];
      return {
        front,
        back,
        isFlipped: false,
        activeSide: "front" as "front" | "back",
      };
    });
  });

  const leftPoolPointer = useRef(8);
  const rightPoolPointer = useRef(8);

  // Pre-fetch 1M historical candles for any visible and upcoming symbols on landing page
  useEffect(() => {
    if (messages.length > 0) return;
    const visibleSymbols = new Set<string>();
    leftSlots.forEach(s => {
      visibleSymbols.add(s.activeSide === "front" ? s.front.symbol : s.back.symbol);
      visibleSymbols.add(s.activeSide === "front" ? s.back.symbol : s.front.symbol);
    });
    rightSlots.forEach(s => {
      visibleSymbols.add(s.activeSide === "front" ? s.front.symbol : s.back.symbol);
      visibleSymbols.add(s.activeSide === "front" ? s.back.symbol : s.front.symbol);
    });

    visibleSymbols.forEach(sym => {
      if (cardCandles[sym]) return;
      fetch(`/api/market/candles?symbol=${sym}&range=1M`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.points?.length > 0) {
            const converted = convertCandlesToSparklinePoints(data.points);
            setCardCandles(prev => ({ ...prev, [sym]: converted }));
          }
        }).catch(err => console.warn("Card candle fetch failed:", sym, err));
    });
  }, [leftSlots, rightSlots, messages.length, cardCandles, convertCandlesToSparklinePoints]);

  useEffect(() => {
    if (messages.length > 0) return;

    let leftFlipIndex = 0;
    let rightFlipIndex = 0;

    const leftInterval = setInterval(() => {
      setLeftSlots((prev) => {
        const next = [...prev];
        const idx = leftFlipIndex;
        leftFlipIndex = (leftFlipIndex + 1) % 4;

        const slot = next[idx];
        const newSide = slot.activeSide === "front" ? "back" : "front";
        const isFlipped = newSide === "back";

        const nextAsset = LEFT_POOL_ASSETS[leftPoolPointer.current % LEFT_POOL_ASSETS.length];
        leftPoolPointer.current++;

        next[idx] = {
          ...slot,
          isFlipped,
          activeSide: newSide,
          front: newSide === "back" ? nextAsset : slot.front,
          back: newSide === "front" ? nextAsset : slot.back,
        };
        return next;
      });
    }, 10000); // 10 seconds calm rotation

    let rightTimeout: NodeJS.Timeout;
    const rightIntervals: NodeJS.Timeout[] = [];
    
    rightTimeout = setTimeout(() => {
      const rightInterval = setInterval(() => {
        setRightSlots((prev) => {
          const next = [...prev];
          const idx = rightFlipIndex;
          rightFlipIndex = (rightFlipIndex + 1) % 4;

          const slot = next[idx];
          const newSide = slot.activeSide === "front" ? "back" : "front";
          const isFlipped = newSide === "back";

          const nextAsset = RIGHT_POOL_ASSETS[rightPoolPointer.current % RIGHT_POOL_ASSETS.length];
          rightPoolPointer.current++;

          next[idx] = {
            ...slot,
            isFlipped,
            activeSide: newSide,
            front: newSide === "back" ? nextAsset : slot.front,
            back: newSide === "front" ? nextAsset : slot.back,
          };
          return next;
        });
      }, 10000); // 10 seconds calm rotation
      rightIntervals.push(rightInterval);
    }, 5000); // 5 seconds staggered side-to-side offset delay

    return () => {
      clearInterval(leftInterval);
      clearTimeout(rightTimeout);
      rightIntervals.forEach(clearInterval);
    };
  }, [messages.length]);

  // Sidebar dynamic quotes record & search state
  const [searchQuery, setSearchQuery] = useState("");
  const [leftSidebarTab, setLeftSidebarTab] = useState<"markets" | "portfolio">("markets");

  // Simulated CFD Portfolios
  const [positions, setPositions] = useState<TradeData[]>([]);
  const [isTradeOpen, setIsTradeOpen] = useState(false);

  // Platform account and Ledger balance states
  const [account, setAccount] = useState<PlatformAccount | null>(null);
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("5000");
  const [depositGateway, setDepositGateway] = useState("ACH");
  const [isDepositing, setIsDepositing] = useState(false);

  // 0. Automatic Account & Ledger Setup on mount
  useEffect(() => {
    async function initAccount() {
      try {
        let userId = localStorage.getItem("quant_user_id");
        if (!userId) {
          try {
            userId = crypto.randomUUID();
          } catch (e) {
            userId = "usr_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
          }
          localStorage.setItem("quant_user_id", userId);
        }

        const acc = await ensurePlatformAccount(userId);
        setAccount(acc);

        const bal = await getAccountBalance(acc.id);
        setBalance(bal);
      } catch (err) {
        console.error("Failed to initialize Quant platform account:", err);
      }
    }

    initAccount();
  }, []);

  const handleDepositSubmit = async () => {
    const amt = parseFloat(depositAmount);
    if (!account || isNaN(amt) || amt <= 0) return;

    setIsDepositing(true);
    try {
      await postDeposit(account.id, amt, depositGateway);
      const newBal = await getAccountBalance(account.id);
      setBalance(newBal);
      setIsDepositModalOpen(false);

      // Append confirmation receipt to chat history
      const receiptId = Date.now().toString();
      const receiptMessage: ChatMessage = {
        id: receiptId,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `✅ **Demo Wallet Funded Successfully!**\n\nWe have credited your paper margin account (**${account.id.substring(0, 8)}...**) with **$${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** via simulated **${depositGateway}** gateway transfer.\n\n* Your available margin cash is now **$${newBal.available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**.\n* This transaction has been permanently recorded in the Supabase ledger entries table.`
          }
        ]
      };
      setMessages((prev) => [...prev, receiptMessage]);
    } catch (err) {
      console.error("Deposit simulation error:", err);
    } finally {
      setIsDepositing(false);
    }
  };

  // --- Real-time Polling & Quote Sync ---
  
  // 1. Initial quotes setup
  useEffect(() => {
    const initialQuotes: Record<string, any> = {};
    Object.values(ASSET_CATALOG).forEach((categoryGroup) => {
      categoryGroup.forEach((item) => {
        const fallbackPrice = capitalAdapter.getInitialFallbackPrice(item.symbol);
        const hash = item.symbol.split("").reduce((acc, v) => acc + v.charCodeAt(0), 0);
        const change24hPct = ((hash % 100) / 20) - 2.5;
        const spreadBps = 12 / 10000;
        const bid = fallbackPrice * (1 - spreadBps / 2);
        const ask = fallbackPrice * (1 + spreadBps / 2);

        initialQuotes[item.symbol] = {
          symbol: item.symbol,
          bid,
          ask,
          spot: fallbackPrice,
          change24hPct,
          spread: ask - bid,
          marketStatus: "TRADEABLE",
        };
      });
    });

    setSidebarQuotes(initialQuotes);
  }, []);

  // 2. Poll Active Quote and Chart Candles every 10s
  useEffect(() => {
    let active = true;
    const fetchActiveDetails = async () => {
      try {
        const quoteRes = await fetch(`/api/market/quote?symbol=${activeSymbol}&assetClass=${activeCategory}`);
        if (!active) return;
        if (quoteRes.ok) {
          const quoteData = await quoteRes.json();
          setActiveQuote(quoteData);
          setSidebarQuotes((prev) => ({
            ...prev,
            [activeSymbol]: quoteData,
          }));
        }

        const candlesRes = await fetch(`/api/market/candles?symbol=${activeSymbol}&range=${selectedTimeframe}`);
        if (!active) return;
        if (candlesRes.ok) {
          const candlesData = await candlesRes.json();
          setCandlePoints(candlesData.points || []);
        }
      } catch (err) {
        console.warn("Failed to fetch active symbol data:", err);
      }
    };

    fetchActiveDetails();
    const interval = setInterval(fetchActiveDetails, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeSymbol, activeCategory, selectedTimeframe]);

  // 3. 3-second client-side Brownian Motion Price fluctuation (Premium Terminal Effect!)
  useEffect(() => {
    const timer = setInterval(() => {
      setSidebarQuotes((prev) => {
        const updated = { ...prev };
        let changed = false;

        Object.keys(updated).forEach((sym) => {
          if (sym === activeSymbol) return; // Skip currently active symbol to stay in exact sync with REST API polls

          const q = updated[sym];
          if (!q) return;

          // Brownian walk (fluctuate ±0.04% max)
          const changePct = (Math.random() - 0.5) * 0.0008;
          const oldSpot = q.spot;
          const newSpot = oldSpot * (1 + changePct);
          const spreadBps = 12 / 10000;
          const bid = newSpot * (1 - spreadBps / 2);
          const ask = newSpot * (1 + spreadBps / 2);

          const netChange = (q.change24hPct || 0) + (changePct * 100);

          updated[sym] = {
            ...q,
            bid,
            ask,
            spot: newSpot,
            change24hPct: Math.min(Math.max(netChange, -15), 15),
            spread: ask - bid,
          };
          changed = true;
        });

        return changed ? updated : prev;
      });
    }, 3000);

    return () => clearInterval(timer);
  }, [activeSymbol]);

  // Background Proactive Quant Agent Scanner
  useEffect(() => {
    const interval = setInterval(() => {
      // Pick a random signal to scan/update
      const randomIndex = Math.floor(Math.random() * INITIAL_SIGNALS.length);
      const signalToUpdate = INITIAL_SIGNALS[randomIndex];
      
      // Randomize parameters to simulate active analysis
      const actions: ("BUY" | "SELL")[] = ["BUY", "SELL"];
      const newAction = actions[Math.floor(Math.random() * actions.length)];
      
      const strategies = [
        "SMC Order Block", 
        "Fair Value Gap", 
        "MACD Crossover", 
        "RSI Overbought Fade", 
        "RSI Oversold Bounce",
        "SMC Liquidity Sweep",
        "EMA Golden Cross",
        "EMA Death Cross",
        "BB Upper Rejection",
        "BB Lower Breakout"
      ];
      const newStrategy = strategies[Math.floor(Math.random() * strategies.length)];
      
      const timeframes: ("5m" | "15m" | "1H" | "4H")[] = ["5m", "15m", "1H", "4H"];
      const newTimeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
      
      // Update price change
      const newChange = (Math.random() * 8 - 4); // -4% to +4%
      
      // Generate some smart reasons
      let newReason = "";
      if (newAction === "BUY") {
        newReason = `${newStrategy} triggered near support on the ${newTimeframe} chart.`;
      } else {
        newReason = `${newStrategy} resistance zone rejected on the ${newTimeframe} chart.`;
      }

      setLiveSignals((prev) => {
        const updated = [...prev];
        updated[randomIndex] = {
          ...signalToUpdate,
          action: newAction,
          strategy: newStrategy,
          timeframe: newTimeframe,
          change24h: newChange,
          reason: newReason
        };
        return updated;
      });

      // Pulse/Flash the updated card
      setFlashingSignalId(signalToUpdate.id);
      const flashTimeout = setTimeout(() => {
        setFlashingSignalId(null);
      }, 2500);

      return () => clearTimeout(flashTimeout);
    }, 6000); // scan every 6 seconds

    return () => clearInterval(interval);
  }, []);

  // --- CFD Transaction Execution ---

  const handleTradeExecute = async (trade: {
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
  }) => {
    // Assert if margin can be covered
    if (balance && balance.available < trade.margin) {
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `⚠️ **Margin Check Failed:** Your required leverage margin for this trade (**$${trade.margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**) exceeds your available account cash balance of **$${balance.available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**. Please deposit funds or adjust your trade parameters.`
          }
        ]
      };
      setMessages((prev) => [...prev, errorMsg]);
      setIsDepositModalOpen(true); // Open Deposit Modal
      return;
    }

    const position: TradeData = {
      id: trade.id,
      symbol: trade.symbol,
      direction: trade.direction,
      entryPrice: trade.price,
      size: trade.size,
      leverage: trade.leverage,
      margin: trade.margin,
      tp: trade.tp,
      sl: trade.sl,
      status: "OPEN",
      timestamp: trade.timestamp,
    };

    // Add position to active positions portfolio
    setPositions((prev) => [position, ...prev]);

    // Post reserve transaction to ledger
    if (account) {
      try {
        await postTradeReserve(account.id, trade.margin, trade.symbol, trade.id, trade.direction.toLowerCase() as "buy" | "sell");
        const newBal = await getAccountBalance(account.id);
        setBalance(newBal);
      } catch (err) {
        console.error("Failed to post trade reserve ledger entry:", err);
      }
    }

    // Append beautiful execution receipt to Chat feed
    const receiptId = Date.now().toString();
    const receiptMessage: ChatMessage = {
      id: receiptId,
      role: "assistant",
      parts: [
        {
          type: "trade-execution",
          text: JSON.stringify(position),
        },
      ],
    };
    setMessages((prev) => [...prev, receiptMessage]);
  };

  // Listen to standard "execute-simulated-trade" custom window events dispatched by Approach B widgets
  useEffect(() => {
    const handleSimulatedTrade = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { symbol, direction, size, price } = customEvent.detail;
      
      const leverage = 5;
      const margin = (size * price) / leverage;
      
      handleTradeExecute({
        id: "sim_" + Math.random().toString(36).substring(2, 11),
        symbol,
        direction,
        price,
        size,
        leverage,
        margin,
        tp: null,
        sl: null,
        timestamp: Date.now()
      });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("execute-simulated-trade", handleSimulatedTrade);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("execute-simulated-trade", handleSimulatedTrade);
      }
    };
  }, [handleTradeExecute]);

  const closePosition = async (id: string) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;

    const currentSpot = sidebarQuotes[pos.symbol]?.spot || pos.entryPrice;
    const finalPnl = pos.direction === "BUY"
      ? (currentSpot - pos.entryPrice) * pos.size
      : (pos.entryPrice - currentSpot) * pos.size;

    // Filter out of portfolio
    setPositions((prev) => prev.filter((p) => p.id !== id));

    // Post release and adjustment ledger entries in parallel
    if (account) {
      try {
        await Promise.all([
          postTradeRelease(account.id, pos.margin, pos.symbol, pos.id, pos.direction.toLowerCase() as "buy" | "sell"),
          postTradeAdjustment(account.id, finalPnl, pos.symbol, pos.id, pos.direction.toLowerCase() as "buy" | "sell")
        ]);
        const newBal = await getAccountBalance(account.id);
        setBalance(newBal);
      } catch (err) {
        console.error("Failed to post trade release / adjustment ledger entries:", err);
      }
    }

    // Append beautiful position closed confirmation card to chat feed
    const receiptId = Date.now().toString();
    const receiptMessage: ChatMessage = {
      id: receiptId,
      role: "assistant",
      parts: [
        {
          type: "trade-execution",
          text: JSON.stringify({
            ...pos,
            closePrice: currentSpot,
            pnl: finalPnl,
            status: "CLOSED",
            timestamp: Math.floor(Date.now() / 1000),
          }),
        },
      ],
    };
    setMessages((prev) => [...prev, receiptMessage]);
  };

  // --- Core AI Streaming Logic ---
  const handleSend = async (textToSend: string) => {
    const prompt = textToSend.trim();
    if (!prompt || loading) return;

    // Add user message
    const userMsgId = Date.now().toString();
    const newUserMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      parts: [{ type: "text", text: prompt }],
    };
    
    // Placeholder assistant message
    const assistantMsgId = (Date.now() + 1).toString();
    const newAssistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      parts: [],
    };

    setMessages((prev) => [...prev, newUserMessage, newAssistantMessage]);
    setValue("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });

      if (!response.body) {
        throw new Error("Response body is not readable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed) as { type: "reasoning" | "text"; text: string };
            
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              
              if (lastMsg && lastMsg.id === assistantMsgId) {
                const parts = [...lastMsg.parts];
                const lastPart = parts[parts.length - 1];

                if (lastPart && lastPart.type === event.type) {
                  parts[parts.length - 1] = {
                    ...lastPart,
                    text: lastPart.text + event.text,
                  };
                } else {
                  parts.push({ type: event.type, text: event.text });
                }

                updated[updated.length - 1] = {
                  ...lastMsg,
                  parts,
                };
              }
              return updated;
            });
          } catch (e) {
            console.warn("Could not parse stream event line:", trimmed, e);
          }
        }
      }
    } catch (err: any) {
      console.error("Streaming error caught on client:", err);
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg && lastMsg.id === assistantMsgId) {
          updated[updated.length - 1] = {
            ...lastMsg,
            parts: [
              ...lastMsg.parts,
              {
                type: "text",
                text: `\n\n*(A streaming connection failure occurred: ${err.message || "Failed to reach backend server"}. Please ensure stable local network connections.)*`,
              },
            ],
          };
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (label: string) => {
    let customizedPrompt = "";
    switch (label) {
      case "Clone a Screenshot":
        customizedPrompt = "Explain how to build a responsive interface with rich styling and modern animations.";
        break;
      case "Import from Figma":
        customizedPrompt = "How can we structure custom theme design tokens to build standard dark modes easily?";
        break;
      case "Upload a Project":
        customizedPrompt = "What are the best architectural practices for deploying modular containerized web services?";
        break;
      case "Landing Page":
        customizedPrompt = "Provide a clean, elegant layout template with styled buttons and neutral grids.";
        break;
      case "Sign Up Form":
        customizedPrompt = "Provide a clean sign-up layout with validated text fields and standard inputs.";
        break;
      default:
        customizedPrompt = `I would like some guidance and advice on: ${label}`;
    }
    setValue(customizedPrompt);
  };

  // --- CTA - Direct Analyze with Quant AI ---
  const triggerAiAnalysis = () => {
    const prompt = `Conduct a comprehensive, professional quantitative analysis on ${activeSymbol}. 

Provide:
1. **Executive Summary**: Asset profile and key market posture.
2. **Technical Outlook**: Signal markers and trend configurations.
3. **Volatility & Risk**: Expected spreads and delta movements.
4. **Strategic Guidance**: Formulate structured tactical considerations for simulated CFD entries.`;
    handleSend(prompt);
  };

  // Filter sidebar elements based on tab and search
  const filteredSymbols = useMemo(() => {
    const items = ASSET_CATALOG[activeCategory] || [];
    if (!searchQuery.trim()) return items;
    return items.filter(
      (item) =>
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeCategory, searchQuery]);

  const activeQuoteSpot = activeQuote?.spot ?? sidebarQuotes[activeSymbol]?.spot ?? 100.0;
  const activeQuoteBid = activeQuote?.bid ?? sidebarQuotes[activeSymbol]?.bid ?? activeQuoteSpot * 0.9995;
  const activeQuoteAsk = activeQuote?.ask ?? sidebarQuotes[activeSymbol]?.ask ?? activeQuoteSpot * 1.0005;
  const activeQuoteChange = activeQuote?.change24hPct ?? sidebarQuotes[activeSymbol]?.change24hPct ?? 0;
  const activeQuoteSpread = activeQuoteAsk - activeQuoteBid;
  const activeQuoteSpreadPct = (activeQuoteSpread / activeQuoteSpot) * 100;

  return (
    <div className="flex h-screen overflow-hidden bg-[#050508] text-zinc-200 antialiased selection:bg-indigo-500/20 selection:text-indigo-200 relative w-full">
      
      {/* Mesh Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[350px] bg-gradient-to-b from-indigo-950/10 via-transparent to-transparent blur-3xl pointer-events-none -z-10" />

      {/* --- LEFT SIDEBAR (Collapsible Asset List / Markets) --- */}
      <aside
        style={{ width: leftOpen ? `${leftWidth}px` : "0px" }}
        className={cn(
          "shrink-0 border-r border-zinc-900/60 bg-zinc-950/20 backdrop-blur-xl flex flex-col h-full relative z-30",
          !isResizing && "transition-all duration-300",
          leftOpen ? "opacity-100" : "opacity-0 overflow-hidden pointer-events-none"
        )}
      >
        {messages.length === 0 ? (
          <>
            {/* Landing Page: Attract cards */}
            <div className="p-4 border-b border-zinc-900/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <LineChart className="size-4 text-indigo-400 animate-pulse" />
                <h2 className="text-sm font-extrabold text-white tracking-wider uppercase">Hot Markets</h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase tracking-wider scale-90">Trending</span>
            </div>

            <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto scrollbar-none">
              {leftSlots.map((slot, index) => {
                const activeAsset = slot.activeSide === "front" ? slot.front : slot.back;

                return (
                  <div
                    key={index}
                    onClick={() => handleCardClick(activeAsset.symbol, activeAsset.asset_class, activeAsset.sector)}
                    className="relative w-full h-[270px] perspective-1000 cursor-pointer group shrink-0"
                  >
                    <div
                      className={cn(
                        "w-full h-full relative transform-style-3d transition-transform duration-700",
                        slot.isFlipped ? "rotate-y-180" : ""
                      )}
                    >
                      {/* Front Face */}
                      <div className="absolute inset-0 w-full h-full backface-hidden rounded-2xl bg-zinc-950/45 border border-zinc-900/60 group-hover:border-zinc-800/80 p-4 flex flex-col justify-between overflow-hidden shadow-lg shadow-black/20">
                        {renderCardFace(slot.front)}
                      </div>

                      {/* Back Face */}
                      <div className="absolute inset-0 w-full h-full backface-hidden rounded-2xl bg-zinc-950/45 border border-zinc-900/60 group-hover:border-zinc-800/80 p-4 flex flex-col justify-between overflow-hidden shadow-lg shadow-black/20 rotate-y-180">
                        {renderCardFace(slot.back)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Left Sidebar Header */}
            <div className="p-4 border-b border-zinc-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LineChart className="size-4 text-indigo-400" />
                <h2 className="text-sm font-extrabold text-white tracking-wider uppercase">Asset Markets</h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-900 text-zinc-400">DEMO</span>
            </div>

            {/* Tab Switcher (Markets vs Simulated Positions) */}
            <div className="px-4 pt-3 flex gap-2">
              <button
                onClick={() => setLeftSidebarTab("markets")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                  leftSidebarTab === "markets"
                    ? "bg-zinc-900 border border-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Activity className="size-3.5" />
                Markets
              </button>
              <button
                onClick={() => setLeftSidebarTab("portfolio")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 relative",
                  leftSidebarTab === "portfolio"
                    ? "bg-zinc-900 border border-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Briefcase className="size-3.5" />
                Portfolio
                {positions.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-extrabold text-white">
                    {positions.length}
                  </span>
                )}
              </button>
            </div>

            {leftSidebarTab === "markets" ? (
              <>
                {/* Market Explorer Search */}
                <div className="p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 size-4 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Filter by symbol..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-950/60 border border-zinc-900 focus:border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs outline-none text-zinc-200 placeholder:text-zinc-600 font-medium"
                    />
                  </div>
                </div>

                {/* Category horizontal tabs */}
                <div className="px-4 pb-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none border-b border-zinc-900/40">
                  {Object.keys(ASSET_CATALOG).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setActiveCategory(cat);
                        setSearchQuery("");
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase shrink-0 transition-all",
                        activeCategory === cat
                          ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-400"
                          : "bg-transparent border border-transparent text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Scrollable asset items */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredSymbols.map((item) => {
                    const q = sidebarQuotes[item.symbol];
                    const spot = q?.spot || 100;
                    const change = q?.change24hPct ?? 0;
                    const isActive = item.symbol === activeSymbol;

                    return (
                      <button
                        key={item.symbol}
                        onClick={() => {
                          setActiveSymbol(item.symbol);
                        }}
                        className={cn(
                          "w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between group",
                          isActive
                            ? "bg-zinc-900/60 border-zinc-800 text-white shadow-md shadow-black/10"
                            : "bg-transparent border-transparent hover:bg-zinc-900/20 text-zinc-400 hover:text-zinc-200"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AssetLogoIcon symbol={item.symbol} assetClass={item.asset_class} sector={item.sector} size="sm" className="rounded-lg shadow-sm border border-zinc-900/10 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-extrabold text-xs block tracking-tight text-zinc-100 group-hover:text-white transition-colors">{item.symbol}</span>
                            <span className="text-[10px] text-zinc-500 font-medium truncate block max-w-[110px]">{item.name}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-xs block text-zinc-100">
                            ${spot >= 1000 ? spot.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : spot.toFixed(3)}
                          </span>
                          <span className={cn(
                            "text-[9px] font-extrabold tracking-wide uppercase leading-none mt-0.5 inline-block",
                            change >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {change >= 0 ? "▲ +" : "▼ "}{change.toFixed(2)}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {filteredSymbols.length === 0 && (
                    <div className="text-center py-8 text-zinc-600 text-xs font-medium">
                      No matching assets found
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Portfolio Positions Tab */
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wide border-b border-zinc-900/40 pb-2">
                  <span>Active Contracts</span>
                  <span>LIVE P&L</span>
                </div>
                {positions.map((pos) => {
                  const liveQuote = sidebarQuotes[pos.symbol];
                  const currentSpot = liveQuote?.spot || pos.entryPrice;
                  const pnl = pos.direction === "BUY"
                    ? (currentSpot - pos.entryPrice) * pos.size
                    : (pos.entryPrice - currentSpot) * pos.size;
                  const isProfit = pnl >= 0;
                  const pnlPct = pos.margin > 0 ? (pnl / pos.margin) * 100 : 0;

                  return (
                    <div
                      key={pos.id}
                      className={cn(
                        "p-3 rounded-xl border bg-zinc-950/60 border-zinc-900/60 space-y-2.5 relative group hover:border-zinc-800 transition-all"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AssetLogoIcon symbol={pos.symbol} size="sm" className="rounded-lg shadow-sm border border-zinc-900/10 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-extrabold text-xs text-white block leading-none truncate">{pos.symbol}</span>
                            <span className={cn("text-[9px] font-extrabold tracking-wider uppercase mt-1 inline-block px-1 rounded leading-none", 
                              pos.direction === "BUY" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                            )}>
                              {pos.direction} {pos.leverage}x
                            </span>
                          </div>
                        </div>

                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider scale-90 border",
                          pos.direction === "BUY"
                            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                            : "bg-red-500/10 border-red-500/25 text-red-400"
                        )}>
                          {pos.direction === "BUY" ? "LONG / BUY" : "SHORT / SELL"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] font-mono border-t border-b border-zinc-900/40 py-2">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Size</span>
                          <span className="font-bold text-zinc-300">{pos.size} units</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Entry</span>
                          <span className="font-bold text-zinc-300">${pos.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Current</span>
                          <span className="font-bold text-zinc-300">${currentSpot.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Margin</span>
                          <span className="font-bold text-indigo-400">${pos.margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-zinc-950/20 p-2 rounded-lg border border-zinc-900">
                        <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wide">PnL Summary</span>
                        <div className="text-right flex flex-col">
                          <span className={cn(
                            "text-xs font-mono font-bold tracking-tight leading-none",
                            pnl >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {pnl >= 0 ? "+" : ""}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className={cn(
                            "text-[8px] font-mono font-extrabold leading-none mt-1",
                            pnl >= 0 ? "text-emerald-500" : "text-red-500"
                          )}>
                            ({pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => closePosition(pos.id)}
                        className="w-full py-1.5 bg-red-500/5 hover:bg-red-500/10 border border-red-500/15 hover:border-red-500/30 rounded-lg text-[9px] font-extrabold uppercase tracking-wider text-red-400 hover:text-white transition-all duration-300 cursor-pointer"
                      >
                        Close CFD Position
                      </button>
                    </div>
                  );
                })}
                {positions.length === 0 && (
                  <div className="text-center py-12 flex flex-col items-center justify-center space-y-3">
                    <Briefcase className="size-8 text-zinc-700 stroke-[1.25]" />
                    <p className="text-zinc-500 text-xs font-medium max-w-[150px] leading-normal text-center">Your simulated CFD portfolio is empty. Open some contracts to track P&L.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </aside>

      {/* --- RESIZER BAR --- */}
      {leftOpen && (
        <div
          onMouseDown={(e) => startResize("left", e)}
          className={cn(
            "w-[5px] hover:w-[6px] cursor-col-resize h-full relative z-40 transition-all select-none border-r border-zinc-950 shrink-0",
            isResizing === "left"
              ? "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
              : "bg-zinc-900/30 hover:bg-indigo-500/30"
          )}
        />
      )}

      {/* --- CONVERSATIONAL AI WORKSPACE (Right Panel) --- */}
      <div className="flex-1 flex flex-col relative h-full min-w-0 bg-[#050508]">
        
        {/* Mesh Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[350px] bg-gradient-to-b from-indigo-950/5 via-transparent to-transparent blur-3xl pointer-events-none -z-10" />

        {/* Top Minimal Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-900/60 bg-zinc-950/40 backdrop-blur-xl sticky top-0 z-40 shrink-0 select-none">
          <div className="flex items-center gap-3">
            {/* Toggle Left Sidebar */}
            <button
              onClick={() => setLeftOpen(!leftOpen)}
              className="p-1.5 rounded-lg border border-zinc-900/60 bg-zinc-950/20 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer"
              title="Toggle Trading Station"
            >
              <Menu className="size-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <SparklesIcon className="size-4 text-indigo-400" />
              <span className="font-bold tracking-tight text-white text-sm uppercase">Quant AI Workspace</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Wallet Widget */}
            {balance && (
              <div className="flex items-center gap-2.5 bg-zinc-950/80 border border-zinc-900 rounded-xl px-3 py-1.5 shadow-md">
                <div className="flex flex-col text-right">
                  <span className="text-[8px] text-zinc-500 font-extrabold tracking-wider uppercase leading-none">Simulated Cash</span>
                  <span className="text-xs font-mono font-bold text-white tracking-tight mt-0.5">${balance.available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <button
                  onClick={() => setIsDepositModalOpen(true)}
                  className="p-1 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all duration-300 cursor-pointer text-[9px] font-extrabold uppercase tracking-wider px-2"
                >
                  + Deposit
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Conversation Container */}
        <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto px-4 sm:px-6 pb-6 pt-4 min-h-0 relative h-full self-center">
          {messages.length === 0 ? (
            /* Centered Welcome Screen */
            <div className="flex-1 flex flex-col items-center justify-center space-y-8 w-full py-10">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                  <SparklesIcon className="size-5 text-white" />
                </div>
                <h1 className="text-4xl font-extrabold text-white tracking-tight sm:text-5xl select-none">
                  Quant Trading AI
                </h1>
                <p className="text-zinc-500 text-sm max-w-md select-none font-medium leading-relaxed">
                  Welcome to Quant. Explore assets on the Left Trading Station, analyze live trends, and request deep comparative analysis using natural language.
                </p>
              </div>

              <div className="w-full max-w-2xl">
                {/* Central Input Box */}
                <InputBar
                  value={value}
                  onChange={setValue}
                  onSend={({ content }) => handleSend(content)}
                  disabled={loading}
                  status={loading ? "streaming" : "ready"}
                  placeholder={`Ask Quant about ${activeSymbol} or any other asset...`}
                  onAttach={() => {}}
                />
              </div>
            </div>
          ) : (
            /* Active Conversational Thread */
            <div className="flex-1 flex flex-col w-full min-h-0 space-y-4 relative">
              <Conversation>
                <ConversationContent className="p-1 pb-32 space-y-6 bg-transparent">
                  {messages.map((message, messageIndex) => {
                    const isLastMessage = messageIndex === messages.length - 1;

                    return (
                      <div key={message.id} className="flex flex-col gap-2">
                        <ChatMessageBubble
                          message={message}
                          isAssistantStreaming={loading && isLastMessage}
                          livePrices={sidebarQuotes}
                          onClosePosition={closePosition}
                        />

                        {message.role === "assistant" && isLastMessage && !loading && (
                          <div className="flex items-center gap-1.5 justify-start pl-12 sm:pl-16">
                            <button
                              onClick={() => handleSend(messages[messages.length - 2]?.parts[0]?.text || "")}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-zinc-800 bg-zinc-900/10 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-500 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                              title="Retry"
                            >
                              <RefreshCcwIcon className="size-3" />
                              <span>Retry</span>
                            </button>
                            <button
                              onClick={() => {
                                const combinedText = message.parts.map((p) => p.text).join("");
                                navigator.clipboard.writeText(combinedText);
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-zinc-800 bg-zinc-900/10 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-500 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                              title="Copy"
                            >
                              <CopyIcon className="size-3" />
                              <span>Copy</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </ConversationContent>
                <ConversationScrollButton className="border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:text-white" />
              </Conversation>

              {/* Floating Bottom Input Bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#050508] via-[#050508]/95 to-transparent pt-4 pb-2 z-30">
                <InputBar
                  value={value}
                  onChange={setValue}
                  onSend={({ content }) => handleSend(content)}
                  disabled={loading}
                  status={loading ? "streaming" : "ready"}
                  placeholder={`Ask Quant about ${activeSymbol} or any other asset...`}
                  onAttach={() => {}}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* --- QUICK TRADE DIALOG COMPONENT --- */}
      <QuickTradeDialog
        isOpen={isTradeOpen}
        onClose={() => setIsTradeOpen(false)}
        symbol={activeSymbol}
        currentPrice={activeQuoteSpot}
        bid={activeQuoteBid}
        ask={activeQuoteAsk}
        change24hPct={activeQuoteChange}
        onExecute={handleTradeExecute}
      />

      {/* --- FUND DEPOSIT MODAL --- */}
      {isDepositModalOpen && account && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950/95 border border-zinc-900 rounded-2xl w-full max-w-md p-6 relative shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={() => setIsDepositModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-zinc-900 bg-zinc-950 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer"
            >
              <X className="size-4" />
            </button>

            {/* Header */}
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-indigo-400 tracking-wider uppercase">PAPER TRADING WALLET</span>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
                <DollarSign className="size-5 text-indigo-400" />
                Fund Demo Account
              </h2>
              <p className="text-xs text-zinc-500 font-medium">Add simulated capital to your paper margin account instantly.</p>
            </div>

            {/* Account Status Card */}
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-3.5 flex items-center justify-between text-xs font-mono">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 font-bold block leading-none">DEMO ACCOUNT</span>
                <span className="text-zinc-300 font-bold">{account.id.substring(0, 16)}...</span>
              </div>
              <div className="text-right space-y-1">
                <span className="text-[10px] text-zinc-500 font-bold block leading-none">CURRENT BALANCE</span>
                <span className="text-emerald-400 font-bold">${balance ? balance.available.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}</span>
              </div>
            </div>

            {/* Preset Amount buttons */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wide">Select Capital Amount</span>
              <div className="grid grid-cols-4 gap-2">
                {[1000, 5000, 10000, 50000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(String(amt))}
                    className={cn(
                      "py-2.5 rounded-xl text-xs font-bold font-mono transition-all border cursor-pointer",
                      depositAmount === String(amt)
                        ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400"
                        : "bg-zinc-950/60 border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200"
                    )}
                  >
                    +${amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wide">Custom Amount (USD)</span>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 size-4 text-zinc-500" />
                <input
                  type="number"
                  min="1"
                  placeholder="Enter amount..."
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-900 focus:border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm font-mono outline-none text-zinc-200 placeholder:text-zinc-600 font-bold"
                />
              </div>
            </div>

            {/* Gateway selectors */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wide">Payment Simulator Gateway</span>
              <div className="grid grid-cols-3 gap-2">
                {["ACH", "Crypto", "Card"].map((gw) => (
                  <button
                    key={gw}
                    type="button"
                    onClick={() => setDepositGateway(gw)}
                    className={cn(
                      "py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                      depositGateway === gw
                        ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400"
                        : "bg-zinc-950/60 border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200"
                    )}
                  >
                    {gw === "Crypto" ? "🌐 Crypto Sim" : gw === "ACH" ? "🏦 ACH Bank" : "💳 Credit Card"}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleDepositSubmit}
              disabled={isDepositing || !depositAmount || Number(depositAmount) <= 0}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:opacity-95 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 border border-indigo-400/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isDepositing ? (
                <>
                  <RefreshCcwIcon className="size-3.5 animate-spin" />
                  Simulating Transfer...
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  Fund Demo Wallet
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Action Button sub-component with beautiful design
interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function ActionButton({ icon, label, onClick }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2 px-5 py-2.5 bg-zinc-950/40 hover:bg-zinc-900/60 rounded-full border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-white transition-all duration-300 hover:shadow-[0_4px_20px_rgba(99,102,241,0.02)] scale-[1] hover:scale-[1.01] cursor-pointer"
    >
      {icon}
      <span className="text-xs font-semibold tracking-wide transition-colors">{label}</span>
    </button>
  );
}
