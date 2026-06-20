import type Redis from "ioredis"
import type { HITLRequest, HITLResponse, HITLDecision } from "./types.js"

const KEY_PREFIX = "hitl:pending"
const RESPONSE_PREFIX = "hitl:response"
const DEFAULT_TIMEOUT_MS = 3_600_000 // 1 hour
const POLL_INTERVAL_MS = 2_000

/**
 * HITL Approval Service
 *
 * Manages the lifecycle of human approval requests for high-risk trades.
 * Uses Redis as the communication channel between the engine (producer)
 * and the web dashboard (consumer/approver).
 *
 * Flow:
 *  1. Engine calls requestApproval() → stores pending request in Redis
 *  2. Web dashboard polls /api/hitl/pending → renders approval modal
 *  3. User approves/rejects → web dashboard calls /api/hitl/respond
 *  4. Engine's awaitDecision() receives the decision and continues
 */
export class HITLApprovalService {
  constructor(private readonly redis: Redis | null) {}

  /**
   * Create a pending approval request. Returns requestId.
   * The engine suspends the trade pipeline until this is resolved.
   */
  async requestApproval(request: HITLRequest): Promise<string> {
    if (!this.redis) {
      console.warn("[hitl] Redis unavailable — auto-approving request")
      return request.requestId
    }

    const key = `${KEY_PREFIX}:${request.requestId}`
    const ttlSecs = Math.floor(
      (new Date(request.expiresAt).getTime() - Date.now()) / 1000
    )

    await this.redis.set(key, JSON.stringify(request), "EX", ttlSecs > 0 ? ttlSecs : 3600)

    // Publish event for real-time dashboard notification
    await this.redis.publish("hitl:new_request", JSON.stringify({
      requestId: request.requestId,
      symbol: request.symbol,
      side: request.side,
      confidence: request.confidence,
      createdAt: request.createdAt
    }))

    console.log(`[hitl] Approval requested: ${request.requestId} — ${request.symbol} ${request.side}`)
    return request.requestId
  }

  /**
   * Wait for a human decision with polling. Returns the decision or TIMEOUT.
   */
  async awaitDecision(requestId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<HITLDecision> {
    if (!this.redis) return "APPROVED" // Fail-open when Redis unavailable

    const start = Date.now()

    while (Date.now() - start < timeoutMs) {
      const responseKey = `${RESPONSE_PREFIX}:${requestId}`
      const raw = await this.redis.get(responseKey)

      if (raw) {
        const response = JSON.parse(raw) as HITLResponse
        console.log(`[hitl] Decision received for ${requestId}: ${response.decision}`)

        // Cleanup
        await this.redis.del(responseKey)
        await this.redis.del(`${KEY_PREFIX}:${requestId}`)

        return response.decision
      }

      // Check if request expired
      const pending = await this.redis.get(`${KEY_PREFIX}:${requestId}`)
      if (!pending) {
        console.log(`[hitl] Request ${requestId} expired — treating as TIMEOUT`)
        return "TIMEOUT"
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    }

    console.log(`[hitl] Timeout waiting for decision on ${requestId}`)
    await this.redis.del(`${KEY_PREFIX}:${requestId}`)
    return "TIMEOUT"
  }

  /**
   * Submit a human decision (called from web dashboard API).
   */
  async submitDecision(response: HITLResponse): Promise<void> {
    if (!this.redis) return

    const key = `${RESPONSE_PREFIX}:${response.requestId}`
    await this.redis.set(key, JSON.stringify(response), "EX", 300) // 5 min TTL

    // Remove from pending
    await this.redis.del(`${KEY_PREFIX}:${response.requestId}`)

    // Publish response event
    await this.redis.publish("hitl:decision", JSON.stringify(response))
  }

  /**
   * List all pending approval requests (for dashboard display).
   */
  async listPending(): Promise<HITLRequest[]> {
    if (!this.redis) return []

    try {
      const keys = await this.redis.keys(`${KEY_PREFIX}:*`)
      if (keys.length === 0) return []

      const values = await this.redis.mget(...keys)
      return values
        .filter((v): v is string => v !== null)
        .map((v) => JSON.parse(v) as HITLRequest)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    } catch {
      return []
    }
  }

  /**
   * Get a specific pending request by ID.
   */
  async getRequest(requestId: string): Promise<HITLRequest | null> {
    if (!this.redis) return null

    try {
      const raw = await this.redis.get(`${KEY_PREFIX}:${requestId}`)
      return raw ? (JSON.parse(raw) as HITLRequest) : null
    } catch {
      return null
    }
  }
}
