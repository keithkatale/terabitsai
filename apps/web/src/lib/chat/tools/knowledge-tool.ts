import { Type } from "@google/genai";
import { queryTradingKnowledge } from "@/lib/knowledge/knowledge-loader";

export const queryTradingKnowledgeDeclaration = {
  name: "query_trading_knowledge",
  description:
    "Query the structured trading knowledge base for strategies, chart patterns, indicators, risk rules, and psychology. Use for technical analysis grounding, strategy selection by regime, and risk management rules.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description:
          "Search query e.g. 'head and shoulders pattern', 'trend following ADX', 'position sizing risk', 'trader psychology'",
      },
      category: {
        type: Type.STRING,
        description: "Optional folder filter: concepts, markets, agents, reference",
        enum: ["concepts", "markets", "agents", "reference"],
      },
    },
    required: ["query"],
  },
};

export async function executeQueryTradingKnowledge(args: {
  query?: string;
  category?: string;
}) {
  const query = String(args.query ?? "").trim();
  if (!query) {
    return { success: false, error: "query is required" };
  }

  const result = await queryTradingKnowledge({
    query,
    category: args.category,
    limit: 5,
  });

  return {
    success: true,
    query: result.query,
    patterns: result.patterns?.map((p) => ({
      name: p.name,
      type: p.type,
      direction: p.direction,
      reliability: p.reliability,
      entry: p.entry_rules[0]?.condition,
      confirmation: p.confirmation_signals,
    })),
    strategies: result.strategies?.map((s) => ({
      name: s.name,
      category: s.category,
      regime: s.regime,
      entry: s.entry.conditions,
      exit: s.exit,
      win_rate: s.win_rate,
    })),
    indicators: result.indicators?.map((i) => ({
      name: i.name,
      signals: i.signals,
      best_for: i.best_for,
    })),
    risk_rules: result.riskRules?.map((r) => ({
      trigger: r.trigger,
      action: r.action,
      threshold: r.threshold,
    })),
    psychology: result.psychology?.map((p) => ({
      principle: p.principle,
      application: p.application,
    })),
    excerpts: result.ragExcerpts?.map((e) => ({
      title: e.title,
      content: e.content.slice(0, 800),
      source: e.filePath,
    })),
  };
}
