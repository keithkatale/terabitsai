"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { chatDraftPath } from "@/lib/routes";
import { Loader2 } from "lucide-react";
import { AssistantSiriOrb } from "@/components/ai-elements/agent-orb";
import { cn } from "@/lib/utils";
import type { OnboardProfileDraft, ProfileFieldKey } from "@/lib/onboard/profile-types";
import type { ProfileQuestionPayload } from "@/lib/onboard/profile-question-fallback";
import { AnalyticsEvents, captureEvent } from "@/lib/posthog/analytics";

type TranscriptLine = { role: "user" | "assistant"; content: string };

type CompletedTurn = {
  question: string;
  answer: string;
};

type SetupPhase =
  | "welcome"
  | "loading-first"
  | "question"
  | "loading-next"
  | "complete";

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

function CompletedTurnCard({ turn }: { turn: CompletedTurn }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-sm leading-relaxed text-zinc-400">{turn.question}</p>
      <p className="mt-2 text-sm font-medium text-cyan-300/90">{turn.answer}</p>
    </div>
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
  const requestIdRef = useRef(0);

  const [profile, setProfile] = useState<OnboardProfileDraft>({});
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [activePayload, setActivePayload] = useState<ProfileQuestionPayload | null>(null);
  const [completedTurns, setCompletedTurns] = useState<CompletedTurn[]>([]);
  const [phase, setPhase] = useState<SetupPhase>("welcome");
  const [contextLoading, setContextLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [questionReady, setQuestionReady] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [welcomeText, setWelcomeText] = useState(
    "Welcome to Terabits. I'll ask a few quick questions so your AI advisor understands how you trade and invest.",
  );

  const isLoadingQuestion = phase === "loading-first" || phase === "loading-next";
  const loadingLabel =
    phase === "loading-first" ? "Preparing the first question…" : "Preparing next question…";

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
      const requestId = ++requestIdRef.current;
      const previousPayload = activePayload;

      setError(null);
      setSelected([]);
      setQuestionReady(false);
      setActivePayload(null);
      setPhase(answer ? "loading-next" : "loading-first");

      if (answer && previousPayload) {
        setCompletedTurns((prev) => [
          ...prev,
          { question: previousPayload.say, answer: answer.label },
        ]);
      }

      try {
        const res = await fetch("/api/onboard/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, transcript, answeredCount, answer }),
        });
        const data = await res.json();

        if (requestId !== requestIdRef.current) return;

        if (!res.ok) {
          if (answer) {
            setCompletedTurns((prev) => prev.slice(0, -1));
          }
          setActivePayload(previousPayload);
          setPhase(previousPayload ? "question" : "loading-first");
          setQuestionReady(Boolean(previousPayload));
          setError(data.error ?? "Something went wrong");
          return;
        }

        setProfile(data.profile);
        setTranscript(data.transcript);
        setAnsweredCount(data.answeredCount);
        setActivePayload(data.payload);
        if (data.account) setAccount(data.account);
        setPhase(data.payload?.done ? "complete" : "question");
      } catch {
        if (requestId !== requestIdRef.current) return;
        if (answer) {
          setCompletedTurns((prev) => prev.slice(0, -1));
        }
        setActivePayload(previousPayload);
        setPhase(previousPayload ? "question" : "loading-first");
        setQuestionReady(Boolean(previousPayload));
        setError("Something went wrong. Please try again.");
      }
    },
    [profile, transcript, answeredCount, activePayload],
  );

  const startQuestionnaire = useCallback(() => {
    setPhase("loading-first");
    void fetchNext();
  }, [fetchNext]);

  const handleSelectOption = (optionId: string) => {
    if (!activePayload?.field || isLoadingQuestion || submitting || !questionReady) return;

    if (activePayload.multiSelect) {
      setSelected((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
      );
      return;
    }

    setSelected([optionId]);
  };

  const handleNext = async () => {
    if (!activePayload?.field || selected.length === 0 || isLoadingQuestion || submitting) return;

    if (activePayload.multiSelect) {
      const labels = selected
        .map((id) => activePayload.options.find((o) => o.id === id)?.label ?? id)
        .join(", ");
      const markets = selected.flatMap((id) => {
        const v = activePayload.values[id];
        return Array.isArray(v) ? v : [String(v)];
      });
      await fetchNext({
        field: activePayload.field,
        label: labels,
        value: [...new Set(markets)],
      });
      return;
    }

    const optionId = selected[0];
    const label = activePayload.options.find((o) => o.id === optionId)?.label ?? optionId;
    const value = activePayload.values[optionId] ?? optionId;
    await fetchNext({ field: activePayload.field, label, value });
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
      captureEvent(AnalyticsEvents.ONBOARDING_COMPLETED);
      router.replace(chatDraftPath());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete setup");
      setSubmitting(false);
    }
  };

  const hasSelection = selected.length > 0;
  const currentStep = Math.min(completedTurns.length + 1, 5);

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-[#050508]">
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <AssistantSiriOrb
            active={isLoadingQuestion || submitting || contextLoading}
            sizePx={32}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-white">Account setup</h1>
            <p className="text-xs text-zinc-500">
              {phase === "welcome"
                ? "Getting started"
                : phase === "complete"
                  ? "All set"
                  : `Step ${currentStep} of ~5`}
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

        {phase === "welcome" ? (
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
              <SetupPrimaryButton onClick={startQuestionnaire} className="self-start">
                Let&apos;s go
              </SetupPrimaryButton>
            ) : null}
          </div>
        ) : phase === "complete" && activePayload?.done ? (
          <div className="flex flex-1 flex-col justify-center gap-6">
            {completedTurns.length > 0 ? (
              <div className="mb-2 flex max-h-48 flex-col gap-2 overflow-y-auto">
                {completedTurns.map((turn, index) => (
                  <CompletedTurnCard key={`${turn.question}-${index}`} turn={turn} />
                ))}
              </div>
            ) : null}
            <p className="text-lg leading-relaxed text-zinc-200">{activePayload.say}</p>
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
                  Your{" "}
                  <span className="font-semibold text-zinc-200">
                    {account?.planLabel ?? "plan"}
                  </span>{" "}
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
            {completedTurns.length > 0 ? (
              <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                {completedTurns.map((turn, index) => (
                  <CompletedTurnCard key={`${turn.question}-${index}`} turn={turn} />
                ))}
              </div>
            ) : null}

            {isLoadingQuestion ? (
              <div className="flex flex-1 flex-col justify-center">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="text-sm">{loadingLabel}</span>
                </div>
              </div>
            ) : activePayload ? (
              <>
                <p className="text-lg leading-relaxed text-zinc-200">
                  {questionReady ? (
                    activePayload.say
                  ) : (
                    <TypewriterText
                      text={activePayload.say}
                      onComplete={() => setQuestionReady(true)}
                    />
                  )}
                </p>

                {questionReady && !activePayload.done ? (
                  <div className="flex flex-col gap-2.5">
                    {activePayload.options.map((opt) => (
                      <SetupOptionButton
                        key={opt.id}
                        label={opt.label}
                        selected={selected.includes(opt.id)}
                        disabled={isLoadingQuestion}
                        onClick={() => handleSelectOption(opt.id)}
                      />
                    ))}

                    {hasSelection ? (
                      <SetupPrimaryButton
                        disabled={isLoadingQuestion}
                        onClick={() => void handleNext()}
                        className="mt-2 w-full"
                      >
                        Next
                      </SetupPrimaryButton>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
