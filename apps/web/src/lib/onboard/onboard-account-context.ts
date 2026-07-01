import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserPlan, type UserPlan } from "@/lib/subscription/access";
import {
  ensureTrialCredits,
  FREE_TRIAL_CREDITS,
  getTrialExpiresAt,
  isTrialActive,
  type UserCredits,
} from "@/lib/subscription/credits";
import type { ProfileFieldKey } from "@/lib/onboard/profile-types";
import { getApplicableProfileFields } from "@/lib/onboard/profile-types";

export type OnboardAccountContext = {
  userId: string;
  plan: UserPlan;
  email?: string | null;
  tradingMode: "demo" | "live";
  credits: UserCredits;
  isOnFreeTrial: boolean;
  isNewAccount: boolean;
  daysSinceSignup: number;
  hasCompletedOnboarding: boolean;
  allowedProfileFields: ProfileFieldKey[];
};

export function planLabel(plan: UserPlan): string {
  switch (plan) {
    case "premium":
      return "Managed ($50/mo)";
    case "pro":
      return "Terminal ($30/mo)";
    default:
      return "Chat (Free)";
  }
}

export function planCapabilities(plan: UserPlan): string {
  switch (plan) {
    case "premium":
      return "Full wallet, managed portfolio, automated trade execution, capital deployment questions allowed";
    case "pro":
      return "Live signals, analytics, intel feed, charts, scanners — no managed wallet or capital deployment questions";
    default:
      return "AI chat, education, market analysis — no managed wallet, no trade execution, no capital deployment questions";
  }
}

/** Rich context block injected into every onboarding AI turn. */
export function formatAccountContextForAi(account: OnboardAccountContext): string {
  return [
    "=== USER ACCOUNT SNAPSHOT (authoritative) ===",
    `Plan: ${planLabel(account.plan)} (${account.plan})`,
    `Capabilities: ${planCapabilities(account.plan)}`,
    `Trading mode: ${account.tradingMode}`,
    `Email on file: ${account.email ?? "unknown"}`,
    `New account (first week): ${account.isNewAccount ? "yes" : "no"}`,
    `Days since signup: ${account.daysSinceSignup}`,
    `Free trial active: ${account.isOnFreeTrial ? "yes" : "no"}`,
    `Trial credits remaining: ${account.credits.balance.toLocaleString()} / ${FREE_TRIAL_CREDITS}`,
    `Onboarding complete: ${account.hasCompletedOnboarding ? "yes" : "no"}`,
    `Profile fields you MAY collect: ${account.allowedProfileFields.join(", ")}`,
    "",
    "=== FIELD RULES ===",
    "- amountAvailable: ONLY if plan is premium (Managed). Never ask free/pro users how much capital to deploy.",
    "- goal: tailor to plan — free=learning/analysis, pro=signals/intel, premium=growth/automation",
    "- userPersona, tradingExperience, marketsOfInterest, riskPreference, horizonDays: all plans",
    "",
    "=== STYLE ===",
    "- Ask ONE question at a time. Conversational, not corporate.",
    "- Adapt wording to their persona, experience, and plan.",
    "- Never mention upgrading or paid plans during setup.",
  ].join("\n");
}

export async function buildOnboardAccountContext(userId: string): Promise<OnboardAccountContext> {
  const supabase = await createSupabaseServerClient();

  const [plan, prefs, profileRow, authUser, credits] = await Promise.all([
    getUserPlan(userId),
    supabase
      .from("user_app_preferences")
      .select("trading_mode")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_account_profiles")
      .select("onboarding_completed")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.auth.getUser(),
    ensureTrialCredits(userId),
  ]);

  const user = authUser.data.user;
  const createdAt = user?.created_at ? new Date(user.created_at) : new Date();
  const daysSinceSignup = Math.max(
    0,
    Math.floor((Date.now() - createdAt.getTime()) / 86_400_000),
  );

  const tradingMode = prefs.data?.trading_mode === "live" ? "live" : "demo";

  return {
    userId,
    plan,
    email: user?.email ?? null,
    tradingMode,
    credits,
    isOnFreeTrial: isTrialActive(credits) && credits.balance > 0,
    isNewAccount: daysSinceSignup <= 7,
    daysSinceSignup,
    hasCompletedOnboarding: Boolean(profileRow.data?.onboarding_completed),
    allowedProfileFields: getApplicableProfileFields(plan),
  };
}

/** Client-safe subset for the setup UI. */
export function toClientAccountSnapshot(account: OnboardAccountContext) {
  return {
    plan: account.plan,
    planLabel: planLabel(account.plan),
    tradingMode: account.tradingMode,
    isOnFreeTrial: account.isOnFreeTrial,
    trialCreditsRemaining: account.credits.balance,
    trialCreditsTotal: FREE_TRIAL_CREDITS,
    trialExpiresAt: getTrialExpiresAt(account.credits)?.toISOString() ?? null,
    isNewAccount: account.isNewAccount,
    daysSinceSignup: account.daysSinceSignup,
  };
}
