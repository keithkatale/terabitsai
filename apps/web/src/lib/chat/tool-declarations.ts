import { Type } from "@google/genai";
import {
  analyzeChartDeclaration,
} from "@/lib/chart/analyze-chart-tool";
import { applyChartDrawingsDeclaration } from "@/lib/chart/apply-chart-drawings-tool";
import {
  executeSkillDeclaration,
} from "@/lib/skills/tool-declaration";
import {
  queryTradingKnowledgeDeclaration,
} from "@/lib/chat/tools/knowledge-tool";
import {
  webScrapeDeclaration,
  httpRequestDeclaration,
} from "@/lib/chat/tools/web-tools";
import {
  tradingViewNewsDeclaration,
  tradingViewOptionsChainDeclaration,
  tradingViewQuoteDeclaration,
  tradingViewScreenerDeclaration,
  tradingViewSearchDeclaration,
} from "@/lib/chat/tools/tradingview-tools";
import {
  hyperliquidBookDeclaration,
  hyperliquidCandlesDeclaration,
  hyperliquidFundingDeclaration,
  hyperliquidMarketsDeclaration,
} from "@/lib/chat/tools/hyperliquid-tools";
import { executeWorkflowDeclaration } from "@/lib/skills/workflow-declaration";

export const getAllAssetsDeclaration = {
  name: "get_all_assets",
  description:
    "Retrieve all assets available in the Terabits AI catalog, grouped by asset class (crypto, stock, etf, index, commodity, etc.)",
  parameters: {
    type: Type.OBJECT,
    properties: {
      asset_class: {
        type: Type.STRING,
        description: "Optional filter by asset class: crypto, stock, or etf",
        enum: ["crypto", "stock", "etf"],
      },
    },
  },
};

export const getAssetDetailsDeclaration = {
  name: "get_asset_details",
  description:
    "Retrieve detailed metadata and transaction rules for a specific asset ticker from the catalog.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: {
        type: Type.STRING,
        description: "The exact symbol of the asset to look up (e.g. BTCUSD, AAPL, EURUSD, GOLD)",
      },
    },
    required: ["symbol"],
  },
};

export const getAssetMarketDataDeclaration = {
  name: "get_asset_market_data",
  description:
    "Fetch LIVE quote + historical OHLCV from Capital.com for any catalog asset. Returns a real AssetPriceChart component — never invent prices.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING, description: "Ticker or name, e.g. BTCUSD, Bitcoin, AAPL, GOLD" },
      query: { type: Type.STRING, description: "Alternative to symbol — natural language asset name" },
      range: {
        type: Type.STRING,
        description: "History window: 1D, 1W, 1M, 3M, 6M, 1Y (default 1M)",
        enum: ["1D", "1W", "1M", "3M", "6M", "1Y"],
      },
    },
  },
};

export const renderAssetChartDeclaration = {
  name: "render_asset_chart",
  description:
    "Render an interactive LIVE price chart from Capital.com OHLCV data. Use for ANY chart, graph, or price-history request. Returns server-built AssetPriceChart — do NOT hand-write chart numbers.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING, description: "Ticker e.g. BTCUSD, AAPL, GOLD" },
      query: { type: Type.STRING, description: "Natural language asset name" },
      range: {
        type: Type.STRING,
        enum: ["1D", "1W", "1M", "3M", "6M", "1Y"],
        description: "Time window (default 1M)",
      },
      variant: { type: Type.STRING, enum: ["line", "area"], description: "Chart style" },
    },
  },
};

export const renderComparativeChartDeclaration = {
  name: "render_comparative_chart",
  description:
    "Compare two assets with LIVE Capital.com historical data on one chart. Use when user asks to compare two tickers.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol1: { type: Type.STRING },
      symbol2: { type: Type.STRING },
      range: {
        type: Type.STRING,
        enum: ["1M", "3M", "6M", "1Y"],
        description: "Comparison window (default 6M)",
      },
    },
    required: ["symbol1", "symbol2"],
  },
};

export const getMarketOverviewDeclaration = {
  name: "get_market_overview",
  description:
    "Build a contextual market overview from live Capital.com data. Pass symbols[] relevant to the user's question, OR set scan_broad_market to true (or omit symbols entirely) to trigger a complete multi-asset cross-sector scanning of 30+ assets across Crypto, Stocks, FX, and Commodities, identifying top movers, technical setups, and news-backed trends. Returns quant_ui markup — the client renders it automatically; do not paste it yourself.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbols: {
        type: Type.ARRAY,
        description: 'Optional tickers to fetch specific assets, e.g. ["BTCUSD","ETHUSD","US100"]. Defaults to scanning the broader market if omitted.',
        items: { type: Type.STRING },
      },
      scan_broad_market: {
        type: Type.BOOLEAN,
        description: "Set to true to scan 30+ assets from the catalog across all asset classes, correlating technical signals and news.",
      },
    },
  },
};

export const spawnSubagentsDeclaration = {
  name: "spawn_subagents",
  description:
    "Spin up parallel sub-agent instances for distinct slices of a large research task. Each agent needs a unique short label (widget trace) and a full prompt. Delegate only when parallel depth maximizes utility — not for its own sake.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      subagents: {
        type: Type.ARRAY,
        description:
          "List of sub-agents to run in parallel (max 5). Each entry is one self-contained prompt.",
        items: {
          type: Type.OBJECT,
          properties: {
            label: {
              type: Type.STRING,
              description:
                "Short user-facing trace (3–7 words) for the live widget — what this agent is assigned to do, e.g. 'Chart patterns on BTCUSD' or 'Macro catalyst scan'. Must be unique per agent in the team.",
            },
            prompt: {
              type: Type.STRING,
              description:
                "Complete detailed task for this sub-agent — include asset symbols, timeframe, indicators, questions, and output format. Not shown in the widget.",
            },
          },
          required: ["label", "prompt"],
        },
      },
    },
    required: ["subagents"],
  },
};

export const informUserDeclaration = {
  name: "inform_user",
  description:
    "Send a short informal status update to the user while you work (shown in the live trace only — NOT in the final reply). Use before/while running tools to explain what you are about to do or currently doing.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      message: {
        type: Type.STRING,
        description:
          "Brief update in plain language (1–2 short sentences max). Example: 'Spinning up sub-agents to scan BTC, ETH, and NVDA for day-trade setups.'",
      },
    },
    required: ["message"],
  },
};

export const searchMarketIntelDeclaration = {
  name: "search_market_intel",
  description:
    "Search ingested market intelligence (news, macro, flow) with verified sources. Use for 'why is X moving' questions before synthesizing an answer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Search query" },
      symbol: { type: Type.STRING, description: "Optional ticker filter e.g. NVDA" },
    },
    required: ["query"],
  },
};

export const getCatalystBriefDeclaration = {
  name: "get_catalyst_brief",
  description: "Get latest AI catalyst synthesis brief for a symbol with impact score and provenance URLs.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING },
    },
    required: ["symbol"],
  },
};

export const getAccountStateDeclaration = {
  name: "get_account_state",
  description:
    "Get complete account information: wallet balance, locked margin, open positions, recent transactions, and portfolio performance.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      include_history: { type: Type.BOOLEAN, description: "Include recent ledger transactions" },
      include_positions: { type: Type.BOOLEAN, description: "Include open positions with P&L" },
      include_performance: { type: Type.BOOLEAN, description: "Include portfolio growth metrics" },
      history_limit: { type: Type.NUMBER, description: "Max transactions to return (default 50)" },
    },
  },
};

export const brokerActionDeclaration = {
  name: "broker_action",
  description:
    "Capital.com API: get_quote, get_candles, get_positions, get_account. For place_order/close_position when autonomous trading is ON, orders execute immediately on Capital.com with no user confirmation. When autonomous is OFF, returns a swipe-to-confirm proposal.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        enum: ["get_quote", "get_positions", "get_account", "get_candles", "place_order", "close_position"],
      },
      symbol: { type: Type.STRING },
      direction: { type: Type.STRING, enum: ["BUY", "SELL"] },
      size: { type: Type.NUMBER, description: "Contract size in units (optional — auto-sized from goal risk limits if omitted)" },
      stop_loss: { type: Type.NUMBER },
      take_profit: { type: Type.NUMBER },
      deal_id: { type: Type.STRING },
      timeframe: { type: Type.STRING, description: "1D, 1W, 1M, 3M, 6M, 1Y" },
      reasoning: { type: Type.STRING, description: "Why you are placing this trade" },
    },
    required: ["action"],
  },
};

export const executeTradeDeclaration = {
  name: "execute_trade",
  description:
    "Execute a trade directly on Capital.com when autonomous trading is ON. No swipe confirmation — the order is placed immediately. Use get_quote first, then call with symbol, direction, optional size/stop_loss/take_profit. For closing, set action to close_position.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, enum: ["place_order", "close_position"] },
      symbol: { type: Type.STRING },
      direction: { type: Type.STRING, enum: ["BUY", "SELL"] },
      size: { type: Type.NUMBER },
      stop_loss: { type: Type.NUMBER },
      take_profit: { type: Type.NUMBER },
      deal_id: { type: Type.STRING },
      reasoning: { type: Type.STRING },
    },
    required: ["action"],
  },
};

export const scheduleTaskDeclaration = {
  name: "schedule_task",
  description:
    "Schedule a future check (price, position review, reminder). Use when waiting for price movement or long-running scalping workflows.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      task_type: {
        type: Type.STRING,
        enum: ["price_check", "position_review", "market_open", "reminder", "strategy_check"],
      },
      delay_minutes: { type: Type.NUMBER, description: "Minutes from now (1–1440)" },
      symbol: { type: Type.STRING },
      condition: { type: Type.STRING, description: "Optional JS expression using `price`, e.g. price > 50000" },
      message: { type: Type.STRING },
    },
    required: ["task_type", "delay_minutes"],
  },
};

export const manageGoalsDeclaration = {
  name: "manage_goals",
  description:
    "Set, track, and manage persistent balance goals. Required before autonomous trading. Use set_balance_target to grow account (e.g. $20 → $50). Background cron monitors progress every 5 minutes.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      operation: {
        type: Type.STRING,
        enum: [
          "list",
          "set",
          "update",
          "cancel",
          "set_balance_target",
          "check_progress",
          "pause_goal",
          "resume_goal",
          "enable_autonomous",
          "disable_autonomous",
        ],
      },
      goal_type: {
        type: Type.STRING,
        enum: ["balance_target", "strategy_preference", "risk_tolerance", "milestone"],
      },
      goal_value: { type: Type.OBJECT, description: "JSON goal payload, e.g. { target: 50 }" },
      description: { type: Type.STRING },
      goal_id: { type: Type.STRING },
      progress_pct: { type: Type.NUMBER },
      target_balance: { type: Type.NUMBER, description: "Target account balance in USD" },
      deadline_days: { type: Type.NUMBER, description: "Optional deadline in days from now" },
      autonomous_trading: {
        type: Type.BOOLEAN,
        description: "If true, agent may execute trades toward goal without confirmation",
      },
      max_risk_per_trade: { type: Type.NUMBER, description: "Max % of account per trade (default 5)" },
      status: {
        type: Type.STRING,
        enum: ["active", "in_progress", "achieved", "failed", "cancelled", "paused"],
      },
    },
    required: ["operation"],
  },
};

export const getMacroDataDeclaration = {
  name: "get_macro_data",
  description: "Fetch macro indicators and market sentiment (Fear & Greed, rates, VIX via FRED when configured).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      indicators: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "e.g. fear_greed, macro, rates, vix",
      },
    },
  },
};

export const getFundamentalsDeclaration = {
  name: "get_fundamentals",
  description: "Fetch stock fundamentals and news sentiment via Alpha Vantage (when API key configured).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING },
    },
    required: ["symbol"],
  },
};

/** Read-only tools available to parallel sub-agents (no trading, goals, or recursion). */
export const SUBAGENT_READ_ONLY_TOOL_NAMES = new Set([
  "get_all_assets",
  "get_asset_details",
  "get_asset_market_data",
  "render_asset_chart",
  "render_comparative_chart",
  "analyze_chart",
  "get_market_overview",
  "search_market_intel",
  "get_catalyst_brief",
  "get_macro_data",
  "get_fundamentals",
  "query_trading_knowledge",
  "inform_user",
  "web_scrape",
  "http_request",
  "tradingview_quote",
  "tradingview_screener",
  "tradingview_news",
  "tradingview_search",
  "tradingview_options_chain",
  "hyperliquid_markets",
  "hyperliquid_candles",
  "hyperliquid_book",
  "hyperliquid_funding",
  "execute_skill",
]);

export const subagentReadOnlyDeclarations = [
  getAllAssetsDeclaration,
  getAssetDetailsDeclaration,
  getAssetMarketDataDeclaration,
  renderAssetChartDeclaration,
  renderComparativeChartDeclaration,
  analyzeChartDeclaration,
  applyChartDrawingsDeclaration,
  getMarketOverviewDeclaration,
  searchMarketIntelDeclaration,
  getCatalystBriefDeclaration,
  getMacroDataDeclaration,
  getFundamentalsDeclaration,
  queryTradingKnowledgeDeclaration,
  informUserDeclaration,
  webScrapeDeclaration,
  httpRequestDeclaration,
  tradingViewQuoteDeclaration,
  tradingViewScreenerDeclaration,
  tradingViewNewsDeclaration,
  tradingViewSearchDeclaration,
  tradingViewOptionsChainDeclaration,
  hyperliquidMarketsDeclaration,
  hyperliquidCandlesDeclaration,
  hyperliquidBookDeclaration,
  hyperliquidFundingDeclaration,
  executeSkillDeclaration,
];

export const orchestratorToolDeclarations = [
  informUserDeclaration,
  getAllAssetsDeclaration,
  getAssetDetailsDeclaration,
  getAssetMarketDataDeclaration,
  getMarketOverviewDeclaration,
  renderAssetChartDeclaration,
  renderComparativeChartDeclaration,
  analyzeChartDeclaration,
  applyChartDrawingsDeclaration,
  spawnSubagentsDeclaration,
  searchMarketIntelDeclaration,
  getCatalystBriefDeclaration,
  getAccountStateDeclaration,
  brokerActionDeclaration,
  executeTradeDeclaration,
  executeSkillDeclaration,
  scheduleTaskDeclaration,
  manageGoalsDeclaration,
  getMacroDataDeclaration,
  getFundamentalsDeclaration,
  queryTradingKnowledgeDeclaration,
  webScrapeDeclaration,
  httpRequestDeclaration,
  tradingViewQuoteDeclaration,
  tradingViewScreenerDeclaration,
  tradingViewNewsDeclaration,
  tradingViewSearchDeclaration,
  tradingViewOptionsChainDeclaration,
  hyperliquidMarketsDeclaration,
  hyperliquidCandlesDeclaration,
  hyperliquidBookDeclaration,
  hyperliquidFundingDeclaration,
  executeWorkflowDeclaration,
];
