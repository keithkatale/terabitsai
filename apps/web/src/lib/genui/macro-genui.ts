/** GenUI for macro / sentiment snapshots (regime scans). */

type GenuiView = { view: Record<string, unknown>[] };

export function buildMacroDataGenui(result: Record<string, unknown>): GenuiView | null {
  const nodes: Record<string, unknown>[] = [];

  const fg = result.fear_greed as { value?: number; classification?: string } | undefined;
  if (fg?.value != null) {
    nodes.push({
      type: "metricCard",
      label: "Fear & Greed",
      value: String(fg.value),
      sublabel: fg.classification,
      accent: fg.value < 30 ? "rose" : fg.value > 70 ? "emerald" : "amber",
    });
  }

  const macro = result.macro as Record<string, unknown> | undefined;
  if (macro) {
    const items: Array<{ label: string; value: string; accent: string }> = [];
    for (const [key, val] of Object.entries(macro)) {
      if (val == null || typeof val === "object") continue;
      items.push({
        label: key.replace(/_/g, " "),
        value: String(val),
        accent: "cyan",
      });
    }
    if (items.length > 0) {
      nodes.push({ type: "barlist", title: "Macro snapshot", items: items.slice(0, 8) });
    }
  }

  if (nodes.length === 0) return null;

  return {
    view: [
      {
        type: "section",
        title: "Macro & sentiment",
        subtitle: "Context for regime / exposure decisions",
        children: [{ type: "grid", columns: 2, children: nodes }],
      },
    ],
  };
}
