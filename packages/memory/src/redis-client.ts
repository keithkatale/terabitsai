import Redis from "ioredis"

let _client: Redis | null = null

/**
 * Returns a singleton Redis client.
 * Falls back gracefully if REDIS_URL is not set (memory operations become no-ops).
 */
export function getRedisClient(): Redis | null {
  if (_client) return _client

  const url = process.env.REDIS_URL
  if (!url) {
    console.warn("[memory] REDIS_URL not set — memory persistence disabled")
    return null
  }

  try {
    _client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false
    })

    _client.on("error", (err) => {
      console.error("[memory] Redis error:", err)
    })

    return _client
  } catch (err) {
    console.error("[memory] Redis connection failed:", err)
    return null
  }
}

export async function closeRedisClient(): Promise<void> {
  if (_client) {
    await _client.quit()
    _client = null
  }
}
