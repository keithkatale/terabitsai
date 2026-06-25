"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { chatDraftPath } from "@/lib/routes";
import { Loader2 } from "lucide-react";
import { AssistantSiriOrb } from "@/components/ai-elements/agent-orb";
import { cn } from "@/lib/utils";
import type { OnboardProfileDraft, ProfileFieldKey } from "@/lib/onboard/profile-types";
import type { ProfileQuestionPayload } from "@/lib/onboard/profile-question-fallback";

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
    <span
      onClick={() => {
        setDisplayed(text);
        onComplete?.();
      }}
      className="cursor-pointer"
    >
      {displayed}
    </span>
  );
}

function SetupOptionButton({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border px-5 py-3.5 text-left text-sm transition-all duration-200",
        selected
          ? "border-white/25 bg-white/[0.08] text-white"
          : "border-white/10 bg-white/[0.02] text-zinc-200 hover:border-white/20 hover:bg-white/[0.04]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {label}
    </button>
  );
}

function SetupPrimaryButton({
  children,
  disabled,
  onClick,
  className,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "terminal-btn terminal-btn-primary px-6 py-3 text-sm",
        className,
      )}
    >
      {children}
    </button>
  );
}

type AccountSnapshot = {
  plan: string;
  planLabel: string;
  tradingMode: string;
  isOnFreeTrial: boolean;
  trialCreditsRemaining: number;
  trialCreditsTotal: number;
  isNewAccount: boolean;
  daysSinceSignup: number;
};

export function SetupQuestionnaire() {
  const router = useRouter();
  const [profile, setProfile] = useState<OnboardProfileDraft>({});
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [payload, setPayload] = useState<ProfileQuestionPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [questionDone, setQuestionDone] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [welcomeText, setWelcomeText] = useState(
    "Welcome to Terabits. I'll ask a few quick questions so your AI advisor understands how you trade and invest.",
  );

  const loadingLabel =
    answeredCount === 0 ? "Preparing the first question…" : "Preparing next question…";

  useEffect(() => {
    fetch("/api/onboard/context", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.account) setAccount(data.account);
        if (data.welcomeMessage) setWelcomeText(data.welcomeMessage);
      })
      .catch(() => {})
      .finally(() => setContextLoading(false));
  }, []);

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
      if (data.account) setAccount(data.account);
      setLoading(false);
    },
    [profile, transcript, answeredCount],
  );

  useEffect(() => {
    if (!showWelcome && welcomeDone && !payload) {
      void fetchNext();
    }
  }, [showWelcome, welcomeDone, payload, fetchNext]);

  const handleSelectOption = (optionId: string) => {
    if (!payload?.field || loading || submitting) return;

    if (payload.multiSelect) {
      setSelected((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
      );
      return;
    }

    setSelected([optionId]);
  };

  const handleNext = async () => {
    if (!payload?.field || selected.length === 0 || loading || submitting) return;

    if (payload.multiSelect) {
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
      return;
    }

    const optionId = selected[0];
    const label = payload.options.find((o) => o.id === optionId)?.label ?? optionId;
    const value = payload.values[optionId] ?? optionId;
    await fetchNext({ field: payload.field, label, value });
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
      router.replace(chatDraftPath());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete setup");
      setSubmitting(false);
    }
  };

  const hasSelection = selected.length > 0;

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-[#050508]">
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <AssistantSiriOrb active={loading || submitting || contextLoading} sizePx={32} />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-white">Account setup</h1>
            <p className="text-xs text-zinc-500">
              {showWelcome
                ? "Getting started"
                : `Step ${Math.min(answeredCount + 1, 5)} of ~5`}
            </p>
            {account ? (
              <p className="mt-1 truncate text-[10px] text-zinc-600">
                {account.planLabel}
                {account.isOnFreeTrial
                  ? ` · ${account.trialCreditsRemaining.toLocaleString()} trial credits`
                  : ""}
                {account.isNewAccount ? " · New account" : ""}
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {showWelcome ? (
          <div className="flex flex-1 flex-col justify-center">
            {contextLoading ? (
              <div className="mb-8 flex items-center gap-2 text-zinc-500">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Personalizing your setup…</span>
              </div>
            ) : (
              <p className="mb-8 text-xl leading-relaxed text-zinc-200">
                <TypewriterText text={welcomeText} onComplete={() => setWelcomeDone(true)} />
              </p>
            )}
            {welcomeDone && !contextLoading ? (
              <SetupPrimaryButton
                onClick={() => setShowWelcome(false)}
                className="self-start"
              >
                Let&apos;s go
              </SetupPrimaryButton>
            ) : null}
          </div>
        ) : payload?.done ? (
          <div className="flex flex-1 flex-col justify-center gap-6">
            <p className="text-lg leading-relaxed text-zinc-200">{payload.say}</p>
            <p className="text-sm text-zinc-500">
              {account?.isOnFreeTrial ? (
                <>
                  Your free trial includes{" "}
                  <span className="font-semibold text-zinc-200">
                    {account.trialCreditsRemaining.toLocaleString()} Terabits credits
                  </span>{" "}
                  for AI chat and analysis.
                </>
              ) : (
                <>
                  Your <span className="font-semibold text-zinc-200">{account?.planLabel ?? "plan"}</span>{" "}
                  profile is ready.
                </>
              )}
            </p>
            <SetupPrimaryButton
              disabled={submitting}
              onClick={() => void handleComplete()}
              className="inline-flex w-full items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Enter Terabits
            </SetupPrimaryButton>
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
                <span className="text-sm">{loadingLabel}</span>
              </div>
            ) : null}

            {questionDone && payload && !payload.done ? (
              <div className="flex flex-col gap-2.5">
                {payload.options.map((opt) => (
                  <SetupOptionButton
                    key={opt.id}
                    label={opt.label}
                    selected={selected.includes(opt.id)}
                    disabled={loading}
                    onClick={() => handleSelectOption(opt.id)}
                  />
                ))}

                {hasSelection ? (
                  <SetupPrimaryButton
                    disabled={loading}
                    onClick={() => void handleNext()}
                    className="mt-2 w-full"
                  >
                    Next
                  </SetupPrimaryButton>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
