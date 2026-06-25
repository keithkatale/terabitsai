import { NextResponse } from "next/server";
import { z } from "zod";
import { generateConversationTitleWithLlm } from "@/lib/chat/generate-conversation-title";
import {
  shouldUpgradeTitleWithLlm,
  synthesizeConversationTitleFromFirstUserText,
} from "@/lib/chat/conversation-title";
import { updateConversationTitle } from "@/lib/chat/conversation-persistence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  firstUserText: z.string().min(1).max(2000),
});

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

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("title")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const currentTitle = String(conversation.title ?? "");
  if (!shouldUpgradeTitleWithLlm(currentTitle, parsed.firstUserText)) {
    return NextResponse.json({ title: currentTitle.trim(), generated: false });
  }

  const firstUserText = parsed.firstUserText.trim();
  const fallbackTitle = synthesizeConversationTitleFromFirstUserText(firstUserText);

  try {
    const title = await generateConversationTitleWithLlm(firstUserText);
    const finalTitle = title?.trim() || fallbackTitle;
    
    console.log(`[generate-title] Generated "${finalTitle}" for conversation ${id}`);
    
    await updateConversationTitle(id, user.id, finalTitle);

    const { data: updated } = await supabase
      .from("conversations")
      .select("title, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      title: updated?.title ?? finalTitle,
      updated_at: updated?.updated_at ?? null,
      generated: true,
    });
  } catch (e) {
    console.error(`[generate-title] Error for conversation ${id}:`, e);
    const message = e instanceof Error ? e.message : "Failed to generate title";
    
    // Still save the fallback title even if LLM fails
    try {
      await updateConversationTitle(id, user.id, fallbackTitle);
      return NextResponse.json({
        title: fallbackTitle,
        updated_at: new Date().toISOString(),
        generated: false,
      });
    } catch {
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
}
