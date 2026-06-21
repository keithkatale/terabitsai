import { getAccountBalance } from "@/lib/ledger/ledger-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { summarizeOpenPositions } from "@/lib/portfolio/positions";
import { getTotalAccountBalance } from "@/lib/portfolio/portfolio-balance";
import { SNAPSHOT_BUCKET_MS } from "@/lib/portfolio/portfolio-chart-utils";

export type SnapshotReason =
  | "periodic"
  | "trade"
  | "deposit"
  | "withdrawal"
  | "close"
  | "partial_close"
  | "manual";

const DEFAULT_MIN_INTERVAL_MS = SNAPSHOT_BUCKET_MS;

async function snapshotDb() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return await createSupabaseServerClient();
  }
}

async function lastSnapshotAgeMs(
  accountId: string,
  mode: "demo" | "live",
): Promise<number | null> {
  const db = await snapshotDb();
  const { data, error } = await db
    .from("portfolio_wealth_snapshots")
    .select("recorded_at")
    .eq("account_id", accountId)
    .eq("mode", mode)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.recorded_at) return null;
  return Date.now() - new Date(String(data.recorded_at)).getTime();
}

export async function capturePortfolioSnapshot(
  accountId: string,
  mode: "demo" | "live",
  options?: {
    reason?: SnapshotReason;
    force?: boolean;
    minIntervalMs?: number;
  },
): Promise<{ captured: boolean; skipped?: boolean }> {
  const reason = options?.reason ?? "periodic";
  const force = options?.force ?? reason !== "periodic";
  const minIntervalMs = options?.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;

  if (!force) {
    const ageMs = await lastSnapshotAgeMs(accountId, mode);
    if (ageMs != null && ageMs < minIntervalMs) {
      return { captured: false, skipped: true };
    }
  }

  const db = await snapshotDb();
  const balance = await getAccountBalance(accountId, "USD");
  let positionSummary = {
    invested_value_usd: 0,
    unrealized_pnl_usd: 0,
    open_count: 0,
  };

  try {
    positionSummary = await summarizeOpenPositions(accountId);
  } catch {
    // Positions table may be unavailable during rollout.
  }

  const walletAvailable = balance.available;
  const orderLocked = balance.locked;
  const savingsLocked = 0;
  const investedValue = positionSummary.invested_value_usd;
  const totalBalance = await getTotalAccountBalance(accountId);

  const { error } = await db.from("portfolio_wealth_snapshots").insert({
    account_id: accountId,
    mode,
    wallet_available_usd: walletAvailable,
    order_locked_usd: orderLocked,
    savings_locked_usd: savingsLocked,
    invested_value_usd: investedValue,
    total_balance_usd: totalBalance,
    reason,
    recorded_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
  return { captured: true };
}

export async function captureAllAccountsWealthSnapshots(): Promise<{
  captured: number;
  skipped: number;
  errors: string[];
}> {
  const db = await snapshotDb();
  const { data: accounts, error } = await db
    .from("accounts")
    .select("id, mode")
    .eq("status", "active");

  if (error) throw new Error(error.message);

  let captured = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const account of accounts ?? []) {
    try {
      const result = await capturePortfolioSnapshot(
        String(account.id),
        (account.mode as "demo" | "live") ?? "demo",
        { reason: "periodic" },
      );
      if (result.captured) captured += 1;
      else skipped += 1;
    } catch (e) {
      errors.push(
        `${account.id}: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    }
  }

  return { captured, skipped, errors };
}
