import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGoalProfileMd, buildDefaultGoalProfile } from "@/lib/autonomous/goal-profile";
import { toExtendedGoal } from "@/lib/autonomous/decide-next-action";
import { evaluateBalanceGoal } from "@/lib/goals/goal-evaluator";

export const dynamic = "force-dynamic";

const MONITOR_ACTIONS = [
  "monitor_analyze",
  "monitor_directive",
  "monitor_review",
  "monitor_followup",
  "monitor_goal_update",
  "cycle_end",
] as const;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: goalRow, error: goalError } = await supabase
    .from("user_goals")
    .select("*")
    .eq("user_id", user.id)
    .eq("goal_type", "balance_target")
    .in("status", ["active", "in_progress", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (goalError) {
    return NextResponse.json({ error: goalError.message }, { status: 500 });
  }

  if (!goalRow) {
    return NextResponse.json({
      success: true,
      active: false,
      goalProfileMd: null,
      activity: [],
      goal: null,
    });
  }

  const admin = createSupabaseAdminClient();
  const goal = toExtendedGoal(goalRow as Record<string, unknown>);

  let goalProfileMd = await getGoalProfileMd(goal.id);
  if (!goalProfileMd) {
    const evaluation = await evaluateBalanceGoal(goal);
    goalProfileMd = buildDefaultGoalProfile({
      goal,
      currentBalance: evaluation.currentBalance,
      progressPct: evaluation.progressPct,
      status: evaluation.status,
    });
  }

  const { data: activity } = await admin
    .from("agent_activity")
    .select("id, phase, action, reasoning, payload, cycle_id, created_at")
    .eq("user_id", user.id)
    .eq("goal_id", goal.id)
    .in("action", [...MONITOR_ACTIONS])
    .order("created_at", { ascending: false })
    .limit(40);

  const monitorActivity = (activity ?? [])
    .filter((a) => a.phase === "monitor" || MONITOR_ACTIONS.includes(a.action as (typeof MONITOR_ACTIONS)[number]))
    .reverse();

  const autonomousActive =
    goal.autonomous_trading && !goal.kill_switch && goal.status !== "paused";

  return NextResponse.json({
    success: true,
    active: autonomousActive,
    autonomousActive,
    goalProfileMd,
    activity: monitorActivity,
    goal: {
      id: goal.id,
      status: goal.status,
      autonomousTrading: goal.autonomous_trading,
      killSwitch: goal.kill_switch,
      progressPct: goal.progress_pct,
      targetBalance: goal.target_balance,
      nextWakeAt: goal.next_wake_at,
    },
  });
}
