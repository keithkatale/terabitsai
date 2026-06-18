import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAccountBalance } from "@/lib/ledger/ledger-service";
import type { RecentLedgerEntry } from "@/lib/ledger/types";

async function ledgerDb() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return await createSupabaseServerClient();
  }
}

export async function getLedgerSummary(accountId: string) {
  const admin = await ledgerDb();

  const { data: accountRow } = await admin
    .from("accounts")
    .select("display_currency, mode")
    .eq("id", accountId)
    .maybeSingle();

  const displayCurrency = String(
    accountRow?.display_currency ?? "USD"
  ).toUpperCase();
  const mode = (accountRow?.mode as "demo" | "live") ?? "demo";

  const balance = await getAccountBalance(accountId, "USD");

  const { data: recentLedgerRows } = await admin
    .from("ledger_entries")
    .select(
      "id, created_at, entry_type, amount, currency, reference_type, metadata"
    )
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(25);

  const walletAvailable = balance.available;
  const orderLocked = balance.locked;

  const recentLedgerEntries: RecentLedgerEntry[] =
    recentLedgerRows?.map((row) => {
      const entryType = String(row.entry_type);
      const refType = String(row.reference_type);
      const amount = Number(row.amount);
      const rowCurrency = String(row.currency || "USD").toUpperCase();
      const meta = (row.metadata ?? {}) as Record<string, unknown>;

      const isOutflow =
        entryType === "withdrawal" ||
        entryType === "reserve";
      const isInflow =
        entryType === "deposit" ||
        entryType === "release" ||
        (entryType === "adjustment" && amount > 0);
      const direction: "in" | "out" | "neutral" = isOutflow
        ? "out"
        : isInflow
          ? "in"
          : entryType === "adjustment" && amount < 0
            ? "out"
            : "neutral";

      let title = entryType.replace(/_/g, " ");
      if (entryType === "deposit" && refType === "demo_deposit")
        title = "Demo deposit";
      else if (entryType === "deposit" && refType === "cash_movement")
        title = "Deposit";
      else if (entryType === "withdrawal" && refType === "demo_withdrawal")
        title = "Demo withdrawal";
      else if (entryType === "withdrawal") title = "Withdrawal";
      else if (entryType === "reserve") title = "Margin reserved";
      else if (entryType === "release") title = "Margin released";
      else if (entryType === "adjustment") title = "Trade P&L";

      const gateway =
        typeof meta.gateway === "string" ? meta.gateway : undefined;
      const symbol =
        typeof meta.symbol === "string" ? meta.symbol : undefined;
      const subtitle =
        gateway ??
        (symbol ? symbol : refType !== "deposit" ? refType.replace(/_/g, " ") : "");

      return {
        id: String(row.id),
        created_at: String(row.created_at),
        entry_type: entryType,
        reference_type: refType,
        amount: Number.isFinite(amount) ? Math.abs(amount) : 0,
        currency: rowCurrency,
        direction,
        title,
        subtitle: subtitle ? subtitle.slice(0, 80) : null,
      };
    }) ?? [];

  return {
    balance: {
      wallet_available: walletAvailable,
      order_locked: orderLocked,
      total_balance: walletAvailable + orderLocked,
      currency: displayCurrency,
    },
    mode,
    recent_ledger_entries: recentLedgerEntries,
  };
}
