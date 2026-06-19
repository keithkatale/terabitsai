export type FredObservation = { date: string; value: string };

const KEY_SERIES: Record<string, string> = {
  DGS10: "10-Year Treasury Yield",
  DFF: "Fed Funds Rate",
  CPIAUCSL: "CPI (All Urban)",
  UNRATE: "Unemployment Rate",
  VIXCLS: "VIX",
  DTWEXBGS: "Trade Weighted USD Index"
};

export function getFredSeriesLabels(): Record<string, string> {
  return { ...KEY_SERIES };
}

export async function fetchFredLatest(seriesId: string): Promise<{
  seriesId: string;
  label: string;
  value: number;
  date: string;
  priorValue?: number;
  changePct?: number;
} | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { observations?: FredObservation[] };
    const obs = (data.observations ?? []).filter((o) => o.value !== ".");
    if (obs.length === 0) return null;
    const latest = parseFloat(obs[0].value);
    const prior = obs[1] ? parseFloat(obs[1].value) : undefined;
    const changePct = prior && prior !== 0 ? ((latest - prior) / Math.abs(prior)) * 100 : undefined;
    return {
      seriesId,
      label: KEY_SERIES[seriesId] ?? seriesId,
      value: latest,
      date: obs[0].date,
      priorValue: prior,
      changePct
    };
  } catch {
    return null;
  }
}

export async function fetchFredMacroSnapshot(): Promise<
  Array<{ seriesId: string; label: string; value: number; date: string; changePct?: number }>
> {
  const results = await Promise.all(Object.keys(KEY_SERIES).map((id) => fetchFredLatest(id)));
  return results.filter((r): r is NonNullable<typeof r> => r != null);
}

export function classifyMacroRegime(
  snapshot: Array<{ seriesId: string; value: number; changePct?: number }>
): "risk_on" | "risk_off" | "late_cycle" | "recession_scare" | "neutral" {
  const vix = snapshot.find((s) => s.seriesId === "VIXCLS")?.value ?? 20;
  const unrate = snapshot.find((s) => s.seriesId === "UNRATE")?.value ?? 4;
  if (vix > 28) return "recession_scare";
  if (vix > 22) return "risk_off";
  if (unrate > 5.5) return "late_cycle";
  if (vix < 16) return "risk_on";
  return "neutral";
}
