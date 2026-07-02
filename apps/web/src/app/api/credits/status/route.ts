import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensureTrialCredits,
  FREE_TRIAL_CREDITS,
  getTrialExpiresAt,
  isTrialActive,
  isTrialExpired,
} from "@/lib/subscription/credits";
import { isPlanLimitsDisabled } from "@/lib/subscription/dev-access";

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
  const limitsDisabled = isPlanLimitsDisabled();
  return Response.json({
    balance: limitsDisabled ? FREE_TRIAL_CREDITS : credits.balance,
    trialGranted: credits.trial_granted,
    trialGrantedAt: credits.trial_granted_at,
    trialExpiresAt: limitsDisabled
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : trialExpiresAt?.toISOString() ?? null,
    trialActive: limitsDisabled ? true : isTrialActive(credits),
    trialExpired: limitsDisabled ? false : isTrialExpired(credits),
    trialTotal: FREE_TRIAL_CREDITS,
    devUnlimited: limitsDisabled,
  });
}
