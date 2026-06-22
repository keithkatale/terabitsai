import { manageUserGoals, type ManageGoalArgs } from "@/lib/chat/tools/goal-tool";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED_OPS = new Set<ManageGoalArgs["operation"]>([
  "pause_goal",
  "resume_goal",
  "enable_autonomous",
  "disable_autonomous",
  "cancel",
  "check_progress",
]);

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { goal_id?: string; operation?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const goalId = body.goal_id?.trim();
  const operation = body.operation as ManageGoalArgs["operation"];
  const mode = body.mode === "live" ? "live" : "demo";

  if (!goalId) {
    return Response.json({ success: false, error: "goal_id is required" }, { status: 400 });
  }
  if (!operation || !ALLOWED_OPS.has(operation)) {
    return Response.json({ success: false, error: "Invalid operation" }, { status: 400 });
  }

  const result = await manageUserGoals(user.id, mode, {
    operation,
    goal_id: goalId,
  });

  if (!result.success) {
    return Response.json(result, { status: 400 });
  }

  return Response.json(result);
}
