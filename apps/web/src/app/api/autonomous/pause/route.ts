import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const goalId = body.goalId as string | undefined;
  const pause = body.pause !== false;

  if (!goalId) {
    return NextResponse.json({ error: "goalId is required" }, { status: 400 });
  }

  const { data: goal, error: fetchErr } = await supabase
    .from("user_goals")
    .select("id, user_id")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr || !goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("user_goals")
    .update({
      autonomous_trading: !pause,
      status: pause ? "paused" : "in_progress",
      updated_at: now,
    })
    .eq("id", goalId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    autonomousTrading: !pause,
    message: pause ? "Autonomous trading paused" : "Autonomous trading resumed",
  });
}
