"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useRef, useCallback, useId } from "react";
import InputBar, { type TaggedAsset } from "@/components/ui/input-bar";
import {
  formatUserDisplayMessage,
  toPinnedAssetRef,
} from "@/lib/chat/pinned-assets";
import { cn } from "@/lib/utils";
import { SmoothAreaChart } from "@/components/ui/smooth-area-chart";
import { capitalAdapter } from "@/lib/execution/capital-adapter";
import QuickTradeDialog from "@/components/ui/quick-trade-dialog";
import { useAccount } from "@/hooks/use-account";
import { postTradeLedger } from "@/lib/account/api";
import { DepositModal } from "@/components/account/deposit-modal";
import { WithdrawModal } from "@/components/account/withdraw-modal";
import { AccountPanel } from "@/components/account/account-panel";

import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import {
  ImageIcon,
  FileUp,
  MonitorIcon,
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
  X,
  Eye,
} from "lucide-react";

import { ChatMessage as ChatMessageBubble } from "@/components/ai-elements/message";
import type { ChatStreamEvent, ChatToolPod } from "@/lib/chat/stream-types";
import { buildHistoryFromMessages } from "@/lib/chat/conversation-history";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MarketTerminal } from "@/components/terminal/market-terminal";
import type { TerminalTabId } from "@/components/terminal/types";
import { categoryForAsset } from "@/lib/catalog/asset-catalog";
import { HOT_SYMBOLS, assetClassForSymbol } from "@/lib/market/watchlist";
import type { LiveSignal } from "@/lib/market/market-intel-data";
import { PageBackground } from "@/components/ui/page-background";
import {
  ChatLandingHero,
  CHAT_LANDING_PROMPT_SUGGESTIONS,
  CHAT_LANDING_MAX_TAGGED_ASSETS,
} from "@/components/workspace/chat-landing-hero";

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

interface MessagePart {
  type: "reasoning" | "text" | "trade-execution" | "genui";
  text?: string;
  payload?: unknown;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
  toolPods?: ChatToolPod[];
  liveStatus?: string;
  liveStatusDetail?: string;
}

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

// --- Main workspace ---
export function TradingWorkspace({ mode = "terminal" }: { mode?: "chat" | "terminal" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const pendingBootstrapped = useRef(false);

  const [activeTerminalTab, setActiveTerminalTab] = useState<TerminalTabId>("markets");
  const [pinnedAssetTabs, setPinnedAssetTabs] = useState<string[]>([]);
  const [sectorFeedSignals, setSectorFeedSignals] = useState<
    Array<{ symbol: string; strategy: string; action: string; reason: string; sector?: string | null }>
  >([]);


  // Active Market selected symbol and category
  const [activeSymbol, setActiveSymbol] = useState("BTCUSD");
  const [activeCategory, setActiveCategory] = useState("Crypto");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1M");
  const [candlePoints, setCandlePoints] = useState<any[]>([]);
  const [activeQuote, setActiveQuote] = useState<any>(null);
  const [sidebarQuotes, setSidebarQuotes] = useState<Record<string, any>>({});

  // Real candles mapping for sidebar card charts (Figma specification)
  const [cardCandles, setCardCandles] = useState<Record<string, { x: number; y: number }[]>>({});

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
    setActiveCategory(categoryForAsset(assetClass, sector));
    setValue(`Analyze ${symbol} trend and recommend a simulated trading strategy.`);
  }, []);

  const openAssetTab = useCallback((symbol: string) => {
    setActiveSymbol(symbol);
    const asset = rawCapitalCatalog.find((a) => a.symbol === symbol);
    if (asset) {
      setActiveCategory(categoryForAsset(asset.asset_class, asset.sector ?? undefined));
    }
    setPinnedAssetTabs((prev) => (prev.includes(symbol) ? prev : [...prev, symbol].slice(-6)));
    setActiveTerminalTab(`asset:${symbol}`);
  }, []);

  const handleSignalClick = useCallback((sig: LiveSignal) => {
    openAssetTab(sig.symbol);
    setActiveSymbol(sig.symbol);
    setActiveCategory(categoryForAsset(sig.assetClass, sig.sector));
    setValue(
      `Perform a detailed multi-agent team analysis on ${sig.symbol} regarding the recent ${sig.strategy} signal on the ${sig.timeframe} timeframe.`,
    );
  }, [openAssetTab]);

  const closeAssetTab = useCallback((symbol: string) => {
    setPinnedAssetTabs((prev) => prev.filter((s) => s !== symbol));
    setActiveTerminalTab((t) => (t === `asset:${symbol}` ? "markets" : t));
  }, []);

  const handleSymbolFromFeed = useCallback((symbol: string) => {
    const asset = rawCapitalCatalog.find((a) => a.symbol === symbol);
    if (asset) {
      handleCardClick(symbol, asset.asset_class, asset.sector ?? undefined);
    } else {
      setActiveSymbol(symbol);
      setValue(`Analyze ${symbol} trend and recommend a strategy.`);
    }
  }, [handleCardClick]);

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
  const [tradeDirection, setTradeDirection] = useState<"BUY" | "SELL">("BUY");
  const [tradeSize, setTradeSize] = useState<number>(1);
  const [tradeLeverage, setTradeLeverage] = useState<number>(5);

  const {
    user,
    summary,
    loading: accountLoading,
    refresh: refreshAccount,
    signOut,
    accountId,
    balance,
  } = useAccount();

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false);
  const [taggedAssets, setTaggedAssets] = useState<TaggedAsset[]>([]);

  const MAX_TAGGED_ASSETS = CHAT_LANDING_MAX_TAGGED_ASSETS;

  const toggleTaggedAsset = useCallback((symbol: string) => {
    setTaggedAssets((prev) => {
      if (prev.some((t) => t.symbol === symbol)) {
        return prev.filter((t) => t.symbol !== symbol);
      }
      if (prev.length >= MAX_TAGGED_ASSETS) return prev;
      const item = rawCapitalCatalog.find((a) => a.symbol === symbol);
      return [
        ...prev,
        {
          symbol,
          name: item?.display_name.replace(" CFD", "").replace(" / USD", ""),
          assetClass: item?.asset_class,
          sector: item?.sector ?? null,
        },
      ];
    });
  }, []);

  const removeTaggedAsset = useCallback((symbol: string) => {
    setTaggedAssets((prev) => prev.filter((t) => t.symbol !== symbol));
  }, []);

  const handleDepositSuccess = useCallback(
    async (amt: number, gateway: string) => {
      const updated = await fetch("/api/ledger/summary?mode=demo", {
        credentials: "include",
      }).then((r) => r.json());
      await refreshAccount();
      const available = updated?.balance?.wallet_available ?? 0;
      const receiptMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `✅ **Demo wallet funded**\n\nCredited **$${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** via simulated **${gateway}**.\n\nAvailable margin: **$${available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`,
          },
        ],
      };
      setMessages((prev) => [...prev, receiptMessage]);
    },
    [refreshAccount]
  );

  const handleWithdrawSuccess = useCallback(
    async (amt: number) => {
      await refreshAccount();
      const receiptMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `✅ **Withdrawal processed**\n\n**$${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** was withdrawn from your demo wallet.`,
          },
        ],
      };
      setMessages((prev) => [...prev, receiptMessage]);
    },
    [refreshAccount]
  );

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
    if (mode !== "terminal") return;
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
  }, [activeSymbol, activeCategory, selectedTimeframe, mode]);

  // 2b. Poll watchlist quotes for market scanner (HOT_SYMBOLS)
  useEffect(() => {
    if (mode !== "terminal") return;
    let active = true;
    const fetchWatchlist = async () => {
      const results = await Promise.allSettled(
        HOT_SYMBOLS.map(async (symbol) => {
          const assetClass = assetClassForSymbol(symbol);
          const res = await fetch(`/api/market/quote?symbol=${symbol}&assetClass=${assetClass}`);
          if (!res.ok) return null;
          const data = await res.json();
          return { symbol, data };
        })
      );
      if (!active) return;
      setSidebarQuotes((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            next[r.value.symbol] = r.value.data;
          }
        }
        return next;
      });
    };
    fetchWatchlist();
    const interval = setInterval(fetchWatchlist, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [mode]);

  // 2c. Bootstrap intel on app open (triggers scan if stale, feeds Markets + Intelligence)
  useEffect(() => {
    if (mode !== "terminal") return;
    fetch("/api/intel/bootstrap")
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.items)) {
          const signals = data.items
            .filter((i: { kind: string }) => i.kind === "signal")
            .map((i: { item: Record<string, unknown> }) => i.item as {
              symbol: string;
              strategy: string;
              action: string;
              reason: string;
              sector?: string;
            });
          if (signals.length > 0) setSectorFeedSignals(signals);
        }
      })
      .catch(() => {});
  }, [mode]);

  // 3. 3-second client-side Brownian Motion Price fluctuation (Premium Terminal Effect!)
  useEffect(() => {
    if (mode !== "terminal") return;
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

  // --- CFD Transaction Execution ---

  const handleTradeExecute = useCallback(async (trade: {
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
    const walletAvailable = balance?.wallet_available ?? 0;
    if (walletAvailable < trade.margin) {
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `⚠️ **Margin check failed:** Required margin **$${trade.margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** exceeds available **$${walletAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**. Deposit funds or reduce size.`,
          },
        ],
      };
      setMessages((prev) => [...prev, errorMsg]);
      setIsDepositModalOpen(true);
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

    setPositions((prev) => [position, ...prev]);

    try {
      await postTradeLedger({
        action: "reserve",
        amount: trade.margin,
        symbol: trade.symbol,
        tradeId: trade.id,
        side: trade.direction.toLowerCase() as "buy" | "sell",
      });
      await refreshAccount();
    } catch (err) {
      console.error("Failed to post trade reserve:", err);
    }

    const receiptMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "assistant",
      parts: [{ type: "trade-execution", text: JSON.stringify(position) }],
    };
    setMessages((prev) => [...prev, receiptMessage]);
  }, [balance, refreshAccount]);

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

  const closePosition = useCallback(async (id: string) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;

    const currentSpot = sidebarQuotes[pos.symbol]?.spot || pos.entryPrice;
    const finalPnl =
      pos.direction === "BUY"
        ? (currentSpot - pos.entryPrice) * pos.size
        : (pos.entryPrice - currentSpot) * pos.size;

    setPositions((prev) => prev.filter((p) => p.id !== id));

    try {
      await Promise.all([
        postTradeLedger({
          action: "release",
          amount: pos.margin,
          symbol: pos.symbol,
          tradeId: pos.id,
          side: pos.direction.toLowerCase() as "buy" | "sell",
        }),
        postTradeLedger({
          action: "adjustment",
          signedAmount: finalPnl,
          symbol: pos.symbol,
          tradeId: pos.id,
          side: pos.direction.toLowerCase() as "buy" | "sell",
        }),
      ]);
      await refreshAccount();
    } catch (err) {
      console.error("Failed to post trade release / adjustment:", err);
    }

    const receiptMessage: ChatMessage = {
      id: Date.now().toString(),
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
  }, [positions, sidebarQuotes, refreshAccount]);

  // --- Core AI Streaming Logic ---
  const handleSend = async (textToSend: string, pinnedForSend: TaggedAsset[] = []) => {
    const userText = textToSend.trim();
    const displayPrompt = formatUserDisplayMessage(userText, pinnedForSend);
    if (!displayPrompt && pinnedForSend.length === 0) return;
    if (loading) return;

    if (!user && mode === "terminal") {
      window.location.href = `/login?next=${encodeURIComponent("/app/terminal")}`;
      return;
    }

    const apiMessage =
      userText ||
      (pinnedForSend.length > 0
        ? "Give a concise outlook with key levels and risk considerations for each pinned asset."
        : "");
    const pinnedAssets = pinnedForSend.map(toPinnedAssetRef);

    // Add user message
    const userMsgId = Date.now().toString();
    const newUserMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      parts: [{ type: "text", text: displayPrompt }],
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
      const history = buildHistoryFromMessages(messages);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: apiMessage,
          pinnedAssets,
          history,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(
          typeof errBody.error === "string" ? errBody.error : `Request failed (${response.status})`,
        );
      }

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
            const event = JSON.parse(trimmed) as ChatStreamEvent;

            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (!lastMsg || lastMsg.id !== assistantMsgId) return prev;

              if (event.type === "text" || event.type === "reasoning") {
                const parts = [...lastMsg.parts];
                const lastPart = parts[parts.length - 1];
                if (lastPart && lastPart.type === event.type) {
                  parts[parts.length - 1] = { ...lastPart, text: (lastPart.text ?? "") + event.text };
                } else {
                  parts.push({ type: event.type, text: event.text });
                }
                updated[updated.length - 1] = { ...lastMsg, parts, liveStatus: undefined, liveStatusDetail: undefined };
                return updated;
              }

              if (event.type === "genui") {
                const parts = [...lastMsg.parts, { type: "genui" as const, payload: event.payload }];
                updated[updated.length - 1] = { ...lastMsg, parts, liveStatus: undefined, liveStatusDetail: undefined };
                return updated;
              }

              if (event.type === "status") {
                updated[updated.length - 1] = {
                  ...lastMsg,
                  liveStatus: event.label,
                  liveStatusDetail: event.detail,
                };
                return updated;
              }

              if (event.type === "tool_start") {
                const pods = [...(lastMsg.toolPods ?? [])];
                const i = pods.findIndex((p) => p.toolUseId === event.toolUseId);
                if (i >= 0) {
                  pods[i] = { ...pods[i], name: event.name, status: "running", args: event.args };
                } else {
                  pods.push({ toolUseId: event.toolUseId, name: event.name, status: "running", args: event.args });
                }
                updated[updated.length - 1] = { ...lastMsg, toolPods: pods };
                return updated;
              }

              if (event.type === "tool_end") {
                const pods = [...(lastMsg.toolPods ?? [])];
                const i = pods.findIndex((p) => p.toolUseId === event.toolUseId);
                const done: ChatToolPod = {
                  toolUseId: event.toolUseId,
                  name: event.name,
                  status: "done",
                  ok: event.ok,
                  args: event.args,
                  output: event.output,
                  error: event.error,
                  durationMs: event.durationMs,
                };
                if (i >= 0) pods[i] = { ...pods[i], ...done };
                else pods.push(done);
                updated[updated.length - 1] = {
                  ...lastMsg,
                  toolPods: pods,
                  liveStatus: event.ok ? event.name.replace(/_/g, " ") : "Tool failed",
                  liveStatusDetail: event.ok ? "Done" : event.error,
                };
                return updated;
              }

              return prev;
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


  const activeQuoteSpot = activeQuote?.spot ?? sidebarQuotes[activeSymbol]?.spot ?? 100.0;
  const activeQuoteBid = activeQuote?.bid ?? sidebarQuotes[activeSymbol]?.bid ?? activeQuoteSpot * 0.9995;
  const activeQuoteAsk = activeQuote?.ask ?? sidebarQuotes[activeSymbol]?.ask ?? activeQuoteSpot * 1.0005;
  const activeQuoteChange = activeQuote?.change24hPct ?? sidebarQuotes[activeSymbol]?.change24hPct ?? 0;
  const activeQuoteSpread = activeQuoteAsk - activeQuoteBid;
  const activeQuoteSpreadPct = (activeQuoteSpread / activeQuoteSpot) * 100;

  const goToChatWithPrompt = useCallback(
    (prompt: string) => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("chat:pending", JSON.stringify({ prompt, tags: [] }));
      }
      router.push("/app/chat");
    },
    [router],
  );

  useEffect(() => {
    if (mode !== "chat" || pendingBootstrapped.current) return;
    const raw = sessionStorage.getItem("chat:pending");
    if (!raw) return;
    pendingBootstrapped.current = true;
    sessionStorage.removeItem("chat:pending");
    try {
      const parsed = JSON.parse(raw) as { prompt?: string; tags?: TaggedAsset[] };
      const tags = parsed.tags ?? [];
      if (tags.length > 0) setTaggedAssets(tags);
      const prompt = parsed.prompt?.trim() ?? "";
      if (prompt || tags.length > 0) {
        void handleSend(prompt, tags);
      }
    } catch {
      /* ignore malformed pending payload */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once from sessionStorage
  }, [mode]);

  if (mode === "chat") {
    return (
      <>
        {messages.length === 0 ? <PageBackground overlay="minimal" variant="orb" /> : null}
        <div className="relative mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden">
          {messages.length === 0 ? (
            <ChatLandingHero
              value={value}
              onChange={setValue}
              onSend={(content) => {
                const tags = [...taggedAssets];
                setTaggedAssets([]);
                handleSend(content, tags);
              }}
              loading={loading}
              taggedAssets={taggedAssets}
              onRemoveTaggedAsset={removeTaggedAsset}
              onToggleTaggedAsset={toggleTaggedAsset}
              placeholderSuggestions={CHAT_LANDING_PROMPT_SUGGESTIONS}
              maxTaggedAssets={MAX_TAGGED_ASSETS}
            />
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col px-4 py-4">
              <Conversation className="min-h-0 flex-1 overflow-y-auto pb-24">
                <ConversationContent className="space-y-6 bg-transparent">
                  {messages.map((message, messageIndex) => {
                    const isLastMessage = messageIndex === messages.length - 1;
                    return (
                      <ChatMessageBubble
                        key={message.id}
                        message={message}
                        isAssistantStreaming={loading && isLastMessage}
                        livePrices={sidebarQuotes}
                        onClosePosition={closePosition}
                      />
                    );
                  })}
                </ConversationContent>
                <ConversationScrollButton className="border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:text-white" />
              </Conversation>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/95 to-transparent pb-3 pt-6">
                <InputBar
                  value={value}
                  onChange={setValue}
                  onSend={({ content }) => {
                    const tags = [...taggedAssets];
                    setTaggedAssets([]);
                    handleSend(content, tags);
                  }}
                  disabled={loading}
                  status={loading ? "streaming" : "ready"}
                  placeholder="Continue the conversation…"
                  variant="landing"
                  taggedAssets={taggedAssets}
                  onRemoveTaggedAsset={removeTaggedAsset}
                  maxTaggedAssets={MAX_TAGGED_ASSETS}
                />
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--background)] selection:bg-blue-500/20 selection:text-blue-100">
      <div className="pointer-events-none absolute top-0 left-1/2 -z-10 h-[350px] w-full max-w-7xl -translate-x-1/2 bg-gradient-to-b from-blue-950/12 via-neutral-950/6 to-transparent blur-3xl" />

      <div className="flex min-h-0 flex-1 flex-col">
        <MarketTerminal
          leftOpen={false}
          activeTab={activeTerminalTab}
          setActiveTab={setActiveTerminalTab}
          pinnedAssetTabs={pinnedAssetTabs}
          onOpenAssetTab={openAssetTab}
          onCloseAssetTab={closeAssetTab}
          sectorFeedSignals={sectorFeedSignals}
          setSectorFeedSignals={setSectorFeedSignals}
          activeSymbol={activeSymbol}
          activeCategory={activeCategory}
          setActiveSymbol={setActiveSymbol}
          setActiveCategory={setActiveCategory}
          selectedTimeframe={selectedTimeframe}
          setSelectedTimeframe={setSelectedTimeframe}
          candlePoints={candlePoints}
          sidebarQuotes={sidebarQuotes}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          positions={positions}
          tradeDirection={tradeDirection}
          setTradeDirection={setTradeDirection}
          tradeSize={tradeSize}
          setTradeSize={setTradeSize}
          tradeLeverage={tradeLeverage}
          setTradeLeverage={setTradeLeverage}
          activeQuoteSpot={activeQuoteSpot}
          activeQuoteBid={activeQuoteBid}
          activeQuoteAsk={activeQuoteAsk}
          activeQuoteChange={activeQuoteChange}
          balance={balance}
          summary={summary}
          userEmail={user?.email}
          accountLoading={accountLoading}
          onDeposit={() => setIsDepositModalOpen(true)}
          onWithdraw={() => setIsWithdrawModalOpen(true)}
          onSignOut={signOut}
          onTradeExecute={handleTradeExecute}
          onClosePosition={closePosition}
          onCardClick={handleCardClick}
          onSignalClick={handleSignalClick}
          onSymbolFromFeed={handleSymbolFromFeed}
          onAskAi={goToChatWithPrompt}
          onAnalyzeWithAi={() => {
            goToChatWithPrompt(
              `Analyze the recent market performance, technical setups, and risk metrics for ${activeSymbol} and recommend a detailed strategy.`,
            );
          }}
        />
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

      <DepositModal
        open={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        accountId={accountId}
        currentBalance={balance?.wallet_available ?? 0}
        onSuccess={handleDepositSuccess}
      />

      <WithdrawModal
        open={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        walletAvailable={balance?.wallet_available ?? 0}
        onSuccess={handleWithdrawSuccess}
      />

      <AccountPanel
        open={isAccountPanelOpen}
        onClose={() => setIsAccountPanelOpen(false)}
        summary={summary}
        userEmail={user?.email}
        onDeposit={() => {
          setIsAccountPanelOpen(false);
          setIsDepositModalOpen(true);
        }}
        onWithdraw={() => {
          setIsAccountPanelOpen(false);
          setIsWithdrawModalOpen(true);
        }}
        onSignOut={signOut}
        loading={accountLoading}
      />
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

