import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { processGoalById } from "@/lib/goals/goal-monitor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { goalId?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }

  let goalId = body.goalId;
  if (!goalId) {
    const { data: goal } = await supabase
      .from("user_goals")
      .select("id")
      .eq("user_id", user.id)
      .eq("goal_type", "balance_target")
      .in("status", ["active", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    goalId = goal?.id;
  }

  if (!goalId) {
    return NextResponse.json({ error: "No active goal found" }, { status: 404 });
  }

  const { data: owned } = await supabase
    .from("user_goals")
    .select("id, autonomous_trading, kill_switch, status")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owned) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  if (!owned.autonomous_trading || owned.kill_switch || owned.status === "paused") {
    return NextResponse.json(
      { error: "Autonomous trading is not active", skipped: true },
      { status: 409 },
    );
  }

  try {
    const result = await processGoalById(goalId, { userId: user.id });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Trigger failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
