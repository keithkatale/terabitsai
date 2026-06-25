import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OnboardProfileDraft } from "@/lib/onboard/profile-types";
import { fillProfileDefaults, personaLabel } from "@/lib/onboard/profile-types";

export type UserAccountProfile = {
  user_id: string;
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  user_persona: string | null;
  trading_experience: string | null;
  markets_of_interest: string[];
  goal: string | null;
  amount_available: number | null;
  risk_preference: string | null;
  horizon_days: number | null;
  profile_summary: string | null;
  raw_profile: Record<string, unknown>;
};

export async function getUserAccountProfile(userId: string): Promise<UserAccountProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_account_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as UserAccountProfile | null) ?? null;
}

export async function isOnboardingComplete(userId: string): Promise<boolean> {
  const profile = await getUserAccountProfile(userId);
  return Boolean(profile?.onboarding_completed);
}

export async function saveCompletedProfile(
  userId: string,
  draft: OnboardProfileDraft,
): Promise<UserAccountProfile> {
  const filled = fillProfileDefaults(draft);
  const summary = [
    personaLabel(filled.userPersona),
    filled.goal,
    `Experience: ${filled.tradingExperience}`,
    `Markets: ${(filled.marketsOfInterest ?? []).join(", ")}`,
    `Risk: ${filled.riskPreference}`,
    `Horizon: ${filled.horizonDays} days`,
  ]
    .filter(Boolean)
    .join(" · ");

  const supabase = await createSupabaseServerClient();
  const row = {
    user_id: userId,
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString(),
    user_persona: filled.userPersona ?? null,
    trading_experience: filled.tradingExperience ?? null,
    markets_of_interest: filled.marketsOfInterest ?? [],
    goal: filled.goal ?? null,
    amount_available: filled.amountAvailable ?? null,
    risk_preference: filled.riskPreference ?? null,
    horizon_days: filled.horizonDays ?? null,
    profile_summary: summary,
    raw_profile: filled,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_account_profiles")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as UserAccountProfile;
}

export function buildAccountProfilePrompt(profile: UserAccountProfile | null): string {
  if (!profile?.onboarding_completed) {
    return `\n\nACCOUNT PROFILE: Not completed — encourage the user to finish setup at /app/setup if they want personalized guidance.`;
  }

  const lines = [
    "ACCOUNT PROFILE (from onboarding — treat as factual user context):",
    `- Persona: ${personaLabel(profile.user_persona ?? undefined)}`,
    profile.goal ? `- Primary goal: ${profile.goal}` : null,
    profile.trading_experience ? `- Experience: ${profile.trading_experience}` : null,
    profile.markets_of_interest?.length
      ? `- Markets of interest: ${profile.markets_of_interest.join(", ")}`
      : null,
    profile.amount_available != null
      ? `- Starting capital band: ~$${profile.amount_available}`
      : null,
    profile.risk_preference ? `- Risk tolerance: ${profile.risk_preference}` : null,
    profile.horizon_days ? `- Time horizon: ~${profile.horizon_days} days` : null,
  ].filter(Boolean);

  return `\n\n${lines.join("\n")}\nTailor analysis, examples, and recommendations to this profile.`;
}
