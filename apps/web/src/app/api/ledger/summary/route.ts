import { resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { getLedgerSummary } from "@/lib/ledger/read-model";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
    const summary = await getLedgerSummary(account.id);
    return Response.json({
      account: {
        id: account.id,
        mode: account.mode,
        kyc_tier: account.kyc_tier,
        display_currency: account.display_currency,
      },
      user: { id: user.id, email: user.email },
      ...summary,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
