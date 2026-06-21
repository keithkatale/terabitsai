import { getAccountBalance } from "@/lib/ledger/ledger-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { summarizeOpenPositions } from "@/lib/portfolio/positions";

async function snapshotDb() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return await createSupabaseServerClient();
  }
}

export async function capturePortfolioSnapshot(
  accountId: string,
  mode: "demo" | "live",
): Promise<void> {
  const db = await snapshotDb();
  const balance = await getAccountBalance(accountId, "USD");
  const positionSummary = await summarizeOpenPositions(accountId);

  const walletAvailable = balance.available;
  const orderLocked = balance.locked;
  const savingsLocked = 0;
  const investedValue = positionSummary.invested_value_usd;
  const totalBalance = walletAvailable + investedValue;

  const { error } = await db.from("portfolio_wealth_snapshots").insert({
    account_id: accountId,
    mode,
    wallet_available_usd: walletAvailable,
    order_locked_usd: orderLocked,
    savings_locked_usd: savingsLocked,
    invested_value_usd: investedValue,
    total_balance_usd: totalBalance,
    recorded_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
}

export async function captureAllAccountsWealthSnapshots(): Promise<{
  captured: number;
  errors: string[];
}> {
  const db = await snapshotDb();
  const { data: accounts, error } = await db
    .from("accounts")
    .select("id, mode")
    .eq("status", "active");

  if (error) throw new Error(error.message);

  let captured = 0;
  const errors: string[] = [];

  for (const account of accounts ?? []) {
    try {
      await capturePortfolioSnapshot(
        String(account.id),
        (account.mode as "demo" | "live") ?? "demo",
      );
      captured += 1;
    } catch (e) {
      errors.push(
        `${account.id}: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    }
  }

  return { captured, errors };
}
