import { runTradingLoop } from "./loop.js"
import { runOPARLoop } from "./opar-loop.js"

const once = process.argv.includes("--once")
const useOPAR = process.env.ENGINE_MODE === "opar" || process.argv.includes("--opar")
const intervalMs = Number(process.env.ENGINE_INTERVAL_MS ?? 3_600_000)

const WATCHLIST = (process.env.ENGINE_WATCHLIST ?? "US100,US500,GOLD")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

async function runLoop(): Promise<void> {
  if (useOPAR) {
    await runOPARLoop({
      watchlist: WATCHLIST,
      liveExecution: process.env.LIVE_EXECUTION_ENABLED === "true"
    })
  } else {
    // Legacy loop for backward compatibility
    await runTradingLoop()
  }
}

async function main(): Promise<void> {
  const mode = useOPAR ? "OPAR" : "legacy"
  console.log(`[engine] Quant AQWM engine starting — mode: ${mode}, watchlist: ${WATCHLIST.join(", ")}`)

  if (once) {
    await runLoop()
    process.exit(0)
  }

  await runLoop()

  setInterval(async () => {
    try {
      await runLoop()
    } catch (err) {
      console.error("[engine] Scheduled loop failed:", err)
    }
  }, intervalMs)

  console.log(`[engine] Scheduled every ${intervalMs / 1000}s in ${mode} mode`)
}

main().catch((err) => {
  console.error("[engine] Fatal error:", err)
  process.exit(1)
})
