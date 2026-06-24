import { NextResponse } from "next/server";
import { z } from "zod";
import {
  appendConversationMessages,
  loadConversationMessages,
  type PersistedChatMessage,
} from "@/lib/chat/conversation-persistence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(
    z.object({
      type: z.string(),
      text: z.string().optional(),
      payload: z.unknown().optional(),
    }),
  ),
  toolPods: z.unknown().optional(),
  subAgents: z.unknown().optional(),
});

const postSchema = z.object({
  messages: z.array(messageSchema).min(1),
});

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

export async function POST(
  request: Request,
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

  let parsed: z.infer<typeof postSchema>;
  try {
    parsed = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const { title } = await appendConversationMessages(
      id,
      user.id,
      parsed.messages as PersistedChatMessage[],
    );

    const { data: conversation } = await supabase
      .from("conversations")
      .select("title, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      title: title ?? conversation?.title ?? null,
      updated_at: conversation?.updated_at ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
