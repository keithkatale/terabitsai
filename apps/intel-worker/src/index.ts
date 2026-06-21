import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const monorepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnvFile(resolve(monorepoRoot, ".env"));
loadEnvFile(resolve(monorepoRoot, "apps/web/.env.local"));

import { startScheduler } from "./scheduler.js";
import { runHotScan, runFullScan } from "./scan-jobs.js";
import { runNewsScan } from "@quant/market-intel";

const once = process.argv.includes("--once");
const hotOnly = process.argv.includes("--hot");
const fullOnly = process.argv.includes("--full");
const newsOnly = process.argv.includes("--news");
const useBullmq = Boolean(process.env.REDIS_URL) && process.env.INTEL_USE_BULLMQ !== "false";

async function main(): Promise<void> {
  console.log("[intel-worker] Market intelligence worker starting");

  if (once) {
    if (newsOnly) {
      await runNewsScan();
    } else if (fullOnly) {
      await runFullScan();
    } else {
      await runHotScan();
      if (!hotOnly) await runFullScan();
    }
    process.exit(0);
  }

  await startScheduler(useBullmq ? "bullmq" : "interval");
}

main().catch((err) => {
  console.error("[intel-worker] Fatal error:", err);
  process.exit(1);
});
