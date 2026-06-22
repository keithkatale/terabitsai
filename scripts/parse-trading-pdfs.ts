#!/usr/bin/env npx tsx
/**
 * PDF Knowledge Base Maintenance Script
 *
 * Validates structured knowledge-base JSON files and optionally extracts
 * raw text from PDFs in PDFs/ for future processing.
 *
 * Usage:
 *   npx tsx scripts/parse-trading-pdfs.ts           # validate only
 *   npx tsx scripts/parse-trading-pdfs.ts --extract # extract PDF text to knowledge-base/raw/
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const KB_ROOT = path.join(ROOT, "knowledge-base");
const PDF_DIR = path.join(ROOT, "PDFs");
const RAW_DIR = path.join(KB_ROOT, "raw");

const REFERENCE_FILES = [
  "chart-patterns.json",
  "elliott-wave.json",
  "trading-psychology.json",
  "execution-strategies.json",
  "patterns.json",
  "strategies.json",
  "indicators.json",
  "risk-rules.json",
];

function validateJsonFiles(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const file of REFERENCE_FILES) {
    const fullPath = path.join(KB_ROOT, "reference", file);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Missing: reference/${file}`);
      continue;
    }
    try {
      const raw = fs.readFileSync(fullPath, "utf8");
      JSON.parse(raw);
      console.log(`✓ reference/${file}`);
    } catch (err) {
      errors.push(`Invalid JSON in reference/${file}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

async function extractPdfs(): Promise<void> {
  if (!fs.existsSync(PDF_DIR)) {
    console.log("No PDFs/ directory found — skipping extraction");
    return;
  }

  fs.mkdirSync(RAW_DIR, { recursive: true });

  let pdfParse: ((buffer: Buffer) => Promise<{ text: string }>) | null = null;
  try {
    const mod = await import("pdf-parse");
    pdfParse = mod.default ?? mod;
  } catch {
    console.warn(
      "pdf-parse not installed. Run: npm install -D pdf-parse\nSkipping PDF extraction.",
    );
    return;
  }

  const pdfs = fs.readdirSync(PDF_DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
  console.log(`Extracting ${pdfs.length} PDF(s)...`);

  for (const pdf of pdfs) {
    const buffer = fs.readFileSync(path.join(PDF_DIR, pdf));
    const result = await pdfParse!(buffer);
    const outName = pdf.replace(/\.pdf$/i, ".txt");
    const outPath = path.join(RAW_DIR, outName);
    fs.writeFileSync(outPath, result.text, "utf8");
    console.log(`  → raw/${outName} (${result.text.length} chars)`);
  }
}

function printSummary(): void {
  const chartPatterns = JSON.parse(
    fs.readFileSync(path.join(KB_ROOT, "reference", "chart-patterns.json"), "utf8"),
  );
  const patternCount = Object.keys(chartPatterns.patterns ?? {}).length;

  console.log("\nKnowledge Base Summary:");
  console.log(`  Chart patterns: ${patternCount}`);
  console.log(`  Reference files: ${REFERENCE_FILES.length}`);
  console.log(`  Location: ${KB_ROOT}`);
}

async function main(): Promise<void> {
  const extract = process.argv.includes("--extract");

  console.log("Validating knowledge-base JSON files...\n");
  const { ok, errors } = validateJsonFiles();

  if (!ok) {
    console.error("\nValidation errors:");
    errors.forEach((e) => console.error(`  ✗ ${e}`));
    process.exit(1);
  }

  printSummary();

  if (extract) {
    console.log("\nExtracting PDF text...");
    await extractPdfs();
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
