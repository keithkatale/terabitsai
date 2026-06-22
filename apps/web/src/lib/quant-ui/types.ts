/** AST node for Quant UI markup — a tag-based design system the AI writes as text. */
export interface QuantUiNode {
  tag: string;
  attrs: Record<string, string>;
  children: QuantUiNode[];
}

export type QuantUiAccent =
  | "cyan"
  | "violet"
  | "emerald"
  | "rose"
  | "amber"
  | "sky"
  | "zinc";

export const QUANT_UI_TAG_PREFIX = "quant:";
