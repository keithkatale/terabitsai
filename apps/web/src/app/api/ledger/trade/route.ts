import {
  appendSignedAdjustment,
  releaseFunds,
  reserveFunds,
  resolvePlatformAccount,
} from "@/lib/ledger/ledger-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reserve"),
    amount: z.number().positive(),
    symbol: z.string().min(1),
    tradeId: z.string().min(1),
    side: z.enum(["buy", "sell"]),
  }),
  z.object({
    action: z.literal("release"),
    amount: z.number().positive(),
    symbol: z.string().min(1),
    tradeId: z.string().min(1),
    side: z.enum(["buy", "sell"]),
  }),
  z.object({
    action: z.literal("adjustment"),
    signedAmount: z.number(),
    symbol: z.string().min(1),
    tradeId: z.string().min(1),
    side: z.enum(["buy", "sell"]),
  }),
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
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const meta = {
    symbol: payload.symbol,
    side: payload.side,
    timestamp: new Date().toISOString(),
  };

  try {
    const account = await resolvePlatformAccount(user.id, "demo");

    if (payload.action === "reserve") {
      await reserveFunds(
        account.id,
        payload.amount,
        "trade",
        payload.tradeId,
        meta
      );
    } else if (payload.action === "release") {
      await releaseFunds(
        account.id,
        payload.amount,
        "trade",
        payload.tradeId,
        meta
      );
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

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Ledger update failed" },
      { status: 400 }
    );
  }
}
