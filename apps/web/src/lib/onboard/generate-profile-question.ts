import type { OnboardProfileDraft, ProfileFieldKey } from "@/lib/onboard/profile-types";
import { buildFallbackQuestion } from "@/lib/onboard/profile-question-fallback";

type GenerateArgs = {
  profile: OnboardProfileDraft;
  transcript: Array<{ role: "user" | "assistant"; content: string }>;
  answeredCount: number;
  missing: ProfileFieldKey[];
};

/** Returns the next onboarding question. Uses static fallbacks (no LLM dependency). */
export async function generateProfileQuestionPayload(
  args: GenerateArgs,
): Promise<ReturnType<typeof buildFallbackQuestion>> {
  void args.transcript;
  void args.answeredCount;
  void args.missing;
  return buildFallbackQuestion(args.profile);
}
