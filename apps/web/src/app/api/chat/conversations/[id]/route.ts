import { NextResponse } from "next/server";
import {
  activateConversation,
  deleteConversation,
  loadConversationMessages,
} from "@/lib/chat/conversation-persistence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { mode?: string };
  const mode = body.mode === "live" ? "live" : "demo";

  try {
    const conversation = await activateConversation(user.id, id, mode);
    return NextResponse.json({ conversation });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to activate conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    await deleteConversation(user.id, id);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const { data: conversation, error } = await supabase
      .from("conversations")
      .select("id, session_number, mode, title, context_summary, is_active, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const messages = await loadConversationMessages(id, user.id);
    return NextResponse.json({ conversation, messages: messages ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
