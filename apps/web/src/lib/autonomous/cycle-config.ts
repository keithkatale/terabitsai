/** Production cron runs /api/autonomous/cycle every 2 minutes (see vercel.json). */
export const AUTONOMOUS_CYCLE_INTERVAL_MS = 120_000;

const TRUEISH = new Set(["1", "true", "yes", "on"]);

/** Automated Wealth Monitor cycles (cron, worker, scheduled events). Default: off. */
export function isWealthMonitorEnabled(): boolean {
  const v = process.env.WEALTH_MONITOR_ENABLED?.trim().toLowerCase();
  if (!v) return false;
  return TRUEISH.has(v);
}

/** Worker tick when deployed (apps/wealth-manager). Shown when metadata indicates worker. */
export const WEALTH_MANAGER_INTERVAL_MS = 45_000;

export function computeNextCycleAt(
  lastAttentionAt: string | null | undefined,
  intervalMs = AUTONOMOUS_CYCLE_INTERVAL_MS
): { lastAttentionAt: string | null; nextCycleAt: string | null; remainingMs: number } {
  if (!lastAttentionAt) {
    return { lastAttentionAt: null, nextCycleAt: null, remainingMs: intervalMs };
  }
  const lastMs = new Date(lastAttentionAt).getTime();
  const interval = intervalMs;
  const elapsed = Date.now() - lastMs;
  const cyclesPassed = Math.floor(elapsed / interval);
  const nextMs = lastMs + (cyclesPassed + 1) * interval;
  return {
    lastAttentionAt,
    nextCycleAt: new Date(nextMs).toISOString(),
    remainingMs: Math.max(0, nextMs - Date.now()),
  };
}

export function formatCountdown(remainingMs: number): string {
  const totalSec = Math.ceil(remainingMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
