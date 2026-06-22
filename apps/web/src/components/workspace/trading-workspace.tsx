"use client";

import { useEffect, useState, useMemo, useRef, useCallback, useId, type ReactNode } from "react";
import { useAppTab, type AppTab } from "@/contexts/app-tab-context";
import InputBar, { type TaggedAsset } from "@/components/ui/input-bar";
import {
  formatUserDisplayMessage,
  toPinnedAssetRef,
} from "@/lib/chat/pinned-assets";
import { cn } from "@/lib/utils";
import { SmoothAreaChart } from "@/components/ui/smooth-area-chart";
import { capitalAdapter } from "@/lib/execution/capital-adapter";
import QuickTradeDialog from "@/components/ui/quick-trade-dialog";
import { useAppAccount } from "@/contexts/app-account-context";
import { postTradeLedger, fetchOpenPositions, closePositionAtMarket, purchaseAssetAtMarket } from "@/lib/account/api";
import {
  PositionActionsSheet,
  type PositionActionRequest,
} from "@/components/portfolio/position-actions-sheet";
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
import { FollowUpSuggestions } from "@/components/ai-elements/follow-up-suggestions";
import { InteractiveQuestionForm } from "@/components/ai-elements/interactive-question-form";
import type { ChatStreamEvent, ChatToolPod } from "@/lib/chat/stream-types";
import {
  buildHistoryFromMessages,
  messagesToPredictPayload,
} from "@/lib/chat/conversation-history";
import type { ParsedInteractiveQuestion } from "@/lib/chat/interactive-question-helper";
import {
  hasInteractiveQuestionMarkup,
  parseInteractiveQuestion,
} from "@/lib/chat/interactive-question-helper";
import { ChatWidgetProvider } from "@/contexts/chat-widget-context";
import type { WidgetAction } from "@/lib/chat/widget-actions";
import { QUANT_WIDGET_ACTION_EVENT } from "@/lib/chat/widget-actions";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MarketTerminal } from "@/components/terminal/market-terminal";
import type { TerminalTabId, TradeData } from "@/components/terminal/types";
import { categoryForAsset } from "@/lib/catalog/asset-catalog";
import type { LiveSignal } from "@/lib/market/market-intel-data";
import { PageBackground } from "@/components/ui/page-background";
import {
  ChatLandingHero,
  CHAT_LANDING_PROMPT_SUGGESTIONS,
  CHAT_LANDING_MAX_TAGGED_ASSETS,
} from "@/components/workspace/chat-landing-hero";
import { HomeSection } from "@/components/workspace/app-sections/home-section";
import { OrchestratorCycleControls } from "@/components/workspace/orchestrator-cycle-controls";
import { WealthMonitorPanel } from "@/components/workspace/wealth-monitor-panel";
import { InvestingSection } from "@/components/workspace/app-sections/investing-section";
import { notifyPortfolioUpdated } from "@/lib/portfolio/portfolio-events";
import { readHomeTabCache, writeHomeTabCache } from "@/lib/portfolio/home-tab-cache";
import { readCachedTradingMode } from "@/lib/account/user-app-preferences-client";
import { usePortfolioSnapshotPoll } from "@/hooks/use-portfolio-snapshot-poll";

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
  type: "reasoning" | "text" | "trade-execution" | "genui" | "quant-ui" | "monitor_directive" | "session_divider";
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

function mapPersistedParts(
  parts: Array<{ type: string; text?: string; payload?: unknown }>,
): MessagePart[] {
  return parts.map((p) => {
    if (p.type === "genui" && p.payload != null) {
      return { type: "genui" as const, payload: p.payload };
    }
    if (p.type === "quant-ui" && p.payload != null) {
      return { type: "quant-ui" as const, payload: p.payload };
    }
    if (p.type === "reasoning") {
      return { type: "reasoning" as const, text: p.text };
    }
    if (p.type === "trade-execution") {
      return { type: "trade-execution" as const, text: p.text };
    }
    if (p.type === "monitor_directive") {
      return { type: "monitor_directive" as const, text: p.text, payload: p.payload };
    }
    if (p.type === "session_divider") {
      return { type: "session_divider" as const, text: p.text, payload: p.payload };
    }
    return { type: "text" as const, text: p.text };
  });
}

function isVisibleChatMessage(msg: {
  role: string;
  parts: Array<{ type?: string }>;
}): boolean {
  if (msg.role === "system") {
    return msg.parts.some((p) => p.type === "session_divider");
  }
  return msg.role === "user" || msg.role === "assistant";
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

function tabPanelClass(active: boolean) {
  return cn(
    "absolute inset-0 flex min-h-0 flex-col overflow-hidden",
    !active && "hidden",
  );
}

function TabPanel({
  tab,
  activeTab,
  children,
}: {
  tab: AppTab;
  activeTab: AppTab;
  children: ReactNode;
}) {
  return (
    <div className={tabPanelClass(activeTab === tab)} aria-hidden={activeTab !== tab}>
      {children}
    </div>
  );
}

// --- Main workspace ---
export function TradingWorkspace() {
  const { activeTab: mode, setActiveTab, isTabActive } = useAppTab();
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState<ParsedInteractiveQuestion | null>(null);
  const [dismissedQuestionIds, setDismissedQuestionIds] = useState<string[]>([]);
  const pendingBootstrapped = useRef(false);
  const followUpRequestId = useRef(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [newSessionLoading, setNewSessionLoading] = useState(false);
  const sessionContextRef = useRef("");
  const conversationBootstrapped = useRef(false);
  const conversationIdRef = useRef<string | null>(null);
  const lastTaskPollRef = useRef(new Date().toISOString());
  const lastOrchestratorPollRef = useRef(new Date().toISOString());
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement | null>(null);
  const pendingChatScrollRef = useRef(false);
  const [responseSpacerHeight, setResponseSpacerHeight] = useState(0);

  const scrollUserMessageIntoView = useCallback(() => {
    const container = chatScrollRef.current;
    const userEl = lastUserMessageRef.current;
    if (!container || !userEl) return;

    const topPadding = 12;
    const targetScrollTop = userEl.offsetTop - topPadding;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
  }, []);

  const updateResponseSpacer = useCallback(() => {
    const container = chatScrollRef.current;
    const userEl = lastUserMessageRef.current;
    if (!container) return;

    const containerHeight = container.clientHeight;
    const userHeight = userEl?.offsetHeight ?? 72;
    const spacer = Math.max(240, containerHeight - userHeight - 32);
    setResponseSpacerHeight(spacer);
  }, []);

  useEffect(() => {
    if (!pendingChatScrollRef.current) return;
    pendingChatScrollRef.current = false;

    requestAnimationFrame(() => {
      updateResponseSpacer();
      requestAnimationFrame(() => {
        scrollUserMessageIntoView();
      });
    });
  }, [messages, loading, scrollUserMessageIntoView, updateResponseSpacer]);

  useEffect(() => {
    if (!loading) {
      setResponseSpacerHeight(0);
    }
  }, [loading]);

  const [activeTerminalTab, setActiveTerminalTab] = useState<TerminalTabId>("markets");
  const [pinnedAssetTabs, setPinnedAssetTabs] = useState<string[]>([]);

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

  // Pre-fetch 1M historical candles for carousel cards (chat landing only)
  useEffect(() => {
    if (mode !== "command" || messages.length > 0) return;
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
  }, [mode, leftSlots, rightSlots, messages.length, cardCandles, convertCandlesToSparklinePoints]);

  useEffect(() => {
    if (mode !== "command" || messages.length > 0) return;

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
  }, [mode, messages.length]);

  // Sidebar dynamic quotes record & search state
  const [searchQuery, setSearchQuery] = useState("");
  const [leftSidebarTab, setLeftSidebarTab] = useState<"markets" | "portfolio">("markets");

  // Simulated CFD Portfolios
  const [positions, setPositions] = useState<TradeData[]>(
    () => readHomeTabCache(readCachedTradingMode())?.positions ?? [],
  );
  const [positionsRefreshing, setPositionsRefreshing] = useState(false);
  const [activePositionId, setActivePositionId] = useState<string | null>(null);
  const [positionActionBusy, setPositionActionBusy] = useState(false);
  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [tradeDirection, setTradeDirection] = useState<"BUY" | "SELL">("BUY");
  const [tradeSize, setTradeSize] = useState<number>(1);
  const [tradeLeverage, setTradeLeverage] = useState<number>(5);

  const {
    user,
    summary,
    loading: accountLoading,
    refreshing: accountRefreshing,
    refresh: refreshAccount,
    signOut,
    accountId,
    balance,
    tradingMode,
    openDeposit,
    openWithdraw,
    registerFundingHandlers,
  } = useAppAccount();

  usePortfolioSnapshotPoll(
    tradingMode,
    isTabActive("home") || isTabActive("investing"),
  );

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    conversationBootstrapped.current = false;
  }, [tradingMode]);

  useEffect(() => {
    if (mode !== "command" || !user || conversationBootstrapped.current) return;
    conversationBootstrapped.current = true;

    void (async () => {
      try {
        const modeParam = tradingMode;
        const [convRes, ctxRes] = await Promise.all([
          fetch(`/api/chat/conversations/active?mode=${modeParam}`),
          fetch(`/api/chat/context?mode=${modeParam}`),
        ]);

        let convId: string | null = null;
        let sessionNum: number | null = null;

        if (convRes.ok) {
          const convJson = (await convRes.json()) as {
            conversation?: { id?: string; session_number?: number } | null;
          };
          if (convJson.conversation?.id) {
            convId = convJson.conversation.id;
            sessionNum = convJson.conversation.session_number ?? null;
          } else {
            const createRes = await fetch("/api/chat/conversations/active", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: modeParam }),
            });
            if (createRes.ok) {
              const created = (await createRes.json()) as {
                conversation?: { id?: string; session_number?: number };
              };
              convId = created.conversation?.id ?? null;
              sessionNum = created.conversation?.session_number ?? null;
            }
          }
        }

        if (convId) {
          setConversationId(convId);
          conversationIdRef.current = convId;
          setSessionNumber(sessionNum);

          const msgRes = await fetch(`/api/chat/conversations/${convId}/messages`);
          if (msgRes.ok) {
            const msgJson = (await msgRes.json()) as {
              messages?: Array<{
                id: string;
                role: "user" | "assistant" | "system";
                parts: Array<{ type: string; text?: string; payload?: unknown }>;
                toolPods?: unknown;
                createdAt?: string;
              }>;
            };
            const loaded = msgJson.messages ?? [];
            if (loaded.length > 0) {
              const visible = loaded.filter(isVisibleChatMessage);
              if (visible.length > 0) {
                setMessages(
                  visible.map((m) => ({
                    id: m.id,
                    role: m.role as ChatMessage["role"],
                    parts: mapPersistedParts(m.parts),
                    toolPods: m.toolPods as ChatToolPod[] | undefined,
                  })),
                );
                const latest = visible
                  .map((m) => m.createdAt)
                  .filter(Boolean)
                  .sort()
                  .pop();
                lastOrchestratorPollRef.current = latest ?? new Date().toISOString();
              }
            }
          }
        }

        if (ctxRes.ok) {
          const ctxJson = (await ctxRes.json()) as {
            prompt?: string;
            hasBalanceGoal?: boolean;
          };
          sessionContextRef.current = ctxJson.prompt ?? "";

          if (!ctxJson.hasBalanceGoal) {
            setMessages((prev) => {
              if (prev.length > 0) return prev;
              return [
                {
                  id: "goal-onboarding",
                  role: "assistant",
                  parts: [
                    {
                      type: "text",
                      text: "Welcome to Command. Before we trade, let's set a **balance goal** — the target your agent works toward in the background.\n\nFor example, if you have **$20** in your account, you might aim for **$50**. I'll monitor progress every 2 minutes and suggest (or execute) trades to get you there.\n\n**What balance would you like to reach?**",
                    },
                  ],
                },
              ];
            });
          }
        }
      } catch (e) {
        console.warn("Failed to bootstrap chat session", e);
      }
    })();
  }, [mode, user, tradingMode]);

  useEffect(() => {
    if (!user) return;

    const pollOrchestratorInbox = async () => {
      try {
        const since = lastOrchestratorPollRef.current;
        const convId = conversationIdRef.current;
        const params = new URLSearchParams({
          mode: tradingMode,
          since,
        });
        if (convId) params.set("conversationId", convId);

        const res = await fetch(`/api/autonomous/orchestrator-inbox?${params}`);
        if (!res.ok) return;

        const json = (await res.json()) as {
          messages?: Array<{
            id: string;
            role: string;
            parts: Array<{ type: string; text?: string; payload?: unknown }>;
            toolPods?: unknown;
            createdAt?: string;
          }>;
        };
        const incoming = (json.messages ?? []).filter(isVisibleChatMessage);
        if (incoming.length === 0) return;

        lastOrchestratorPollRef.current = new Date().toISOString();
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const toAdd: ChatMessage[] = incoming
            .filter((m) => !existingIds.has(m.id))
            .map((m) => ({
              id: m.id,
              role: m.role as ChatMessage["role"],
              parts: mapPersistedParts(m.parts),
              toolPods: m.toolPods as ChatToolPod[] | undefined,
            }));
          if (toAdd.length === 0) return prev;
          return [...prev, ...toAdd];
        });
      } catch {
        /* non-fatal */
      }
    };

    void pollOrchestratorInbox();
    const interval = window.setInterval(() => void pollOrchestratorInbox(), 5_000);
    return () => window.clearInterval(interval);
  }, [user, tradingMode, conversationId]);

  useEffect(() => {
    if (mode !== "command" || !user) return;

    const pollTasks = async () => {
      try {
        const since = lastTaskPollRef.current;
        const res = await fetch(
          `/api/chat/pending-tasks?mode=${tradingMode}&since=${encodeURIComponent(since)}`,
        );
        if (!res.ok) return;

        const json = (await res.json()) as {
          tasks?: Array<{ id: string; task_type: string; result?: { message?: string } }>;
        };
        const tasks = json.tasks ?? [];
        if (tasks.length === 0) return;

        lastTaskPollRef.current = new Date().toISOString();
        setMessages((prev) => [
          ...prev,
          ...tasks.map((task) => ({
            id: `task-${task.id}`,
            role: "system" as const,
            parts: [
              {
                type: "text" as const,
                text: `⏱ **Scheduled task · ${task.task_type.replace(/_/g, " ")}**\n\n${task.result?.message ?? "Task completed."}`,
              },
            ],
          })),
        ]);
      } catch {
        // Ignore polling errors — tables may not exist until migration runs.
      }
    };

    void pollTasks();
    const interval = window.setInterval(() => void pollTasks(), 60_000);
    return () => window.clearInterval(interval);
  }, [mode, user, tradingMode]);

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
      const updated = await refreshAccount();
      const available = updated?.balance?.wallet_available ?? 0;
      const label = tradingMode === "demo" ? "Demo wallet funded" : "Deposit received";
      const receiptMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `✅ **${label}**\n\nCredited **$${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**${tradingMode === "demo" ? ` via simulated **${gateway}**` : ""}.\n\nAvailable margin: **$${available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`,
          },
        ],
      };
      setMessages((prev) => [...prev, receiptMessage]);
      notifyPortfolioUpdated();
    },
    [refreshAccount, tradingMode],
  );

  const handleWithdrawSuccess = useCallback(
    async (amt: number) => {
      await refreshAccount();
      notifyPortfolioUpdated();
      const receiptMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `✅ **Withdrawal processed**\n\n**$${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** was withdrawn from your ${tradingMode} wallet.`,
          },
        ],
      };
      setMessages((prev) => [...prev, receiptMessage]);
    },
    [refreshAccount, tradingMode],
  );

  useEffect(() => {
    registerFundingHandlers({
      onDepositSuccess: handleDepositSuccess,
      onWithdrawSuccess: handleWithdrawSuccess,
    });
  }, [registerFundingHandlers, handleDepositSuccess, handleWithdrawSuccess]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const depositStatus = params.get("deposit");
    if (!depositStatus) return;

    params.delete("deposit");
    const url = new URL(window.location.href);
    url.search = params.toString();
    window.history.replaceState(null, "", url.toString());

    if (depositStatus === "success") {
      void refreshAccount().then((updated) => {
        const available = updated?.balance?.wallet_available ?? 0;
        notifyPortfolioUpdated();
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            parts: [
              {
                type: "text",
                text: `✅ **Deposit received**\n\nYour live wallet balance is now **$${available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**. It may take a moment for card payments to settle.`,
              },
            ],
          },
        ]);
      });
      setActiveTab("home");
    } else if (depositStatus === "cancel") {
      setActiveTab("home");
    }
  }, [refreshAccount, setActiveTab]);

  useEffect(() => {
    if (!user) {
      setPositions([]);
      return;
    }

    let cancelled = false;
    const loadPositions = async (silent = false) => {
      if (!silent) setPositionsRefreshing(true);
      try {
        const rows = await fetchOpenPositions(tradingMode);
        if (!cancelled) {
          setPositions(rows as TradeData[]);
          writeHomeTabCache(tradingMode, { positions: rows as TradeData[] });
        }
      } catch {
        if (!cancelled && !silent) {
          /* keep cached / current positions */
        }
      } finally {
        if (!cancelled) setPositionsRefreshing(false);
      }
    };

    void loadPositions(false);
    return () => {
      cancelled = true;
    };
  }, [user, tradingMode]);

  const reloadPositions = useCallback(async (silent = false) => {
    if (!silent) setPositionsRefreshing(true);
    try {
      const rows = await fetchOpenPositions(tradingMode);
      setPositions(rows as TradeData[]);
      writeHomeTabCache(tradingMode, { positions: rows as TradeData[] });
      await refreshAccount(undefined, silent);
      if (!silent) notifyPortfolioUpdated();
    } catch {
      /* keep current positions on refresh failure */
    } finally {
      if (!silent) setPositionsRefreshing(false);
    }
  }, [refreshAccount, tradingMode]);

  useEffect(() => {
    if (!user) return;
    if (!isTabActive("home") && !isTabActive("investing")) return;

    const interval = window.setInterval(() => {
      void reloadPositions(true);
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [user, reloadPositions, isTabActive]);

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

  // 2b. Watchlist polling removed — news tab loads its own data.

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
    tradeLogId?: string;
  }) => {
    const walletAvailable = balance?.wallet_available ?? 0;
    if (walletAvailable < trade.margin) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `⚠️ **Margin check failed:** Required margin **$${trade.margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** exceeds available **$${walletAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**. Deposit funds or reduce size.`,
          },
        ],
      };
      setMessages((prev) => [...prev, errorMsg]);
      openDeposit();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("quant-trade-failed", {
            detail: { message: "Insufficient margin for this trade." },
          }),
        );
      }
      return;
    }

    try {
      const result = await purchaseAssetAtMarket(tradingMode, {
        symbol: trade.symbol,
        side: trade.direction === "BUY" ? "buy" : "sell",
        size: trade.size,
        leverage: trade.leverage,
      });

      if (trade.tradeLogId) {
        await fetch("/api/trades/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tradeLogId: trade.tradeLogId,
            execution_result: result,
          }),
        }).catch(() => undefined);
      }

      await refreshAccount();
      await reloadPositions();
      notifyPortfolioUpdated();

      const position: TradeData = {
        id: result.trade.id,
        symbol: result.trade.symbol,
        direction: result.trade.direction,
        entryPrice: result.trade.entryPrice,
        size: result.trade.size,
        leverage: result.trade.leverage,
        margin: result.trade.margin,
        tp: trade.tp,
        sl: trade.sl,
        status: "OPEN",
        timestamp: trade.timestamp,
      };

      const receiptMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [
          {
            type: "trade-execution",
            text: JSON.stringify({
              ...position,
              capitalDealId: result.trade.capitalDealId,
              notional: result.trade.notional,
            }),
          },
        ],
      };
      setMessages((prev) => [...prev, receiptMessage]);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("quant-trade-executed", { detail: { symbol: trade.symbol } }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Trade execution failed";
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          parts: [{ type: "text", text: `⚠️ **Trade failed:** ${message}` }],
        },
      ]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("quant-trade-failed", { detail: { message } }));
      }
    }
  }, [balance, openDeposit, refreshAccount, reloadPositions, tradingMode]);

  // Trade tickets from chat GenUI widgets
  useEffect(() => {
    const handleTradeFromWidget = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { symbol, direction, size, price, leverage, tradeLogId } = customEvent.detail;

      const effectiveLeverage = leverage ?? 5;
      const margin = (size * price) / effectiveLeverage;

      handleTradeExecute({
        id: crypto.randomUUID(),
        symbol,
        direction,
        price,
        size,
        leverage: effectiveLeverage,
        margin,
        tp: null,
        sl: null,
        timestamp: Date.now(),
        tradeLogId,
      });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("execute-trade", handleTradeFromWidget);
      // Legacy event name for older cached responses
      window.addEventListener("execute-simulated-trade", handleTradeFromWidget);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("execute-trade", handleTradeFromWidget);
        window.removeEventListener("execute-simulated-trade", handleTradeFromWidget);
      }
    };
  }, [handleTradeExecute]);

  const closePosition = useCallback(async (id: string) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;

    setPositions((prev) => prev.filter((p) => p.id !== id));

    try {
      const result = await closePositionAtMarket(tradingMode, id);
      await refreshAccount();
      await reloadPositions();
      notifyPortfolioUpdated();

      const receiptMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        parts: [
          {
            type: "trade-execution",
            text: JSON.stringify({
              ...pos,
              closePrice: result.closePrice,
              pnl: result.pnl,
              status: "CLOSED",
              timestamp: Math.floor(Date.now() / 1000),
            }),
          },
        ],
      };
      setMessages((prev) => [...prev, receiptMessage]);
    } catch (err) {
      console.error("Failed to close Capital.com position:", err);
      await reloadPositions();
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `⚠️ **Close failed:** ${err instanceof Error ? err.message : "Capital.com did not confirm the close."}`,
          },
        ],
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }, [positions, refreshAccount, reloadPositions, tradingMode]);

  const activePositionRow = useMemo(() => {
    if (!activePositionId) return null;
    const pos = positions.find((p) => p.id === activePositionId);
    if (!pos) return null;
    const live = pos.markPrice ?? sidebarQuotes[pos.symbol]?.spot ?? pos.entryPrice;
    const pnl =
      pos.pnl ??
      (pos.direction === "BUY"
        ? (live - pos.entryPrice) * pos.size
        : (pos.entryPrice - live) * pos.size);
    const pnlPct = pos.pnlPct ?? (pos.margin > 0 ? (pnl / pos.margin) * 100 : 0);
    const allocatedValue = Math.max(0, pos.margin + pnl);
    return { pos, live, pnl, pnlPct, allocatedValue };
  }, [activePositionId, positions, sidebarQuotes]);

  const handlePositionAction = useCallback(
    async (request: PositionActionRequest) => {
      const pos = positions.find((p) => p.id === request.dealId);
      if (!pos) return;

      setPositionActionBusy(true);
      const isFullClose = request.action !== "dilute";

      if (isFullClose) {
        setPositions((prev) => prev.filter((p) => p.id !== request.dealId));
      }

      try {
        const result = await closePositionAtMarket(
          tradingMode,
          request.dealId,
          request.action === "dilute" && request.percent
            ? { percent: request.percent }
            : undefined,
        );
        await refreshAccount();
        await reloadPositions();
        notifyPortfolioUpdated();
        setActivePositionId(null);

        if (request.action === "cash_out") {
          openWithdraw();
        }

        const receiptMessage: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          parts: [
            {
              type: "trade-execution",
              text: JSON.stringify({
                ...pos,
                closePrice: result.closePrice,
                pnl: result.pnl,
                status: isFullClose ? "CLOSED" : "OPEN",
                timestamp: Math.floor(Date.now() / 1000),
              }),
            },
          ],
        };
        setMessages((prev) => [...prev, receiptMessage]);
      } catch (err) {
        console.error("Position action failed:", err);
        await reloadPositions();
        const errorMsg: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          parts: [
            {
              type: "text",
              text: `⚠️ **Action failed:** ${err instanceof Error ? err.message : "Capital.com did not confirm."}`,
            },
          ],
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setPositionActionBusy(false);
      }
    },
    [positions, refreshAccount, reloadPositions, tradingMode, openWithdraw],
  );

  const buildScreenContext = useCallback(() => {
    const parts = [
      `Command tab · ${tradingMode} mode`,
      `Active symbol: ${activeSymbol}`,
    ];
    if (positions.length > 0) {
      parts.push(`Open positions: ${positions.map((p) => p.symbol).join(", ")}`);
    }
    if (balance?.wallet_available != null) {
      parts.push(`Available margin: $${balance.wallet_available.toFixed(2)}`);
    }
    return parts.join(" · ");
  }, [activeSymbol, balance?.wallet_available, positions, tradingMode]);

  const loadFollowUpSuggestions = useCallback(
    async (conversation: ChatMessage[]) => {
      const predictMessages = messagesToPredictPayload(conversation);
      if (predictMessages.length === 0) return;

      const lastAssistant = [...predictMessages].reverse().find((m) => m.role === "assistant");
      if (lastAssistant && hasInteractiveQuestionMarkup(lastAssistant.content)) {
        return;
      }

      const requestId = ++followUpRequestId.current;

      try {
        const response = await fetch("/api/chat/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: predictMessages,
            screenContext: buildScreenContext(),
            tradingMode,
            activeSymbol,
            openPositionSymbols: positions.map((p) => p.symbol),
            walletAvailable: balance?.wallet_available,
          }),
        });

        if (requestId !== followUpRequestId.current) return;

        if (response.ok) {
          const data = (await response.json()) as { question?: ParsedInteractiveQuestion | null };
          if (data.question?.options?.length) {
            setFollowUpQuestion(data.question);
          }
        }
      } catch (err) {
        console.error("Follow-up predictor failed:", err);
      }
    },
    [
      activeSymbol,
      balance?.wallet_available,
      buildScreenContext,
      positions,
      tradingMode,
    ],
  );

  const handleFollowUpSelect = useCallback(
    (prompt: string) => {
      setFollowUpQuestion(null);
      void handleSendRef.current?.(prompt);
    },
    [],
  );

  const handleSendRef = useRef<
    ((textToSend: string, pinnedForSend?: TaggedAsset[]) => Promise<void>) | null
  >(null);

  const activeQuestion = useMemo(() => {
    if (loading) return null;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") return null;
    const textPart = lastMsg.parts.find((p) => p.type === "text");
    return parseInteractiveQuestion(textPart?.text ?? "");
  }, [loading, messages]);

  const isQuestionActive = Boolean(
    activeQuestion && !dismissedQuestionIds.includes(activeQuestion.id),
  );

  const handleWidgetAction = useCallback((action: WidgetAction) => {
    if (action.type === "prompt" && action.prompt.trim()) {
      void handleSendRef.current?.(action.prompt.trim());
    }
  }, []);

  const handleNewSession = useCallback(async () => {
    const convId = conversationIdRef.current;
    if (!convId || newSessionLoading) return;
    setNewSessionLoading(true);
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/new-session`, {
        method: "POST",
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        sessionNumber?: number;
        dividerMessage?: {
          id: string;
          role: string;
          parts: Array<{ type: string; text?: string; payload?: unknown }>;
        };
      };
      if (json.sessionNumber) setSessionNumber(json.sessionNumber);
      if (json.dividerMessage) {
        setMessages((prev) => [
          ...prev,
          {
            id: json.dividerMessage!.id,
            role: json.dividerMessage!.role as ChatMessage["role"],
            parts: mapPersistedParts(json.dividerMessage!.parts),
          },
        ]);
      }
    } finally {
      setNewSessionLoading(false);
    }
  }, [newSessionLoading]);

  useEffect(() => {
    const onWidgetEvent = (event: Event) => {
      const detail = (event as CustomEvent<WidgetAction>).detail;
      if (detail) handleWidgetAction(detail);
    };
    window.addEventListener(QUANT_WIDGET_ACTION_EVENT, onWidgetEvent);
    return () => window.removeEventListener(QUANT_WIDGET_ACTION_EVENT, onWidgetEvent);
  }, [handleWidgetAction]);

  const handleQuestionSubmit = useCallback(
    (answer: string) => {
      if (!activeQuestion) return;
      setDismissedQuestionIds((prev) => [...prev, activeQuestion.id]);
      void handleSendRef.current?.(answer);
    },
    [activeQuestion],
  );

  const handleQuestionDismiss = useCallback(() => {
    if (!activeQuestion) return;
    setDismissedQuestionIds((prev) => [...prev, activeQuestion.id]);
  }, [activeQuestion]);

  // --- Core AI Streaming Logic ---
  const handleSend = async (textToSend: string, pinnedForSend: TaggedAsset[] = []) => {
    const userText = textToSend.trim();
    const displayPrompt = formatUserDisplayMessage(userText, pinnedForSend);
    if (!displayPrompt && pinnedForSend.length === 0) return;
    if (loading) return;

    if (!user) {
      window.location.href = `/login?next=${encodeURIComponent("/app")}`;
      return;
    }

    const apiMessage =
      userText ||
      (pinnedForSend.length > 0
        ? "Give a concise outlook with key levels and risk considerations for each pinned asset."
        : "");
    const pinnedAssets = pinnedForSend.map(toPinnedAssetRef);

    // Add user message
    const userMsgId = crypto.randomUUID();
    const newUserMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      parts: [{ type: "text", text: displayPrompt }],
    };
    
    // Placeholder assistant message
    const assistantMsgId = crypto.randomUUID();
    const newAssistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      parts: [],
    };

    setMessages((prev) => [...prev, newUserMessage, newAssistantMessage]);
    setValue("");
    setFollowUpQuestion(null);
    followUpRequestId.current += 1;
    pendingChatScrollRef.current = true;
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
          conversationId: conversationIdRef.current,
          tradingMode,
          sessionContext: sessionContextRef.current,
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

              if (event.type === "quant_ui") {
                const parts = [...lastMsg.parts, { type: "quant-ui" as const, text: event.markup }];
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
      setMessages((prev) => {
        if (prev.length >= 2) {
          void loadFollowUpSuggestions(prev);

          const convId = conversationIdRef.current;
          if (convId) {
            const userMsg = prev.find((m) => m.id === userMsgId);
            const assistantMsg = prev.find((m) => m.id === assistantMsgId);
            if (userMsg && assistantMsg && assistantMsg.parts.length > 0) {
              void fetch(`/api/chat/conversations/${convId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: [
                    {
                      id: userMsg.id,
                      role: userMsg.role,
                      parts: userMsg.parts,
                    },
                    {
                      id: assistantMsg.id,
                      role: assistantMsg.role,
                      parts: assistantMsg.parts,
                      toolPods: assistantMsg.toolPods,
                    },
                  ],
                }),
              }).catch((err) => console.warn("Failed to persist chat messages", err));
            }
          }
        }
        return prev;
      });
    }
  };

  handleSendRef.current = handleSend;

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
      setActiveTab("command");
    },
    [setActiveTab],
  );

  useEffect(() => {
    if (mode !== "command" || pendingBootstrapped.current) return;
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

  return (
    <div className="relative h-full min-h-0 w-full">
      <TabPanel tab="home" activeTab={mode}>
        <HomeSection
          balance={balance}
          summary={summary}
          userEmail={user?.email}
          accountLoading={accountLoading}
          accountRefreshing={accountRefreshing}
          positionsRefreshing={positionsRefreshing}
          tradingMode={tradingMode}
          positions={positions}
          sidebarQuotes={sidebarQuotes}
          onDeposit={openDeposit}
          onWithdraw={openWithdraw}
          onManagePosition={setActivePositionId}
        />
      </TabPanel>

      <TabPanel tab="investing" activeTab={mode}>
        <InvestingSection
          balance={balance}
          summary={summary}
          accountLoading={accountLoading && summary == null}
          accountRefreshing={accountRefreshing}
          positionsRefreshing={positionsRefreshing}
          tradingMode={tradingMode}
          positions={positions}
          sidebarQuotes={sidebarQuotes}
          onManagePosition={setActivePositionId}
          onRefresh={() => void reloadPositions()}
          isActive={isTabActive("investing")}
        />
      </TabPanel>

      <TabPanel tab="command" activeTab={mode}>
        {messages.length === 0 ? <PageBackground overlay="minimal" variant="orb" /> : null}
        <ChatWidgetProvider onWidgetAction={handleWidgetAction}>
        <div className="relative flex h-full w-full overflow-hidden">
          <div className="relative mx-auto flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <OrchestratorCycleControls />
          {sessionNumber ? (
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Session {sessionNumber} · Memory from prior sessions included
              </p>
              <button
                type="button"
                onClick={() => void handleNewSession()}
                disabled={newSessionLoading || !conversationId}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-white/10 disabled:opacity-50"
              >
                {newSessionLoading ? "Saving…" : "New session"}
              </button>
            </div>
          ) : null}
          {messages.length === 0 ? (
            <ChatLandingHero
              showBrandMark={false}
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
              <Conversation className="min-h-0 flex-1 pb-24">
                <ConversationContent
                  ref={chatScrollRef}
                  className="space-y-6 bg-transparent"
                >
                  {messages.map((message, messageIndex) => {
                    const isLastMessage = messageIndex === messages.length - 1;
                    const isActiveUserTurn =
                      loading &&
                      message.role === "user" &&
                      messageIndex === messages.length - 2;
                    return (
                      <ChatMessageBubble
                        key={message.id}
                        message={message}
                        isAssistantStreaming={loading && isLastMessage}
                        livePrices={sidebarQuotes}
                        onClosePosition={closePosition}
                        rootRef={
                          isActiveUserTurn
                            ? (el) => {
                                lastUserMessageRef.current = el;
                              }
                            : undefined
                        }
                      />
                    );
                  })}
                  {loading && responseSpacerHeight > 0 ? (
                    <div
                      aria-hidden
                      className="pointer-events-none shrink-0"
                      style={{ minHeight: responseSpacerHeight }}
                    />
                  ) : null}
                  {!loading && !isQuestionActive ? (
                    <FollowUpSuggestions
                      question={followUpQuestion}
                      disabled={loading}
                      onSelect={handleFollowUpSelect}
                      className="pb-2 pt-1"
                    />
                  ) : null}
                </ConversationContent>
                <ConversationScrollButton className="border-white/8 bg-[var(--terminal-surface)] text-zinc-300 hover:text-white" />
              </Conversation>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/95 to-transparent pb-3 pt-6">
                <div className="relative">
                  <InputBar
                    value={value}
                    onChange={setValue}
                    onSend={({ content }) => {
                      const tags = [...taggedAssets];
                      setTaggedAssets([]);
                      handleSend(content, tags);
                    }}
                    disabled={loading || isQuestionActive}
                    status={loading ? "streaming" : "ready"}
                    placeholder={
                      isQuestionActive
                        ? "Answer the question below…"
                        : "Continue the conversation…"
                    }
                    variant="landing"
                    taggedAssets={taggedAssets}
                    onRemoveTaggedAsset={removeTaggedAsset}
                    maxTaggedAssets={MAX_TAGGED_ASSETS}
                  />
                  {isQuestionActive && activeQuestion ? (
                    <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto">
                      <div className="mx-auto w-full max-w-2xl">
                        <InteractiveQuestionForm
                          question={activeQuestion}
                          onSubmit={handleQuestionSubmit}
                          onDismiss={handleQuestionDismiss}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
          </div>
          <WealthMonitorPanel />
        </div>
        </ChatWidgetProvider>
      </TabPanel>

      {activePositionRow ? (
        <PositionActionsSheet
          position={activePositionRow.pos}
          markPrice={activePositionRow.live}
          pnl={activePositionRow.pnl}
          pnlPct={activePositionRow.pnlPct}
          allocatedValue={activePositionRow.allocatedValue}
          open={activePositionId != null}
          busy={positionActionBusy}
          onClose={() => setActivePositionId(null)}
          onConfirm={(request) => void handlePositionAction(request)}
        />
      ) : null}

      <AccountPanel
        open={isAccountPanelOpen}
        onClose={() => setIsAccountPanelOpen(false)}
        summary={summary}
        userEmail={user?.email}
        onDeposit={() => {
          setIsAccountPanelOpen(false);
          openDeposit();
        }}
        onWithdraw={() => {
          setIsAccountPanelOpen(false);
          openWithdraw();
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

