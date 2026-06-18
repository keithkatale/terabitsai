import { appendLedgerEntry, resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  mode: z.enum(["demo", "live"]).default("demo"),
  amount: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  gateway: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  if (payload.mode === "live") {
    return Response.json(
      {
        error:
          "Live deposits are not enabled yet. Use demo mode to fund your paper account.",
      },
      { status: 400 }
    );
  }

  try {
    const account = await resolvePlatformAccount(user.id, "demo");
    const gateway = payload.gateway ?? "ACH";

    await appendLedgerEntry({
      accountId: account.id,
      amount: payload.amount,
      currency: payload.currency,
      entryType: "deposit",
      referenceType: "demo_deposit",
      metadata: {
        mode: "demo",
        gateway,
        timestamp: new Date().toISOString(),
      },
    });

    return Response.json({
      ok: true,
      simulated: true,
      deposited: {
        amount: payload.amount,
        currency: payload.currency,
        gateway,
      },
    });
  } catch (e) {
    console.error("[funding/deposit]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Deposit failed" },
      { status: 500 }
    );
  }
}
