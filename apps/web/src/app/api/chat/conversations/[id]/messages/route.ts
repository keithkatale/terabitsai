import { NextResponse } from "next/server";
import { loadConversationMessages } from "@/lib/chat/conversation-persistence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const messages = await loadConversationMessages(id, user.id);
    if (!messages) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json({ messages });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
