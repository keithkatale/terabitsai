import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PLAN_RANK } from "@/lib/billingsdk-config";
import { getEffectiveUserPlan, isPlanLimitsDisabled } from "@/lib/subscription/dev-access";

export type UserPlan = "free" | "pro" | "premium";

export async function getUserPlan(userId: string): Promise<UserPlan> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("app_subscriptions")
    .select("plan_id, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan = data?.plan_id;
  let resolved: UserPlan = "free";
  if (plan === "premium") resolved = "premium";
  else if (plan === "pro") resolved = "pro";

  return getEffectiveUserPlan(resolved);
}

export function planMeetsRequirement(userPlan: UserPlan, required: UserPlan): boolean {
  if (isPlanLimitsDisabled()) return true;
  return (PLAN_RANK[userPlan] ?? 0) >= (PLAN_RANK[required] ?? 0);
}
