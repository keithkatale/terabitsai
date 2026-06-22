import { fetchAssetChartData } from "@/lib/chat/chart-data-tool";
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
  const symbol = searchParams.get("symbol") ?? "";
  const range = searchParams.get("range") ?? "1M";
  const variant = searchParams.get("variant") === "line" ? "line" : "area";

  if (!symbol.trim()) {
    return Response.json({ error: "symbol is required" }, { status: 400 });
  }

  const result = await fetchAssetChartData({ symbol, range, variant });
  if (!result.success) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  return Response.json(result);
}
