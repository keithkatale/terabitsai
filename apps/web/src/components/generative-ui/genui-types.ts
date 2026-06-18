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

/** Narrow an unknown parsed JSON value into a normalized node array. */
export function normalizeGenUiPayload(payload: unknown): GenUiNode[] | null {
  if (!payload || typeof payload !== "object") return null;

  if (Array.isArray(payload)) {
    return payload.filter(isGenUiNodeLike) as GenUiNode[];
  }

  const obj = payload as Record<string, unknown>;

  if (Array.isArray(obj.view)) {
    return (obj.view as unknown[]).filter(isGenUiNodeLike) as GenUiNode[];
  }

  if (typeof obj.type === "string") {
    return [obj as unknown as GenUiNode];
  }

  return null;
}

function isGenUiNodeLike(v: unknown): boolean {
  return !!v && typeof v === "object" && typeof (v as Record<string, unknown>).type === "string";
}
