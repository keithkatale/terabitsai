import { getLedgerSummary } from "@/lib/ledger/read-model";
import { resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { getPortfolioHistory } from "@/lib/portfolio/portfolio-history";
import { listOpenPositions } from "@/lib/portfolio/positions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AccountStateArgs = {
  include_history?: boolean;
  include_positions?: boolean;
  include_performance?: boolean;
  history_limit?: number;
};

async function ledgerDb() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return await createSupabaseServerClient();
  }
}

export async function fetchAccountState(
  userId: string,
  mode: "demo" | "live",
  args: AccountStateArgs = {},
) {
  const account = await resolvePlatformAccount(userId, mode);
  const summary = await getLedgerSummary(account.id);

  const includeHistory = args.include_history !== false;
  const includePositions = args.include_positions !== false;
  const includePerformance = args.include_performance !== false;
  const historyLimit = Math.min(Math.max(args.history_limit ?? 50, 1), 100);

  let positions: Awaited<ReturnType<typeof listOpenPositions>> = [];
  if (includePositions) {
    try {
      positions = await listOpenPositions(account.id);
    } catch {
      positions = [];
    }
  }

  let performance: {
    currentValue: number;
    changePct: number;
    accountStartedAt: string;
  } | null = null;
  if (includePerformance) {
    try {
      const history = await getPortfolioHistory(account.id, mode);
      performance = {
        currentValue: history.currentValue,
        changePct: history.changePct,
        accountStartedAt: history.accountStartedAt,
      };
    } catch {
      performance = null;
    }
  }

  let transactions: Array<{
    id: string;
    created_at: string;
    entry_type: string;
    amount: number;
    reference_type: string;
  }> = [];

  if (includeHistory) {
    const db = await ledgerDb();
    const { data } = await db
      .from("ledger_entries")
      .select("id, created_at, entry_type, amount, reference_type")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(historyLimit);

    transactions = (data ?? []).map((row) => ({
      id: String(row.id),
      created_at: String(row.created_at),
      entry_type: String(row.entry_type),
      amount: Number(row.amount),
      reference_type: String(row.reference_type),
    }));
  }

  return {
    success: true,
    mode,
    account: {
      id: account.id,
      currency: summary.balance.currency,
    },
    balance: {
      wallet_available: summary.balance.wallet_available,
      order_locked: summary.balance.order_locked,
      invested_value_usd: summary.balance.invested_value_usd,
      unrealized_pnl_usd: summary.balance.unrealized_pnl_usd,
      total_balance: summary.balance.total_balance,
    },
    open_positions_count: summary.portfolio.open_positions_count,
    positions: includePositions
      ? positions.map((p) => ({
          id: p.id,
          symbol: p.symbol,
          side: p.side,
          quantity: p.quantity,
          entry_price: p.entry_price,
          current_price: p.current_price,
          leverage: p.leverage,
          margin_usd: p.margin_usd,
          unrealized_pnl_usd: p.unrealized_pnl_usd,
          opened_at: p.opened_at,
        }))
      : undefined,
    recent_transactions: includeHistory ? transactions : undefined,
    performance: performance ?? undefined,
    recent_activity: summary.recent_ledger_entries.slice(0, 10),
  };
}
