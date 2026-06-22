import { readFile } from "fs/promises";
import fs from "fs";
import path from "path";
import { RAGEngine } from "@quant/rag-engine";
import type {
  ChartPattern,
  TradingStrategy,
  TradingPsychology,
  RiskRule,
  IndicatorSignals,
  KnowledgeQueryResult,
  MarketRegime,
} from "@quant/contracts";

type JsonRecord = Record<string, unknown>;

let kbRoot: string | null = null;
let ragEngine: RAGEngine | null = null;

const jsonCache = new Map<string, JsonRecord>();

function resolveKbRoot(): string {
  if (kbRoot) return kbRoot;

  const candidates = [
    path.join(process.cwd(), "knowledge-base"),
    path.join(process.cwd(), "..", "knowledge-base"),
    path.join(process.cwd(), "..", "..", "knowledge-base"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      kbRoot = candidate;
      return candidate;
    }
  }

  kbRoot = candidates[0];
  return kbRoot;
}

function getRagEngine(): RAGEngine {
  if (!ragEngine) {
    ragEngine = new RAGEngine(resolveKbRoot());
  }
  return ragEngine;
}

async function loadJsonFile(relPath: string): Promise<JsonRecord> {
  const cached = jsonCache.get(relPath);
  if (cached) return cached;

  const fullPath = path.join(resolveKbRoot(), relPath);
  try {
    const raw = await readFile(fullPath, "utf8");
    const data = JSON.parse(raw) as JsonRecord;
    jsonCache.set(relPath, data);
    return data;
  } catch {
    return {};
  }
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function matchesQuery(text: string, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = text.toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

function flattenChartPatterns(data: JsonRecord): ChartPattern[] {
  const patterns = data.patterns as Record<string, ChartPattern> | undefined;
  if (!patterns) return [];
  return Object.values(patterns);
}

function flattenStrategies(data: JsonRecord): TradingStrategy[] {
  const results: TradingStrategy[] = [];

  const strategies = data.strategies as Record<string, Record<string, JsonRecord>> | undefined;
  if (strategies) {
    for (const [category, items] of Object.entries(strategies)) {
      for (const [key, item] of Object.entries(items)) {
        const entry = item.entry as { indicators?: string[]; conditions?: string[] } | string | undefined;
        const exit = item.exit as { stops?: string; targets?: string } | string | undefined;

        results.push({
          id: `${category}_${key}`,
          name: key.replace(/_/g, " "),
          category: mapCategory(category),
          description: String(item.description ?? ""),
          entry: {
            indicators: Array.isArray(entry)
              ? []
              : typeof entry === "object" && entry
                ? (entry.indicators ?? [])
                : [],
            conditions: Array.isArray(entry)
              ? []
              : typeof entry === "object" && entry
                ? (entry.conditions ?? (typeof entry === "string" ? [entry] : []))
                : typeof entry === "string"
                  ? [entry]
                  : [],
          },
          exit: {
            stops:
              typeof exit === "object" && exit
                ? String(exit.stops ?? "")
                : typeof exit === "string"
                  ? exit
                  : "",
            targets:
              typeof exit === "object" && exit
                ? String(exit.targets ?? "")
                : "",
          },
          win_rate: typeof item.win_rate === "number" ? item.win_rate : undefined,
          risk_reward: String(item.reward_ratio ?? item.risk_reward ?? ""),
          markets: Array.isArray(item.markets)
            ? (item.markets as string[])
            : Array.isArray(item.best_markets)
              ? (item.best_markets as string[])
              : Array.isArray(item.best_in)
                ? (item.best_in as string[])
                : [],
          regime: inferRegime(category, item),
          source: String(item.source ?? ""),
        });
      }
    }
  }

  const pdfStrategies = data.pdf_sourced_strategies as Record<string, JsonRecord> | undefined;
  if (pdfStrategies) {
    for (const [key, item] of Object.entries(pdfStrategies)) {
      const entry = item.entry as { indicators?: string[]; conditions?: string[] } | undefined;
      const exit = item.exit as { stops?: string; targets?: string } | undefined;
      results.push({
        id: key,
        name: key.replace(/_/g, " "),
        category: inferCategoryFromName(key),
        description: String(item.description ?? ""),
        entry: {
          indicators: entry?.indicators ?? [],
          conditions: entry?.conditions ?? [],
        },
        exit: {
          stops: String(exit?.stops ?? ""),
          targets: String(exit?.targets ?? ""),
        },
        win_rate: typeof item.win_rate === "number" ? item.win_rate : undefined,
        markets: Array.isArray(item.markets) ? (item.markets as string[]) : [],
        regime: inferRegime(key, item),
        source: String(item.source ?? ""),
      });
    }
  }

  return results;
}

function mapCategory(category: string): TradingStrategy["category"] {
  const c = category.toLowerCase();
  if (c.includes("mean") || c.includes("reversion")) return "mean_reversion";
  if (c.includes("volatil")) return "volatility";
  if (c.includes("arbitr")) return "arbitrage";
  if (c.includes("execution")) return "execution";
  return "trend";
}

function inferCategoryFromName(name: string): TradingStrategy["category"] {
  const n = name.toLowerCase();
  if (n.includes("counter") || n.includes("fade") || n.includes("range")) return "mean_reversion";
  if (n.includes("scalp") || n.includes("pin_bar")) return "mean_reversion";
  if (n.includes("vwap") || n.includes("twap") || n.includes("execution")) return "execution";
  if (n.includes("volatil")) return "volatility";
  if (n.includes("arb") || n.includes("pairs")) return "arbitrage";
  return "trend";
}

function inferRegime(key: string, item: JsonRecord): MarketRegime {
  const text = `${key} ${JSON.stringify(item)}`.toLowerCase();
  if (text.includes("range") || text.includes("mean reversion") || text.includes("counter")) {
    return "ranging";
  }
  if (text.includes("volatil") || text.includes("breakout")) return "volatile";
  return "trending";
}

function flattenPsychology(data: JsonRecord): TradingPsychology[] {
  const results: TradingPsychology[] = [];

  const core = data.core_concepts as TradingPsychology[] | undefined;
  if (core) results.push(...core);

  const styles = data.trading_styles as Record<string, TradingPsychology> | undefined;
  if (styles) results.push(...Object.values(styles));

  const cfi = data.cfi_psychology as Record<string, TradingPsychology> | undefined;
  if (cfi) results.push(...Object.values(cfi));

  return results;
}

function flattenRiskRules(data: JsonRecord): RiskRule[] {
  const results: RiskRule[] = [];

  const limits = data.risk_limits as Record<string, JsonRecord> | undefined;
  if (limits) {
    for (const [key, val] of Object.entries(limits)) {
      results.push({
        id: `risk_limit_${key}`,
        trigger: key,
        threshold: String(val.recommended ?? val.acceptable_max ?? ""),
        action: String(val.action ?? "Apply limit"),
        category: key as RiskRule["category"],
      });
    }
  }

  const decisions = data.decision_rules as Record<string, JsonRecord> | undefined;
  if (decisions?.when_losing) {
    const losing = decisions.when_losing as Record<string, string>;
    for (const [pct, action] of Object.entries(losing)) {
      if (pct === "action" || pct === "avoid" || pct === "benefit") continue;
      results.push({
        id: `drawdown_${pct}`,
        trigger: `Drawdown ${pct.replace(/_/g, " ")}`,
        threshold: pct,
        action,
        category: "drawdown",
      });
    }
  }

  return results;
}

function flattenIndicators(data: JsonRecord): IndicatorSignals[] {
  const results: IndicatorSignals[] = [];
  const indicators = data.indicators as Record<string, Record<string, JsonRecord>> | undefined;
  if (!indicators) return results;

  for (const [group, items] of Object.entries(indicators)) {
    for (const [key, item] of Object.entries(items)) {
      results.push({
        id: `${group}_${key}`,
        name: String(item.name ?? key),
        formula: String(item.formula ?? item.calculation ?? ""),
        parameters: item.parameters as Record<string, string> | undefined,
        signals: (item.signals as Record<string, string>) ?? {},
        best_for: Array.isArray(item.best_for) ? (item.best_for as string[]) : undefined,
        win_rate: typeof item.win_rate === "number" ? item.win_rate : undefined,
        optimal_timeframe: Array.isArray(item.optimal_timeframe)
          ? (item.optimal_timeframe as string[])
          : undefined,
        combinations: Array.isArray(item.combinations)
          ? (item.combinations as string[])
          : undefined,
      });
    }
  }

  return results;
}

export async function getPatternKnowledge(patternName: string): Promise<ChartPattern | null> {
  const data = await loadJsonFile("reference/chart-patterns.json");
  const patterns = flattenChartPatterns(data);
  const key = normalizeKey(patternName);

  return (
    patterns.find(
      (p) =>
        normalizeKey(p.id) === key ||
        normalizeKey(p.name) === key ||
        normalizeKey(p.name).includes(key) ||
        key.includes(normalizeKey(p.id)),
    ) ?? null
  );
}

export async function getStrategyForRegime(regime: string): Promise<TradingStrategy[]> {
  const data = await loadJsonFile("reference/strategies.json");
  const all = flattenStrategies(data);
  const r = regime.toLowerCase() as MarketRegime;

  const selection = data.strategy_selection as
    | { by_market_condition?: Record<string, string[]> }
    | undefined;
  const conditionMap: Record<MarketRegime, string[]> = {
    trending: selection?.by_market_condition?.strong_uptrend ?? [
      "Momentum trading",
      "Trend following",
    ],
    ranging: selection?.by_market_condition?.range_bound ?? [
      "Range trading",
      "Mean reversion",
    ],
    volatile: selection?.by_market_condition?.high_volatility ?? [
      "Volatility strategies",
    ],
  };

  const preferredNames = conditionMap[r] ?? [];
  const regimeMatches = all.filter((s) => s.regime === r);

  if (regimeMatches.length > 0) return regimeMatches.slice(0, 8);

  return all
    .filter((s) =>
      preferredNames.some((name) =>
        s.name.toLowerCase().includes(name.toLowerCase().split(" ")[0] ?? ""),
      ),
    )
    .slice(0, 8);
}

export async function getRiskRulesForDrawdown(drawdownPct: number): Promise<RiskRule[]> {
  const data = await loadJsonFile("reference/risk-rules.json");
  const rules = flattenRiskRules(data);

  if (drawdownPct >= 40) {
    return rules.filter((r) => r.category === "drawdown" || r.category === "emergency");
  }
  if (drawdownPct >= 30) {
    return rules.filter((r) => r.threshold?.includes("30") || r.threshold?.includes("40"));
  }
  if (drawdownPct >= 20) {
    return rules.filter((r) => r.threshold?.includes("20") || r.category === "drawdown");
  }

  const perTrade = data.position_sizing as JsonRecord | undefined;
  if (perTrade) {
    return [
      {
        id: "default_risk",
        trigger: "Per trade risk",
        threshold: "1-2%",
        action: "Size positions from stop distance using fixed percentage or ATR method",
        category: "per_trade",
      },
      ...rules.slice(0, 3),
    ];
  }

  return rules.slice(0, 5);
}

export async function getIndicatorSignals(indicator: string): Promise<IndicatorSignals | null> {
  const data = await loadJsonFile("reference/indicators.json");
  const all = flattenIndicators(data);
  const key = normalizeKey(indicator);

  return (
    all.find(
      (i) =>
        normalizeKey(i.id).includes(key) ||
        normalizeKey(i.name).includes(key) ||
        key.includes(normalizeKey(i.name)),
    ) ?? null
  );
}

export async function queryTradingKnowledge(params: {
  query: string;
  category?: string;
  limit?: number;
}): Promise<KnowledgeQueryResult> {
  const query = params.query.trim();
  const limit = params.limit ?? 5;

  const [chartData, strategiesData, psychologyData, riskData, indicatorsData] =
    await Promise.all([
      loadJsonFile("reference/chart-patterns.json"),
      loadJsonFile("reference/strategies.json"),
      loadJsonFile("reference/trading-psychology.json"),
      loadJsonFile("reference/risk-rules.json"),
      loadJsonFile("reference/indicators.json"),
    ]);

  const patterns = flattenChartPatterns(chartData).filter(
    (p) =>
      matchesQuery(`${p.name} ${p.type} ${p.direction} ${p.formation.join(" ")}`, query) ||
      matchesQuery(p.id, query),
  );

  const strategies = flattenStrategies(strategiesData).filter(
    (s) =>
      matchesQuery(`${s.name} ${s.description ?? ""} ${s.category}`, query) ||
      matchesQuery(s.id, query),
  );

  const psychology = flattenPsychology(psychologyData).filter((p) =>
    matchesQuery(`${p.principle} ${p.description} ${p.application}`, query),
  );

  const riskRules = flattenRiskRules(riskData).filter((r) =>
    matchesQuery(`${r.trigger} ${r.action} ${r.threshold ?? ""}`, query),
  );

  const indicators = flattenIndicators(indicatorsData).filter((i) =>
    matchesQuery(`${i.name} ${i.id} ${Object.values(i.signals).join(" ")}`, query),
  );

  const rag = getRagEngine();
  const ragChunks = rag.query(query, limit, params.category);

  return {
    query,
    patterns: patterns.slice(0, limit),
    strategies: strategies.slice(0, limit),
    psychology: psychology.slice(0, limit),
    riskRules: riskRules.slice(0, limit),
    indicators: indicators.slice(0, limit),
    ragExcerpts: ragChunks.map((c) => ({
      title: c.title,
      content: c.content.slice(0, 1500),
      filePath: c.filePath,
      score: c.score,
    })),
  };
}

export async function buildKnowledgeContextForSetup(params: {
  regime: string;
  rationale: string[];
  direction: string;
}): Promise<string> {
  const regime = params.regime as MarketRegime;
  const [strategies, riskRules] = await Promise.all([
    getStrategyForRegime(regime),
    getRiskRulesForDrawdown(0),
  ]);

  const rationaleText = params.rationale.join(" ").toLowerCase();
  const patternHints: string[] = [];

  const patternKeywords = [
    "head",
    "shoulder",
    "triangle",
    "flag",
    "gap",
    "double",
    "support",
    "resistance",
    "rsi",
    "macd",
    "ema",
    "smc",
    "order block",
    "fvg",
  ];

  for (const kw of patternKeywords) {
    if (rationaleText.includes(kw)) patternHints.push(kw);
  }

  const patterns = await Promise.all(
    patternHints.slice(0, 3).map((h) => getPatternKnowledge(h)),
  );
  const validPatterns = patterns.filter(Boolean) as ChartPattern[];

  const chunks: string[] = [
    `REGIME: ${regime} | DIRECTION: ${params.direction}`,
    `RECOMMENDED STRATEGIES: ${strategies
      .slice(0, 3)
      .map((s) => `${s.name} (${s.description?.slice(0, 80) ?? ""})`)
      .join("; ")}`,
    `RISK RULES: ${riskRules
      .slice(0, 2)
      .map((r) => `${r.trigger}: ${r.action}`)
      .join("; ")}`,
  ];

  if (validPatterns.length > 0) {
    chunks.push(
      `PATTERN CONTEXT: ${validPatterns
        .map(
          (p) =>
            `${p.name} (${p.type}/${p.direction}, reliability ${(p.reliability * 100).toFixed(0)}%) — entry: ${p.entry_rules[0]?.condition ?? "N/A"}`,
        )
        .join("; ")}`,
    );
  }

  return chunks.join("\n");
}

export async function buildOrchestratorKnowledgeContext(regime?: string): Promise<string> {
  const effectiveRegime = regime ?? "trending";
  const [strategies, psychologyData] = await Promise.all([
    getStrategyForRegime(effectiveRegime),
    loadJsonFile("reference/trading-psychology.json"),
  ]);

  const psychology = flattenPsychology(psychologyData).slice(0, 2);

  return [
    `Active regime strategies: ${strategies
      .slice(0, 2)
      .map((s) => s.name)
      .join(", ")}`,
    `Discipline reminders: ${psychology.map((p) => p.principle).join("; ")}`,
  ].join("\n");
}

export function clearKnowledgeCache(): void {
  jsonCache.clear();
  ragEngine = null;
}
