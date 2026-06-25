import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateProfileQuestionPayload } from "@/lib/onboard/generate-profile-question";
import { buildOnboardAccountContext, toClientAccountSnapshot } from "@/lib/onboard/onboard-account-context";
import {
  applyProfileAnswer,
  fillProfileDefaults,
  missingApplicableFields,
  onboardProfileSchema,
  PROFILE_FIELD_KEYS,
} from "@/lib/onboard/profile-types";

const transcriptSchema = z.array(
  z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  }),
);

const bodySchema = z.object({
  profile: onboardProfileSchema.partial().default({}),
  transcript: transcriptSchema.default([]),
  answeredCount: z.number().int().min(0).max(6).default(0),
  answer: z
    .object({
      field: z.enum(PROFILE_FIELD_KEYS),
      label: z.string(),
      value: z.union([z.string(), z.number(), z.array(z.string())]),
    })
    .optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await buildOnboardAccountContext(user.id);

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  let profile = { ...parsed.profile };
  let transcript = [...parsed.transcript];
  let answeredCount = parsed.answeredCount;

  if (parsed.answer) {
    const raw =
      Array.isArray(parsed.answer.value)
        ? parsed.answer.value.join(",")
        : parsed.answer.value;
    profile = applyProfileAnswer(profile, parsed.answer.field, raw);
    transcript.push({ role: "user", content: parsed.answer.label });
    answeredCount += 1;
  }

  if (answeredCount >= 5 && missingApplicableFields(profile, account.plan).length > 0) {
    profile = fillProfileDefaults(profile, account.plan);
  }

  const missing = missingApplicableFields(profile, account.plan);

  if (missing.length === 0 || answeredCount >= 5) {
    const say =
      missing.length === 0
        ? "Perfect — your Terabits profile is ready. Tap continue to start."
        : "Great — we've gathered enough. Tap continue.";
    const payload = {
      say,
      field: null as null,
      options: [{ id: "continue", label: "Continue" }],
      values: {} as Record<string, string | number>,
      done: true,
    };
    transcript.push({ role: "assistant", content: payload.say });
    return Response.json({
      payload,
      profile,
      transcript,
      answeredCount,
      missingFields: missingApplicableFields(profile, account.plan),
      account: toClientAccountSnapshot(account),
    });
  }

  const payload = await generateProfileQuestionPayload({
    profile,
    transcript,
    answeredCount,
    account,
  });

  transcript.push({ role: "assistant", content: payload.say });

  return Response.json({
    payload,
    profile,
    transcript,
    answeredCount,
    missingFields: missing,
    account: toClientAccountSnapshot(account),
  });
}
