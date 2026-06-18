import { detectSMC, Candle } from "./smc-detector.js"
import assert from "assert"

console.log("=== Running SMC Detector Unit Tests ===")

// 1. Test FVG Detection
function testFVG() {
  const candles: Candle[] = [
    { time: 1, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
    { time: 2, open: 102, high: 120, low: 101, close: 118, volume: 5000 }, // Large upward candle
    { time: 3, open: 118, high: 125, low: 110, close: 122, volume: 1000 }  // c3.low (110) > c1.high (105)
  ]

  const result = detectSMC(candles)
  assert.strictEqual(result.fvgs.length, 1, "Should detect 1 Bullish FVG")
  assert.strictEqual(result.fvgs[0].type, "BULLISH")
  assert.strictEqual(result.fvgs[0].top, 110)
  assert.strictEqual(result.fvgs[0].bottom, 105)
  assert.strictEqual(result.fvgs[0].mitigated, false)
  console.log("✓ FVG Detection passed")
}

// 2. Test Order Block Detection
function testOrderBlock() {
  const candles: Candle[] = [
    { time: 1, open: 100, high: 102, low: 98, close: 99, volume: 100 },
    { time: 2, open: 99, high: 101, low: 97, close: 98, volume: 1000 },  // Bearish candle (potential Bullish OB)
    { time: 3, open: 98, high: 105, low: 98, close: 104, volume: 2000 }, // Bullish impulse 1
    { time: 4, open: 104, high: 110, low: 103, close: 109, volume: 2500 }, // Bullish impulse 2
    { time: 5, open: 109, high: 115, low: 108, close: 114, volume: 3000 }, // Bullish impulse 3
    { time: 6, open: 114, high: 116, low: 112, close: 115, volume: 100 }
  ]

  const result = detectSMC(candles)
  assert.ok(result.orderBlocks.length >= 1, "Should detect at least 1 Bullish Order Block")
  const ob = result.orderBlocks[0]
  assert.strictEqual(ob.type, "BULLISH")
  assert.strictEqual(ob.close, 98)
  console.log("✓ Order Block Detection passed")
}

// Execute tests
try {
  testFVG()
  testOrderBlock()
  console.log("🎉 All SMC Detector Tests Passed!\n")
} catch (err) {
  console.error("❌ SMC Detector Test Failed:")
  console.error(err)
  process.exit(1)
}
