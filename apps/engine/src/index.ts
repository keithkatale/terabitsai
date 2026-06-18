import { runTradingLoop } from "./loop.js"

const once = process.argv.includes("--once")
const intervalMs = Number(process.env.ENGINE_INTERVAL_MS ?? 3_600_000)

async function main(): Promise<void> {
  console.log("[engine] Quant-in-a-Box engine worker starting")

  if (once) {
    await runTradingLoop()
    process.exit(0)
  }

  await runTradingLoop()

  setInterval(async () => {
    try {
      await runTradingLoop()
    } catch (err) {
      console.error("[engine] Scheduled loop failed:", err)
    }
  }, intervalMs)

  console.log(`[engine] Scheduled every ${intervalMs / 1000}s`)
}

main().catch((err) => {
  console.error("[engine] Fatal error:", err)
  process.exit(1)
})
