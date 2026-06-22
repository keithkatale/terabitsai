import { NextResponse } from "next/server";
import { getActiveConversation, createConversation } from "@/lib/chat/conversation-persistence";
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

  try {
    const conversation = await getActiveConversation(user.id, mode);
    return NextResponse.json({ conversation });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const mode = body.mode === "live" ? "live" : "demo";
  const forceNew = Boolean(body.forceNew);

  try {
    if (!forceNew) {
      const existing = await getActiveConversation(user.id, mode);
      if (existing) {
        return NextResponse.json({ conversation: existing, created: false });
      }
    }
    const conversation = await createConversation(user.id, mode);
    return NextResponse.json({ conversation, created: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to resolve conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
