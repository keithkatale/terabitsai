import type { AssetChartPayload } from "@/lib/chat/chart-data-tool";

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

export function buildChartQuantUi(payload: AssetChartPayload): string {
  const change =
    payload.change24hPct != null
      ? `${payload.change24hPct >= 0 ? "+" : ""}${payload.change24hPct.toFixed(2)}%`
      : "";

  return `<quant:section title="${escapeAttr(payload.displayName)}" subtitle="Live · Capital.com · ${payload.range}">
  <quant:chart
    symbol="${escapeAttr(payload.symbol)}"
    name="${escapeAttr(payload.displayName)}"
    range="${payload.range}"
    variant="${payload.variant}"
    spot="${payload.spot}"
    ${change ? `change="${escapeAttr(change)}"` : ""}
    high="${payload.high}"
    low="${payload.low}"
    data-source="${payload.dataSource}"
  />
  <quant:metrics columns="2">
    <quant:stat label="Spot" value="${payload.spot.toFixed(2)}" accent="amber" />
    <quant:stat label="24h Change" value="${change || "—"}" accent="${payload.change24hPct != null && payload.change24hPct >= 0 ? "emerald" : "rose"}" />
    <quant:stat label="Range High" value="${payload.high.toFixed(2)}" accent="cyan" />
    <quant:stat label="Range Low" value="${payload.low.toFixed(2)}" accent="violet" />
  </quant:metrics>
  <quant:actions>
    <quant:button action="prompt" payload="Run a technical analysis on ${escapeAttr(payload.symbol)}">Analyze ${escapeAttr(payload.symbol)}</quant:button>
    <quant:button action="prompt" payload="Compare ${escapeAttr(payload.symbol)} against a peer asset">Compare</quant:button>
  </quant:actions>
  <quant:citation source="Capital.com" />
</quant:section>`;
}

export function buildComparativeChartQuantUi(args: {
  symbol1: string;
  symbol2: string;
  name1: string;
  name2: string;
  range: string;
}): string {
  return `<quant:section title="${escapeAttr(args.name1)} vs ${escapeAttr(args.name2)}" subtitle="Live comparison · ${args.range}">
  <quant:compare symbol1="${escapeAttr(args.symbol1)}" symbol2="${escapeAttr(args.symbol2)}" range="${args.range}" />
  <quant:citation source="Capital.com" />
</quant:section>`;
}

export function buildMarketOverviewQuantUi(
  assets: Array<{
    symbol: string;
    displayName: string;
    spot: number;
    change24hPct: number | null;
    range: string;
  }>,
): string {
  if (assets.length === 0) return "";

  const cards = assets
    .map((a) => {
      const change =
        a.change24hPct != null
          ? `${a.change24hPct >= 0 ? "+" : ""}${a.change24hPct.toFixed(2)}%`
          : "";
      const trend =
        a.change24hPct == null ? "flat" : a.change24hPct >= 0 ? "up" : "down";
      return `    <quant:asset-card symbol="${escapeAttr(a.symbol)}" name="${escapeAttr(a.displayName)}" spot="${a.spot.toFixed(2)}" change="${escapeAttr(change)}" trend="${trend}" range="${a.range}" />`;
    })
    .join("\n");

  const symbols = assets.map((a) => a.symbol).join(", ");

  return `<quant:section title="Market pulse" subtitle="Live quotes · Capital.com" variant="minimal">
  <quant:grid columns="${Math.min(3, assets.length)}">
${cards}
  </quant:grid>
  <quant:actions>
    <quant:button action="prompt" payload="Deep dive chart for ${escapeAttr(assets[0]?.symbol ?? "BTCUSD")}">Chart ${escapeAttr(assets[0]?.symbol ?? "BTCUSD")}</quant:button>
    <quant:button action="prompt" payload="Compare two assets from: ${escapeAttr(symbols)}">Compare assets</quant:button>
  </quant:actions>
  <quant:citation source="Capital.com" />
</quant:section>`;
}
