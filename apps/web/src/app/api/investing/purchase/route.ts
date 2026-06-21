import { capitalAdapter } from "@/lib/execution/capital-adapter";
import {
  getAccountBalance,
  releaseFunds,
  reserveFunds,
  resolvePlatformAccount,
} from "@/lib/ledger/ledger-service";
import { assetClassForSymbol } from "@/lib/market/watchlist";
import { capturePortfolioSnapshot } from "@/lib/portfolio/capture-snapshot";
import { openPosition } from "@/lib/portfolio/positions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    mode: z.enum(["demo", "live"]).default("demo"),
    symbol: z.string().min(1),
    side: z.enum(["buy", "sell"]),
    size: z.number().positive().optional(),
    allocationUsd: z.number().positive().optional(),
    leverage: z.number().positive().max(50).default(5),
  })
  .refine((data) => data.size != null || data.allocationUsd != null, {
    message: "Provide allocationUsd or size",
  })
  .refine((data) => !(data.size != null && data.allocationUsd != null), {
    message: "Provide only one of allocationUsd or size",
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

  const { mode, symbol, side, leverage, size: sizeInput, allocationUsd } = parsed.data;
  const epic = symbol.toUpperCase();
  const assetClass = assetClassForSymbol(epic);
  const direction = side === "buy" ? "BUY" : "SELL";

  try {
    const quote = await capitalAdapter.fetchQuoteStrict(epic, assetClass);
    if (quote.marketStatus && quote.marketStatus !== "TRADEABLE") {
      return Response.json(
        { error: `Market ${epic} is not tradeable right now (${quote.marketStatus}).` },
        { status: 400 },
      );
    }

    const indicativePrice = side === "buy" ? quote.ask : quote.bid;
    const marginEstimate =
      allocationUsd != null
        ? Math.round(allocationUsd * 100) / 100
        : Math.round(((sizeInput! * indicativePrice) / leverage) * 100) / 100;
    const notionalEstimate = marginEstimate * leverage;
    const size =
      allocationUsd != null
        ? Math.round((notionalEstimate / indicativePrice) * 1_000_000) / 1_000_000
        : sizeInput!;

    const account = await resolvePlatformAccount(user.id, mode);
    const balance = await getAccountBalance(account.id);
    if (balance.available < marginEstimate) {
      return Response.json(
        {
          error: `Insufficient funds. Need $${marginEstimate.toFixed(2)} margin, available $${balance.available.toFixed(2)}.`,
        },
        { status: 400 },
      );
    }

    // 1. Execute on Capital.com first — nothing is recorded until broker confirms.
    const capitalResult = await capitalAdapter.createPosition(epic, direction, size);
    const entryPrice =
      capitalResult.price > 0 ? capitalResult.price : indicativePrice;
    const margin = Math.round(((size * entryPrice) / leverage) * 100) / 100;
    const notional = size * entryPrice;
    const dealId = capitalResult.dealId;

    // 2. Mirror confirmed fill in app ledger + position store.
    try {
      await reserveFunds(account.id, margin, "trade", dealId, {
        symbol: epic,
        side,
        timestamp: new Date().toISOString(),
        quantity: size,
        entry_price: entryPrice,
        leverage,
        source: "investing_listing",
        allocation_usd: marginEstimate,
        capital_deal_id: dealId,
        bid: quote.bid,
        ask: quote.ask,
      });

      await openPosition({
        accountId: account.id,
        mode,
        externalId: dealId,
        symbol: epic,
        side: side === "buy" ? "long" : "short",
        quantity: size,
        entryPrice,
        leverage,
        marginUsd: margin,
      });
    } catch (mirrorError) {
      console.error(
        "[investing/purchase] Capital trade confirmed but app mirror failed:",
        mirrorError,
      );
      return Response.json(
        {
          error:
            "Trade executed on Capital.com but failed to sync locally. Contact support with deal ID: " +
            dealId,
          capitalDealId: dealId,
          capitalConfirmed: true,
        },
        { status: 500 },
      );
    }

    try {
      await capturePortfolioSnapshot(account.id, mode, {
        reason: "trade",
        force: true,
      });
    } catch (snapshotError) {
      console.warn("[investing/purchase] snapshot failed:", snapshotError);
    }

    return Response.json({
      ok: true,
      capitalConfirmed: true,
      trade: {
        id: dealId,
        capitalDealId: dealId,
        symbol: epic,
        direction,
        size,
        leverage,
        margin,
        allocationUsd: marginEstimate,
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
      {
        error: e instanceof Error ? e.message : "Purchase failed",
        capitalConfirmed: false,
      },
      { status: 500 },
    );
  }
}
