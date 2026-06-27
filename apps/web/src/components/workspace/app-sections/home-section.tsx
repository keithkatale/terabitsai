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
}

export function HomeSection({ sidebarQuotes, goToChatWithPrompt }: HomeSectionProps) {
  const [activeCategory, setActiveCategory] = useState<string>("All Assets");
  const [timeframe, setTimeframe] = useState<"1h" | "4h" | "24h">("24h");
  const [rowLimit, setRowLimit] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<EnrichedAsset | null>(null);
  const [copilotInput, setCopilotInput] = useState("");

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
        const liveSpot = sidebarQuotes[asset.symbol]?.spot;
        const liveChange24h = sidebarQuotes[asset.symbol]?.change24hPct;

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
        const change24h = liveChange24h ?? (((sSeed % 120) - 55) / 10);
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
  }, [sidebarQuotes]);

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
          
          {/* Card A: Global Market Cap */}
          <div className="quant-card p-3.5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Global Market Cap</span>
              <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[var(--accent-green)]">
                <TrendingUp className="size-3" /> +{marketCapChange24h}%
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold leading-none text-white tabular-nums">
                {formatLargeNum(marketCap)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">Aggregated crypto, stock, commodities cap</p>
            </div>
            <div className="pt-2 border-t border-white/[0.03] flex items-center justify-center h-10">
              <MiniSparkline data={sparklineCap} trend="up" />
            </div>
          </div>

          {/* Card B: CMC20 Market Index */}
          <div className="quant-card p-3.5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">CMC20 Top Assets</span>
              <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[var(--accent-green)]">
                <TrendingUp className="size-3" /> +{cmc20Change24h}%
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold leading-none text-white tabular-nums">
                {formatPrice(cmc20Index)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">SMC weighted average of top 20 assets</p>
            </div>
            <div className="pt-2 border-t border-white/[0.03] flex items-center justify-center h-10">
              <MiniSparkline data={sparklineCmc20} trend="up" />
            </div>
          </div>

          {/* Card C: Fear & Greed Dial (SVG Circular Gauge) */}
          <div className="quant-card p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Fear & Greed Index</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">
                Greed
              </span>
            </div>

            <div className="flex items-center justify-center relative py-1">
              {/* Semi-circular gauge */}
              <svg width="100" height="60" viewBox="0 0 100 55" className="overflow-visible">
                <defs>
                  <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#FF3B30" />    {/* Red */}
                    <stop offset="50%" stopColor="#FF9F00" />   {/* Orange */}
                    <stop offset="100%" stopColor="#00FF85" />  {/* Green */}
                  </linearGradient>
                </defs>
                {/* Arc path */}
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="url(#gauge-grad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="125"
                  strokeDashoffset={125 - (125 * fearAndGreedVal) / 100}
                />
                {/* Needle */}
                <g transform={`translate(50,50) rotate(${-90 + (180 * fearAndGreedVal) / 100})`}>
                  <line x1="0" y1="0" x2="0" y2="-42" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="0" cy="0" r="4" fill="#ffffff" />
                </g>
              </svg>
              <div className="absolute bottom-1 flex flex-col items-center">
                <span className="text-xl font-black text-white">{fearAndGreedVal}</span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 text-center mt-1">Extreme leverage volatility expected</p>
          </div>

          {/* Card D: Altcoin Season Track */}
          <div className="quant-card p-3.5 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Altcoin Season Index</span>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                BTC Season
              </span>
            </div>

            <div className="space-y-2 py-2">
              <div className="flex justify-between text-[9px] font-semibold text-zinc-600">
                <span>BITCOIN</span>
                <span>ALTCOIN</span>
              </div>
              {/* Linear Slider Track */}
              <div className="relative w-full h-2 bg-zinc-850 rounded-full border border-white/[0.03]">
                {/* Hot Zone Glow */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-cyan-500 to-amber-500 rounded-full opacity-60"
                  style={{ width: `${altcoinSeasonVal}%` }}
                />
                {/* Glowing Indicator Pin */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] -ml-2 transition-all duration-300"
                  style={{ left: `${altcoinSeasonVal}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                <span>Score: {altcoinSeasonVal}/100</span>
                <span>30d Trend: Consolidated</span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 mt-1">Cap dominated by BTC liquidity pools</p>
          </div>

          {/* Card E: Aggregate Market RSI */}
          <div className="quant-card p-3.5 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Average Market RSI</span>
              <span className="text-[10px] font-bold text-zinc-400 bg-white/[0.04] px-1.5 py-0.5 rounded uppercase">
                Neutral
              </span>
            </div>

            <div className="space-y-2 py-2">
              <div className="flex justify-between text-[9px] font-semibold text-zinc-600">
                <span>OVERSOLD (30)</span>
                <span>OVERBOUGHT (70)</span>
              </div>
              {/* RSI Indicator Track */}
              <div className="relative w-full h-2 bg-zinc-850 rounded-full border border-white/[0.03] overflow-visible">
                {/* Middle neutral zone */}
                <div className="absolute inset-y-0 left-[30%] right-[30%] bg-emerald-500/10 border-x border-emerald-500/20" />
                {/* Glowing Indicator Pin */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-400 border-2 border-zinc-950 shadow-[0_0_8px_rgba(16,185,129,0.8)] -ml-2 transition-all duration-300"
                  style={{ left: `${marketAverageRsi}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                <span>RSI: {marketAverageRsi}</span>
                <span>Momentum: Consolidated</span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 mt-1">Aggregate RSI computed over 14 periods</p>
          </div>

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
                    
                    return (
                      <tr
                        key={asset.symbol}
                        onClick={() => setSelectedAsset(asset)}
                        className="group hover:bg-white/[0.02] cursor-pointer transition-colors text-xs font-medium text-white tabular-nums"
                      >
                        {/* Rank */}
                        <td className="py-3.5 px-4 text-center text-zinc-500 font-bold group-hover:text-cyan-400 transition-colors">
                          {asset.rank}
                        </td>

                        {/* Name / Symbol */}
                        <td className="py-3.5 px-3 font-semibold text-left">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <span className="text-white font-black hover:underline group-hover:text-[var(--accent-cyan)] transition-colors">
                                {asset.symbol}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-medium max-w-[150px] truncate">
                                {asset.name}
                              </span>
                            </div>
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

        {/* ======================================================== */}
        {/* 4. BOTTOM FLOATING AI COPILOT PILL BAR                  */}
        {/* ======================================================== */}
        <div className="pt-2">
          <form
            onSubmit={handleCopilotSubmit}
            className="quant-card bg-gradient-to-r from-zinc-950 via-cyan-950/20 to-zinc-950 border border-cyan-500/15 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_0_25px_rgba(0,229,255,0.04)]"
          >
            <div className="flex items-start gap-3">
              <div className="size-9 bg-cyan-500/10 border border-cyan-400/20 rounded-xl flex items-center justify-center text-cyan-400 shrink-0">
                <Sparkles className="size-4 animate-bounce" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  ASK CMC CO-PILOT
                  <span className="text-[8px] bg-cyan-500 text-zinc-950 font-black px-1 rounded tracking-normal">ALPHA</span>
                </h3>
                <p className="text-[11px] text-zinc-500 font-medium">
                  Trigger automated deep RAG scans on catalysts, supply chains, or historical technical indicators.
                </p>
              </div>
            </div>

            <div className="relative flex-1 max-w-2xl w-full">
              <input
                type="text"
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                placeholder="Ask co-pilot... (e.g. Analyze BTCUSD daily order blocks or explain AAPL breakout)"
                className="w-full bg-black/60 border border-white/[0.08] focus:border-cyan-400 rounded-lg pl-3 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 font-medium focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 size-7 bg-cyan-400 text-zinc-950 hover:bg-cyan-300 rounded-md flex items-center justify-center transition-colors shadow-lg"
              >
                <MessageSquare className="size-3.5 stroke-[2.5]" />
              </button>
            </div>
          </form>
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
              <div className="flex items-center gap-2.5">
                <div className="flex flex-col">
                  <span className="text-lg font-black text-[var(--accent-cyan)]">{selectedAsset.symbol}</span>
                  <span className="text-xs text-zinc-500 font-bold">{selectedAsset.name}</span>
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
