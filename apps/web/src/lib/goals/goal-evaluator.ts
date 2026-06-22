import { resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { getLiveTotalAccountBalance } from "@/lib/portfolio/portfolio-balance";
import type { GoalEvaluation, GoalEvaluationStatus, UserGoal } from "@/lib/goals/types";

const IMPOSSIBLE_LOSS_FRACTION = 0.1;
const AT_RISK_PROGRESS_THRESHOLD = -20;

function readBalanceFields(goal: UserGoal): {
  initial: number;
  target: number;
} {
  const initial =
    goal.initial_balance ??
    Number(goal.goal_value?.initial ?? goal.goal_value?.current ?? 0);
  const target =
    goal.target_balance ?? Number(goal.goal_value?.target ?? 0);

  return { initial, target };
}

export function computeProgressPct(
  currentBalance: number,
  initial: number,
  target: number,
): number {
  const delta = target - initial;
  if (delta <= 0) return currentBalance >= target ? 100 : 0;
  return Math.round(((currentBalance - initial) / delta) * 10000) / 100;
}

function determineSuggestedAction(
  goal: UserGoal,
  currentBalance: number,
  progressPct: number,
): GoalEvaluation["suggestedAction"] {
  const { target } = readBalanceFields(goal);
  const gap = target - currentBalance;

  if (gap <= 0) return "hold";
  if (progressPct < AT_RISK_PROGRESS_THRESHOLD) return "rebalance";
  if (gap > currentBalance * 0.05) return "trade";
  return "hold";
}

export async function evaluateBalanceGoal(goal: UserGoal): Promise<GoalEvaluation> {
  const account = await resolvePlatformAccount(goal.user_id, goal.mode);
  const currentBalance = await getLiveTotalAccountBalance(account.id);
  const { initial, target } = readBalanceFields(goal);

  const progressPct = computeProgressPct(currentBalance, initial, target);

  if (initial > 0 && currentBalance < initial * IMPOSSIBLE_LOSS_FRACTION) {
    return {
      goalId: goal.id,
      currentBalance,
      progressPct,
      status: "failed",
      failureReason: "Balance fell below 10% of starting amount — goal is no longer achievable",
      suggestedAction: "hold",
    };
  }

  if (goal.deadline_at && new Date() > new Date(goal.deadline_at)) {
    return {
      goalId: goal.id,
      currentBalance,
      progressPct,
      status: "failed",
      failureReason: "Deadline passed without reaching the target balance",
      suggestedAction: "hold",
    };
  }

  if (target > 0 && currentBalance >= target) {
    return {
      goalId: goal.id,
      currentBalance,
      progressPct: 100,
      status: "achieved",
      suggestedAction: "hold",
    };
  }

  const status: GoalEvaluationStatus =
    progressPct < AT_RISK_PROGRESS_THRESHOLD ? "at_risk" : "on_track";

  return {
    goalId: goal.id,
    currentBalance,
    progressPct,
    status,
    suggestedAction: determineSuggestedAction(goal, currentBalance, progressPct),
  };
}
