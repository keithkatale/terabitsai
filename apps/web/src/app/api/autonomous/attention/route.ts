import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  AUTONOMOUS_CYCLE_INTERVAL_MS,
  computeNextCycleAt,
  formatCountdown,
} from "@/lib/autonomous/cycle-config";

function formatIntervalLabel(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  return `${(ms / 3_600_000).toFixed(1)} hr`;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  const [{ data: goal }, { data: lastCycleRow }, { data: heartbeat }, { data: monitorActivity }] =
    await Promise.all([
      supabase
        .from("user_goals")
        .select(
          "id, status, autonomous_trading, kill_switch, last_evaluated_at, next_wake_at, goal_profile_md, progress_pct, target_balance",
        )
        .eq("user_id", user.id)
        .eq("goal_type", "balance_target")
        .in("status", ["active", "in_progress", "paused"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("agent_activity")
        .select("created_at, action, phase")
        .eq("user_id", user.id)
        .in("action", ["cycle_start", "cycle_end", "monitor_analyze", "monitor_goal_update"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("worker_heartbeat")
        .select("last_beat_at, status, metadata")
        .eq("id", "wealth-manager")
        .maybeSingle(),
      admin
        .from("agent_activity")
        .select("action, phase, created_at")
        .eq("user_id", user.id)
        .eq("phase", "monitor")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const workerLastBeat = heartbeat?.last_beat_at ?? null;
  const userLastCycle = lastCycleRow?.created_at ?? null;
  const goalLastEval = goal?.last_evaluated_at ?? null;
  const nextWakeAt = goal?.next_wake_at ?? null;

  const timestamps = [userLastCycle, goalLastEval, workerLastBeat].filter(Boolean) as string[];
  const lastAttentionAt =
    timestamps.length > 0
      ? timestamps.reduce((latest, t) =>
          new Date(t).getTime() > new Date(latest).getTime() ? t : latest,
        )
      : null;

  const workerStale =
    workerLastBeat != null && Date.now() - new Date(workerLastBeat).getTime() > 120_000;

  let nextCycleAt: string | null;
  let remainingMs: number;
  let cycleIntervalMs: number;

  if (nextWakeAt) {
    const wakeMs = new Date(nextWakeAt).getTime();
    remainingMs = Math.max(0, wakeMs - Date.now());
    nextCycleAt = nextWakeAt;
    const base = lastAttentionAt ? new Date(lastAttentionAt).getTime() : wakeMs - AUTONOMOUS_CYCLE_INTERVAL_MS;
    cycleIntervalMs = Math.max(15_000, wakeMs - base);
  } else {
    const cycle = computeNextCycleAt(lastAttentionAt, AUTONOMOUS_CYCLE_INTERVAL_MS);
    nextCycleAt = cycle.nextCycleAt;
    remainingMs = cycle.remainingMs;
    cycleIntervalMs = AUTONOMOUS_CYCLE_INTERVAL_MS;
  }

  const autonomousActive =
    Boolean(goal?.autonomous_trading) && !goal?.kill_switch && goal?.status !== "paused";

  const monitorRunning =
    monitorActivity != null &&
    ["monitor_analyze", "monitor_directive", "monitor_review", "monitor_followup"].includes(
      monitorActivity.action,
    ) &&
    Date.now() - new Date(monitorActivity.created_at).getTime() < 120_000;

  let attentionState: "inactive" | "watching" | "checking" | "paused" | "stale" = "inactive";
  if (!goal) {
    attentionState = "inactive";
  } else if (goal.kill_switch || goal.status === "paused" || !goal.autonomous_trading) {
    attentionState = "paused";
  } else if (workerStale && !userLastCycle) {
    attentionState = "stale";
  } else if (monitorRunning || remainingMs <= 3_000) {
    attentionState = "checking";
  } else {
    attentionState = "watching";
  }

  return NextResponse.json({
    success: true,
    cycleIntervalMs,
    cycleIntervalLabel: formatIntervalLabel(cycleIntervalMs),
    lastAttentionAt,
    lastUserCycleAt: userLastCycle,
    lastEvaluatedAt: goalLastEval,
    workerLastBeatAt: workerLastBeat,
    nextCycleAt,
    nextWakeAt,
    remainingMs,
    remainingLabel: formatCountdown(remainingMs),
    attentionState,
    monitorRunning,
    autonomousActive,
    goal: goal
      ? {
          id: goal.id,
          status: goal.status,
          autonomousTrading: goal.autonomous_trading,
          killSwitch: goal.kill_switch,
          progressPct: goal.progress_pct,
          targetBalance: goal.target_balance,
          hasGoalProfile: Boolean(goal.goal_profile_md),
        }
      : null,
    workerStatus: workerStale ? "stale" : (heartbeat?.status ?? "unknown"),
  });
}
