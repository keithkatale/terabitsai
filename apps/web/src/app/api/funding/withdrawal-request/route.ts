import {
  appendLedgerEntry,
  getAccountBalance,
  resolvePlatformAccount,
} from "@/lib/ledger/ledger-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  mode: z.enum(["demo", "live"]).default("demo"),
  requestedAmount: z.number().positive().max(10_000_000),
  method: z.enum(["demo", "bank", "mobile_money"]).default("demo"),
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
      { status: 400 }
    );
  }

  const payload = parsed.data;

  try {
    const account = await resolvePlatformAccount(user.id, payload.mode);
    const balance = await getAccountBalance(account.id, "USD");
    const currency = account.display_currency?.toUpperCase() || "USD";

    if (payload.requestedAmount > balance.available + 1e-4) {
      return Response.json(
        {
          error: `That amount exceeds your available balance ($${balance.available.toFixed(2)}).`,
        },
        { status: 400 }
      );
    }

    if (payload.mode === "demo") {
      await appendLedgerEntry({
        accountId: account.id,
        amount: payload.requestedAmount,
        currency: "USD",
        entryType: "withdrawal",
        referenceType: "demo_withdrawal",
        metadata: {
          mode: "demo",
          method: payload.method,
          timestamp: new Date().toISOString(),
        },
      });
      return Response.json({ ok: true, simulated: true });
    }

    return Response.json(
      {
        error:
          "Live withdrawals require manual processing. Contact support or use demo mode.",
      },
      { status: 400 }
    );
  } catch (e) {
    console.error("[funding/withdrawal-request]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Withdrawal failed" },
      { status: 500 }
    );
  }
}
