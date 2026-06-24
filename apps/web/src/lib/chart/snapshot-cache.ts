/**
 * In-memory PNG snapshot cache keyed by specHash.
 * Used to serve chart screenshots to the workspace and vision analyzer.
 */

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  buffer: Buffer;
  mimeType: string;
  createdAt: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedSnapshot(hash: string): Buffer | null {
  const entry = cache.get(hash);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    cache.delete(hash);
    return null;
  }
  return entry.buffer;
}

export function setCachedSnapshot(hash: string, buffer: Buffer, mimeType = "image/png"): void {
  cache.set(hash, { buffer, mimeType, createdAt: Date.now() });
}

export function snapshotUrl(hash: string, baseUrl?: string): string {
  const base = getBaseUrl(baseUrl);
  return `${base}/api/chart/snapshot?hash=${hash}`;
}

function getBaseUrl(override?: string): string {
  if (override?.trim()) return override.trim().replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim()}`;
  }
  const port = process.env.PORT ?? "3000";
  return `http://127.0.0.1:${port}`;
}
