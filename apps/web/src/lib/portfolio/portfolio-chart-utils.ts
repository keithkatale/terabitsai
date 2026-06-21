/** Wealth snapshot grid interval (Benchmark standard: 10 minutes). */
export const SNAPSHOT_BUCKET_SEC = 10 * 60;
export const SNAPSHOT_BUCKET_MS = SNAPSHOT_BUCKET_SEC * 1000;

export type PortfolioHistoryPoint = {
  time: number;
  value: number;
};

export function computePortfolioChangePct(
  points: PortfolioHistoryPoint[],
  currentValue: number,
): number {
  if (currentValue <= 0) return 0;
  const firstNonZero = points.find((p) => p.value > 0)?.value ?? 0;
  if (firstNonZero <= 0) return 0;
  return Math.round(((currentValue - firstNonZero) / firstNonZero) * 10000) / 100;
}

function roundMoney(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

/** Every account history begins at $0 at creation time. */
export function withZeroOrigin(
  startSec: number,
  points: PortfolioHistoryPoint[],
): PortfolioHistoryPoint[] {
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time);

  const withoutStart = sorted.filter((p) => p.time > startSec);
  return [{ time: startSec, value: 0 }, ...withoutStart];
}

/**
 * Resample irregular snapshot/event times onto a fixed 10-minute x-axis grid.
 * Values carry forward until the next observation (step chart semantics).
 */
export function resampleToTenMinuteGrid(
  rawPoints: PortfolioHistoryPoint[],
  startSec: number,
  nowSec: number,
  currentValue: number,
): PortfolioHistoryPoint[] {
  const alignedStart = Math.floor(startSec / SNAPSHOT_BUCKET_SEC) * SNAPSHOT_BUCKET_SEC;
  const alignedNow = Math.max(alignedStart, nowSec);

  const sorted = withZeroOrigin(alignedStart, rawPoints);
  if (sorted.length === 0) {
    return [
      { time: alignedStart, value: 0 },
      { time: alignedNow, value: roundMoney(currentValue) },
    ];
  }

  const buckets: PortfolioHistoryPoint[] = [];
  let obsIdx = 0;
  let lastValue = 0;

  for (let t = alignedStart; t <= alignedNow; t += SNAPSHOT_BUCKET_SEC) {
    while (obsIdx < sorted.length - 1 && sorted[obsIdx + 1]!.time <= t) {
      obsIdx += 1;
      lastValue = roundMoney(sorted[obsIdx]!.value);
    }
    if (sorted[obsIdx]!.time <= t) {
      lastValue = roundMoney(sorted[obsIdx]!.value);
    }
    buckets.push({ time: t, value: lastValue });
  }

  if (buckets.length === 0) {
    buckets.push({ time: alignedStart, value: 0 });
  }

  buckets[buckets.length - 1] = {
    time: alignedNow,
    value: roundMoney(currentValue),
  };

  return buckets;
}

export function thinPoints(points: PortfolioHistoryPoint[]): PortfolioHistoryPoint[] {
  if (points.length <= 400) return points;
  const step = Math.ceil(points.length / 400);
  const thin = points.filter((_, i) => i % step === 0);
  const last = points[points.length - 1];
  if (last && thin[thin.length - 1]?.time !== last.time) {
    thin.push(last);
  }
  return thin.length >= 2 ? thin : points;
}
