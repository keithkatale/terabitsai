import { normalizeGenUiPayload } from "@/components/generative-ui/genui-types";
import type { GenUiNode } from "@/components/generative-ui/genui-types";
import { normalizeComponentName } from "@/components/generative-ui/registry";

const CHART_EMBED_COMPONENTS = new Set([
  "TradingViewChart",
  "AssetPriceChart",
  "AssetComparativeChart",
]);

function filterNodes(nodes: GenUiNode[]): GenUiNode[] {
  const out: GenUiNode[] = [];

  for (const node of nodes) {
    if (node.type === "component") {
      const name = normalizeComponentName(String(node.name ?? ""));
      if (CHART_EMBED_COMPONENTS.has(name)) continue;
    }
    if (node.type === "chart") continue;

    if (node.type === "section" && node.children?.length) {
      const children = filterNodes(node.children);
      if (children.length === 0) continue;
      out.push({ ...node, children });
      continue;
    }

    if (node.type === "grid" && node.children?.length) {
      const children = filterNodes(node.children);
      if (children.length === 0) continue;
      out.push({ ...node, children });
      continue;
    }

    out.push(node);
  }

  return out;
}

/** Remove live chart embed components from a GenUI payload (workspace sidebar). */
export function filterChartEmbedsFromGenui(payload: unknown): unknown | null {
  const nodes = normalizeGenUiPayload(payload);
  if (!nodes?.length) return null;
  const filtered = filterNodes(nodes);
  if (filtered.length === 0) return null;
  return { view: filtered };
}

/** Drop quant-ui blocks that render chart widgets in chat. */
export function filterChartEmbedsFromQuantUi(markup: string): string | null {
  if (!markup.includes("<quant:")) return null;
  if (/<quant:(chart|compare)/i.test(markup)) return null;
  return markup;
}
