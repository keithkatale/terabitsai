import { resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { listOpenPositions } from "@/lib/portfolio/positions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function mapPositionToTradeData(pos: Awaited<ReturnType<typeof listOpenPositions>>[number]) {
  return {
    id: pos.external_id,
    symbol: pos.symbol,
    direction: pos.side === "long" ? ("BUY" as const) : ("SELL" as const),
    entryPrice: pos.entry_price,
    size: pos.quantity,
    leverage: pos.leverage,
    margin: pos.margin_usd,
    tp: null,
    sl: null,
    status: "OPEN" as const,
    timestamp: new Date(pos.opened_at).getTime(),
  };
}

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
    const positions = await listOpenPositions(account.id);
    return Response.json({
      positions: positions.map(mapPositionToTradeData),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
