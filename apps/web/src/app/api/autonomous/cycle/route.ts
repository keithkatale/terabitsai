import { NextResponse } from "next/server";
import { processActiveGoals, processPendingEvents } from "@/lib/goals/goal-monitor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

async function updateHeartbeat(metadata: Record<string, unknown>) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("worker_heartbeat").upsert({
      id: "wealth-manager",
      last_beat_at: new Date().toISOString(),
      status: "running",
      metadata,
    });
  } catch {
    /* non-fatal */
  }
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body: { goalId?: string } = {};
    try {
      body = await request.json();
    } catch {
      /* GET has no body */
    }

    if (body.goalId) {
      const { processGoalById } = await import("@/lib/goals/goal-monitor");
      const result = await processGoalById(body.goalId);
      await updateHeartbeat({ singleGoal: body.goalId, result });
      return NextResponse.json({ success: true, result });
    }

    const events = await processPendingEvents(20);
    const goals = await processActiveGoals(50);
    await updateHeartbeat({ events, goals, source: "cron" });
    return NextResponse.json({ success: true, events, goals });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Goal monitor failed";
    await updateHeartbeat({ error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body: { goalId?: string } = {};
    try {
      body = await request.json();
    } catch {
      /* empty body ok */
    }

    if (body.goalId) {
      const { processGoalById } = await import("@/lib/goals/goal-monitor");
      const result = await processGoalById(body.goalId);
      await updateHeartbeat({ singleGoal: body.goalId, result });
      return NextResponse.json({ success: true, result });
    }

    const events = await processPendingEvents(20);
    const goals = await processActiveGoals(50);
    await updateHeartbeat({ events, goals, source: "worker" });
    return NextResponse.json({ success: true, events, goals });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cycle failed";
    await updateHeartbeat({ error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
