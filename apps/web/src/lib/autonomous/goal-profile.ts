import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ExtendedUserGoal } from "@/lib/autonomous/types";

export function buildDefaultGoalProfile(params: {
  goal: ExtendedUserGoal;
  currentBalance: number;
  progressPct: number;
  status: string;
}): string {
  const { goal, currentBalance, progressPct, status } = params;
  const target = goal.target_balance ?? 0;
  const initial = goal.initial_balance ?? currentBalance;
  const deadline = goal.deadline_at
    ? new Date(goal.deadline_at).toLocaleDateString()
    : "Not set";

  return `# Goal Profile

## Mission
Grow account from **$${initial.toFixed(2)}** to **$${target.toFixed(2)}** (${goal.mode} mode).

## Current Progress
- **Balance:** $${currentBalance.toFixed(2)}
- **Progress:** ${progressPct.toFixed(1)}%
- **Status:** ${status}
- **Deadline:** ${deadline}

## Risk Parameters
- Max risk per trade: ${goal.max_risk_per_trade}%
- Daily loss limit: ${goal.daily_loss_limit_pct}%
- Max concurrent positions: ${goal.max_concurrent_positions}
- Kill switch: ${goal.kill_switch ? "ON" : "off"}

## Monitor Notes
- Autonomous trading: ${goal.autonomous_trading ? "enabled" : "paused"}
- Last evaluated: ${goal.last_evaluated_at ?? "never"}

## Active Plan
_Awaiting first monitor cycle analysis._
`;
}

export async function getGoalProfileMd(goalId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("user_goals")
    .select("goal_profile_md")
    .eq("id", goalId)
    .maybeSingle();
  return (data?.goal_profile_md as string | null) ?? null;
}

export async function saveGoalProfileMd(goalId: string, markdown: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("user_goals")
    .update({
      goal_profile_md: markdown,
      updated_at: new Date().toISOString(),
    })
    .eq("id", goalId);
}

export async function scheduleNextWake(
  goalId: string,
  wakeAt: Date,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("user_goals")
    .update({
      next_wake_at: wakeAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", goalId);
}

export async function clearNextWake(goalId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("user_goals")
    .update({
      next_wake_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", goalId);
}
