import type { UserPlan } from "@/lib/subscription/access";

/**
 * Bypass trial expiry, credit deduction, and plan-tier gates while building locally.
 * On by default when NODE_ENV=development. Set DISABLE_PLAN_LIMITS=false to re-enable limits in dev.
 */
export function isPlanLimitsDisabled(): boolean {
  const flag = process.env.DISABLE_PLAN_LIMITS?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return process.env.NODE_ENV === "development";
}

export const DEV_EFFECTIVE_PLAN: UserPlan = "premium";

export function getEffectiveUserPlan(plan: UserPlan): UserPlan {
  return isPlanLimitsDisabled() ? DEV_EFFECTIVE_PLAN : plan;
}
