import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { evaluateBalanceGoal } from "@/lib/goals/goal-evaluator";
import { decideNextAction, toExtendedGoal } from "@/lib/autonomous/decide-next-action";
import { runOrchestratorTurn } from "@/lib/autonomous/orchestrator";
import { logAgentActivity } from "@/lib/autonomous/activity-log";
import type {
  GoalEvaluationAction,
  GoalEvaluation,
  UserGoal,
} from "@/lib/goals/types";
import type { DecisionOutcome } from "@/lib/autonomous/types";

const MAX_CONSECUTIVE_LOSSES = 3;

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

function mapOutcomeToAction(
  outcomeType: string,
  tradeId?: string
): { actionTaken: GoalEvaluationAction; tradeId?: string } {
  switch (outcomeType) {
    case "execute":
      return { actionTaken: "trade_executed", tradeId };
    case "queue_confirm":
      return { actionTaken: "trade_proposed", tradeId };
    case "paused":
      return { actionTaken: "autonomous_paused" };
    default:
      return { actionTaken: "none" };
  }
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
  let tradesExecuted = 0;

  for (const row of goals ?? []) {
    const goal = toExtendedGoal(row as Record<string, unknown>);
    const evaluation = await evaluateBalanceGoal(goal);

    let actionTaken: GoalEvaluationAction = "none";
    let reasoning = `Progress ${evaluation.progressPct.toFixed(1)}% — ${evaluation.status}`;
    let tradeId: string | undefined;

    if (evaluation.status === "achieved") {
      actionTaken = "goal_achieved";
      reasoning = "Target balance reached";
      achieved += 1;
    } else if (evaluation.status === "failed") {
      actionTaken = "goal_failed";
      reasoning = evaluation.failureReason ?? "Goal failed";
      failed += 1;
    } else if (goal.autonomous_trading && goal.status !== "paused" && !goal.kill_switch) {
      try {
        let outcome: DecisionOutcome;
        let narration: string;
        let cycleId: string;

        const cycleResult = await decideNextAction(row as Record<string, unknown>);
        outcome = cycleResult.outcome;
        narration = cycleResult.narration;
        cycleId = cycleResult.cycleId;

        const mapped = mapOutcomeToAction(outcome.type, "tradeId" in outcome ? outcome.tradeId : undefined);
        actionTaken = mapped.actionTaken;
        tradeId = mapped.tradeId;
        reasoning = narration;
        if (actionTaken === "trade_executed") tradesExecuted += 1;

        await logAgentActivity({
          userId: goal.user_id,
          goalId: goal.id,
          cycleId,
          phase: "report",
          action: "cycle_end",
          reasoning: narration,
        });

        try {
          await runOrchestratorTurn({
            goalRow: row as Record<string, unknown>,
            cycleId,
            outcome,
            narration,
          });
        } catch (orchErr) {
          console.warn("[goal-monitor] orchestrator turn failed:", orchErr);
        }
      } catch (err) {
        reasoning = err instanceof Error ? err.message : "Autonomous cycle failed";
        actionTaken = "none";
      }
    }

    await logGoalEvaluation(goal.id, evaluation, actionTaken, reasoning, tradeId);
    await applyGoalStatusUpdate(goal, evaluation, actionTaken);
    evaluated += 1;
  }

  return { evaluated, achieved, failed, tradesExecuted };
}

export async function processGoalById(goalId: string) {
  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("user_goals")
    .select("*")
    .eq("id", goalId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;

  const { outcome, narration, cycleId } = await decideNextAction(row as Record<string, unknown>);

  try {
    await runOrchestratorTurn({
      goalRow: row as Record<string, unknown>,
      cycleId,
      outcome,
      narration,
    });
  } catch (orchErr) {
    console.warn("[goal-monitor] orchestrator turn failed:", orchErr);
  }

  return { outcome, narration };
}

export async function processPendingEvents(limit = 20) {
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
