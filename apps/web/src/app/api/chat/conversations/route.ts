import { z } from "zod";
import {
  createConversation,
  listConversations,
} from "@/lib/chat/conversation-persistence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  mode: z.enum(["demo", "live"]).default("demo"),
  title: z.string().max(120).optional(),
});

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "live" ? "live" : "demo";

  try {
    const conversations = await listConversations(user.id, mode);
    return Response.json({ conversations });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list conversations";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let parsed: z.infer<typeof createSchema>;
  try {
    parsed = createSchema.parse(await request.json().catch(() => ({})));
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const conversation = await createConversation(
      user.id,
      parsed.mode,
      parsed.title?.trim() || "New conversation",
    );
    return Response.json({ conversation });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create conversation";
    return Response.json({ error: message }, { status: 500 });
  }
}
