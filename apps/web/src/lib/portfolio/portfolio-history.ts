import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAccountBalance } from "@/lib/ledger/ledger-service";
import { summarizeOpenPositions } from "@/lib/portfolio/positions";

export type PortfolioHistoryPoint = {
  time: number;
  value: number;
};

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

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function dayStartUnix(dk: string): number {
  const [y, m, d] = dk.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 1000);
}

function computeChangePct(points: PortfolioHistoryPoint[]): number {
  const firstNonZero = points.find((p) => p.value > 0)?.value ?? points[0]?.value ?? 0;
  const lastVal = points[points.length - 1]?.value ?? 0;
  if (firstNonZero <= 0) return 0;
  return Math.round(((lastVal - firstNonZero) / firstNonZero) * 10000) / 100;
}

function thinPoints(points: PortfolioHistoryPoint[]): PortfolioHistoryPoint[] {
  if (points.length <= 400) return points;
  const step = Math.ceil(points.length / 400);
  const thin = points.filter((_, i) => i % step === 0);
  const last = points[points.length - 1];
  if (last && thin[thin.length - 1]?.time !== last.time) {
    thin.push(last);
  }
  return thin.length >= 2 ? thin : points;
}

function ledgerDelta(entryType: string, amount: number): number {
  if (entryType === "deposit" || entryType === "release" || entryType === "trade_credit") {
    return amount;
  }
  if (
    entryType === "withdrawal" ||
    entryType === "reserve" ||
    entryType === "trade_debit" ||
    entryType === "fee"
  ) {
    return -amount;
  }
  if (entryType === "adjustment") return amount;
  return 0;
}

async function getCurrentTotalBalance(accountId: string): Promise<number> {
  const balance = await getAccountBalance(accountId, "USD");
  const positionSummary = await summarizeOpenPositions(accountId);
  return (
    Math.round((balance.available + positionSummary.invested_value_usd) * 100) / 100
  );
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
  const byDay = new Map<string, number>();

  let running = 0;
  for (const row of ledgerEntries ?? []) {
    const amount = toNumber(row.amount);
    const delta = ledgerDelta(String(row.entry_type), amount);
    running += delta;
    const dk = dayKey(String(row.created_at));
    byDay.set(dk, Math.max(0, running));
  }

  const points: PortfolioHistoryPoint[] = [{ time: startSec, value: 0 }];

  const sortedDays = [...byDay.keys()].sort();
  for (const dk of sortedDays) {
    points.push({
      time: dayStartUnix(dk),
      value: Math.round((byDay.get(dk) ?? 0) * 100) / 100,
    });
  }

  points.push({ time: nowSec, value: currentValue });

  const deduped: PortfolioHistoryPoint[] = [];
  for (const p of points) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.time !== p.time) {
      deduped.push(p);
    } else {
      deduped[deduped.length - 1] = p;
    }
  }

  return thinPoints(deduped);
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
  const currentValue = await getCurrentTotalBalance(accountId);

  try {
    const { data: snapshots, error: snapshotsError } = await db
      .from("portfolio_wealth_snapshots")
      .select("total_balance_usd, recorded_at")
      .eq("account_id", accountId)
      .eq("mode", mode)
      .order("recorded_at", { ascending: true });

    if (!snapshotsError && snapshots && snapshots.length >= 2) {
      const points: PortfolioHistoryPoint[] = snapshots.map((s) => ({
        time: Math.floor(new Date(String(s.recorded_at)).getTime() / 1000),
        value: Math.round(toNumber(s.total_balance_usd) * 100) / 100,
      }));

      if (points[0]!.time > startSec + 3600) {
        points.unshift({ time: startSec, value: 0 });
      }

      points.push({ time: nowSec, value: currentValue });
      const thin = thinPoints(points);

      return {
        points: thin,
        currentValue,
        changePct: computeChangePct(thin),
        accountStartedAt: accountStart.toISOString(),
      };
    }
  } catch {
    // Table may not exist yet; fall through to ledger reconstruction.
  }

  const points = await reconstructFromLedger(accountId, accountStart, currentValue);

  return {
    points,
    currentValue,
    changePct: computeChangePct(points),
    accountStartedAt: accountStart.toISOString(),
  };
}
