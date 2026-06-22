import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "live" ? "live" : "demo";
  const since = searchParams.get("since");
  const conversationId = searchParams.get("conversationId");

  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .eq("mode", mode)
    .eq("is_active", true)
    .maybeSingle();

  const activeConvId = conversationId ?? conv?.id;
  if (!activeConvId) {
    return NextResponse.json({ messages: [], cycleEvents: [] });
  }

  let query = supabase
    .from("chat_messages")
    .select("id, role, parts, tool_pods, sequence, created_at")
    .eq("conversation_id", activeConvId)
    .order("created_at", { ascending: true });

  if (since) {
    query = query.gt("created_at", since);
  }

  const [{ data: rows }, { data: cycleEvents }] = await Promise.all([
    query,
    supabase
      .from("agent_activity")
      .select("id, action, reasoning, created_at, cycle_id")
      .eq("user_id", user.id)
      .in("action", [
        "orchestrator_wake",
        "orchestrator_skip",
        "cycle_end",
        "monitor_directive",
        "monitor_followup",
      ])
      .order("created_at", { ascending: false })
      .limit(since ? 10 : 3),
  ]);

  const messages = (rows ?? []).filter((m) => {
    if (!since) return false;
    const parts = (m.parts ?? []) as Array<{ type?: string }>;
    if (m.role === "assistant") return true;
    if (m.role === "user" && parts.some((p) => p.type === "monitor_directive")) return true;
    if (m.role === "system" && parts.some((p) => p.type === "session_divider")) return true;
    return false;
  });

  return NextResponse.json({
    conversationId: activeConvId,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts,
      toolPods: m.tool_pods,
      createdAt: m.created_at,
    })),
    cycleEvents: cycleEvents ?? [],
  });
}
