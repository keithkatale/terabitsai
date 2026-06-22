import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  AUTONOMOUS_CYCLE_INTERVAL_MS,
  computeNextCycleAt,
} from "@/lib/autonomous/cycle-config";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  const [{ data: goal }, { data: lastCycleRow }, { data: heartbeat }] = await Promise.all([
    supabase
      .from("user_goals")
      .select("id, status, autonomous_trading, kill_switch, last_evaluated_at")
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
      .in("action", ["cycle_start", "cycle_end"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("worker_heartbeat")
      .select("last_beat_at, status, metadata")
      .eq("id", "wealth-manager")
      .maybeSingle(),
  ]);

  const workerLastBeat = heartbeat?.last_beat_at ?? null;
  const userLastCycle = lastCycleRow?.created_at ?? null;
  const goalLastEval = goal?.last_evaluated_at ?? null;

  const timestamps = [userLastCycle, goalLastEval, workerLastBeat].filter(Boolean) as string[];
  const lastAttentionAt =
    timestamps.length > 0
      ? timestamps.reduce((latest, t) =>
          new Date(t).getTime() > new Date(latest).getTime() ? t : latest
        )
      : null;

  const workerStale =
    workerLastBeat != null && Date.now() - new Date(workerLastBeat).getTime() > 120_000;

  const cycle = computeNextCycleAt(lastAttentionAt, AUTONOMOUS_CYCLE_INTERVAL_MS);

  const autonomousActive =
    Boolean(goal?.autonomous_trading) &&
    !goal?.kill_switch &&
    goal?.status !== "paused";

  let attentionState: "inactive" | "watching" | "checking" | "paused" | "stale" = "inactive";
  if (!goal) {
    attentionState = "inactive";
  } else if (goal.kill_switch || goal.status === "paused" || !goal.autonomous_trading) {
    attentionState = "paused";
  } else if (workerStale && !userLastCycle) {
    attentionState = "stale";
  } else if (cycle.remainingMs <= 3_000) {
    attentionState = "checking";
  } else {
    attentionState = "watching";
  }

  return NextResponse.json({
    success: true,
    cycleIntervalMs: AUTONOMOUS_CYCLE_INTERVAL_MS,
    cycleIntervalLabel: "2 min",
    lastAttentionAt,
    lastUserCycleAt: userLastCycle,
    lastEvaluatedAt: goalLastEval,
    workerLastBeatAt: workerLastBeat,
    nextCycleAt: cycle.nextCycleAt,
    remainingMs: cycle.remainingMs,
    attentionState,
    autonomousActive,
    goal: goal
      ? {
          id: goal.id,
          status: goal.status,
          autonomousTrading: goal.autonomous_trading,
          killSwitch: goal.kill_switch,
        }
      : null,
    workerStatus: workerStale ? "stale" : (heartbeat?.status ?? "unknown"),
  });
}
