import {
  appendSignedAdjustment,
  releaseFunds,
  reserveFunds,
  resolvePlatformAccount,
} from "@/lib/ledger/ledger-service";
import { capturePortfolioSnapshot } from "@/lib/portfolio/capture-snapshot";
import {
  closePositionByExternalId,
  openPosition,
} from "@/lib/portfolio/positions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const tradeMetaSchema = z.object({
  quantity: z.number().positive().optional(),
  entryPrice: z.number().positive().optional(),
  leverage: z.number().positive().optional(),
  closePrice: z.number().positive().optional(),
});

const schema = z.discriminatedUnion("action", [
  z
    .object({
      mode: z.enum(["demo", "live"]).default("demo"),
      action: z.literal("reserve"),
      amount: z.number().positive(),
      symbol: z.string().min(1),
      tradeId: z.string().min(1),
      side: z.enum(["buy", "sell"]),
    })
    .merge(tradeMetaSchema),
  z
    .object({
      mode: z.enum(["demo", "live"]).default("demo"),
      action: z.literal("release"),
      amount: z.number().positive(),
      symbol: z.string().min(1),
      tradeId: z.string().min(1),
      side: z.enum(["buy", "sell"]),
    })
    .merge(tradeMetaSchema),
  z
    .object({
      mode: z.enum(["demo", "live"]).default("demo"),
      action: z.literal("adjustment"),
      signedAmount: z.number(),
      symbol: z.string().min(1),
      tradeId: z.string().min(1),
      side: z.enum(["buy", "sell"]),
    })
    .merge(tradeMetaSchema),
]);

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

  const payload = parsed.data;
  const meta = {
    symbol: payload.symbol,
    side: payload.side,
    timestamp: new Date().toISOString(),
    quantity: "quantity" in payload ? payload.quantity : undefined,
    entry_price: "entryPrice" in payload ? payload.entryPrice : undefined,
    leverage: "leverage" in payload ? payload.leverage : undefined,
    close_price: "closePrice" in payload ? payload.closePrice : undefined,
  };

  try {
    const account = await resolvePlatformAccount(user.id, payload.mode);

    if (payload.action === "reserve") {
      await reserveFunds(
        account.id,
        payload.amount,
        "trade",
        payload.tradeId,
        meta,
      );
      try {
        await openPosition({
          accountId: account.id,
          mode: payload.mode,
          externalId: payload.tradeId,
          symbol: payload.symbol,
          side: payload.side === "buy" ? "long" : "short",
          quantity: payload.quantity ?? 1,
          entryPrice: payload.entryPrice ?? payload.amount,
          leverage: payload.leverage ?? 5,
          marginUsd: payload.amount,
        });
      } catch (positionError) {
        console.warn("[ledger/trade] position open failed:", positionError);
      }
    } else if (payload.action === "release") {
      await releaseFunds(
        account.id,
        payload.amount,
        "trade",
        payload.tradeId,
        meta,
      );
      if (payload.closePrice != null) {
        try {
          await closePositionByExternalId(
            account.id,
            payload.tradeId,
            payload.closePrice,
          );
        } catch (positionError) {
          console.warn("[ledger/trade] position close failed:", positionError);
        }
      }
    } else if (payload.action === "adjustment") {
      if (payload.signedAmount !== 0) {
        await appendSignedAdjustment({
          accountId: account.id,
          signedAmount: payload.signedAmount,
          referenceType: "trade",
          referenceId: payload.tradeId,
          metadata: meta,
        });
      }
    }

    try {
      const snapshotReason =
        payload.action === "release"
          ? "close"
          : payload.action === "reserve"
            ? "trade"
            : "trade";
      await capturePortfolioSnapshot(account.id, payload.mode, {
        reason: snapshotReason,
        force: true,
      });
    } catch (snapshotError) {
      console.warn("[ledger/trade] snapshot capture failed:", snapshotError);
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Ledger update failed" },
      { status: 400 },
    );
  }
}
