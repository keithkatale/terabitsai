import { capitalAdapter } from "@/lib/execution/capital-adapter";
import { getAccountBalance } from "@/lib/ledger/ledger-service";
import { listOpenPositions, summarizeOpenPositions } from "@/lib/portfolio/positions";

/**
 * Ledger book balance for snapshots / DB persistence (10-min grid).
 */
export async function getTotalAccountBalance(accountId: string): Promise<number> {
  const balance = await getAccountBalance(accountId, "USD");

  try {
    const positionSummary = await summarizeOpenPositions(accountId);
    if (positionSummary.open_count > 0) {
      return (
        Math.round((balance.available + positionSummary.invested_value_usd) * 100) /
        100
      );
    }
  } catch {
    // positions table unavailable
  }

  return Math.round((balance.available + balance.locked) * 100) / 100;
}

/**
 * Mark-to-market balance using live Capital.com P/L on open positions.
 * Used for chart live tail and trading header — not persisted on every tick.
 */
export async function getLiveTotalAccountBalance(accountId: string): Promise<number> {
  const balance = await getAccountBalance(accountId, "USD");
  const walletAvailable = balance.available;

  let localPositions: Awaited<ReturnType<typeof listOpenPositions>> = [];
  try {
    localPositions = await listOpenPositions(accountId);
  } catch {
    return getTotalAccountBalance(accountId);
  }

  if (localPositions.length === 0) {
    return Math.round((walletAvailable + balance.locked) * 100) / 100;
  }

  let capitalByDealId = new Map<
    string,
    { upl: number; marginBasis?: number }
  >();
  try {
    const capitalPositions = await capitalAdapter.getOpenPositions();
    capitalByDealId = new Map(
      capitalPositions.map((cp) => [cp.dealId, { upl: cp.upl }]),
    );
  } catch {
    /* fall back to local marks */
  }

  let liveInvested = 0;
  for (const local of localPositions) {
    const cp = capitalByDealId.get(local.external_id);
    const margin = local.margin_usd;
    const pnl =
      cp?.upl ??
      local.unrealized_pnl_usd ??
      0;
    liveInvested += Math.max(0, margin + pnl);
  }

  return Math.round((walletAvailable + liveInvested) * 100) / 100;
}
