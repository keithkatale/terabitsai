import { fetchFredMacroSnapshot, classifyMacroRegime } from "../ingest/fred-macro.js";
import { normalizeFredSeries, normalizeCalendarEvent } from "../enrich/normalizer.js";
import { persistIntelDocument, persistMacroRegime } from "../persist-synthesis.js";
import { synthesizeMorningBrief } from "../synthesize/catalyst-brief.js";
import { fetchFinnhubEarningsCalendar, fetchFinnhubEconomicCalendar } from "../ingest/finnhub-extended.js";
import { HOT_SYMBOLS } from "../symbols.js";
import { createScanRun, completeScanRun } from "../persist.js";

export async function runMacroIngest(scanRunId?: string): Promise<void> {
  const snapshot = await fetchFredMacroSnapshot();
  const regime = classifyMacroRegime(snapshot);

  for (const row of snapshot) {
    const doc = normalizeFredSeries(row.seriesId, row.label, row.value, row.changePct, row.date);
    await persistIntelDocument(doc, scanRunId);
  }

  await persistMacroRegime(
    regime,
    snapshot.map((s) => ({
      label: s.label,
      value: `${s.value}${s.changePct != null ? ` (${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}%)` : ""}`
    })),
    { snapshot }
  );
}

export async function runCalendarIngest(scanRunId?: string): Promise<void> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 7);
  const fromStr = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
  const toStr = `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`;

  const [earnings, economic] = await Promise.all([
    fetchFinnhubEarningsCalendar(fromStr, toStr),
    fetchFinnhubEconomicCalendar(fromStr, toStr)
  ]);

  for (const e of earnings) {
    const doc = normalizeCalendarEvent({
      symbol: e.symbol,
      title: `${e.symbol} earnings`,
      body: `EPS estimate: ${e.epsEstimate ?? "N/A"} on ${e.date}`,
      eventDate: new Date(e.date),
      eventType: "earnings",
      source: "finnhub",
      externalId: `earnings-${e.symbol}-${e.date}`
    });
    await persistIntelDocument(doc, scanRunId);
  }

  for (const ev of economic.slice(0, 20)) {
    const doc = normalizeCalendarEvent({
      title: ev.event ?? "Macro event",
      body: `${ev.country ?? ""} ${ev.event ?? ""} (${ev.impact ?? "medium"} impact)`,
      eventDate: ev.time ? new Date(ev.time) : new Date(),
      eventType: "macro_calendar",
      source: "finnhub",
      externalId: `macro-${ev.event}-${ev.time}`
    });
    await persistIntelDocument(doc, scanRunId);
  }
}

export async function runColdScan(): Promise<void> {
  const run = await createScanRun("full");
  try {
    await runMacroIngest(run.id);
    await runCalendarIngest(run.id);
    await synthesizeMorningBrief([...HOT_SYMBOLS], run.id);
    await completeScanRun(run.id, { symbolsScanned: HOT_SYMBOLS.length, signalsCreated: 0 });
  } catch (err) {
    await completeScanRun(run.id, {
      symbolsScanned: 0,
      signalsCreated: 0,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}
