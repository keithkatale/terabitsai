import { resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { getPortfolioHistory } from "@/lib/portfolio/portfolio-history";
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
    const history = await getPortfolioHistory(account.id, mode);
    return Response.json({
      points: history.points,
      currentValue: history.currentValue,
      liveValue: history.currentValue,
      changePct: history.changePct,
      accountStartedAt: history.accountStartedAt,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
