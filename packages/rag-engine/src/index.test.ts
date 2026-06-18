import { RAGEngine } from "./index.js"
import fs from "fs"
import path from "path"
import assert from "assert"

console.log("=== Running RAG Engine Unit Tests ===")

const TEMP_KB_DIR = path.join(process.cwd(), "temp-test-kb")

function setupMockKB() {
  if (fs.existsSync(TEMP_KB_DIR)) {
    fs.rmSync(TEMP_KB_DIR, { recursive: true, force: true })
  }
  fs.mkdirSync(TEMP_KB_DIR, { recursive: true })

  // Write a mock concepts file
  const conceptsDir = path.join(TEMP_KB_DIR, "concepts")
  fs.mkdirSync(conceptsDir, { recursive: true })
  fs.writeFileSync(
    path.join(conceptsDir, "smart-money-concepts.md"),
    `# Smart Money Concepts

## Bullish Order Blocks
An Order Block (OB) is a candle zone where institutional players accumulated massive buying power.
We look for the last bearish candle before a rapid bullish break.

## Fair Value Gaps
A Fair Value Gap (FVG) represents an imbalance in buyers and sellers.
It is identified using a three-candle sequence where Candle 3's low is higher than Candle 1's high.
`,
    "utf8"
  )
}

function cleanupMockKB() {
  if (fs.existsSync(TEMP_KB_DIR)) {
    fs.rmSync(TEMP_KB_DIR, { recursive: true, force: true })
  }
}

function testRAGSearch() {
  setupMockKB()

  try {
    const engine = new RAGEngine(TEMP_KB_DIR)
    
    // Assert chunks were loaded
    const chunks = engine.getAllChunks()
    assert.strictEqual(chunks.length, 3, "Should index 3 chunks (including main header + 2 sub-headers)")

    // Test querying
    const results = engine.query("What is an Order Block?")
    assert.ok(results.length > 0, "Should return search results")
    assert.strictEqual(results[0].title, "Bullish Order Blocks", "Top result should be Bullish Order Blocks")
    assert.ok(results[0].content.includes("accumulated massive buying power"))

    // Test category filter
    const cryptoResults = engine.query("Order Block", 5, "crypto")
    assert.strictEqual(cryptoResults.length, 0, "Should return 0 results with non-matching category filter")

    const conceptResults = engine.query("Order Block", 5, "concepts")
    assert.ok(conceptResults.length > 0, "Should return results matching the concepts category")

    console.log("✓ RAG Indexing and Keyword Overlap search passed")
  } finally {
    cleanupMockKB()
  }
}

// Execute tests
try {
  testRAGSearch()
  console.log("🎉 All RAG Engine Tests Passed!\n")
} catch (err) {
  console.error("❌ RAG Engine Test Failed:")
  console.error(err)
  process.exit(1)
}
