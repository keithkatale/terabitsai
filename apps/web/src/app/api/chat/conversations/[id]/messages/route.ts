import { z } from "zod";
import {
  appendConversationMessages,
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
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await appendConversationMessages(
      id,
      user.id,
      parsed.messages as PersistedChatMessage[],
    );
    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save messages";
    return Response.json({ error: message }, { status: 500 });
  }
}
