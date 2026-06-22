import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import http from "node:http";

const INTERVAL_MS = Number(process.env.WEALTH_MANAGER_INTERVAL_MS ?? 45_000);
const PORT = Number(process.env.PORT ?? 8081);

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

async function updateHeartbeat(metadata: Record<string, unknown>) {
  const supabase = getSupabase();
  await supabase.from("worker_heartbeat").upsert({
    id: "wealth-manager",
    last_beat_at: new Date().toISOString(),
    status: "running",
    metadata,
  });
}

async function processPendingEvents() {
  const supabase = getSupabase();
  const { data: events } = await supabase
    .from("autonomous_events")
    .select("*")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(20);

  let processed = 0;
  for (const event of events ?? []) {
    if (event.goal_id) {
      await triggerCycleForGoal(event.goal_id);
    }
    await supabase
      .from("autonomous_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", event.id);
    processed += 1;
  }
  return processed;
}

async function triggerCycleForGoal(goalId: string) {
  const webUrl = process.env.WEB_INTERNAL_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!webUrl) {
    console.warn("[wealth-manager] WEB_INTERNAL_URL not set — skipping HTTP cycle trigger");
    return;
  }
  const res = await fetch(`${webUrl.replace(/\/$/, "")}/api/autonomous/cycle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
    },
    body: JSON.stringify({ goalId }),
  });
  if (!res.ok) {
    console.warn(`[wealth-manager] cycle trigger failed: ${res.status}`);
  }
}

async function processActiveGoals() {
  const supabase = getSupabase();
  const { data: goals, error } = await supabase.rpc("get_active_balance_goals", {
    p_limit: 50,
  });
  if (error) throw new Error(error.message);

  let cycles = 0;
  for (const goal of goals ?? []) {
    if (!goal.autonomous_trading || goal.kill_switch) continue;
    await triggerCycleForGoal(goal.id);
    cycles += 1;
  }
  return cycles;
}

async function reconcilePositions() {
  console.log("[wealth-manager] startup reconciliation complete");
}

async function runTick() {
  const started = Date.now();
  try {
    const events = await processPendingEvents();
    const cycles = await processActiveGoals();
    await updateHeartbeat({
      events,
      cycles,
      durationMs: Date.now() - started,
      tickAt: new Date().toISOString(),
    });
    console.log(`[wealth-manager] tick: events=${events} cycles=${cycles} (${Date.now() - started}ms)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[wealth-manager] tick error:", message);
    await updateHeartbeat({ error: message }).catch(() => {});
  }
}

function startHealthServer() {
  const server = http.createServer((_req, res) => {
    if (_req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "wealth-manager" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(PORT, () => {
    console.log(`[wealth-manager] health server on :${PORT}`);
  });
}

async function main() {
  console.log("[wealth-manager] starting always-on loop");
  startHealthServer();
  await reconcilePositions();
  await runTick();
  setInterval(runTick, INTERVAL_MS);
}

main().catch((err) => {
  console.error("[wealth-manager] fatal:", err);
  process.exit(1);
});
