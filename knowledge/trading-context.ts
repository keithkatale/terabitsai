import { readFile } from "fs/promises";
import path from "path";
import fs from "fs";
import { queryTradingKnowledge } from "@/lib/knowledge/knowledge-loader";

function resolveKbRoot(): string {
  const candidates = [
    path.join(process.cwd(), "knowledge-base"),
    path.join(process.cwd(), "..", "knowledge-base"),
    path.join(process.cwd(), "..", "..", "knowledge-base"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

const KB_ROOT = resolveKbRoot();

/** Bounded excerpts injected into signal-generation prompts */
export async function loadTradingKnowledgeContext(): Promise<string> {
  const chunks: string[] = [];
  const files = [
    "KNOWLEDGE-BASE-INDEX.md",
    path.join("docs", "concepts", "risk-management.md"),
    path.join("docs", "concepts", "technical-analysis.md"),
    path.join("docs", "concepts", "trading-strategies.md"),
    path.join("agents", "agent-guidelines.md"),
  ];

  const limit = 12_000;
  let total = 0;

  for (const rel of files) {
    try {
      const full = path.join(KB_ROOT, rel);
      const text = await readFile(full, "utf8");
      const slice = text.slice(0, Math.min(text.length, 4000));
      chunks.push(`--- ${rel} ---\n${slice}`);
      total += slice.length;
      if (total >= limit) break;
    } catch {
      continue;
    }
  }

  if (chunks.length === 0) {
    return "";
  }

  const merged = chunks.join("\n\n");
  return merged.length > limit ? merged.slice(0, limit) : merged;
}

/** Structured knowledge query for programmatic use */
export async function loadStructuredKnowledge(query: string) {
  return queryTradingKnowledge({ query, limit: 5 });
}
