/**
 * Generative UI DSL
 * ------------------
 * A declarative, composable vocabulary the AI emits inside a ```genui fenced
 * block. The renderer (genui-renderer.tsx) walks this tree and composes branded,
 * data-driven, animated React primitives — so the model never hand-writes HTML
 * for structured data. Reserve raw ```html artifacts for genuinely custom,
 * bespoke interactive visuals.
 *
 * Top-level block may be:
 *   - a single node:            { "type": "metricCard", ... }
 *   - an explicit view wrapper: { "view": [ ...nodes ] }
 *   - a bare array:             [ ...nodes ]
 */

export type GenUiAccent =
  | "cyan"
  | "violet"
  | "emerald"
  | "rose"
  | "amber"
  | "sky"
  | "zinc";

export type GenUiTrend = "up" | "down" | "flat";

export type GenUiCalloutVariant = "info" | "success" | "warning" | "danger";

/** A single named data series for the line/area chart primitive. */
export interface GenUiSeries {
  name: string;
  data: number[];
  /** Accent name or raw hex; falls back to a palette colour by index. */
  color?: string;
}

export type GenUiNode =
  // ── Layout ───────────────────────────────────────────────────────────
  | { type: "section"; title?: string; subtitle?: string; children: GenUiNode[] }
  | { type: "grid"; columns?: number; children: GenUiNode[] }
  | { type: "divider" }
  | { type: "text"; text: string; tone?: "default" | "muted" | "strong" }

  // ── Inline expressive primitives ─────────────────────────────────────
  | {
      type: "stat";
      label: string;
      value: string | number;
      delta?: string | number;
      trend?: GenUiTrend;
      icon?: string; // lucide icon name (kebab or Pascal tolerated)
      accent?: GenUiAccent;
    }
  | {
      type: "metricCard";
      label: string;
      value: string | number;
      sublabel?: string;
      delta?: string | number;
      trend?: GenUiTrend;
      sparkline?: number[];
      accent?: GenUiAccent;
    }
  | { type: "sparkline"; data: number[]; accent?: GenUiAccent; label?: string }
  | {
      type: "gauge";
      value: number; // 0..100
      label?: string;
      caption?: string;
      accent?: GenUiAccent;
    }
  | {
      type: "progress";
      value: number; // 0..100
      label?: string;
      caption?: string;
      accent?: GenUiAccent;
    }
  | {
      type: "callout";
      variant?: GenUiCalloutVariant;
      title?: string;
      text: string;
    }
  | { type: "badge"; text: string; accent?: GenUiAccent }
  | {
      type: "keyValue";
      items: { label: string; value: string | number; accent?: GenUiAccent }[];
    }
  | {
      type: "barlist";
      title?: string;
      items: { label: string; value: number; accent?: GenUiAccent }[];
      max?: number;
      unit?: string;
    }
  | {
      type: "table";
      columns: string[];
      rows: (string | number)[][];
    }
  | {
      type: "chart";
      variant?: "line" | "area";
      series: GenUiSeries[];
      labels?: string[];
      height?: number;
      title?: string;
    }

  // ── Bridge to the existing rich React widget registry ────────────────
  | { type: "component"; name: string; props?: Record<string, unknown> };

export interface GenUiView {
  view: GenUiNode[];
  title?: string;
}

export type GenUiPayload = GenUiNode | GenUiView | GenUiNode[];

const LEAF_TYPES = new Set([
  "stat", "metricCard", "sparkline", "gauge", "progress", "callout",
  "badge", "keyValue", "barlist", "table", "chart", "text", "divider", "component",
]);

const LAYOUT_TYPES = new Set(["section", "grid"]);

/** Narrow an unknown parsed JSON value into a normalized node array. */
export function normalizeGenUiPayload(payload: unknown): GenUiNode[] | null {
  if (!payload || typeof payload !== "object") return null;

  if (Array.isArray(payload)) {
    const nodes = payload.map(sanitizeNode).filter(Boolean) as GenUiNode[];
    return nodes.length > 0 ? nodes : null;
  }

  const obj = payload as Record<string, unknown>;

  if (Array.isArray(obj.view)) {
    const nodes = (obj.view as unknown[]).map(sanitizeNode).filter(Boolean) as GenUiNode[];
    return nodes.length > 0 ? nodes : null;
  }

  if (typeof obj.type === "string") {
    const node = sanitizeNode(obj);
    return node ? [node] : null;
  }

  return null;
}

function sanitizeNode(v: unknown): GenUiNode | null {
  if (!v || typeof v !== "object") return null;
  const node = v as Record<string, unknown>;
  const type = node.type;
  if (typeof type !== "string") return null;

  if (type === "section" || type === "grid") {
    const children = Array.isArray(node.children)
      ? (node.children as unknown[]).map(sanitizeNode).filter(Boolean) as GenUiNode[]
      : [];
    if (children.length === 0 && type === "grid") return null;
    if (children.length === 0 && type === "section" && !node.title && !node.subtitle) {
      return null;
    }
    return { ...node, children } as GenUiNode;
  }

  if (type === "metricCard" || type === "stat") {
    if (node.label == null && node.value == null) return null;
    return node as GenUiNode;
  }

  if (type === "chart") {
    const series = node.series;
    if (!Array.isArray(series) || series.length === 0) return null;
    return node as GenUiNode;
  }

  if (LEAF_TYPES.has(type) || LAYOUT_TYPES.has(type)) {
    return node as GenUiNode;
  }

  return null;
}
