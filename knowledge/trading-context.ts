import { readFile } from "fs/promises"
import path from "path"

const KB_ROOT = path.join(process.cwd(), "Trading", "knowledge-base")

/** Bounded excerpts injected into signal-generation prompts */
export async function loadTradingKnowledgeContext(): Promise<string> {
  const chunks: string[] = []
  const files = [
    "KNOWLEDGE-BASE-INDEX.md",
    path.join("docs", "concepts", "risk-management.md"),
    path.join("docs", "concepts", "technical-analysis.md"),
    path.join("agents", "exness-platform-guide.md"),
  ]

  const limit = 12_000
  let total = 0

  for (const rel of files) {
    try {
      const full = path.join(KB_ROOT, rel)
      const text = await readFile(full, "utf8")
      const slice = text.slice(0, Math.min(text.length, 4000))
      chunks.push(`--- ${rel} ---\n${slice}`)
      total += slice.length
      if (total >= limit) break
    } catch {
      continue
    }
  }

  if (chunks.length === 0) {
    return ""
  }

  const merged = chunks.join("\n\n")
  return merged.length > limit ? merged.slice(0, limit) : merged
}
