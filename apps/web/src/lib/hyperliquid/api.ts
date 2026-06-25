const INFO_URL = "https://api.hyperliquid.xyz/info";

export async function hyperliquidInfoFetch(body: Record<string, unknown>) {
  const res = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hyperliquid info ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function pctChange(now: unknown, prev: unknown): number | null {
  const a = num(now);
  const b = num(prev);
  if (a == null || b == null || b === 0) return null;
  return ((a - b) / b) * 100;
}

export function fundingToApr(rate: unknown, intervalHours = 1): number | null {
  const r = num(rate);
  const h = num(intervalHours) || 1;
  return r == null ? null : (r / h) * 24 * 365 * 100;
}

export function isoTime(ms: unknown): string | null {
  const n = num(ms);
  if (n == null) return null;
  return new Date(n).toISOString();
}

export { INFO_URL };
