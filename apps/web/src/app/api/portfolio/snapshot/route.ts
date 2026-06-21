import { resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { capturePortfolioSnapshot } from "@/lib/portfolio/capture-snapshot";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  mode: z.enum(["demo", "live"]).default("demo"),
  reason: z
    .enum(["periodic", "trade", "deposit", "withdrawal", "close", "manual"])
    .default("manual"),
  force: z.boolean().optional(),
});

/** Authenticated snapshot capture for chart granularity while the app is open. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { mode, reason, force } = parsed.data;

  try {
    const account = await resolvePlatformAccount(user.id, mode);
    const result = await capturePortfolioSnapshot(account.id, mode, {
      reason,
      force: force ?? reason !== "periodic",
    });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Snapshot failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
