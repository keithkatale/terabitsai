import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("worker_heartbeat")
    .select("*")
    .eq("id", "wealth-manager")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lastBeat = data?.last_beat_at ? new Date(data.last_beat_at).getTime() : 0;
  const stale = Date.now() - lastBeat > 120_000;

  return NextResponse.json({
    success: true,
    status: stale ? "stale" : (data?.status ?? "unknown"),
    lastBeatAt: data?.last_beat_at,
    metadata: data?.metadata ?? {},
  });
}
