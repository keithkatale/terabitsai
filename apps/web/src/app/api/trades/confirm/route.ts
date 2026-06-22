import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const tradeLogId = typeof body.tradeLogId === "string" ? body.tradeLogId : null;
    const executionResult =
      body.execution_result != null && typeof body.execution_result === "object"
        ? body.execution_result
        : null;

    if (!tradeLogId) {
      return Response.json({ success: false, error: "tradeLogId is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("ai_trade_log")
      .update({
        status: "executed",
        confirmed_by_user: true,
        confirmed_at: now,
        executed_at: now,
        ...(executionResult ? { execution_result: executionResult } : {}),
      })
      .eq("id", tradeLogId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return Response.json({ success: false, error: "Trade log not found" }, { status: 404 });
    }

    return Response.json({ success: true, id: data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
