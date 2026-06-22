import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AgentActivityAction, AgentActivityPhase } from "./types";

export async function logAgentActivity(params: {
  userId: string;
  goalId?: string;
  cycleId?: string;
  phase: AgentActivityPhase;
  action: AgentActivityAction;
  symbol?: string;
  reasoning?: string;
  payload?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  await admin.from("agent_activity").insert({
    user_id: params.userId,
    goal_id: params.goalId ?? null,
    cycle_id: params.cycleId ?? null,
    phase: params.phase,
    action: params.action,
    symbol: params.symbol ?? null,
    reasoning: params.reasoning ?? null,
    payload: params.payload ?? {},
  });
}

export async function enqueueAutonomousEvent(params: {
  userId: string;
  goalId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  await admin.from("autonomous_events").insert({
    user_id: params.userId,
    goal_id: params.goalId,
    event_type: params.eventType,
    payload: params.payload ?? {},
  });
}
