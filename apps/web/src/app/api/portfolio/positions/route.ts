import { capitalAdapter } from "@/lib/execution/capital-adapter";
import { resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { assetClassForSymbol } from "@/lib/market/watchlist";
import {
  computePositionMarketValue,
  listOpenPositions,
} from "@/lib/portfolio/positions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "live" ? "live" : "demo";

  try {
    const account = await resolvePlatformAccount(user.id, mode);
    const [capitalPositions, localPositions] = await Promise.all([
      capitalAdapter.getOpenPositions().catch(() => []),
      listOpenPositions(account.id).catch(() => []),
    ]);

    const capitalByDealId = new Map(
      capitalPositions.map((cp) => [cp.dealId, cp]),
    );

    // User's open positions come from the local ledger; enrich with live Capital.com P/L.
    const positions = await Promise.all(
      localPositions.map(async (local) => {
        const cp = capitalByDealId.get(local.external_id);
        const direction =
          local.side === "long" ? ("BUY" as const) : ("SELL" as const);
        const leverage = local.leverage || 5;
        const margin = local.margin_usd;

        if (cp) {
          return {
            id: cp.dealId,
            capitalDealId: cp.dealId,
            symbol: cp.epic || local.symbol,
            direction: cp.direction || direction,
            entryPrice: cp.entryPrice || local.entry_price,
            markPrice: cp.markPrice,
            size: cp.size || local.quantity,
            leverage,
            margin,
            pnl: cp.upl,
            pnlPct: cp.uplPct,
            tp: null,
            sl: null,
            status: "OPEN" as const,
            timestamp: new Date(local.opened_at).getTime(),
          };
        }

        let markPrice = local.current_price ?? local.entry_price;
        try {
          const assetClass = assetClassForSymbol(local.symbol);
          const quote = await capitalAdapter.fetchQuote(local.symbol, assetClass);
          markPrice = local.side === "long" ? quote.bid : quote.ask;
        } catch {
          /* use stored price */
        }

        const { unrealizedPnlUsd } = computePositionMarketValue(
          local.side,
          local.quantity,
          local.entry_price,
          markPrice,
          margin,
        );
        const pnlPct =
          margin > 0
            ? Math.round((unrealizedPnlUsd / margin) * 10000) / 100
            : 0;

        return {
          id: local.external_id || local.id,
          capitalDealId: local.external_id,
          symbol: local.symbol,
          direction,
          entryPrice: local.entry_price,
          markPrice,
          size: local.quantity,
          leverage,
          margin,
          pnl: unrealizedPnlUsd,
          pnlPct,
          tp: null,
          sl: null,
          status: "OPEN" as const,
          timestamp: new Date(local.opened_at).getTime(),
        };
      }),
    );

    return Response.json({
      positions,
      source: "merged",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
