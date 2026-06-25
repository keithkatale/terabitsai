import { z } from "zod";
import { isGeminiRuntimeConfigured } from "@/lib/gemini/vertex-client";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import type { OnboardAccountContext } from "@/lib/onboard/onboard-account-context";
import { formatAccountContextForAi } from "@/lib/onboard/onboard-account-context";
import type { OnboardProfileDraft, ProfileFieldKey } from "@/lib/onboard/profile-types";
import { missingApplicableFields } from "@/lib/onboard/profile-types";
import type { ProfileQuestionPayload } from "@/lib/onboard/profile-question-fallback";
import { buildFallbackQuestionForField } from "@/lib/onboard/profile-question-fallback";

const llmShape = z.object({
  say: z.string(),
  field: z
    .enum([
      "userPersona",
      "goal",
      "tradingExperience",
      "marketsOfInterest",
      "amountAvailable",
      "riskPreference",
      "horizonDays",
    ])
    .nullable(),
  options: z.array(z.object({ id: z.string(), label: z.string() })).max(6),
  values: z.record(z.union([z.string(), z.number(), z.array(z.string())])),
  done: z.boolean(),
  multiSelect: z.boolean().optional(),
});

const ONBOARDING_SYSTEM = `You are the Terabits AI onboarding coach. You ask guided setup questions one at a time.

You receive a full USER ACCOUNT SNAPSHOT on every turn. Use it to decide WHAT to ask and HOW to phrase it.

STRICT RULES:
- Only ask about fields listed in "Profile fields you MAY collect".
- NEVER ask amountAvailable unless plan is premium.
- Never suggest upgrading during setup.
- Output ONLY valid JSON (no markdown fences).`;

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1].trim() : trimmed;
}

function validateFieldForAccount(
  field: ProfileFieldKey | null,
  account: OnboardAccountContext,
  missing: ProfileFieldKey[],
): ProfileFieldKey | null {
  if (!field) return missing[0] ?? null;
  if (!missing.includes(field)) return missing[0] ?? null;
  if (field === "amountAvailable" && account.plan !== "premium") return missing[0] ?? null;
  if (!account.allowedProfileFields.includes(field)) return missing[0] ?? null;
  return field;
}

function normalizeLlmPayload(
  raw: z.infer<typeof llmShape>,
  profile: OnboardProfileDraft,
  missing: ProfileFieldKey[],
  account: OnboardAccountContext,
): ProfileQuestionPayload {
  if (raw.done) {
    return {
      say: raw.say.trim() || "You're ready to continue.",
      field: null,
      options: [{ id: "continue", label: "Continue" }],
      values: {},
      done: true,
    };
  }

  const field = validateFieldForAccount(raw.field as ProfileFieldKey | null, account, missing);
  const opts = raw.options.slice(0, 6).filter((o) => o.id.trim() && o.label.trim());
  const vals = raw.values ?? {};

  if (!field || opts.length === 0 || Object.keys(vals).length === 0) {
    const target = missing[0];
    if (!target) {
      return { say: raw.say, field: null, options: [{ id: "continue", label: "Continue" }], values: {}, done: true };
    }
    const fallback = buildFallbackQuestionForField(target, account.plan);
    return { ...fallback, say: raw.say.trim() || fallback.say };
  }

  return {
    say: raw.say.trim() || "Quick question — pick the option that fits you best.",
    field,
    options: opts,
    values: vals,
    done: false,
    multiSelect: field === "marketsOfInterest" ? true : raw.multiSelect,
  };
}

async function callOnboardingLlm(
  account: OnboardAccountContext,
  userPrompt: string,
  temperature = 0.65,
): Promise<string> {
  return generateVertexTextCompletion({
    systemInstruction: `${ONBOARDING_SYSTEM}\n\n${formatAccountContextForAi(account)}`,
    userPrompt,
    temperature,
    maxTokens: 1024,
  });
}

/** AI-generated personalized welcome for the setup screen. */
export async function generateWelcomeMessage(
  account: OnboardAccountContext,
): Promise<string> {
  const fallback =
    account.plan === "premium"
      ? "Welcome to Terabits Managed. I'll learn how you invest so your AI team can manage your portfolio."
      : account.plan === "pro"
        ? "Welcome to Terabits Terminal. I'll tailor signals and analytics to how you trade."
        : account.isOnFreeTrial
          ? `Welcome to Terabits. You have ${account.credits.balance.toLocaleString()} free trial credits — let me learn how you want to use AI for markets.`
          : "Welcome to Terabits. I'll ask a few quick questions so your AI advisor understands how you trade and invest.";

  if (!isGeminiRuntimeConfigured()) return fallback;

  try {
    const txt = await callOnboardingLlm(
      account,
      `Write a warm welcome message (2-3 sentences max) for the setup screen. 
Do NOT ask a question yet — just greet them and explain you'll personalize Terabits to them.
Respond with plain text only, no JSON.`,
      0.7,
    );
    return txt.trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function generateProfileQuestionPayload(opts: {
  profile: OnboardProfileDraft;
  transcript: Array<{ role: "user" | "assistant"; content: string }>;
  answeredCount: number;
  account: OnboardAccountContext;
}): Promise<ProfileQuestionPayload> {
  const { profile, transcript, answeredCount, account } = opts;
  const missing = missingApplicableFields(profile, account.plan);

  if (missing.length === 0) {
    return {
      say: "Wonderful — your Terabits profile is ready.",
      field: null,
      options: [{ id: "continue", label: "Continue" }],
      values: {},
      done: true,
    };
  }

  if (answeredCount >= 5) {
    return {
      say: "Thanks — we've covered what we need. Let's move on.",
      field: null,
      options: [{ id: "continue", label: "Continue" }],
      values: {},
      done: true,
    };
  }

  if (!isGeminiRuntimeConfigured()) {
    const field = missing[0];
    return buildFallbackQuestionForField(field, account.plan);
  }

  const userPrompt = `Generate the NEXT onboarding question as JSON.

Question number: ${answeredCount + 1} of up to 5.
Fields still to collect (pick exactly ONE): ${JSON.stringify(missing)}

Current profile draft:
${JSON.stringify(profile)}

Conversation transcript:
${transcript
  .slice(-12)
  .map((m) => `${m.role}: ${m.content}`)
  .join("\n") || "(none yet)"}

JSON schema:
{"say": string, "field": string, "options": [{"id": string, "label": string}], "values": object, "done": false, "multiSelect": boolean?}

Pick the most natural next field from the missing list. Write "say" as a conversational question tailored to this user's plan and prior answers.`;

  for (const temperature of [0.65, 0.4]) {
    try {
      const txt = await callOnboardingLlm(account, userPrompt, temperature);
      const parsed = JSON.parse(stripJsonFence(txt || "{}"));
      const validated = llmShape.safeParse(parsed);
      if (validated.success) {
        return normalizeLlmPayload(validated.data, profile, missing, account);
      }
    } catch {
      /* retry */
    }
  }

  return buildFallbackQuestionForField(missing[0], account.plan);
}
