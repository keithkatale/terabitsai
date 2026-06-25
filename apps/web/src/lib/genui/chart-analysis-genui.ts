import type { ChartAnalysis } from "@/lib/chart/tradingview-spec";

type GenuiView = { view: Record<string, unknown>[] };

function biasAccent(bias: string): string {
  if (bias === "bullish") return "emerald";
  if (bias === "bearish") return "rose";
  return "amber";
}

function fmtPrice(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

/** GenUI dashboard from structured chart vision analysis. */
export function buildChartAnalysisGenui(
  symbol: string,
  interval: string,
  analysis: ChartAnalysis,
): GenuiView {
  const supports = analysis.keyLevels.filter((l) => l.type === "support").slice(0, 3);
  const resistances = analysis.keyLevels.filter((l) => l.type === "resistance").slice(0, 3);

  const levelItems = analysis.keyLevels.slice(0, 6).map((l) => ({
    label: `${l.type} · ${fmtPrice(l.price)}`,
    value: l.note ?? l.type,
    accent: l.type === "support" ? "emerald" : l.type === "resistance" ? "rose" : "cyan",
  }));

  const nodes: Record<string, unknown>[] = [
    {
      type: "section",
      title: `${symbol} · ${interval} TA`,
      subtitle: analysis.summary,
      children: [
        {
          type: "grid",
          columns: 3,
          children: [
            {
              type: "metricCard",
              label: "Bias",
              value: analysis.bias.toUpperCase(),
              accent: biasAccent(analysis.bias),
            },
            {
              type: "metricCard",
              label: "Confidence",
              value: `${Math.round(analysis.confidence)}%`,
              accent: analysis.confidence >= 70 ? "cyan" : "zinc",
            },
            {
              type: "gauge",
              value: Math.min(100, Math.max(0, analysis.confidence)),
              label: "Conviction",
              caption: analysis.bias,
              accent: biasAccent(analysis.bias),
            },
          ],
        },
      ],
    },
  ];

  if (levelItems.length > 0) {
    nodes.push({ type: "barlist", title: "Key levels", items: levelItems });
  }

  if (analysis.patterns.length > 0) {
    nodes.push({
      type: "callout",
      variant: "info",
      title: "Patterns",
      text: analysis.patterns.join(", "),
    });
  }

  const entry = supports[0]?.price;
  const stop = supports[1]?.price ?? (entry != null ? entry * 0.98 : undefined);
  const target = resistances[0]?.price;

  if (entry != null && analysis.bias !== "neutral") {
    nodes.push({
      type: "section",
      title: "Suggested setup",
      subtitle: "Derived from visible S/R — verify before trading",
      children: [
        {
          type: "grid",
          columns: 3,
          children: [
            {
              type: "metricCard",
              label: "Entry zone",
              value: fmtPrice(entry),
              accent: "cyan",
            },
            {
              type: "metricCard",
              label: "Stop / invalidation",
              value: fmtPrice(stop),
              accent: "rose",
            },
            {
              type: "metricCard",
              label: "Target",
              value: fmtPrice(target),
              accent: "emerald",
            },
          ],
        },
        {
          type: "callout",
          variant: analysis.bias === "bullish" ? "success" : "warning",
          title: "Confirmation",
          text: analysis.confirmation,
        },
      ],
    });
  }

  if (analysis.indicatorReads.length > 0) {
    const indItems = analysis.indicatorReads.slice(0, 4).map((i) => ({
      label: i.name,
      value: i.read.slice(0, 60),
      accent: i.signal === "bullish" ? "emerald" : i.signal === "bearish" ? "rose" : "zinc",
    }));
    nodes.push({ type: "barlist", title: "Indicators", items: indItems });
  }

  return { view: nodes };
}

export function buildTradeSetupGenui(opts: {
  symbol: string;
  bias?: string;
  entry?: number | string;
  stop?: number | string;
  target?: number | string;
  conviction?: number;
  thesis?: string;
  risks?: string;
}): GenuiView {
  const fmt = (v: number | string | undefined) =>
    typeof v === "number" ? fmtPrice(v) : v ?? "—";

  const rr =
    typeof opts.entry === "number" &&
    typeof opts.stop === "number" &&
    typeof opts.target === "number" &&
    opts.entry !== opts.stop
      ? Math.abs((opts.target - opts.entry) / (opts.entry - opts.stop))
      : null;

  return {
    view: [
      {
        type: "section",
        title: `Trade idea · ${opts.symbol}`,
        subtitle: opts.thesis,
        children: [
          {
            type: "grid",
            columns: 2,
            children: [
              { type: "metricCard", label: "Entry", value: fmt(opts.entry), accent: "cyan" },
              { type: "metricCard", label: "Stop", value: fmt(opts.stop), accent: "rose" },
              { type: "metricCard", label: "Target", value: fmt(opts.target), accent: "emerald" },
              {
                type: "metricCard",
                label: "R:R",
                value: rr != null ? `${rr.toFixed(1)}:1` : "—",
                accent: "violet",
              },
              ...(opts.conviction != null
                ? [
                    {
                      type: "metricCard",
                      label: "Conviction",
                      value: `${Math.round(opts.conviction * (opts.conviction <= 1 ? 100 : 1))}%`,
                      accent: "amber",
                    },
                  ]
                : []),
            ],
          },
          ...(opts.risks
            ? [{ type: "callout", variant: "warning", title: "Risks", text: opts.risks }]
            : []),
        ],
      },
    ],
  };
}
