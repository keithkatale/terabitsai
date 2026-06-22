import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadConversationMessages } from "@/lib/chat/conversation-persistence";

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

  let msgQuery = supabase
    .from("chat_messages")
    .select("id, role, parts, tool_pods, sequence, created_at")
    .eq("conversation_id", activeConvId)
    .eq("role", "assistant")
    .order("created_at", { ascending: true });

  if (since) {
    msgQuery = msgQuery.gt("created_at", since);
  }

  const [{ data: messages }, { data: cycleEvents }] = await Promise.all([
    msgQuery,
    supabase
      .from("agent_activity")
      .select("id, action, reasoning, created_at, cycle_id")
      .eq("user_id", user.id)
      .in("action", ["orchestrator_wake", "orchestrator_skip", "cycle_end"])
      .order("created_at", { ascending: false })
      .limit(since ? 10 : 3),
  ]);

  const filtered = (messages ?? []).filter((m) => {
    if (!since) return false;
    return new Date(m.created_at).getTime() > new Date(since).getTime();
  });

  return NextResponse.json({
    conversationId: activeConvId,
    messages: filtered.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts,
      toolPods: m.tool_pods,
      createdAt: m.created_at,
    })),
    cycleEvents: cycleEvents ?? [],
  });
}
