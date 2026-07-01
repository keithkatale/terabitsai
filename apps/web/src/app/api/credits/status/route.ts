import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensureTrialCredits,
  FREE_TRIAL_CREDITS,
  getTrialExpiresAt,
  isTrialActive,
  isTrialExpired,
} from "@/lib/subscription/credits";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credits = await ensureTrialCredits(user.id);
  const trialExpiresAt = getTrialExpiresAt(credits);
  return Response.json({
    balance: credits.balance,
    trialGranted: credits.trial_granted,
    trialGrantedAt: credits.trial_granted_at,
    trialExpiresAt: trialExpiresAt?.toISOString() ?? null,
    trialActive: isTrialActive(credits),
    trialExpired: isTrialExpired(credits),
    trialTotal: FREE_TRIAL_CREDITS,
  });
}
