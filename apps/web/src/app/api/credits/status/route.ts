import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureTrialCredits, FREE_TRIAL_CREDITS } from "@/lib/subscription/credits";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credits = await ensureTrialCredits(user.id);
  return Response.json({
    balance: credits.balance,
    trialGranted: credits.trial_granted,
    trialTotal: FREE_TRIAL_CREDITS,
  });
}
