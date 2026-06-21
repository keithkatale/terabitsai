import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { summarizeOpenPositions } from "@/lib/portfolio/positions";
import {
  computePortfolioChangePct,
  resampleToTenMinuteGrid,
  thinPoints,
  withZeroOrigin,
  type PortfolioHistoryPoint,
} from "@/lib/portfolio/portfolio-chart-utils";
import { getLiveTotalAccountBalance, getTotalAccountBalance } from "@/lib/portfolio/portfolio-balance";

export type { PortfolioHistoryPoint } from "@/lib/portfolio/portfolio-chart-utils";

export type PortfolioHistory = {
  points: PortfolioHistoryPoint[];
  currentValue: number;
  changePct: number;
  accountStartedAt: string;
};

async function historyDb() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return await createSupabaseServerClient();
  }
}

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Ledger deltas that change total account wealth (not internal reserve/release shuffles). */
function wealthDelta(entryType: string, amount: number): number {
  if (entryType === "deposit" || entryType === "trade_credit") {
    return amount;
  }
  if (entryType === "withdrawal" || entryType === "fee") {
    return -amount;
  }
  if (entryType === "adjustment") return amount;
  return 0;
}

async function reconstructFromLedger(
  accountId: string,
  accountStart: Date,
  currentValue: number,
): Promise<PortfolioHistoryPoint[]> {
  const db = await historyDb();
  const { data: ledgerEntries, error } = await db
    .from("ledger_entries")
    .select("created_at, amount, entry_type")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const startSec = Math.floor(accountStart.getTime() / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  const events: PortfolioHistoryPoint[] = [];

  let running = 0;
  for (const row of ledgerEntries ?? []) {
    const amount = toNumber(row.amount);
    const delta = wealthDelta(String(row.entry_type), amount);
    if (delta === 0) continue;
    running = Math.max(0, running + delta);
    events.push({
      time: Math.floor(new Date(String(row.created_at)).getTime() / 1000),
      value: Math.round(running * 100) / 100,
    });
  }

  return resampleToTenMinuteGrid(
    withZeroOrigin(startSec, events),
    startSec,
    nowSec,
    currentValue,
  );
}

export async function getPortfolioHistory(
  accountId: string,
  mode: "demo" | "live",
): Promise<PortfolioHistory> {
  const db = await historyDb();

  const { data: account } = await db
    .from("accounts")
    .select("created_at")
    .eq("id", accountId)
    .maybeSingle();

  const accountStart = account?.created_at
    ? new Date(account.created_at)
    : new Date(Date.now() - 90 * 86_400_000);

  const startSec = Math.floor(accountStart.getTime() / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  const bookValue = await getTotalAccountBalance(accountId);
  const liveValue = await getLiveTotalAccountBalance(accountId);

  let openPositionsCount = 0;
  try {
    const summary = await summarizeOpenPositions(accountId);
    openPositionsCount = summary.open_count;
  } catch {
    // positions table may be unavailable
  }

  let rawObservations: PortfolioHistoryPoint[] = [];

  try {
    const { data: snapshots, error: snapshotsError } = await db
      .from("portfolio_wealth_snapshots")
      .select("total_balance_usd, recorded_at")
      .eq("account_id", accountId)
      .eq("mode", mode)
      .order("recorded_at", { ascending: true });

    if (!snapshotsError && snapshots && snapshots.length >= 1) {
      rawObservations = snapshots.map((s) => ({
        time: Math.floor(new Date(String(s.recorded_at)).getTime() / 1000),
        value: Math.round(toNumber(s.total_balance_usd) * 100) / 100,
      }));
    }
  } catch {
    // Table may not exist yet; fall through to ledger reconstruction.
  }

  let points: PortfolioHistoryPoint[];

  const useSnapshots = rawObservations.length > 0 && openPositionsCount > 0;

  if (useSnapshots) {
    points = resampleToTenMinuteGrid(
      withZeroOrigin(startSec, rawObservations),
      startSec,
      nowSec,
      bookValue,
    );
  } else {
    points = await reconstructFromLedger(accountId, accountStart, bookValue);
  }

  points = thinPoints(points);

  // Live tail at current time — DB snapshots stay on 10-min grid; chart tip is mark-to-market.
  const liveTail = { time: nowSec, value: liveValue };
  if (points.length === 0) {
    points = [
      { time: startSec, value: 0 },
      liveTail,
    ];
  } else {
    const last = points[points.length - 1]!;
    if (last.time >= nowSec) {
      points = [...points.slice(0, -1), liveTail];
    } else {
      points = [...points, liveTail];
    }
  }

  return {
    points,
    currentValue: liveValue,
    changePct: computePortfolioChangePct(points, liveValue),
    accountStartedAt: accountStart.toISOString(),
  };
}
