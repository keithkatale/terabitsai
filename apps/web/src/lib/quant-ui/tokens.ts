/** Quant UI design tokens — referenced by components (like CSS variables for HTML). */
export const QUANT_UI_ACCENTS = {
  cyan: { text: "var(--quant-accent-cyan)", soft: "var(--quant-accent-cyan-soft)", border: "var(--quant-accent-cyan-border)" },
  violet: { text: "var(--quant-accent-violet)", soft: "var(--quant-accent-violet-soft)", border: "var(--quant-accent-violet-border)" },
  emerald: { text: "var(--quant-accent-emerald)", soft: "var(--quant-accent-emerald-soft)", border: "var(--quant-accent-emerald-border)" },
  rose: { text: "var(--quant-accent-rose)", soft: "var(--quant-accent-rose-soft)", border: "var(--quant-accent-rose-border)" },
  amber: { text: "var(--quant-accent-amber)", soft: "var(--quant-accent-amber-soft)", border: "var(--quant-accent-amber-border)" },
  sky: { text: "var(--quant-accent-sky)", soft: "var(--quant-accent-sky-soft)", border: "var(--quant-accent-sky-border)" },
  zinc: { text: "var(--quant-accent-zinc)", soft: "var(--quant-accent-zinc-soft)", border: "var(--quant-accent-zinc-border)" },
} as const;

export type QuantUiTokenAccent = keyof typeof QUANT_UI_ACCENTS;
