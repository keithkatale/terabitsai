"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AssistantSiriOrb } from "@/components/ai-elements/agent-orb";
import { cn } from "@/lib/utils";
import type { OnboardProfileDraft, ProfileFieldKey } from "@/lib/onboard/profile-types";
import type { ProfileQuestionPayload } from "@/lib/onboard/profile-question-fallback";
import { LandingPixelBackground } from "@/components/landing/landing-pixel-background";
import { LandingBlueGlow } from "@/components/landing/landing-blue-glow";

type TranscriptLine = { role: "user" | "assistant"; content: string };

function TypewriterText({
  text,
  speed = 12,
  onComplete,
}: {
  text: string;
  speed?: number;
  onComplete?: () => void;
}) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <span onClick={() => { setDisplayed(text); onComplete?.(); }} className="cursor-pointer">
      {displayed}
    </span>
  );
}

export function SetupQuestionnaire() {
  const router = useRouter();
  const [profile, setProfile] = useState<OnboardProfileDraft>({});
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [payload, setPayload] = useState<ProfileQuestionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [questionDone, setQuestionDone] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const welcomeText =
    "Welcome to Terabits. I'll ask a few quick questions so your AI advisor understands how you trade and invest.";

  const fetchNext = useCallback(
    async (answer?: {
      field: ProfileFieldKey;
      label: string;
      value: string | number | string[];
    }) => {
      setLoading(true);
      setError(null);
      setQuestionDone(false);
      setSelected([]);

      const res = await fetch("/api/onboard/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, transcript, answeredCount, answer }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }

      setProfile(data.profile);
      setTranscript(data.transcript);
      setAnsweredCount(data.answeredCount);
      setPayload(data.payload);
      setLoading(false);
    },
    [profile, transcript, answeredCount],
  );

  useEffect(() => {
    if (!showWelcome && welcomeDone && !payload) {
      void fetchNext();
    }
  }, [showWelcome, welcomeDone, payload, fetchNext]);

  const handleOption = async (optionId: string) => {
    if (!payload?.field || loading || submitting) return;

    if (payload.multiSelect) {
      setSelected((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
      );
      return;
    }

    const label = payload.options.find((o) => o.id === optionId)?.label ?? optionId;
    const value = payload.values[optionId] ?? optionId;
    await fetchNext({ field: payload.field, label, value });
  };

  const handleMultiSubmit = async () => {
    if (!payload?.field || selected.length === 0) return;
    const labels = selected
      .map((id) => payload.options.find((o) => o.id === id)?.label ?? id)
      .join(", ");
    const markets = selected.flatMap((id) => {
      const v = payload.values[id];
      return Array.isArray(v) ? v : [String(v)];
    });
    await fetchNext({
      field: payload.field,
      label: labels,
      value: [...new Set(markets)],
    });
  };

  const handleComplete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save profile");
      router.replace("/app/chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete setup");
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-[#050508]">
      <LandingPixelBackground />
      <LandingBlueGlow />

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <AssistantSiriOrb active={loading || submitting} sizePx={32} />
          <div>
            <h1 className="text-lg font-bold text-white">Account setup</h1>
            <p className="text-xs text-zinc-500">
              {showWelcome ? "Getting started" : `Step ${Math.min(answeredCount + 1, 5)} of ~5`}
            </p>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {showWelcome ? (
          <div className="flex flex-1 flex-col justify-center">
            <p className="mb-8 text-xl leading-relaxed text-zinc-200">
              <TypewriterText
                text={welcomeText}
                onComplete={() => setWelcomeDone(true)}
              />
            </p>
            {welcomeDone ? (
              <button
                type="button"
                onClick={() => setShowWelcome(false)}
                className="self-start rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-cyan-400"
              >
                Let's go
              </button>
            ) : null}
          </div>
        ) : payload?.done ? (
          <div className="flex flex-1 flex-col justify-center gap-6">
            <p className="text-lg leading-relaxed text-zinc-200">{payload.say}</p>
            <p className="text-sm text-zinc-500">
              Your free trial includes <span className="font-semibold text-cyan-400">3,000 Terabits credits</span> for AI chat and analysis.
            </p>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleComplete()}
              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-cyan-400 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Enter Terabits
            </button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-6">
            {payload ? (
              <p className="text-lg leading-relaxed text-zinc-200">
                {questionDone ? (
                  payload.say
                ) : (
                  <TypewriterText text={payload.say} onComplete={() => setQuestionDone(true)} />
                )}
              </p>
            ) : loading ? (
              <div className="flex items-center gap-2 text-zinc-500">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Preparing next question…</span>
              </div>
            ) : null}

            {questionDone && payload && !payload.done ? (
              <div className="flex flex-col gap-2">
                {payload.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={loading}
                    onClick={() => void handleOption(opt.id)}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                      payload.multiSelect && selected.includes(opt.id)
                        ? "border-cyan-500/50 bg-cyan-950/40 text-white"
                        : "border-white/10 bg-white/[0.03] text-zinc-200 hover:border-cyan-500/30 hover:bg-white/[0.06]",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
                {payload.multiSelect ? (
                  <button
                    type="button"
                    disabled={selected.length === 0 || loading}
                    onClick={() => void handleMultiSubmit()}
                    className="mt-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-40"
                  >
                    Continue
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
