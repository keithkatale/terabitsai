"use client";

import { useEffect, useState, useMemo, useRef, useCallback, useId, type ReactNode } from "react";
import { useAppTab, type AppTab } from "@/contexts/app-tab-context";
import InputBar, { type TaggedAsset } from "@/components/ui/input-bar";
import type { AiToolId } from "@/lib/chat/ai-tools";
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
  Sparkles,
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
  LayoutGrid,
} from "lucide-react";

import { normalizeGenUiPayload } from "@/components/generative-ui/genui-types";
import { GenUiRenderer } from "@/components/generative-ui/genui-renderer";
import { QuantUiRenderer } from "@/components/quant-ui/quant-ui-renderer";
import { TradeReceiptCard } from "@/components/ai-elements/message";

function getGenUiColSpan(payload: any): number {
  try {
    const nodes = normalizeGenUiPayload(payload);
    if (!nodes) return 1;
    for (const node of nodes) {
      if (node.type === "chart" || node.type === "table") return 2;
      if (node.type === "grid" && (node.columns ?? 1) > 1) return 2;
      if (node.type === "section" && node.children) {
        for (const child of node.children) {
          if (child.type === "chart" || child.type === "table") return 2;
          if (child.type === "grid" && (child.columns ?? 1) > 1) return 2;
        }
      }
    }
  } catch {}
  return 1;
}

function getGenUiTitle(payload: any): string {
  try {
    if (payload && typeof payload === "object") {
      if ("title" in payload && typeof (payload as any).title === "string") {
        return (payload as any).title;
      }
    }
    const nodes = normalizeGenUiPayload(payload);
    if (nodes) {
      for (const node of nodes) {
        if (node.type === "section" && node.title) return node.title;
        if ("title" in node && node.title) return node.title as string;
      }
    }
  } catch {}
  return "Market Intelligence";
}

function getQuantUiTitleAndSpan(text: string): { title: string; colSpan: number } {
  let title = "Market Signal Grid";
  let colSpan = 1;
  try {
    const titleMatch = text.match(/title="([^"]+)"/);
    if (titleMatch) title = titleMatch[1];
    if (text.includes("<quant:chart") || text.includes("<quant:compare")) {
      colSpan = 2;
    }
  } catch {}
  return { title, colSpan };
}

import { ChatMessage as ChatMessageBubble } from "@/components/ai-elements/message";
import { FollowUpSuggestions } from "@/components/ai-elements/follow-up-suggestions";
import { InteractiveQuestionForm } from "@/components/ai-elements/interactive-question-form";
import type { ChatStreamEvent, ChatToolPod } from "@/lib/chat/stream-types";
import {
  buildActivityTimeline,
  type ActivityPartRef,
  applyUserUpdateToParts,
} from "@/lib/chat/activity-timeline";
import { deriveLiveTraceFromSteps, LIVE_TRACE_PLANNING } from "@/lib/chat/live-trace";
import type { SubAgentState } from "@/lib/chat/subagent-types";
import { normalizeSubAgentList } from "@/lib/chat/subagent-types";
import { applySubagentStreamEvent } from "@/lib/chat/subagent-stream";
import { AgentDetailPane } from "@/components/workspace/agent-detail-pane";
import { ResizablePane } from "@/components/ui/resizable-pane";
import { PremiumUpgradeGate } from "@/components/subscription/premium-upgrade-gate";
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
  CHAT_LANDING_MAX_TAGGED_ASSETS,
} from "@/components/workspace/chat-landing-hero";
import { HomeSection } from "@/components/workspace/app-sections/home-section";
import { WalletSection } from "@/components/workspace/app-sections/wallet-section";
import { MarketsTerminal } from "@/components/markets/markets-terminal";
import { WalletActionsBar } from "@/components/workspace/wallet-actions-bar";
import {
  ConversationPicker,
  type ConversationPickerItem,
} from "@/components/workspace/conversation-picker";
import { notifyPortfolioUpdated } from "@/lib/portfolio/portfolio-events";
import { readHomeTabCache, writeHomeTabCache } from "@/lib/portfolio/home-tab-cache";
import { APP_BASE, CHAT_DRAFT_SEGMENT } from "@/lib/routes";
import { readCachedTradingMode } from "@/lib/account/user-app-preferences-client";
import { usePortfolioSnapshotPoll } from "@/hooks/use-portfolio-snapshot-poll";
import { synthesizeConversationTitleFromFirstUserText } from "@/lib/chat/conversation-title";

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
  type:
    | "reasoning"
    | "text"
    | "tool_ref"
    | "user_update"
    | "trade-execution"
    | "genui"
    | "quant-ui"
    | "monitor_directive"
    | "session_divider";
  text?: string;
  toolUseId?: string;
  payload?: unknown;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
  toolPods?: ChatToolPod[];
  subAgents?: SubAgentState[];
  liveStatus?: string;
  liveStatusDetail?: string;
}

function mapPersistedParts(
  parts: Array<{ type: string; text?: string; toolUseId?: string; payload?: unknown }>,
): MessagePart[] {
  return parts.map((p) => {
    if (p.type === "genui" && p.payload != null) {
      return { type: "genui" as const, payload: p.payload };
    }
    if (p.type === "quant-ui" && p.payload != null) {
      return { type: "quant-ui" as const, payload: p.payload };
    }
    if (p.type === "tool_ref" && p.toolUseId) {
      return { type: "tool_ref" as const, toolUseId: p.toolUseId };
    }
    if (p.type === "user_update") {
      return { type: "user_update" as const, text: p.text };
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

function activityPartsFromMessage(parts: MessagePart[]): ActivityPartRef[] {
  return parts
    .filter((p) => p.type === "reasoning" || p.type === "tool_ref" || p.type === "user_update")
    .map((p) => {
      if (p.type === "tool_ref" && p.toolUseId) {
        return { type: "tool_ref" as const, toolUseId: p.toolUseId };
      }
      if (p.type === "user_update") {
        return { type: "user_update" as const, text: p.text };
      }
      return { type: "reasoning" as const, text: p.text };
    });
}

function appendReasoningPart(parts: MessagePart[], text: string): MessagePart[] {
  const next = [...parts];
  const last = next[next.length - 1];
  if (last?.type === "reasoning") {
    next[next.length - 1] = { ...last, text: `${last.text ?? ""}${text}` };
  } else {
    next.push({ type: "reasoning", text });
  }
  return next;
}

function appendToolRefPart(parts: MessagePart[], toolUseId: string): MessagePart[] {
  const next = [...parts];
  const last = next[next.length - 1];
  if (last?.type === "tool_ref" && last.toolUseId === toolUseId) return next;
  next.push({ type: "tool_ref", toolUseId });
  return next;
}

function liveStatusFromMessage(
  parts: MessagePart[],
  toolPods: ChatToolPod[],
  fallback?: string,
): string {
  const steps = buildActivityTimeline(activityPartsFromMessage(parts), toolPods, true);
  return deriveLiveTraceFromSteps(steps, fallback || LIVE_TRACE_PLANNING);
}

function isWealthMonitorMessage(msg: {
  role: string;
  parts: Array<{ type?: string; payload?: unknown }>;
}): boolean {
  if (msg.parts.some((p) => p.type === "monitor_directive")) return true;
  if (
    msg.role === "assistant" &&
    msg.parts.some((p) => {
      const payload = p.payload as { source?: string } | undefined;
      return payload?.source === "wealth_monitor";
    })
  ) {
    return true;
  }
  return false;
}

function isUserFacingCommandMessage(msg: {
  role: string;
  parts: Array<{ type?: string; payload?: unknown }>;
}): boolean {
  return isVisibleChatMessage(msg) && !isWealthMonitorMessage(msg);
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

// --- Main workspace ---
function TabPanel({
  tab,
  activeTab,
  children,
}: {
  tab: AppTab;
  activeTab: AppTab;
  children: ReactNode;
}) {
  if (activeTab !== tab) return null;

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden">
      {children}
    </div>
  );
}

function mapLoadedMessagesToChat(
  loaded: Array<{
    id: string;
    role: string;
    parts: Array<{ type: string; text?: string; payload?: unknown }>;
    toolPods?: unknown;
    subAgents?: unknown;
    createdAt?: string;
    created_at?: string;
  }>,
): ChatMessage[] {
  const visible = loaded.filter(isUserFacingCommandMessage);
  return visible.map((m) => ({
    id: m.id,
    role: m.role as ChatMessage["role"],
    parts: mapPersistedParts(m.parts),
    toolPods: m.toolPods as ChatToolPod[] | undefined,
    subAgents: normalizeSubAgentList(m.subAgents),
  }));
}

function sortConversations(items: ConversationPickerItem[]): ConversationPickerItem[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.updated_at || b.created_at).getTime() -
      new Date(a.updated_at || a.created_at).getTime(),
  );
}

function toPickerItem(row: {
  id: string;
  title?: string | null;
  created_at: string;
  updated_at: string;
  is_active?: boolean;
}): ConversationPickerItem {
  return {
    id: row.id,
    title: row.title?.trim() || "New conversation",
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_active: row.is_active,
  };
}

// --- Main workspace ---
export function TradingWorkspace() {
  const {
    activeTab: activeTabRaw,
    setActiveTab,
    isTabActive,
    routeConversationId,
    navigateToConversation,
    navigateToNewChat,
  } = useAppTab();
  const mode = activeTabRaw ?? "chat";
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [openAgentId, setOpenAgentId] = useState<string | null>(null);
  const openAgent = useMemo(() => {
    if (!openAgentId) return null;
    for (const message of messages) {
      const agent = message.subAgents?.find((a) => a.id === openAgentId);
      if (agent) return agent;
    }
    return null;
  }, [messages, openAgentId]);
  const [loading, setLoading] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState<ParsedInteractiveQuestion | null>(null);
  const [dismissedQuestionIds, setDismissedQuestionIds] = useState<string[]>([]);
  const pendingBootstrapped = useRef(false);
  const followUpRequestId = useRef(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationPickerItem[]>([]);
  const [switchingConversation, setSwitchingConversation] = useState(false);
  const sessionContextRef = useRef("");
  const conversationIdRef = useRef<string | null>(null);
  const loadedRouteIdRef = useRef<string | null>(null);
  const creatingChatRef = useRef(false);
  const chatMetadataLoadedRef = useRef(false);
  const lastTaskPollRef = useRef(new Date().toISOString());
  const lastOrchestratorPollRef = useRef(new Date().toISOString());
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement | null>(null);
  const pendingChatScrollRef = useRef(false);
  const [responseSpacerHeight, setResponseSpacerHeight] = useState(0);
  const [userPlan, setUserPlan] = useState<"free" | "pro" | "premium">("free");
  const [isHomeChatSidebarOpen, setIsHomeChatSidebarOpen] = useState(false);

  // Helper for micro-sparklines on terminal canvas
  const buildLocalLinePath = useCallback((data: number[], w: number, h: number, pad = 2) => {
    if (data.length === 0) return { line: "", area: "" };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = (w - pad * 2) / Math.max(1, data.length - 1);
    const pts = data.map((d, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (d - min) / range);
      return [x, y] as const;
    });
    const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const area = `${line} L${pts[pts.length - 1][0].toFixed(2)},${h} L${pts[0][0].toFixed(2)},${h} Z`;
    return { line, area };
  }, []);

  const bentoWidgets = useMemo(() => {
    const list: Array<{
      id: string;
      type: "genui" | "quant-ui" | "trade-execution";
      title: string;
      payload?: any;
      text?: string;
      colSpan: number;
    }> = [];
    messages.forEach((msg) => {
      msg.parts.forEach((part, idx) => {
        const id = `${msg.id}-${idx}`;
        if (part.type === "trade-execution") {
          try {
            const trade = typeof part.text === "string" ? JSON.parse(part.text) : part.text;
            list.push({ id, type: "trade-execution", title: `${trade.symbol} Order Receipt`, payload: trade, colSpan: 1 });
          } catch {}
        } else if (part.type === "genui" && part.payload != null) {
          list.push({ id, type: "genui", title: getGenUiTitle(part.payload), payload: part.payload, colSpan: getGenUiColSpan(part.payload) });
        } else if (part.type === "quant-ui" && part.text?.includes("<quant:")) {
          const { title, colSpan } = getQuantUiTitleAndSpan(part.text);
          list.push({ id, type: "quant-ui", title, text: part.text, colSpan });
        }
      });
    });
    return list;
  }, [messages]);

  useEffect(() => {
    fetch("/api/subscription/status", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.plan) setUserPlan(d.plan);
      })
      .catch(() => {});
  }, []);

  const resetCommandChatUi = useCallback(() => {
    setMessages([]);
    setValue("");
    setTaggedAssets([]);
    setDismissedQuestionIds([]);
    setFollowUpQuestion(null);
    setOpenAgentId(null);
  }, []);

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
    isTabActive("home") || isTabActive("markets"),
  );

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    loadedRouteIdRef.current = null;
    creatingChatRef.current = false;
  }, [tradingMode]);

  const loadConversationById = useCallback(
    async (id: string) => {
      setSwitchingConversation(true);
      try {
        const alreadyActive = conversations.some((c) => c.id === id && c.is_active);
        if (!alreadyActive) {
          await fetch(`/api/chat/conversations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ mode: tradingMode }),
          });
        }
        const res = await fetch(`/api/chat/conversations/${id}/messages`, {
          credentials: "include",
        });
        if (res.status === 401) return;
        if (!res.ok) return;
        const json = (await res.json()) as {
          messages?: Array<{
            id: string;
            role: string;
            parts: Array<{ type: string; text?: string; payload?: unknown }>;
            toolPods?: unknown;
            subAgents?: unknown;
            createdAt?: string;
          }>;
        };
        setConversationId(id);
        conversationIdRef.current = id;
        loadedRouteIdRef.current = id;
        setConversations((prev) =>
          sortConversations(prev.map((c) => ({ ...c, is_active: c.id === id }))),
        );
        setMessages(mapLoadedMessagesToChat(json.messages ?? []));
        setDismissedQuestionIds([]);
        setFollowUpQuestion(null);
        setValue("");
        setTaggedAssets([]);
      } catch (e) {
        console.warn("Failed to load conversation", e);
      } finally {
        setSwitchingConversation(false);
      }
    },
    [tradingMode, conversations],
  );

  useEffect(() => {
    if (mode !== "chat" || !user) return;
    if (chatMetadataLoadedRef.current) return;
    chatMetadataLoadedRef.current = true;

    void (async () => {
      try {
        const modeParam = tradingMode;
        const [listRes, ctxRes] = await Promise.all([
          fetch(`/api/chat/conversations?mode=${modeParam}`, { credentials: "include" }),
          fetch(`/api/chat/context?mode=${modeParam}`, { credentials: "include" }),
        ]);

        if (listRes.ok) {
          const listJson = (await listRes.json()) as {
            conversations?: ConversationPickerItem[];
          };
          setConversations(
            sortConversations((listJson.conversations ?? []).map((c) => toPickerItem(c))),
          );
        }

        if (ctxRes.ok) {
          const ctxJson = (await ctxRes.json()) as {
            prompt?: string;
            hasBalanceGoal?: boolean;
          };
          sessionContextRef.current = ctxJson.prompt ?? "";
        }
      } catch (e) {
        console.warn("Failed to load chat metadata", e);
      }
    })();
  }, [mode, user, tradingMode]);

  useEffect(() => {
    chatMetadataLoadedRef.current = false;
  }, [tradingMode]);

  const bootstrapFirstConversationTurn = useCallback(
    async (convId: string, userMsg: ChatMessage, rawUserText: string) => {
      // Show smart optimistic title immediately (never raw user text)
      const optimisticTitle = synthesizeConversationTitleFromFirstUserText(rawUserText);
      setConversations((prev) =>
        sortConversations(
          prev.map((c) => (c.id === convId ? { ...c, title: optimisticTitle } : c)),
        ),
      );

      try {
        // Generate AI title first (this is fast and important for UX)
        const titleRes = await fetch(`/api/chat/conversations/${convId}/generate-title`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ firstUserText: rawUserText }),
        });

        if (titleRes.ok) {
          const titleJson = (await titleRes.json()) as {
            title?: string | null;
            updated_at?: string | null;
            generated?: boolean;
          };
          if (titleJson.title?.trim()) {
            const finalTitle = titleJson.title.trim();
            console.log(
              `[chat] Title ${titleJson.generated ? "generated" : "fallback"}: "${finalTitle}"`,
            );
            setConversations((prev) =>
              sortConversations(
                prev.map((c) =>
                  c.id === convId
                    ? {
                        ...c,
                        title: finalTitle,
                        updated_at: titleJson.updated_at ?? c.updated_at,
                      }
                    : c,
                ),
              ),
            );
          }
        } else {
          console.warn(`[chat] Title generation failed: ${titleRes.status}`);
        }

        // Persist user message (can happen in parallel or after title)
        const persistRes = await fetch(`/api/chat/conversations/${convId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messages: [
              {
                id: userMsg.id,
                role: userMsg.role,
                parts: userMsg.parts,
              },
            ],
          }),
        });

        if (!persistRes.ok) {
          console.warn(`[chat] Message persistence failed: ${persistRes.status}`);
        }
      } catch (err) {
        console.error("[chat] Failed to bootstrap conversation title:", err);
      }
    },
    [],
  );

  useEffect(() => {
    if (mode !== "chat" || !user) return;

    if (!routeConversationId || routeConversationId === CHAT_DRAFT_SEGMENT) {
      // Don't reset if we're in the middle of sending a message (loading state)
      // This prevents race conditions when creating a new conversation
      if (loadedRouteIdRef.current === CHAT_DRAFT_SEGMENT) return;
      if (loading && messages.length > 0) return; // Actively streaming - don't reset
      loadedRouteIdRef.current = CHAT_DRAFT_SEGMENT;
      setConversationId(null);
      conversationIdRef.current = null;
      resetCommandChatUi();
      return;
    }

    // Don't reload if we already have this conversation loaded
    if (loadedRouteIdRef.current === routeConversationId) return;
    
    // Don't reload if we're actively streaming (we just created this conversation)
    if (loading && conversationIdRef.current === routeConversationId) return;
    
    void loadConversationById(routeConversationId);
  }, [mode, user, routeConversationId, loadConversationById, resetCommandChatUi, loading, messages.length]);

  useEffect(() => {
    if (mode !== "chat" || !user || !isTabActive("chat")) return;

    let authLost = false;

    const pollOrchestratorInbox = async () => {
      if (authLost) return;
      try {
        const since = lastOrchestratorPollRef.current;
        const convId = conversationIdRef.current;
        const params = new URLSearchParams({
          mode: tradingMode,
          since,
        });
        if (convId) params.set("conversationId", convId);

        const res = await fetch(`/api/autonomous/orchestrator-inbox?${params}`, {
          credentials: "include",
        });
        if (res.status === 401) {
          authLost = true;
          return;
        }
        if (!res.ok) return;

        const json = (await res.json()) as {
          messages?: Array<{
            id: string;
            role: string;
            parts: Array<{ type: string; text?: string; payload?: unknown }>;
            toolPods?: unknown;
    subAgents?: unknown;
            createdAt?: string;
          }>;
        };
        const incoming = (json.messages ?? []).filter(isUserFacingCommandMessage);
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
    subAgents: normalizeSubAgentList(m.subAgents),
            }));
          if (toAdd.length === 0) return prev;
          return [...prev, ...toAdd];
        });
      } catch {
        /* non-fatal */
      }
    };

    void pollOrchestratorInbox();
    const interval = window.setInterval(() => void pollOrchestratorInbox(), 30_000);
    return () => window.clearInterval(interval);
  }, [mode, user, tradingMode, isTabActive]);

  useEffect(() => {
    if (mode !== "chat" || !user || !isTabActive("chat")) return;

    let authLost = false;

    const pollTasks = async () => {
      if (authLost) return;
      try {
        const since = lastTaskPollRef.current;
        const res = await fetch(
          `/api/chat/pending-tasks?mode=${tradingMode}&since=${encodeURIComponent(since)}`,
          { credentials: "include" },
        );
        if (res.status === 401) {
          authLost = true;
          return;
        }
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
    const interval = window.setInterval(() => void pollTasks(), 120_000);
    return () => window.clearInterval(interval);
  }, [mode, user, tradingMode, isTabActive]);

  const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false);
  const [taggedAssets, setTaggedAssets] = useState<TaggedAsset[]>([]);
  const [selectedAiTools, setSelectedAiTools] = useState<AiToolId[]>([]);

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
    if (!isTabActive("home") && !isTabActive("markets")) return;

    const interval = window.setInterval(() => {
      void reloadPositions(true);
    }, 90_000);

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

  const createNewChat = useCallback(() => {
    if (loading || switchingConversation) return;
    resetCommandChatUi();
    setConversationId(null);
    conversationIdRef.current = null;
    loadedRouteIdRef.current = null;
    creatingChatRef.current = false;
    navigateToNewChat();
  }, [loading, switchingConversation, resetCommandChatUi, navigateToNewChat]);

  const selectConversation = useCallback(
    (id: string) => {
      if (loading || switchingConversation || id === conversationId) return;
      navigateToConversation(id);
    },
    [loading, switchingConversation, conversationId, navigateToConversation],
  );

  const deleteConversationById = useCallback(
    async (id: string) => {
      if (loading || switchingConversation) return;
      try {
        const res = await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
        if (!res.ok) return;
        const remaining = conversations.filter((c) => c.id !== id);
        setConversations(remaining);
        if (conversationIdRef.current === id) {
          if (remaining[0]) {
            navigateToConversation(remaining[0].id);
          } else {
            createNewChat();
          }
        }
      } catch (e) {
        console.warn("Failed to delete conversation", e);
      }
    },
    [loading, switchingConversation, conversations, createNewChat, navigateToConversation],
  );

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
      window.location.href = `/login?next=${encodeURIComponent(`${APP_BASE}/markets`)}`;
      return;
    }

    const apiMessage =
      userText ||
      (pinnedForSend.length > 0
        ? "Give a concise outlook with key levels and risk considerations for each pinned asset."
        : "");
    const pinnedAssets = pinnedForSend.map(toPinnedAssetRef);

    const isFirstTurn = messages.length === 0;

    // Add user message FIRST (optimistic update - like ChatGPT/Claude)
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

    // Set messages BEFORE any navigation to ensure UI shows the chat immediately
    setMessages((prev) => [...prev, newUserMessage, newAssistantMessage]);
    setValue("");
    setFollowUpQuestion(null);
    followUpRequestId.current += 1;
    pendingChatScrollRef.current = true;
    setLoading(true);

    // Now create conversation if needed
    let convId = conversationIdRef.current;
    if (!convId) {
      try {
        const createRes = await fetch("/api/chat/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ mode: tradingMode }),
        });
        if (!createRes.ok) {
          const errBody = await createRes.json().catch(() => ({}));
          throw new Error(
            typeof errBody.error === "string" ? errBody.error : "Failed to create conversation",
          );
        }
        const createdJson = (await createRes.json()) as {
          conversation?: {
            id: string;
            title?: string | null;
            created_at: string;
            updated_at: string;
          };
        };
        const row = createdJson.conversation;
        if (!row?.id) throw new Error("Failed to create conversation");

        convId = row.id;
        conversationIdRef.current = convId;
        setConversationId(convId);
        loadedRouteIdRef.current = convId;

        const item = toPickerItem({ ...row, is_active: true });
        setConversations((prev) =>
          sortConversations([item, ...prev.map((c) => ({ ...c, is_active: false }))]),
        );

        // Navigate AFTER messages are in state (deferred to next tick)
        // This prevents the route change from triggering a re-render that shows the landing hero
        if (mode !== "home") {
          setTimeout(() => {
            navigateToConversation(convId!, { replace: true });
          }, 0);
        }
      } catch (err) {
        console.error("Failed to create conversation:", err);
        // Remove the optimistic messages on error
        setMessages((prev) => prev.filter((m) => m.id !== userMsgId && m.id !== assistantMsgId));
        setLoading(false);
        return;
      }
    }

    if (isFirstTurn) {
      void bootstrapFirstConversationTurn(convId, newUserMessage, apiMessage);
    }

    try {
      const history = buildHistoryFromMessages(messages);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: apiMessage,
          pinnedAssets,
          aiTools: selectedAiTools,
          history,
          conversationId: convId,
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

              if (event.type === "user_update") {
                const partsWithoutPrevUserUpdates = lastMsg.parts.filter((p) => p.type !== "user_update");
                const activityParts = activityPartsFromMessage(partsWithoutPrevUserUpdates);
                const nextActivityParts = applyUserUpdateToParts(activityParts, event.message);
                const parts: MessagePart[] = [
                  ...partsWithoutPrevUserUpdates,
                  { type: "user_update", text: event.message },
                ];
                updated[updated.length - 1] = {
                  ...lastMsg,
                  parts,
                  liveStatus: liveStatusFromMessage(nextActivityParts, lastMsg.toolPods ?? []),
                  liveStatusDetail: undefined,
                };
                return updated;
              }

              if (event.type === "reasoning") {
                const parts = appendReasoningPart(lastMsg.parts, event.text);
                updated[updated.length - 1] = {
                  ...lastMsg,
                  parts,
                  liveStatus: liveStatusFromMessage(parts, lastMsg.toolPods ?? [], lastMsg.liveStatus),
                  liveStatusDetail: undefined,
                };
                return updated;
              }

              if (event.type === "text") {
                const parts = [...lastMsg.parts];
                const lastPart = parts[parts.length - 1];
                if (lastPart && lastPart.type === "text") {
                  parts[parts.length - 1] = { ...lastPart, text: (lastPart.text ?? "") + event.text };
                } else {
                  parts.push({ type: "text", text: event.text });
                }
                updated[updated.length - 1] = {
                  ...lastMsg,
                  parts,
                  liveStatus: undefined,
                  liveStatusDetail: undefined,
                };
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
                const hasReasoning = lastMsg.parts.some(
                  (p) => p.type === "reasoning" && p.text?.trim(),
                );
                if (hasReasoning) return prev;
                updated[updated.length - 1] = {
                  ...lastMsg,
                  liveStatus: liveStatusFromMessage(
                    lastMsg.parts,
                    lastMsg.toolPods ?? [],
                    event.label,
                  ),
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
                const parts = appendToolRefPart(lastMsg.parts, event.toolUseId);
                updated[updated.length - 1] = {
                  ...lastMsg,
                  parts,
                  toolPods: pods,
                  liveStatus: liveStatusFromMessage(parts, pods, lastMsg.liveStatus),
                };
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
                  liveStatus: liveStatusFromMessage(lastMsg.parts, pods, lastMsg.liveStatus),
                };
                return updated;
              }

              if (
                event.type === "subagent_start" ||
                event.type === "subagent_reasoning" ||
                event.type === "subagent_update" ||
                event.type === "subagent_text" ||
                event.type === "subagent_tool_start" ||
                event.type === "subagent_tool_end" ||
                event.type === "subagent_end"
              ) {
                const subAgents = applySubagentStreamEvent(lastMsg.subAgents ?? [], event);
                if (!subAgents) return prev;
                updated[updated.length - 1] = { ...lastMsg, subAgents };
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
                      subAgents: assistantMsg.subAgents,
                    },
                  ],
                }),
              })
                .then(async (persistRes) => {
                  if (!persistRes.ok) return;
                  const persistJson = (await persistRes.json()) as {
                    title?: string | null;
                    updated_at?: string | null;
                  };
                  if (persistJson.title || persistJson.updated_at) {
                    setConversations((prev) =>
                      sortConversations(
                        prev.map((c) =>
                          c.id === convId
                            ? {
                                ...c,
                                title: persistJson.title?.trim() || c.title,
                                updated_at: persistJson.updated_at ?? c.updated_at,
                              }
                            : c,
                        ),
                      ),
                    );
                  }
                })
                .catch((err) => console.warn("Failed to persist chat messages", err));
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
      setActiveTab("chat");
    },
    [setActiveTab],
  );

  const onSignalTrigger = useCallback(
    (prompt: string) => {
      setIsHomeChatSidebarOpen(true);
      void handleSend(prompt);
    },
    [handleSend]
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

  return (
    <div className="relative h-full min-h-0 w-full">
      <TabPanel tab="home" activeTab={mode}>
        <div className="flex h-full min-h-0 flex-row overflow-hidden relative">
          <div className="flex flex-1 min-w-0 flex-col overflow-hidden pb-0">
            <HomeSection
              sidebarQuotes={sidebarQuotes}
              goToChatWithPrompt={goToChatWithPrompt}
              onSignalTrigger={onSignalTrigger}
              isHomeChatSidebarOpen={isHomeChatSidebarOpen}
            />
          </div>
          
          {/* Floating prompt box - only visible if right sidebar is closed */}
          {!isHomeChatSidebarOpen && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-40 pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-zinc-950/60 backdrop-blur-md shadow-2xl">
                <button
                  type="button"
                  className="size-8 shrink-0 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all"
                >
                  <PlusIcon className="size-4" />
                </button>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (value.trim()) {
                        onSignalTrigger(value);
                      }
                    }
                  }}
                  placeholder="Ask any prompt question randomly..."
                  disabled={loading}
                  className="flex-1 bg-transparent border-0 outline-none text-zinc-200 placeholder:text-zinc-500 text-xs py-1 px-1 focus:ring-0 focus-visible:outline-none min-w-0"
                />
                <button
                  type="button"
                  disabled={loading || !value.trim()}
                  onClick={() => {
                    if (value.trim()) {
                      onSignalTrigger(value);
                    }
                  }}
                  className="size-8 shrink-0 rounded-full bg-cyan-500 hover:bg-cyan-400 text-zinc-950 flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:bg-cyan-500 disabled:cursor-not-allowed"
                >
                  <ArrowUpIcon className="size-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}

          {/* Sliding Right-Side AI Sidebar */}
          {isHomeChatSidebarOpen && (
            <ResizablePane
              minWidth={360}
              maxWidth={800}
              defaultWidth={450}
              side="right"
              className="hidden shrink-0 border-l border-white/[0.08] bg-[var(--terminal-surface)] md:flex flex-col h-full min-h-0 relative z-40 shadow-2xl animate-in slide-in-from-right duration-300"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/[0.08] bg-black/20">
                <div className="flex items-center gap-2">
                  <div className="size-2 bg-cyan-400 rounded-full animate-pulse shrink-0" />
                  <span className="text-[10px] font-black text-white uppercase tracking-wider">CMC AI Copilot Panel</span>
                </div>
                <button
                  onClick={() => setIsHomeChatSidebarOpen(false)}
                  className="size-7 hover:bg-white/[0.06] rounded-md flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-black/10">
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <Sparkles className="size-10 text-cyan-400 animate-pulse" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">No Active AI Context</h4>
                      <p className="text-[11px] text-zinc-500 max-w-[240px] mx-auto mt-1 leading-normal">
                        Tap any upper signal card or use the floating prompt bar to initialize deep AI analysis.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex min-h-0 flex-1 flex-col px-2 py-4 sm:px-4">
                    <Conversation className="min-h-0 flex-1 pb-24">
                      <ConversationContent
                        ref={chatScrollRef}
                        className="space-y-4 bg-transparent"
                      >
                        <div className="space-y-4 px-2">
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
                                hideAssistantOrb={true}
                                livePrices={sidebarQuotes}
                                onClosePosition={closePosition}
                                onOpenAgentDetail={(agent) => setOpenAgentId(agent.id)}
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
                        </div>
                      </ConversationContent>
                    </Conversation>
                  </div>
                )}
                
                {/* Sidebar bottom Sticky Input Bar */}
                <div className="absolute bottom-0 left-0 right-0 pointer-events-none pb-3 pt-6 px-4 bg-transparent">
                  <div className="pointer-events-auto">
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
                      placeholder="Ask co-pilot in sidebar..."
                      variant="landing"
                      taggedAssets={taggedAssets}
                      onRemoveTaggedAsset={removeTaggedAsset}
                      onToggleTaggedAsset={toggleTaggedAsset}
                      maxTaggedAssets={MAX_TAGGED_ASSETS}
                      selectedAiTools={selectedAiTools}
                      onSelectedAiToolsChange={setSelectedAiTools}
                    />
                  </div>
                </div>
              </div>
            </ResizablePane>
          )}
        </div>
      </TabPanel>

      <TabPanel tab="wallet" activeTab={mode}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <WalletActionsBar />
          {userPlan !== "premium" ? (
            <PremiumUpgradeGate currentPlan={userPlan} />
          ) : (
            <WalletSection
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
          )}
        </div>
      </TabPanel>

      <TabPanel tab="markets" activeTab={mode}>
        <MarketsTerminal />
      </TabPanel>

      <TabPanel tab="chat" activeTab={mode}>
        {messages.length === 0 ? <PageBackground overlay="minimal" variant="orb" /> : null}
        <div className="relative flex h-full w-full overflow-hidden">
          <ConversationPicker
            conversations={conversations}
            activeConversationId={conversationId}
            onSelect={(id) => void selectConversation(id)}
            onNewChat={() => void createNewChat()}
            onDelete={(id) => void deleteConversationById(id)}
            disabled={loading || switchingConversation}
            className="min-w-0 flex-1"
          >
          <ChatWidgetProvider onWidgetAction={handleWidgetAction}>
          <div className="relative flex h-full w-full overflow-hidden">
            <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          {messages.length === 0 ? (
            <ChatLandingHero
              showBrandMark={false}
              tone="chat"
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
              maxTaggedAssets={MAX_TAGGED_ASSETS}
              selectedAiTools={selectedAiTools}
              onSelectedAiToolsChange={setSelectedAiTools}
            />
          ) : (
            <div className="relative flex h-full w-full overflow-hidden">
              {/* DESKTOP SPLIT VIEW: Bento Canvas Left, Compact Chat Right */}
              <div className="hidden lg:flex flex-1 h-full min-w-0 overflow-hidden">
                {/* Main Workspace Canvas (Bento Grid) */}
                <div className="flex-1 h-full overflow-y-auto p-4 scrollbar-thin">
                  {bentoWidgets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto space-y-6 animate-fade-in">
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center justify-center gap-2">
                          <span className="size-2 rounded-full bg-cyan-400 animate-ping" />
                          Bloomberg Terminal Canvas
                        </h3>
                        <p className="text-xs text-zinc-500 max-w-md mx-auto">
                          Interactive canvas ready. Real-time active market quotes are flashed below. Ask Copilot to run technical analyses, generate models, or execute trades to populate this workspace.
                        </p>
                      </div>
                      
                      {/* Real-time watch list fallback */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-4">
                        {[
                          { symbol: "US500", name: "S&P 500 Index", color: "cyan" as const, sparkData: [5120, 5132, 5115, 5140, 5130, 5145, 5138, 5155] },
                          { symbol: "GOLD", name: "Gold Spot Price", color: "amber" as const, sparkData: [2150, 2162, 2145, 2170, 2155, 2180, 2168, 2195] },
                          { symbol: "BTCUSD", name: "Bitcoin / USD", color: "emerald" as const, sparkData: [64200, 64500, 63900, 64900, 64400, 65200, 64800, 65500] },
                          { symbol: "ETHUSD", name: "Ethereum / USD", color: "violet" as const, sparkData: [3420, 3450, 3390, 3490, 3440, 3520, 3480, 3555] }
                        ].map((item) => {
                          const quote = sidebarQuotes[item.symbol] ?? { spot: item.sparkData[item.sparkData.length - 1], change24hPct: 0.15 };
                          const spot = quote.spot ?? item.sparkData[item.sparkData.length - 1];
                          const change = quote.change24hPct ?? 0;
                          const isUp = change >= 0;
                          
                          const currentSpark = item.sparkData.map(val => val * (spot / item.sparkData[item.sparkData.length - 1]));

                          return (
                            <div
                              key={item.symbol}
                              onClick={() => handleCardClick(item.symbol)}
                              className="group relative rounded-xl border border-white/[0.04] bg-zinc-950/30 p-4 flex flex-col justify-between hover:border-white/[0.08] hover:bg-zinc-950/50 transition-all duration-300 cursor-pointer text-left"
                            >
                              <div className="absolute top-0 right-0 size-24 bg-white/[0.01] blur-2xl group-hover:bg-cyan-500/[0.02] transition-all duration-500" />
                              
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 group-hover:text-zinc-400 transition-colors">
                                    {item.name}
                                  </span>
                                  <h4 className="text-base font-extrabold text-white font-mono mt-1">
                                    {item.symbol}
                                  </h4>
                                </div>
                                <span className={cn(
                                  "text-[10px] font-bold px-1.5 py-0.5 rounded font-mono",
                                  isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                )}>
                                  {isUp ? "+" : ""}{change.toFixed(2)}%
                                </span>
                              </div>

                              <div className="flex items-end justify-between mt-4">
                                <span className="text-xl font-bold tracking-tight text-white font-mono">
                                  ${spot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <div className="w-[100px] h-[30px] opacity-75 group-hover:opacity-100 transition-opacity">
                                  <svg viewBox="0 0 100 30" width="100" height="30" className="overflow-visible">
                                    <path
                                      d={buildLocalLinePath(currentSpark, 100, 30).line}
                                      fill="none"
                                      stroke={isUp ? "#34d399" : "#f87171"}
                                      strokeWidth={1.5}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 auto-rows-max animate-fade-in">
                      {bentoWidgets.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "rounded-xl border border-white/[0.04] bg-zinc-950/40 backdrop-blur-md p-4 flex flex-col gap-3 group transition-all duration-300 hover:border-white/[0.08] hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] relative overflow-hidden",
                            item.colSpan === 2 ? "col-span-1 xl:col-span-2" : "col-span-1"
                          )}
                        >
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.01] via-transparent to-transparent pointer-events-none" />
                          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2 shrink-0">
                            <div className="flex items-center gap-2">
                              <div className="size-1.5 rounded-full bg-cyan-500 animate-pulse" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate max-w-[200px] sm:max-w-[300px]">
                                {item.title || "Terminal Node"}
                              </span>
                            </div>
                            <span className="text-[8px] font-black text-zinc-600 bg-zinc-900/60 px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">
                              {item.type}
                            </span>
                          </div>
                          <div className="flex-1 overflow-x-auto scrollbar-none text-left">
                            {item.type === "trade-execution" && (
                              <div className="flex justify-center py-2">
                                <TradeReceiptCard
                                  trade={item.payload}
                                  currentPrice={sidebarQuotes[item.payload.symbol]?.spot}
                                  onClosePosition={closePosition}
                                />
                              </div>
                            )}
                            {item.type === "genui" && (
                              <GenUiRenderer payload={item.payload} />
                            )}
                            {item.type === "quant-ui" && (
                              <QuantUiRenderer markup={item.text ?? ""} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right side Chat Panel */}
                <ResizablePane
                  minWidth={360}
                  maxWidth={600}
                  defaultWidth={420}
                  side="right"
                  className="hidden lg:flex shrink-0 h-full border-l border-white/[0.04] bg-[var(--terminal-surface)] flex-col relative overflow-hidden"
                >
                  <div className="flex flex-col h-full w-full min-h-0 relative">
                    <Conversation className="min-h-0 flex-1 pb-24">
                      <ConversationContent
                        ref={chatScrollRef}
                        className="space-y-6 bg-transparent py-4 px-3"
                      >
                        <div className="w-full space-y-6">
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
                                onOpenAgentDetail={(agent) => setOpenAgentId(agent.id)}
                                hideVisualWidgets={true}
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
                              className="pb-2 pt-1 px-1"
                            />
                          ) : null}
                        </div>
                      </ConversationContent>
                      <ConversationScrollButton className="border-white/8 bg-[var(--terminal-surface)] text-zinc-300 hover:text-white" />
                    </Conversation>

                    <div className="absolute bottom-0 left-0 right-0 pointer-events-none pb-3 pt-6 bg-transparent z-10">
                      <div className="relative w-full px-3 pointer-events-auto">
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
                          onToggleTaggedAsset={toggleTaggedAsset}
                          maxTaggedAssets={MAX_TAGGED_ASSETS}
                          selectedAiTools={selectedAiTools}
                          onSelectedAiToolsChange={setSelectedAiTools}
                        />
                        {isQuestionActive && activeQuestion ? (
                          <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto px-3">
                            <InteractiveQuestionForm
                              question={activeQuestion}
                              onSubmit={handleQuestionSubmit}
                              onDismiss={handleQuestionDismiss}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </ResizablePane>
              </div>

              {/* MOBILE SINGLE FEED VIEW (<lg) */}
              <div className="flex lg:hidden relative flex-1 h-full min-h-0 flex-col px-2 py-4 sm:px-4">
                <Conversation className="min-h-0 flex-1 pb-24">
                  <ConversationContent
                    ref={chatScrollRef}
                    className="space-y-6 bg-transparent"
                  >
                    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
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
                            onOpenAgentDetail={(agent) => setOpenAgentId(agent.id)}
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
                    </div>
                  </ConversationContent>
                  <ConversationScrollButton className="border-white/8 bg-[var(--terminal-surface)] text-zinc-300 hover:text-white" />
                </Conversation>
                <div className="absolute bottom-0 left-0 right-0 pointer-events-none pb-3 pt-6 bg-transparent">
                  <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pointer-events-auto">
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
                      onToggleTaggedAsset={toggleTaggedAsset}
                      maxTaggedAssets={MAX_TAGGED_ASSETS}
                      selectedAiTools={selectedAiTools}
                      onSelectedAiToolsChange={setSelectedAiTools}
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
            </div>
          )}
            </div>
            {openAgent ? (
              <ResizablePane
                minWidth={320}
                maxWidth={700}
                defaultWidth={420}
                side="right"
                className="hidden shrink-0 md:flex"
              >
                <AgentDetailPane
                  agent={openAgent}
                  onClose={() => setOpenAgentId(null)}
                  className="h-full w-full"
                />
              </ResizablePane>
            ) : null}
          </div>
          </ChatWidgetProvider>
          </ConversationPicker>
        </div>
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

