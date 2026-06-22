import { capitalAdapter } from "@/lib/execution/capital-adapter";
import { resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { listOpenPositions } from "@/lib/portfolio/positions";
import type { ExtendedUserGoal } from "./types";
import { closePositionForGoal } from "./execution";
import { logAgentActivity } from "./activity-log";

export async function manageOpenPositions(
  goal: ExtendedUserGoal,
  cycleId: string
): Promise<string[]> {
  const actions: string[] = [];
  const account = await resolvePlatformAccount(goal.user_id, goal.mode);
  const positions = await listOpenPositions(account.id);

  for (const pos of positions) {
    try {
      const quote = await capitalAdapter.fetchQuoteStrict(pos.symbol, "crypto");
      const currentPrice = quote.spot ?? quote.bid;
      const entry = pos.entry_price;
      const pnlPct =
        entry > 0
          ? pos.side === "long"
            ? ((currentPrice - entry) / entry) * 100
            : ((entry - currentPrice) / entry) * 100
          : 0;

      if (pnlPct <= -((goal.max_risk_per_trade ?? 5) * 1.5)) {
        await closePositionForGoal({
          goal,
          dealId: pos.external_id,
          reasoning: `Stop loss at ${pnlPct.toFixed(2)}%`,
          cycleId,
        });
        actions.push(`Closed ${pos.symbol} — stop loss`);
        continue;
      }

      if (pnlPct >= (goal.max_risk_per_trade ?? 5) * 2) {
        await closePositionForGoal({
          goal,
          dealId: pos.external_id,
          percent: 50,
          reasoning: `Partial take-profit at +${pnlPct.toFixed(2)}%`,
          cycleId,
        });
        actions.push(`Partial close ${pos.symbol} — take profit`);
        continue;
      }

      const openedAt = pos.opened_at ? new Date(pos.opened_at).getTime() : 0;
      const hoursOpen = openedAt > 0 ? (Date.now() - openedAt) / 3_600_000 : 0;
      if (hoursOpen > 72 && Math.abs(pnlPct) < 0.5) {
        await closePositionForGoal({
          goal,
          dealId: pos.external_id,
          reasoning: `Time stop after ${hoursOpen.toFixed(0)}h flat`,
          cycleId,
        });
        actions.push(`Closed ${pos.symbol} — time stop`);
        continue;
      }

      await logAgentActivity({
        userId: goal.user_id,
        goalId: goal.id,
        cycleId,
        phase: "manage",
        action: "position_managed",
        symbol: pos.symbol,
        reasoning: `Monitoring P&L ${pnlPct.toFixed(2)}%`,
        payload: { pnlPct, currentPrice },
      });
    } catch (err) {
      console.warn(`[position-mgmt] ${pos.symbol}:`, err);
    }
  }

  return actions;
}
