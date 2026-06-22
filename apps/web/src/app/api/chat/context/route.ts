import {
  buildSessionContextPrompt,
  getSessionContext,
  hasActiveBalanceGoal,
} from "@/lib/chat/conversation-persistence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "live" ? "live" : "demo";

  try {
    const context = await getSessionContext(user.id, mode);
    const prompt = buildSessionContextPrompt(context);
    return Response.json({
      ...context,
      prompt,
      hasBalanceGoal: hasActiveBalanceGoal(context),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load context";
    return Response.json({ error: message }, { status: 500 });
  }
}
