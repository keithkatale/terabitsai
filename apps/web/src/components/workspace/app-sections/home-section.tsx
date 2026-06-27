"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Flame,
  Search,
  MessageSquare,
  Sparkles,
  Info,
  X,
  Gauge,
  Compass,
  Zap,
  Activity,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ASSET_CATALOG, type CatalogAsset } from "@/lib/catalog/asset-catalog";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import {
  INITIAL_SIGNALS,
  MARKET_NEWS_POOL,
  INVEST_OPPORTUNITIES_POOL,
  TRADING_STRATEGIES,
  type LiveSignal,
  type MarketNewsItem,
  type InvestOpportunity
} from "@/lib/market/market-intel-data";


// Direct styling for self-contained scrolling catalyst marquee & needle rotations
const MARQUEE_STYLE = `
  @keyframes marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .marquee-container {
    overflow: hidden;
    white-space: nowrap;
    position: relative;
    width: 100%;
  }
  .marquee-content {
    display: inline-flex;
    animation: marquee 35s linear infinite;
    width: max-content;
  }
  .marquee-content:hover {
    animation-play-state: paused;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

// Helper: Format large numbers (millions/billions/trillions)
function formatLargeNum(val: number, isCurrency = true) {
  const prefix = isCurrency ? "$" : "";
  if (val >= 1e12) return `${prefix}${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `${prefix}${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `${prefix}${(val / 1e6).toFixed(2)}M`;
  return `${prefix}${val.toLocaleString()}`;
}

// Helper: Format regular spot prices
function formatPrice(val: number, symbol = "") {
  if (symbol.includes("USD") || symbol === "") {
    if (val < 1) return `$${val.toFixed(4)}`;
    if (val < 10) return `$${val.toFixed(3)}`;
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

// Helper: Generate static but realistic historical paths for sparklines
function generateSparklineData(symbol: string, length = 15, pctChange = 0) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const seed = Math.abs(hash) % 1000;
  const data: number[] = [];
  let current = seed;
  for (let i = 0; i < length; i++) {
    const factor = Math.sin(i + seed) * (seed / 100);
    current += factor;
    data.push(current);
  }
  // Adjust last item to align with percent change trend
  if (pctChange !== 0) {
    const start = data[0];
    const end = start * (1 + pctChange / 100);
    const step = (end - start) / (length - 1);
    for (let i = 0; i < length; i++) {
      data[i] = start + step * i + (Math.sin(i) * (start * 0.01));
    }
  }
  return data;
}

// Sparkline SVG Component
function MiniSparkline({ data, trend }: { data: number[]; trend: "up" | "down" }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 120;
  const height = 40;
  const padding = 2;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - ((val - min) / range) * (height - padding * 2) - padding;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const fillD = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`;

  const color = trend === "up" ? "#00FF85" : "#FF3B30";

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${trend}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#grad-${trend})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export interface EnrichedAsset extends CatalogAsset {
  rank: number;
  spotPrice: number;
  change1h: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  liquidityChain?: "Base" | "Solana" | "Ethereum" | "Arbitrum" | "Optimism";
  ageDays: number;
  txBuyRatio: number;
  securityFlag: "Safe" | "Caution" | "Risk";
}

interface HomeSectionProps {
  sidebarQuotes: Record<string, { spot?: number; change24hPct?: number }>;
  goToChatWithPrompt?: (prompt: string) => void;
  onSignalTrigger?: (prompt: string) => void;
  isHomeChatSidebarOpen?: boolean;
}

export function HomeSection({
  sidebarQuotes,
  goToChatWithPrompt,
  onSignalTrigger,
  isHomeChatSidebarOpen,
}: HomeSectionProps) {
  const [activeCategory, setActiveCategory] = useState<string>("All Assets");
  const [timeframe, setTimeframe] = useState<"1h" | "4h" | "24h">("24h");
  const [rowLimit, setRowLimit] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<EnrichedAsset | null>(null);
  const [copilotInput, setCopilotInput] = useState("");

  // Real-time ticking and flashing state hooks
  const [liveQuotesState, setLiveQuotesState] = useState<Record<string, { spot: number; change24hPct?: number; bid?: number; ask?: number }>>({});
  const [tickDirections, setTickDirections] = useState<Record<string, "up" | "down">>({});

  // Cycle indices for AI indicators
  const [signalIndex, setSignalIndex] = useState(0);
  const [smcIndex, setSmcIndex] = useState(1);
  const [newsIndex, setNewsIndex] = useState(0);
  const [oppIndex, setOpportunityIndex] = useState(0);

  // Keep a ref to active symbols for steady ticking interval
  const paginatedAssetsRef = useRef<Array<{ symbol: string; assetClass?: string }>>([]);



  // Market metrics states (simulated but state-locked for realism)
  const marketCap = 2415892040510;
  const marketCapChange24h = 2.45;
  const cmc20Index = 1450.84;
  const cmc20Change24h = 3.12;
  const fearAndGreedVal = 74; // Greed
  const altcoinSeasonVal = 38; // Bitcoin Season (0-100 scale, <50 is BTC season)
  const marketAverageRsi = 58.4;

  const sparklineCap = [2.35, 2.36, 2.34, 2.38, 2.37, 2.39, 2.41, 2.40, 2.42];
  const sparklineCmc20 = [1380, 1395, 1390, 1410, 1422, 1405, 1430, 1445, 1450];

  // Real-time fetching of actual live quotes from Capital.com API
  useEffect(() => {
    const fetchLiveQuotes = async () => {
      const activeAssets = paginatedAssetsRef.current;
      if (activeAssets.length === 0) return;

      try {
        const results = await Promise.allSettled(
          activeAssets.map(async (asset) => {
            const sym = asset.symbol;
            const assetClass = asset.assetClass || "stock";
            const res = await fetch(`/api/market/quote?symbol=${encodeURIComponent(sym)}&assetClass=${assetClass}`);
            if (!res.ok) return null;
            return await res.json();
          })
        );

        setLiveQuotesState((prev) => {
          const next = { ...prev };
          const nextDirections: Record<string, "up" | "down"> = {};

          results.forEach((r) => {
            if (r.status === "fulfilled" && r.value) {
              const data = r.value;
              const sym = data.symbol;
              const newSpot = data.spot;
              const prevSpot = prev[sym]?.spot ?? sidebarQuotes[sym]?.spot;

              if (prevSpot && newSpot !== prevSpot) {
                nextDirections[sym] = newSpot > prevSpot ? "up" : "down";
              }

              next[sym] = {
                spot: newSpot,
                change24hPct: data.change24hPct,
                bid: data.bid,
                ask: data.ask,
              };
            }
          });

          if (Object.keys(nextDirections).length > 0) {
            setTickDirections(nextDirections);
            const timeout = setTimeout(() => {
              setTickDirections({});
            }, 1200);
          }

          return next;
        });
      } catch (err) {
        console.error("Failed to fetch live quotes on interval:", err);
      }
    };

    // Initial run
    void fetchLiveQuotes();

    const interval = setInterval(() => {
      void fetchLiveQuotes();
    }, 10000);

    return () => clearInterval(interval);
  }, [sidebarQuotes]);

  // Sync AI card rotation indices on a 10s interval
  useEffect(() => {
    const interval = setInterval(() => {
      setSignalIndex((prev) => (prev + 1) % INITIAL_SIGNALS.length);
      setSmcIndex((prev) => (prev + 1) % INITIAL_SIGNALS.length);
      setNewsIndex((prev) => (prev + 1) % MARKET_NEWS_POOL.length);
      setOpportunityIndex((prev) => (prev + 1) % INVEST_OPPORTUNITIES_POOL.length);
    }, 10000);

    return () => clearInterval(interval);
  }, []);


  // Ingest full catalogs from asset-catalog.ts
  const fullAssetsList = useMemo(() => {
    const list: EnrichedAsset[] = [];

    let rankCounter = 1;

    // We process each category
    Object.entries(ASSET_CATALOG).forEach(([catName, assets]) => {
      assets.forEach((asset) => {
        // Generate stable-simulated telemetry metrics matching the symbol hash
        let hash = 0;
        for (let i = 0; i < asset.symbol.length; i++) {
          hash = asset.symbol.charCodeAt(i) + ((hash << 5) - hash);
        }
        const sSeed = Math.abs(hash);

        // Fetch live spot quote or fall back to simulated spot
        const quoteSource = liveQuotesState[asset.symbol] ?? sidebarQuotes[asset.symbol];
        const liveSpot = quoteSource?.spot;
        const liveChange24h = quoteSource?.change24hPct;

        let basePrice = 100.0;
        if (asset.asset_class === "crypto") {
          if (asset.symbol.startsWith("BTC")) basePrice = 64500;
          else if (asset.symbol.startsWith("ETH")) basePrice = 3450;
          else if (asset.symbol.startsWith("SOL")) basePrice = 142;
          else basePrice = (sSeed % 250) + 0.5;
        } else if (catName === "Stocks") {
          basePrice = (sSeed % 350) + 15;
        } else if (catName === "Forex") {
          basePrice = 1.0 + (sSeed % 100) / 1000;
        } else {
          basePrice = (sSeed % 2000) + 5;
        }

        const spotPrice = liveSpot ?? basePrice;
        const change24h = liveChange24h ?? ((sSeed % 120) - 55) / 10;
        const change1h = ((sSeed % 40) - 18) / 10;

        // Realistic market cap scaling
        let assetMarketCap = spotPrice * ((sSeed % 5000000) + 100000);
        if (asset.symbol === "BTCUSD") assetMarketCap = 1270000000000;
        else if (asset.symbol === "ETHUSD") assetMarketCap = 415000000000;
        else if (asset.symbol === "AAPL") assetMarketCap = 3150000000000;
        else if (asset.symbol === "MSFT") assetMarketCap = 3250000000000;

        const volume24h = assetMarketCap * ((sSeed % 15) + 1) / 100;
        const liquidity = assetMarketCap * ((sSeed % 5) + 0.5) / 1000;

        const chains: Array<"Base" | "Solana" | "Ethereum" | "Arbitrum" | "Optimism"> = [
          "Ethereum",
          "Solana",
          "Base",
          "Arbitrum",
          "Optimism",
        ];
        const liquidityChain = asset.asset_class === "crypto" ? chains[sSeed % chains.length] : undefined;

        const ageDays = (sSeed % 2500) + 12;
        const txBuyRatio = 0.35 + (sSeed % 50) / 100; // e.g. 0.35 to 0.85
        
        let securityFlag: "Safe" | "Caution" | "Risk" = "Safe";
        if (sSeed % 12 === 0) securityFlag = "Risk";
        else if (sSeed % 7 === 0) securityFlag = "Caution";

        list.push({
          ...asset,
          rank: 0, // Assigned below after sorting
          spotPrice,
          change1h,
          change24h,
          marketCap: assetMarketCap,
          volume24h,
          liquidity,
          liquidityChain,
          ageDays,
          txBuyRatio,
          securityFlag,
        });
      });
    });

    // Sort assets by Market Cap descending and assign ranks
    list.sort((a, b) => b.marketCap - a.marketCap);
    return list.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [sidebarQuotes, liveQuotesState]);


  // Filtered Assets list
  const filteredAssets = useMemo(() => {
    return fullAssetsList.filter((asset) => {
      // Category filter
      if (activeCategory !== "All Assets") {
        let matchesCategory = false;
        if (activeCategory === "Crypto" && asset.asset_class === "crypto") matchesCategory = true;
        else if (activeCategory === "Stocks" && asset.sector !== "Forex" && asset.sector !== "Indices" && asset.sector !== "Commodities" && asset.sector !== "ETFs" && asset.asset_class !== "crypto") matchesCategory = true;
        else if (activeCategory === "Forex" && asset.sector === "Forex") matchesCategory = true;
        else if (activeCategory === "Indices" && asset.sector === "Indices") matchesCategory = true;
        else if (activeCategory === "Commodities" && asset.sector === "Commodities") matchesCategory = true;
        else if (activeCategory === "ETFs" && asset.sector === "ETFs") matchesCategory = true;

        if (!matchesCategory) return false;
      }

      // Query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          asset.symbol.toLowerCase().includes(query) ||
          asset.name.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [fullAssetsList, activeCategory, searchQuery]);

  // Paginated list
  const paginatedAssets = useMemo(() => {
    return filteredAssets.slice(0, rowLimit);
  }, [filteredAssets, rowLimit]);

  // Sync paginated symbols to the ref whenever they change
  useEffect(() => {
    paginatedAssetsRef.current = paginatedAssets.map((a) => ({
      symbol: a.symbol,
      assetClass: a.asset_class,
    }));
  }, [paginatedAssets]);

  // Scrolling catalysts marquee feed
  const catalysts = [
    "🔥 Fed chair hints at potential interest rate pauses, sparking multi-market rallies.",
    "⚡ Bitcoin (BTCUSD) holds steady above major order block support at $64,200.",
    "🚀 Solana (SOL) ecosystem volume surges 14% on massive Base and Solana DEX liquidity inflows.",
    "📈 Apple (AAPL) targets artificial intelligence enhancements ahead of WWDC keynote.",
    "💎 Gold (XAUUSD) touches historical highs on persistent macro hedge allocations.",
    "🇪🇺 Euro stays resilient following ECB structural policy adjustments.",
    "📉 Oil prices drop as OPEC reports production rebalances for upcoming quarter.",
  ];

  // Bottom copilot trigger
  const handleCopilotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotInput.trim()) return;
    if (goToChatWithPrompt) {
      goToChatWithPrompt(copilotInput.trim());
    } else {
      // Fallback
      sessionStorage.setItem("chat:pending", JSON.stringify({ prompt: copilotInput.trim(), tags: [] }));
      window.location.href = "/app/new";
    }
  };

  // Direct trigger to chat about specific asset
  const askCopilotAboutAsset = (asset: CatalogAsset) => {
    const prompt = `Provide a comprehensive technical analysis of ${asset.symbol} (${asset.name}). Please outline detected order blocks, Fair Value Gaps, current daily RSI metrics, and simulated CFD trade boundaries.`;
    if (goToChatWithPrompt) {
      goToChatWithPrompt(prompt);
    } else {
      sessionStorage.setItem("chat:pending", JSON.stringify({ prompt, tags: [] }));
      window.location.href = "/app/new";
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(var(--app-bottom-nav-height)+1rem+env(safe-area-inset-bottom,0px))] custom-scrollbar">
      {/* Dynamic Keyframe style sheet */}
      <style>{MARQUEE_STYLE}</style>

      <div className="mx-auto w-full max-w-[1550px] p-2 sm:p-4 lg:p-5 space-y-4">
        
        {/* Header Title */}
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl flex items-center gap-2">
              <Compass className="size-5 text-[var(--accent-cyan)] animate-pulse" />
              Centralized Market Console
            </h1>
            <p className="text-xs text-zinc-500">
              Aggregated real-time metrics, indexes, liquidity pools, and AI-supported risk audits across all sectors.
            </p>
          </div>

          {/* Alert Ticker Bar inside Header */}
          <div className="mt-2 md:mt-0 flex items-center gap-2 rounded-lg bg-white/[0.02] border border-white/[0.05] px-3 py-1.5 max-w-full md:max-w-md lg:max-w-xl">
            <span className="flex items-center gap-1 shrink-0 text-[10px] font-bold text-amber-500 uppercase tracking-wider bg-amber-500/10 px-1.5 py-0.5 rounded animate-pulse">
              <Flame className="size-3" /> CATALYSTS
            </span>
            <div className="marquee-container text-xs text-zinc-400">
              <div className="marquee-content gap-8">
                {catalysts.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1 shrink-0">
                    {c}
                  </span>
                ))}
                {/* Repeat for seamless marquee */}
                {catalysts.map((c, i) => (
                  <span key={`rep-${i}`} className="inline-flex items-center gap-1 shrink-0">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 1. TOP INDICATORS CAROUSEL / CARDS GRID                 */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
          
          {/* Card 1: AI Scanner Status */}
          <div
            onClick={() => onSignalTrigger?.("Explain the active background crawlers and RAG scanning process you are running. What targets are currently being scanned, and how is the SMC matrix alignment being optimized?")}
            className="quant-card p-3.5 flex flex-col justify-between space-y-3.5 relative overflow-hidden group cursor-pointer active:scale-[0.98] hover:border-cyan-500/30 hover:shadow-[0_0_25px_rgba(6,182,212,0.1)] transition-all duration-300"
          >
            {/* Ambient glow in background */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-cyan-500/10 transition-all duration-500" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <Activity className="size-3 text-cyan-400" />
                AI Scan Console
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">
                <span className="size-1.5 bg-emerald-400 rounded-full animate-ping shrink-0" />
                ACTIVE
              </span>
            </div>
            <div>
              <div className="flex gap-0.5 h-6 items-end justify-center py-0.5 mb-1.5">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-cyan-400/40 rounded-full transition-all duration-300"
                    style={{
                      height: `${20 + Math.abs(Math.sin((signalIndex * 1.5) + i)) * 80}%`,
                    }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-white/[0.04] pt-2 text-[10px]">
                <div>
                  <span className="text-zinc-500 block">Workers Active</span>
                  <span className="text-white font-black">8 Agents</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Scan Speed</span>
                  <span className="text-cyan-400 font-black">150ms/p</span>
                </div>
              </div>
            </div>
            <p className="text-[9px] text-zinc-500 mt-0.5">Continuous RAG crawling & SMC matrix alignment</p>
          </div>

          {/* Card 2: High-Conviction AI Signal */}
          {(() => {
            const activeSignal = INITIAL_SIGNALS[signalIndex];
            const isBuy = activeSignal.action === "BUY";
            return (
              <div
                onClick={() => onSignalTrigger?.(`Provide a deep-dive analysis of the high-conviction AI Intelligence Signal for ${activeSignal.symbol}. The signal is a ${activeSignal.action} trigger using the ${activeSignal.strategy} strategy on the ${activeSignal.timeframe} timeframe. The reported reasoning is: '${activeSignal.reason}'. Please give more details, target validation, and risk management guidelines.`)}
                className="quant-card p-3.5 flex flex-col justify-between space-y-2 relative overflow-hidden group cursor-pointer active:scale-[0.98] hover:border-emerald-500/30 hover:shadow-[0_0_25px_rgba(16,185,129,0.1)] transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="size-3 text-emerald-400" />
                    AI Intelligence Signal
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider",
                    isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                  )}>
                    {activeSignal.action}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <AssetLogoIcon
                    symbol={activeSignal.symbol}
                    assetClass={activeSignal.assetClass}
                    sector={activeSignal.sector}
                    size="sm"
                    className="rounded-full border border-white/[0.05]"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-white leading-none">{activeSignal.symbol}</span>
                    <span className="text-[9px] text-zinc-500 font-extrabold mt-1">{activeSignal.strategy} ({activeSignal.timeframe})</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 line-clamp-2 h-7 font-medium leading-normal">
                    {activeSignal.reason}
                  </p>
                  <p className="text-[9px] text-zinc-500 border-t border-white/[0.04] pt-1.5 mt-1.5 flex justify-between">
                    <span>Conviction Rating</span>
                    <span className="text-emerald-400 font-extrabold uppercase">94% Highly Probable</span>
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Card 3: Smart Money Concepts */}
          {(() => {
            const activeSMC = INITIAL_SIGNALS[smcIndex];
            const isBullish = activeSMC.action === "BUY";
            return (
              <div
                onClick={() => onSignalTrigger?.(`Analyze the Smart Money Concepts (SMC) Order Flow signal detected for ${activeSMC.symbol}. The action is ${activeSMC.action === "BUY" ? "BUY (Liquidity Sweep)" : "SELL (Supply Mitigation)"} with structure shift ${activeSMC.action === "BUY" ? "BOS (Bullish)" : "CHoCH (Bearish)"} and active sweep zone. Please outline key Fair Value Gaps, order blocks, and trade boundaries.`)}
                className="quant-card p-3.5 flex flex-col justify-between space-y-2 relative overflow-hidden group cursor-pointer active:scale-[0.98] hover:border-purple-500/30 hover:shadow-[0_0_25px_rgba(168,85,247,0.1)] transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Gauge className="size-3 text-purple-400" />
                    SMC Order Flow
                  </span>
                  <span className={cn(
                    "text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider",
                    isBullish ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"
                  )}>
                    {isBullish ? "Liquidity Raid" : "Supply Mitigation"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <AssetLogoIcon
                    symbol={activeSMC.symbol}
                    assetClass={activeSMC.assetClass}
                    sector={activeSMC.sector}
                    size="sm"
                    className="rounded-full border border-white/[0.05]"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-white leading-none">{activeSMC.symbol}</span>
                    <span className="text-[9px] text-zinc-500 font-extrabold mt-1">Structure Shift Detected</span>
                  </div>
                </div>
                <div className="space-y-1 text-[10px] text-zinc-400">
                  <div className="flex justify-between">
                    <span>Structural Trend:</span>
                    <span className="font-bold text-white uppercase">{isBullish ? "BOS (Bullish)" : "CHoCH (Bearish)"}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.04] pt-1">
                    <span>Mitigation Zone:</span>
                    <span className="font-extrabold text-[var(--accent-cyan)] uppercase">Active Sweep Zone</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Card 4: Predictive News Concept */}
          {(() => {
            const activeNews = MARKET_NEWS_POOL[newsIndex];
            const sentimentColor = activeNews.sentiment === "bullish"
              ? "text-[var(--accent-green)] bg-emerald-500/10"
              : activeNews.sentiment === "bearish"
              ? "text-[var(--accent-red)] bg-red-500/10"
              : "text-zinc-400 bg-white/[0.04]";
            return (
              <div
                onClick={() => onSignalTrigger?.(`Analyze the Predictive News Concept headline: '${activeNews.headline}'. The sentiment is ${activeNews.sentiment}. Summary: '${activeNews.summary}'. Please explain how this macro catalyst affects the involved symbols (${activeNews.symbols.join(", ")}) and predict potential volatility bounds.`)}
                className="quant-card p-3.5 flex flex-col justify-between space-y-2 relative overflow-hidden group cursor-pointer active:scale-[0.98] hover:border-amber-500/30 hover:shadow-[0_0_25px_rgba(245,158,11,0.1)] transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Compass className="size-3 text-amber-400" />
                    AI Impact Predictor
                  </span>
                  <span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider", sentimentColor)}>
                    {activeNews.sentiment}
                  </span>
                </div>
                <div className="mt-0.5">
                  <h4 className="text-[11px] font-bold text-white line-clamp-1 hover:underline cursor-pointer leading-tight">
                    {activeNews.headline}
                  </h4>
                  <p className="text-[10px] text-zinc-500 line-clamp-2 h-7 mt-1 font-medium leading-normal">
                    {activeNews.summary}
                  </p>
                </div>
                <div className="pt-1.5 border-t border-white/[0.04] flex items-center justify-between">
                  <span className="text-[9px] font-semibold text-zinc-500 uppercase">Impact Tickers</span>
                  <div className="flex items-center gap-1">
                    {activeNews.symbols.slice(0, 3).map((sym) => (
                      <span key={sym} className="text-[9px] font-black text-white bg-white/[0.04] border border-white/[0.05] px-1 rounded flex items-center gap-0.5">
                        <AssetLogoIcon symbol={sym} size="xs" className="rounded-full shrink-0" />
                        {sym}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Card 5: Tactical Market Opportunities */}
          {(() => {
            const activeOpp = INVEST_OPPORTUNITIES_POOL[oppIndex];
            return (
              <div
                onClick={() => onSignalTrigger?.(`Explain the Tactical Market Opportunity: '${activeOpp.title}'. Horizon: ${activeOpp.horizon}, Thesis: '${activeOpp.thesis}'. Symbols involved: ${activeOpp.symbols.join(", ")}. Conviction score: ${activeOpp.conviction}/5. Provide structural entries, risk profiles, and expected thematic triggers.`)}
                className="quant-card p-3.5 flex flex-col justify-between space-y-2 relative overflow-hidden group cursor-pointer active:scale-[0.98] hover:border-cyan-500/30 hover:shadow-[0_0_25px_rgba(6,182,212,0.1)] transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Zap className="size-3 text-cyan-400" />
                    Thematic Opportunity
                  </span>
                  <span className="text-[9px] font-black text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {activeOpp.horizon}
                  </span>
                </div>
                <div className="mt-0.5">
                  <h4 className="text-xs font-black text-white truncate leading-tight">{activeOpp.title}</h4>
                  <p className="text-[10px] text-zinc-400 line-clamp-2 h-7 mt-1 font-medium leading-normal">
                    {activeOpp.thesis}
                  </p>
                </div>
                <div className="pt-1.5 border-t border-white/[0.04] flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {activeOpp.symbols.slice(0, 2).map((sym) => (
                      <span key={sym} className="text-[9px] font-black text-white bg-white/[0.04] border border-white/[0.05] px-1 rounded flex items-center gap-0.5">
                        <AssetLogoIcon symbol={sym} size="xs" className="rounded-full shrink-0" />
                        {sym}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Sparkles
                        key={idx}
                        className={cn(
                          "size-2.5",
                          idx < activeOpp.conviction ? "text-yellow-400 fill-yellow-400" : "text-zinc-800"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

        </div>

        {/* ======================================================== */}
        {/* 2. CATEGORY PILLS & TABLE FILTERS ROW                   */}
        {/* ======================================================== */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between py-1">
          {/* Narrative / Asset Class Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 md:pb-0 custom-scrollbar">
            {["All Assets", "Crypto", "Stocks", "Forex", "Indices", "Commodities", "ETFs"].map((cat) => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all shrink-0",
                    active
                      ? "bg-[var(--accent-cyan)] text-zinc-950 border-[var(--accent-cyan)] shadow-[0_0_12px_rgba(0,229,255,0.2)]"
                      : "bg-white/[0.02] text-zinc-400 border-white/[0.05] hover:text-white hover:bg-white/[0.04]",
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Search, Timeframe & Limit Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter symbols..."
                className="w-full sm:w-[240px] pl-8 pr-3 py-1.5 bg-black/40 border border-white/[0.06] rounded-lg text-xs font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Timeframe selector */}
            <div className="flex items-center bg-black/40 border border-white/[0.06] p-0.5 rounded-lg shrink-0">
              {(["1h", "4h", "24h"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase",
                    timeframe === tf
                      ? "bg-white/10 text-white"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Display limit selector */}
            <div className="flex items-center bg-black/40 border border-white/[0.06] p-0.5 rounded-lg shrink-0">
              {([15, 30, 50] as const).map((lim) => (
                <button
                  key={lim}
                  onClick={() => setRowLimit(lim)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                    rowLimit === lim
                      ? "bg-white/10 text-white"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {lim}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. CENTRAL TELEMETRY GRID TABLE                         */}
        {/* ======================================================== */}
        <div className="quant-card overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.01] text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-3">Asset</th>
                  <th className="py-3 px-3 text-right">Price</th>
                  <th className="py-3 px-3 text-right w-24">1H %</th>
                  <th className="py-3 px-3 text-right w-24">24H %</th>
                  <th className="py-3 px-3 text-right">Market Cap</th>
                  <th className="py-3 px-3 text-right">24h Volume</th>
                  <th className="py-3 px-3 text-center">Liquidity (DEX)</th>
                  <th className="py-3 px-3 text-center">Age</th>
                  <th className="py-3 px-3 text-center w-28">Buy/Sell Ratio</th>
                  <th className="py-3 px-4 text-center">Security</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paginatedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-xs text-zinc-500 font-semibold">
                      No matching assets found for active sector and query.
                    </td>
                  </tr>
                ) : (
                  paginatedAssets.map((asset) => {
                    const isUp1h = asset.change1h >= 0;
                    const isUp24h = asset.change24h >= 0;
                    
                    const tickDir = tickDirections[asset.symbol];
                    const flashingClass = tickDir === "up"
                      ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                      : tickDir === "down"
                      ? "bg-red-500/10 hover:bg-red-500/15"
                      : "hover:bg-white/[0.02]";

                    return (
                      <tr
                        key={asset.symbol}
                        onClick={() => setSelectedAsset(asset)}
                        className={cn(
                          "group cursor-pointer text-xs font-medium text-white tabular-nums transition-all duration-500",
                          flashingClass
                        )}
                      >
                        {/* Rank */}
                        <td className="py-3.5 px-4 text-center text-zinc-500 font-bold group-hover:text-cyan-400 transition-colors">
                          {asset.rank}
                        </td>

                        {/* Name / Symbol (With Logo) */}
                        <td className="py-3.5 px-3 font-semibold text-left">
                          <div className="flex items-center gap-3">
                            <AssetLogoIcon
                              symbol={asset.symbol}
                              assetClass={asset.asset_class}
                              sector={asset.sector}
                              size="sm"
                              className="rounded-full shadow-md border border-white/[0.05]"
                            />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white font-black hover:underline group-hover:text-[var(--accent-cyan)] transition-colors">
                                  {asset.symbol}
                                </span>
                                {/* Visual Asset Class Badge */}
                                <span className={cn(
                                  "text-[8px] font-extrabold uppercase px-1 py-0.5 rounded",
                                  asset.asset_class === "crypto" 
                                    ? "bg-purple-500/10 text-purple-400" 
                                    : "bg-emerald-500/10 text-emerald-400"
                                )}>
                                  {asset.asset_class ?? "CFD"}
                                </span>
                              </div>
                              <span className="text-[10px] text-zinc-500 font-medium max-w-[150px] truncate">
                                {asset.name}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-3.5 px-3 text-right font-bold text-zinc-100">
                          {formatPrice(asset.spotPrice, asset.symbol)}
                        </td>

                        {/* 1h Change */}
                        <td className={cn(
                          "py-3.5 px-3 text-right font-black",
                          isUp1h ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"
                        )}>
                          <span className="inline-flex items-center gap-0.5">
                            {isUp1h ? "+" : ""}{asset.change1h.toFixed(2)}%
                          </span>
                        </td>

                        {/* 24h Change */}
                        <td className={cn(
                          "py-3.5 px-3 text-right font-black",
                          isUp24h ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"
                        )}>
                          <span className="inline-flex items-center gap-0.5">
                            {isUp24h ? "+" : ""}{asset.change24h.toFixed(2)}%
                          </span>
                        </td>

                        {/* Market Cap */}
                        <td className="py-3.5 px-3 text-right text-zinc-400 font-bold">
                          {formatLargeNum(asset.marketCap)}
                        </td>

                        {/* Volume */}
                        <td className="py-3.5 px-3 text-right text-zinc-400 font-medium">
                          {formatLargeNum(asset.volume24h)}
                        </td>

                        {/* Liquidity Pool Badge */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-zinc-300 font-bold">{formatLargeNum(asset.liquidity)}</span>
                            {asset.liquidityChain && (
                              <span className={cn(
                                "text-[8px] font-bold px-1 rounded uppercase",
                                asset.liquidityChain === "Base" && "bg-blue-600/10 text-blue-400",
                                asset.liquidityChain === "Solana" && "bg-purple-600/10 text-purple-400",
                                asset.liquidityChain === "Ethereum" && "bg-slate-400/10 text-slate-300",
                                asset.liquidityChain === "Arbitrum" && "bg-cyan-600/10 text-cyan-400",
                                asset.liquidityChain === "Optimism" && "bg-red-600/10 text-red-400",
                              )}>
                                {asset.liquidityChain}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Age on Market */}
                        <td className="py-3.5 px-3 text-center text-zinc-500 font-semibold">
                          {asset.ageDays >= 365 
                            ? `${(asset.ageDays / 365).toFixed(1)}y` 
                            : `${Math.round(asset.ageDays)}d`}
                        </td>

                        {/* Buy/Sell ratio bar */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="flex flex-col gap-1 w-full max-w-[90px] mx-auto">
                            <div className="flex justify-between text-[8px] font-semibold text-zinc-500">
                              <span>B: {Math.round(asset.txBuyRatio * 100)}%</span>
                              <span>S: {Math.round((1 - asset.txBuyRatio) * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-red-600/30 w-full rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${asset.txBuyRatio * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Security Flag */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider",
                            asset.securityFlag === "Safe" && "bg-emerald-500/10 text-emerald-400",
                            asset.securityFlag === "Caution" && "bg-amber-500/10 text-amber-400",
                            asset.securityFlag === "Risk" && "bg-red-500/10 text-red-400 animate-pulse",
                          )}>
                            {asset.securityFlag === "Safe" ? (
                              <ShieldCheck className="size-3" />
                            ) : (
                              <AlertTriangle className="size-3" />
                            )}
                            {asset.securityFlag}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table summary stats */}
          <div className="flex items-center justify-between p-3.5 border-t border-white/[0.06] bg-white/[0.01] text-[11px] text-zinc-500">
            <span>
              Showing {paginatedAssets.length} of {filteredAssets.length} assets ({fullAssetsList.length} total)
            </span>
            <span className="flex items-center gap-1 font-semibold text-zinc-400">
              <Zap className="size-3.5 text-yellow-500" />
              Live quotes updated every 10 seconds.
            </span>
          </div>
        </div>


      </div>

      {/* ======================================================== */}
      {/* 5. SIDE SHEET / DRAWER FOR SELECTED ASSET               */}
      {/* ======================================================== */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
          {/* Backdrop closer */}
          <div className="absolute inset-0" onClick={() => setSelectedAsset(null)} />

          {/* Drawer Body */}
          <div className="relative w-full max-w-[460px] h-full bg-zinc-950 border-l border-white/[0.08] flex flex-col justify-between shadow-2xl p-4 sm:p-5 text-white animate-slide-in">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <AssetLogoIcon
                  symbol={selectedAsset.symbol}
                  assetClass={selectedAsset.asset_class}
                  sector={selectedAsset.sector}
                  size="md"
                  className="rounded-full shadow-lg border border-white/[0.05]"
                />
                <div className="flex flex-col">
                  <span className="text-lg font-black text-[var(--accent-cyan)] leading-none">{selectedAsset.symbol}</span>
                  <span className="text-xs text-zinc-500 font-bold mt-1.5">{selectedAsset.name}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="p-1 rounded-md bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 custom-scrollbar pr-1">
              
              {/* Telemetry Pricing Panel */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-lg text-center">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Price Quote</span>
                  <span className="text-lg font-black text-white block mt-0.5">
                    {formatPrice(selectedAsset.spotPrice, selectedAsset.symbol)}
                  </span>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-lg text-center">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">24h Change</span>
                  <span className={cn(
                    "text-lg font-black block mt-0.5",
                    selectedAsset.change24h >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"
                  )}>
                    {selectedAsset.change24h >= 0 ? "+" : ""}{selectedAsset.change24h.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Dynamic SVG Candlestick technical Chart */}
              <div className="bg-black/60 border border-white/[0.08] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Activity className="size-3.5 text-cyan-400" />
                    TECHNICAL OUTLOOK (1D INTERVAL)
                  </span>
                  <span className="text-[9px] uppercase font-bold text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                    Simulated Candle Grid
                  </span>
                </div>

                {/* Draw clean technical candles */}
                <div className="relative w-full h-[150px] bg-zinc-950/40 border border-white/[0.03] rounded-lg overflow-hidden flex items-end justify-between px-4 py-2">
                  {/* Grid Lines */}
                  <div className="absolute inset-x-0 top-1/4 border-t border-white/[0.02]" />
                  <div className="absolute inset-x-0 top-2/4 border-t border-white/[0.02]" />
                  <div className="absolute inset-x-0 top-3/4 border-t border-white/[0.02]" />

                  {/* Draw 10 candles based on the symbol hash */}
                  {Array.from({ length: 11 }).map((_, idx) => {
                    const seed = (selectedAsset.symbol.charCodeAt(0) ?? 65) + idx;
                    const heightPct = 30 + ((seed * 7) % 60); // 30% to 90%
                    const candleBodyHeight = 10 + ((seed * 11) % 40); // 10px to 50px
                    const isGreen = seed % 2 === 0;
                    
                    return (
                      <div key={idx} className="flex flex-col items-center flex-1 group/candle relative" style={{ height: `${heightPct}%` }}>
                        {/* Upper Wick */}
                        <div className="w-[1.5px] bg-zinc-600 h-10 absolute -top-2" />
                        {/* Candle Body */}
                        <div
                          className={cn(
                            "w-4 rounded-[1.5px] border-x z-10 transition-all cursor-crosshair",
                            isGreen 
                              ? "bg-[var(--accent-green)] border-[var(--accent-green-bright)] hover:brightness-125 hover:shadow-[0_0_8px_rgba(0,255,133,0.5)]" 
                              : "bg-[var(--accent-red)] border-red-400 hover:brightness-125 hover:shadow-[0_0_8px_rgba(255,59,48,0.5)]"
                          )}
                          style={{ height: `${candleBodyHeight}px` }}
                        />
                        {/* Lower Wick */}
                        <div className="w-[1.5px] bg-zinc-600 h-10 absolute bottom-0" />
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold">
                  <span>EMA(20): Bullish Cross</span>
                  <span>EMA(200): Under-bought</span>
                </div>
              </div>

              {/* Technical Indicator Gauges */}
              <div className="bg-white/[0.01] border border-white/[0.06] rounded-xl p-3.5 space-y-2">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Momentum Summary</span>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Relative Strength Index (RSI)</span>
                    <span className="font-bold text-white">56.5 (Neutral)</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400" style={{ width: "56.5%" }} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Moving Average Convergence (MACD)</span>
                    <span className="font-bold text-emerald-400 uppercase">Bullish Impulse</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: "75%" }} />
                  </div>
                </div>
              </div>

              {/* Smart Money Concepts & Order Blocks */}
              <div className="bg-white/[0.01] border border-white/[0.06] rounded-xl p-3.5 space-y-3">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">SMART MONEY CONCEPTS (SMC)</span>
                
                <div className="space-y-2 text-xs">
                  {/* FVG */}
                  <div className="flex justify-between items-start border-b border-white/[0.03] pb-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-zinc-200 font-semibold">Fair Value Gap (FVG)</span>
                      <span className="text-[10px] text-zinc-500">Unmitigated daily structural gap</span>
                    </div>
                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 rounded uppercase">
                      Open Zone
                    </span>
                  </div>

                  {/* Order Blocks */}
                  <div className="flex justify-between items-start pt-1">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-zinc-200 font-semibold">Institutional Order Block</span>
                      <span className="text-[10px] text-zinc-500">Strong bullish mitigation support</span>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 rounded uppercase">
                      Mitigated
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Action Bar (Footer) */}
            <div className="border-t border-white/[0.08] pt-4 space-y-2">
              <button
                onClick={() => askCopilotAboutAsset(selectedAsset)}
                className="w-full py-2.5 bg-[var(--accent-cyan)] text-zinc-950 hover:brightness-110 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,229,255,0.25)]"
              >
                <Sparkles className="size-4 animate-spin-slow" />
                Ask Co-Pilot to Analyze {selectedAsset.symbol}
              </button>
              <button
                onClick={() => setSelectedAsset(null)}
                className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white transition-colors border border-white/[0.04]"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
