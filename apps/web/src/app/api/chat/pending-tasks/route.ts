import { listPendingTaskResults } from "@/lib/chat/tools/schedule-task-tool";
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
  const since = searchParams.get("since") ?? undefined;

  try {
    const tasks = await listPendingTaskResults(user.id, mode, since);
    return Response.json({ tasks });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load tasks";
    return Response.json({ error: message }, { status: 500 });
  }
}
