import { resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { upsertUserTradingModeForSessionUser } from "@/lib/account/user-app-preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  trading_mode: z.enum(["demo", "live"]),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [liveAccount, demoAccount] = await Promise.all([
    resolvePlatformAccount(user.id, "live"),
    resolvePlatformAccount(user.id, "demo"),
  ]);

  const { data: prefRow } = await supabase
    .from("user_app_preferences")
    .select("trading_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  const trading_mode: "demo" | "live" =
    prefRow?.trading_mode === "live" ? "live" : "demo";

  return Response.json({
    trading_mode,
    accounts: {
      live: { id: liveAccount.id, mode: liveAccount.mode },
      demo: { id: demoAccount.id, mode: demoAccount.mode },
    },
  });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await upsertUserTradingModeForSessionUser(payload.trading_mode);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save trading mode";
    return Response.json({ error: msg }, { status: 500 });
  }

  return Response.json({ ok: true, trading_mode: payload.trading_mode });
}
