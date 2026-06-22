import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { evaluateBalanceGoal } from "@/lib/goals/goal-evaluator";
import type { UserGoal } from "@/lib/goals/types";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: goal } = await supabase
    .from("user_goals")
    .select("*")
    .eq("user_id", user.id)
    .eq("goal_type", "balance_target")
    .in("status", ["active", "in_progress", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!goal) {
    return NextResponse.json({ success: true, goal: null });
  }

  const evaluation = await evaluateBalanceGoal(goal as UserGoal);
  const initial = goal.initial_balance ?? Number(goal.goal_value?.initial ?? 0);
  const target = goal.target_balance ?? Number(goal.goal_value?.target ?? 0);

  return NextResponse.json({
    success: true,
    goal,
    evaluation,
    genui: {
      type: "component",
      name: "GoalProgressWidget",
      props: {
        goalId: goal.id,
        mode: goal.mode,
        initialBalance: initial,
        targetBalance: target,
        currentBalance: evaluation.currentBalance,
        progressPct: evaluation.progressPct,
        status: goal.status,
        autonomousTrading: goal.autonomous_trading,
        deadlineAt: goal.deadline_at,
        description: goal.description,
        failureReason: goal.failure_reason,
      },
    },
  });
}
