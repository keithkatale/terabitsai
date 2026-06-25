import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveCompletedProfile } from "@/lib/account/user-profile";
import { ensureTrialCredits } from "@/lib/subscription/credits";
import { onboardProfileSchema } from "@/lib/onboard/profile-types";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = onboardProfileSchema.safeParse(body.profile ?? body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid profile" }, { status: 400 });
  }

  const profile = await saveCompletedProfile(user.id, parsed.data);
  const credits = await ensureTrialCredits(user.id);

  return Response.json({
    success: true,
    profile,
    credits: credits.balance,
  });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("user_account_profiles")
    .select("onboarding_completed, profile_summary, user_persona, goal, raw_profile")
    .eq("user_id", user.id)
    .maybeSingle();

  return Response.json({
    completed: Boolean(data?.onboarding_completed),
    profile: data ?? null,
  });
}
