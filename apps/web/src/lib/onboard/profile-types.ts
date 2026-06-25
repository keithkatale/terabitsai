import { z } from "zod";

export const PROFILE_FIELD_KEYS = [
  "userPersona",
  "goal",
  "tradingExperience",
  "marketsOfInterest",
  "amountAvailable",
  "riskPreference",
  "horizonDays",
] as const;

export type ProfileFieldKey = (typeof PROFILE_FIELD_KEYS)[number];

export type UserPersona =
  | "forex_trader"
  | "long_term_investor"
  | "market_scout"
  | "swing_trader"
  | "beginner";

export type OnboardProfileDraft = {
  userPersona?: UserPersona | string;
  goal?: string;
  tradingExperience?: string;
  marketsOfInterest?: string[];
  amountAvailable?: number;
  weeklyTargetAmount?: number;
  riskPreference?: "low" | "medium" | "high";
  horizonDays?: number;
  incomeBand?: string;
};

export const onboardProfileSchema = z.object({
  userPersona: z.string().optional(),
  goal: z.string().optional(),
  tradingExperience: z.string().optional(),
  marketsOfInterest: z.array(z.string()).optional(),
  amountAvailable: z.number().finite().optional(),
  weeklyTargetAmount: z.number().finite().optional(),
  riskPreference: z.enum(["low", "medium", "high"]).optional(),
  horizonDays: z.number().int().positive().optional(),
  incomeBand: z.string().optional(),
});

export function missingProfileFields(p: OnboardProfileDraft): ProfileFieldKey[] {
  return PROFILE_FIELD_KEYS.filter((key) => {
    if (key === "marketsOfInterest") {
      return !p.marketsOfInterest?.length;
    }
    const v = p[key as keyof OnboardProfileDraft];
    if (v === undefined || v === null) return true;
    if (typeof v === "string") return v.trim().length === 0;
    if (typeof v === "number") return !Number.isFinite(v);
    return false;
  });
}

export function coerceProfileValue(key: ProfileFieldKey, raw: string | number): unknown {
  if (key === "marketsOfInterest") {
    if (typeof raw === "string") {
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [String(raw)];
  }
  if (key === "amountAvailable" || key === "horizonDays") {
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  if (key === "riskPreference") {
    const s = String(raw).toLowerCase();
    if (s === "low" || s === "medium" || s === "high") return s;
    return undefined;
  }
  return String(raw).trim();
}

export function applyProfileAnswer(
  profile: OnboardProfileDraft,
  field: ProfileFieldKey,
  raw: string | number,
): OnboardProfileDraft {
  const coerced = coerceProfileValue(field, raw);
  if (coerced === undefined) return profile;
  if (field === "marketsOfInterest") {
    return { ...profile, marketsOfInterest: coerced as string[] };
  }
  return { ...profile, [field]: coerced as never };
}

export function fillProfileDefaults(p: OnboardProfileDraft): OnboardProfileDraft {
  const out = { ...p };
  if (!out.userPersona?.trim()) out.userPersona = "beginner";
  if (!out.goal?.trim()) out.goal = "Learn markets and grow capital with AI guidance";
  if (!out.tradingExperience?.trim()) out.tradingExperience = "Beginner";
  if (!out.marketsOfInterest?.length) out.marketsOfInterest = ["stocks", "crypto"];
  if (out.amountAvailable == null || !Number.isFinite(out.amountAvailable)) out.amountAvailable = 0;
  if (!out.riskPreference) out.riskPreference = "medium";
  if (out.horizonDays == null || !Number.isFinite(out.horizonDays)) out.horizonDays = 90;
  return out;
}

export function personaLabel(persona?: string): string {
  switch (persona) {
    case "forex_trader":
      return "Forex / FX trader";
    case "long_term_investor":
      return "Long-term investor";
    case "market_scout":
      return "Market scout / researcher";
    case "swing_trader":
      return "Swing / active trader";
    case "beginner":
      return "New to markets";
    default:
      return persona ?? "Trader";
  }
}
