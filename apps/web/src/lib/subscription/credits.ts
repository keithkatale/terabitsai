import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPlanLimitsDisabled } from "@/lib/subscription/dev-access";

export const FREE_TRIAL_CREDITS = 3000;
export const CREDITS_PER_CHAT_TURN = 5;
export const FREE_TRIAL_DURATION_MS = 24 * 60 * 60 * 1000;

export type UserCredits = {
  user_id: string;
  balance: number;
  trial_granted: boolean;
  trial_granted_at: string | null;
};

export function getTrialExpiresAt(credits: Pick<UserCredits, "trial_granted_at">): Date | null {
  if (!credits.trial_granted_at) return null;
  const grantedAt = new Date(credits.trial_granted_at);
  if (Number.isNaN(grantedAt.getTime())) return null;
  return new Date(grantedAt.getTime() + FREE_TRIAL_DURATION_MS);
}

export function isTrialActive(credits: Pick<UserCredits, "trial_granted" | "trial_granted_at">): boolean {
  if (isPlanLimitsDisabled()) return true;
  if (!credits.trial_granted) return false;
  const expiresAt = getTrialExpiresAt(credits);
  return Boolean(expiresAt && expiresAt.getTime() > Date.now());
}

export function isTrialExpired(credits: Pick<UserCredits, "trial_granted" | "trial_granted_at">): boolean {
  if (isPlanLimitsDisabled()) return false;
  if (!credits.trial_granted) return false;
  const expiresAt = getTrialExpiresAt(credits);
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
}

export async function getUserCredits(userId: string): Promise<UserCredits | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_credits")
    .select("user_id, balance, trial_granted, trial_granted_at")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as UserCredits | null) ?? null;
}

export async function ensureTrialCredits(userId: string): Promise<UserCredits> {
  const supabase = await createSupabaseServerClient();
  const existing = await getUserCredits(userId);
  if (existing?.trial_granted) return existing;

  const { data, error } = await supabase.rpc("grant_trial_credits", {
    p_user_id: userId,
    p_amount: FREE_TRIAL_CREDITS,
  });

  if (error) {
    const { data: inserted, error: insertError } = await supabase
      .from("user_credits")
      .upsert(
        {
          user_id: userId,
          balance: FREE_TRIAL_CREDITS,
          trial_granted: true,
          trial_granted_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("user_id, balance, trial_granted, trial_granted_at")
      .single();
    if (insertError) throw new Error(insertError.message);
    return inserted as UserCredits;
  }

  return data as UserCredits;
}

export async function deductCredits(
  userId: string,
  amount = CREDITS_PER_CHAT_TURN,
): Promise<{ ok: boolean; balance: number }> {
  if (isPlanLimitsDisabled()) {
    const credits = await ensureTrialCredits(userId);
    return { ok: true, balance: Math.max(credits.balance, FREE_TRIAL_CREDITS) };
  }

  const supabase = await createSupabaseServerClient();
  const credits = await ensureTrialCredits(userId);

  if (credits.balance < amount) {
    return { ok: false, balance: credits.balance };
  }

  const { data, error } = await supabase.rpc("deduct_user_credits", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    const newBalance = Math.max(0, credits.balance - amount);
    await supabase
      .from("user_credits")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { ok: newBalance >= 0, balance: newBalance };
  }

  return { ok: true, balance: (data as number) ?? 0 };
}

export function buildCreditsPrompt(balance: number): string {
  if (isPlanLimitsDisabled()) {
    return "\n\nTERABITS CREDITS: Development mode — plan limits disabled, unlimited AI usage.";
  }
  if (balance <= 0) {
    return `\n\nTERABITS CREDITS: User has 0 credits remaining. They used their one-day free trial (${FREE_TRIAL_CREDITS} credits). Suggest upgrading at /pricing for continued AI usage.`;
  }
  return `\n\nTERABITS CREDITS: User has ${balance.toLocaleString()} credits remaining (one-day free trial: ${FREE_TRIAL_CREDITS} total).`;
}
