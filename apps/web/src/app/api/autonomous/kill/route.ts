import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { activateKillSwitch, deactivateKillSwitch } from "@/lib/autonomous/circuit-guard";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const goalId = body.goalId as string | undefined;
  const flattenAll = Boolean(body.flattenAll);
  const action = body.action as string | undefined;

  if (action === "resume" && goalId) {
    await deactivateKillSwitch(user.id, goalId);
    return NextResponse.json({ success: true, message: "Kill switch deactivated" });
  }

  const result = await activateKillSwitch(user.id, goalId, flattenAll);
  return NextResponse.json(result);
}
