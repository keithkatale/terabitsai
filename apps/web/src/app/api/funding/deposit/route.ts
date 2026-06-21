import { appendLedgerEntry, resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { capturePortfolioSnapshot } from "@/lib/portfolio/capture-snapshot";
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
      { status: 400 },
    );
  }

  const payload = parsed.data;

  if (payload.mode === "live") {
    return Response.json(
      {
        error:
          "Use card checkout for live deposits. Instant credits are available in demo mode only.",
      },
      { status: 400 },
    );
  }

  try {
    const account = await resolvePlatformAccount(user.id, payload.mode);
    const gateway = payload.gateway ?? "ACH";

    await appendLedgerEntry({
      accountId: account.id,
      amount: payload.amount,
      currency: payload.currency,
      entryType: "deposit",
      referenceType: "demo_deposit",
      metadata: {
        mode: payload.mode,
        gateway,
        timestamp: new Date().toISOString(),
      },
    });

    try {
      await capturePortfolioSnapshot(account.id, payload.mode, {
        reason: "deposit",
        force: true,
      });
    } catch (snapshotError) {
      console.warn("[funding/deposit] snapshot capture failed:", snapshotError);
    }

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
      { status: 500 },
    );
  }
}
