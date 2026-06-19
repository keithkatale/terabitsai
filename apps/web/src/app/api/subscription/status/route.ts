import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getUserPlan } from "@/lib/subscription/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getServerUser();
  if (!auth.ok) {
    return NextResponse.json({ plan: "free" });
  }
  const plan = await getUserPlan(auth.user.id);
  return NextResponse.json({ plan });
}
