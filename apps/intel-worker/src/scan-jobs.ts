import {
  HOT_SYMBOLS,
  FULL_SCAN_BATCH_SIZE,
  runScan,
  runSectorScan,
  runColdScan
} from "@quant/market-intel";

const HOT_INTERVAL_MS = Number(process.env.INTEL_HOT_INTERVAL_MS ?? 300_000);
const FULL_INTERVAL_MS = Number(process.env.INTEL_FULL_INTERVAL_MS ?? 1_800_000);

const EXTENDED_SYMBOLS = [
  ...HOT_SYMBOLS,
  "MSFT",
  "META",
  "TSLA",
  "AMZN",
  "JPM",
  "BAC",
  "GS",
  "EURUSD",
  "GBPUSD",
  "US500",
  "US30",
  "SILVER",
  "XRPUSD",
  "DOGEUSD",
  "SOLUSD"
];

function uniqueSymbols(): string[] {
  const envList = process.env.INTEL_FULL_SYMBOLS?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const base = envList?.length ? envList : EXTENDED_SYMBOLS;
  return [...new Set(base)];
}

export async function runHotScan(): Promise<void> {
  console.log("[intel-worker] Starting hot scan...");
  await runScan([...HOT_SYMBOLS], "hot");
}

export async function runFullScan(): Promise<void> {
  console.log("[intel-worker] Starting full scan...");
  const symbols = uniqueSymbols();
  for (let i = 0; i < symbols.length; i += FULL_SCAN_BATCH_SIZE) {
    const batch = symbols.slice(i, i + FULL_SCAN_BATCH_SIZE);
    await runScan(batch, "full");
  }
  await runSectorScan();
  await runColdScan().catch((err) => console.warn("[intel-worker] Cold scan failed:", err));
}

export function getIntervals() {
  return { hot: HOT_INTERVAL_MS, full: FULL_INTERVAL_MS };
}
