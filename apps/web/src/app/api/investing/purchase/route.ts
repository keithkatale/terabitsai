import { capitalAdapter } from "@/lib/execution/capital-adapter";
import {
  getAccountBalance,
  reserveFunds,
  resolvePlatformAccount,
} from "@/lib/ledger/ledger-service";
import { capturePortfolioSnapshot } from "@/lib/portfolio/capture-snapshot";
import { openPosition } from "@/lib/portfolio/positions";
import { assetClassForSymbol } from "@/lib/market/watchlist";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  mode: z.enum(["demo", "live"]).default("demo"),
  symbol: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  size: z.number().positive(),
  leverage: z.number().positive().max(50).default(5),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { mode, symbol, side, size, leverage } = parsed.data;
  const epic = symbol.toUpperCase();
  const assetClass = assetClassForSymbol(epic);

  try {
    const quote = await capitalAdapter.fetchQuote(epic, assetClass);
    if (quote.marketStatus && quote.marketStatus !== "TRADEABLE") {
      return Response.json(
        { error: `Market ${epic} is not tradeable right now (${quote.marketStatus}).` },
        { status: 400 },
      );
    }

    const entryPrice = side === "buy" ? quote.ask : quote.bid;
    const notional = size * entryPrice;
    const margin = notional / leverage;

    const account = await resolvePlatformAccount(user.id, mode);
    const balance = await getAccountBalance(account.id);
    if (balance.available < margin) {
      return Response.json(
        {
          error: `Insufficient funds. Need $${margin.toFixed(2)} margin, available $${balance.available.toFixed(2)}.`,
        },
        { status: 400 },
      );
    }

    const tradeId = `inv_${crypto.randomUUID()}`;
    const direction = side === "buy" ? "BUY" : "SELL";

    await reserveFunds(account.id, margin, "trade", tradeId, {
      symbol: epic,
      side,
      timestamp: new Date().toISOString(),
      quantity: size,
      entry_price: entryPrice,
      leverage,
      source: "investing_listing",
      bid: quote.bid,
      ask: quote.ask,
    });

    try {
      await openPosition({
        accountId: account.id,
        mode,
        externalId: tradeId,
        symbol: epic,
        side: side === "buy" ? "long" : "short",
        quantity: size,
        entryPrice,
        leverage,
        marginUsd: margin,
      });
    } catch (positionError) {
      console.warn("[investing/purchase] position open failed:", positionError);
    }

    try {
      await capturePortfolioSnapshot(account.id, mode);
    } catch (snapshotError) {
      console.warn("[investing/purchase] snapshot failed:", snapshotError);
    }

    return Response.json({
      ok: true,
      trade: {
        id: tradeId,
        symbol: epic,
        direction,
        size,
        leverage,
        margin,
        entryPrice,
        notional,
        bid: quote.bid,
        ask: quote.ask,
        spot: quote.spot,
      },
    });
  } catch (e) {
    console.error("[investing/purchase]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Purchase failed" },
      { status: 500 },
    );
  }
}
