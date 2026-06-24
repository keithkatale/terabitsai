import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { evaluateBalanceGoal } from "@/lib/goals/goal-evaluator";
import { toExtendedGoal } from "@/lib/autonomous/decide-next-action";
import { isWealthMonitorEnabled } from "@/lib/autonomous/cycle-config";
import { runWealthMonitorCycle } from "@/lib/autonomous/wealth-monitor";
import type {
  GoalEvaluationAction,
  GoalEvaluation,
  UserGoal,
} from "@/lib/goals/types";

const MAX_CONSECUTIVE_LOSSES = 3;
const CYCLE_COOLDOWN_MS = 30_000;

async function logGoalEvaluation(
  goalId: string,
  evaluation: GoalEvaluation,
  actionTaken: GoalEvaluationAction,
  reasoning: string,
  tradeId?: string,
) {
  const admin = createSupabaseAdminClient();
  await admin.from("goal_evaluations").insert({
    goal_id: goalId,
    current_balance: evaluation.currentBalance,
    progress_pct: evaluation.progressPct,
    action_taken: actionTaken,
    reasoning,
    trade_id: tradeId ?? null,
  });
}

async function applyGoalStatusUpdate(
  goal: UserGoal,
  evaluation: GoalEvaluation,
  actionTaken: GoalEvaluationAction,
) {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    progress_pct: evaluation.progressPct,
    last_evaluated_at: now,
    updated_at: now,
  };

  if (evaluation.status === "achieved") {
    updates.status = "achieved";
    updates.achieved_at = now;
    updates.failure_reason = null;
  } else if (evaluation.status === "failed") {
    updates.status = "failed";
    updates.failure_reason = evaluation.failureReason ?? "Goal failed";
  } else if (goal.status === "active") {
    updates.status = "in_progress";
  }

  if (actionTaken === "autonomous_paused") {
    updates.autonomous_trading = false;
    updates.status = "paused";
    updates.failure_reason = "Autonomous trading paused after repeated losses";
  }

  if (evaluation.status === "at_risk") {
    const nextLosses = (goal.consecutive_losses ?? 0) + 1;
    updates.consecutive_losses = nextLosses;
    if (nextLosses >= MAX_CONSECUTIVE_LOSSES && goal.autonomous_trading) {
      updates.autonomous_trading = false;
      updates.status = "paused";
      updates.failure_reason = "Autonomous trading paused after 3 at-risk evaluations";
    }
  } else if (evaluation.status === "on_track" && actionTaken === "trade_executed") {
    updates.consecutive_losses = 0;
  }

  await admin.from("user_goals").update(updates).eq("id", goal.id);
}

async function isCycleCooldown(goalId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("agent_activity")
    .select("created_at")
    .eq("goal_id", goalId)
    .eq("action", "cycle_start")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.created_at) return false;
  return Date.now() - new Date(data.created_at).getTime() < CYCLE_COOLDOWN_MS;
}

export async function processActiveGoals(limit = 50) {
  const admin = createSupabaseAdminClient();

  const { data: goals, error } = await admin.rpc("get_active_balance_goals", {
    p_limit: limit,
  });

  if (error) {
    throw new Error(error.message);
  }

  let evaluated = 0;
  let achieved = 0;
  let failed = 0;
  let cyclesRun = 0;

  for (const row of goals ?? []) {
    const goal = toExtendedGoal(row as Record<string, unknown>);
    const evaluation = await evaluateBalanceGoal(goal);

    let actionTaken: GoalEvaluationAction = "none";
    let reasoning = `Progress ${evaluation.progressPct.toFixed(1)}% — ${evaluation.status}`;

    if (evaluation.status === "achieved") {
      actionTaken = "goal_achieved";
      reasoning = "Target balance reached";
      achieved += 1;
    } else if (evaluation.status === "failed") {
      actionTaken = "goal_failed";
      reasoning = evaluation.failureReason ?? "Goal failed";
      failed += 1;
    } else if (goal.autonomous_trading && goal.status !== "paused" && !goal.kill_switch) {
      if (!isWealthMonitorEnabled()) {
        reasoning = "Automated Wealth Monitor is disabled";
      } else if (await isCycleCooldown(goal.id)) {
        reasoning = "Monitor cycle already running";
      } else {
        try {
          const result = await runWealthMonitorCycle({
            goalRow: row as Record<string, unknown>,
          });
          reasoning = result.analysis?.summary ?? "Wealth monitor cycle complete";
          cyclesRun += 1;
        } catch (err) {
          reasoning = err instanceof Error ? err.message : "Wealth monitor cycle failed";
          actionTaken = "none";
        }
      }
    }

    await logGoalEvaluation(goal.id, evaluation, actionTaken, reasoning);
    await applyGoalStatusUpdate(goal, evaluation, actionTaken);
    evaluated += 1;
  }

  return { evaluated, achieved, failed, cyclesRun };
}

export async function processGoalById(
  goalId: string,
  options?: { userId?: string; force?: boolean },
) {
  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("user_goals")
    .select("*")
    .eq("id", goalId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;

  if (options?.userId && row.user_id !== options.userId) {
    throw new Error("Unauthorized");
  }

  const goal = toExtendedGoal(row as Record<string, unknown>);

  if (!goal.autonomous_trading || goal.kill_switch || goal.status === "paused") {
    return { skipped: true, reason: "Autonomous trading not active" };
  }

  if (!options?.force && (await isCycleCooldown(goalId))) {
    return { skipped: true, reason: "Cycle already running" };
  }

  const evaluation = await evaluateBalanceGoal(goal);

  const result = await runWealthMonitorCycle({
    goalRow: row as Record<string, unknown>,
  });

  await logGoalEvaluation(
    goal.id,
    evaluation,
    "none",
    result.analysis?.summary ?? "Wealth monitor cycle",
  );
  await applyGoalStatusUpdate(goal, evaluation, "none");

  return result;
}

export async function processPendingEvents(limit = 20) {
  if (!isWealthMonitorEnabled()) {
    return { processed: 0, skipped: true, reason: "Automated Wealth Monitor is disabled" };
  }

  const admin = createSupabaseAdminClient();
  const { data: events, error } = await admin
    .from("autonomous_events")
    .select("*")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  let processed = 0;
  for (const event of events ?? []) {
    if (event.goal_id) {
      await processGoalById(event.goal_id);
    }
    await admin
      .from("autonomous_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", event.id);
    processed += 1;
  }
  return { processed };
}

export async function evaluateGoalById(goalId: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const { data: goal, error } = await admin
    .from("user_goals")
    .select("*")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!goal) return null;

  return evaluateBalanceGoal(goal as UserGoal);
}
