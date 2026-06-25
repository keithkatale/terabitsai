import type { ActivityStep } from "@/lib/chat/activity-timeline";
import type { ChatToolPod } from "@/lib/chat/stream-types";

export const LIVE_TRACE_WORKING = "Working";
export const LIVE_TRACE_PLANNING = "Planning next moves";

const MAX_LABEL = 56;
const MAX_WORDS = 7;

function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function cleanThoughtFragment(text: string): string {
  return text
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Compress model thought into a short scannable phrase — only from real streamed text. */
export function shortenLivePhrase(text: string): string | null {
  const cleaned = cleanThoughtFragment(text.replace(/\*\*/g, ""));
  if (!cleaned || cleaned.length < 3) return null;

  const lines = text
    .split(/\n/)
    .map((l) => cleanThoughtFragment(l.replace(/\*\*/g, "")))
    .filter((l) => l.length > 2);

  const tail = lines[lines.length - 1] ?? cleaned;
  const clause = tail.split(/[.!?]/).filter(Boolean).pop()?.trim() ?? tail;
  const words = clause.split(/\s+/).filter(Boolean);

  let phrase = words.length > MAX_WORDS ? words.slice(-MAX_WORDS).join(" ") : clause;
  phrase = phrase.replace(/[,;:]+$/g, "").trim();
  if (phrase.length > MAX_LABEL) phrase = `${phrase.slice(0, MAX_LABEL - 1)}…`;
  if (phrase.length < 3) return null;

  return titleCase(phrase);
}

function phraseFromReasoningSteps(steps: ActivityStep[]): string | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.type === "update") {
      const phrase = shortenLivePhrase(step.text);
      if (phrase) return phrase;
      if (step.text.length <= MAX_LABEL) return step.text;
    }
    if (step.type === "reasoning") {
      const phrase = shortenLivePhrase(step.text);
      if (phrase) return phrase;
    }
  }
  return null;
}

/** Live trace from the activity timeline — model reasoning only, else generic idle copy. */
export function deriveLiveTraceFromSteps(
  steps: ActivityStep[],
  fallback = LIVE_TRACE_PLANNING,
): string {
  const fromThought = phraseFromReasoningSteps(steps);
  if (fromThought) return fromThought;

  if (steps.length === 0) return fallback;

  const last = steps[steps.length - 1];
  if (last.type === "reasoning" && last.status === "streaming") {
    return LIVE_TRACE_PLANNING;
  }
  if (last.type === "tool" && last.status === "running") {
    return LIVE_TRACE_WORKING;
  }

  return fallback;
}

export function deriveLiveTraceLabel(
  reasoning: string,
  _toolPods: ChatToolPod[] = [],
  fallback = LIVE_TRACE_PLANNING,
): string {
  const fromThought = shortenLivePhrase(reasoning);
  if (fromThought) return fromThought;
  return fallback;
}

export function mergeLiveTrace(
  current: string | undefined,
  reasoning: string,
  toolPods: ChatToolPod[],
): string {
  const fromThought = shortenLivePhrase(reasoning);
  if (fromThought) return fromThought;
  if (current?.trim()) return current.trim();
  const running = toolPods.some((p) => p.status === "running");
  return running ? LIVE_TRACE_WORKING : LIVE_TRACE_PLANNING;
}

export function subAgentWidgetTrace(agent: {
  liveTrace?: string;
  assignmentLabel?: string;
  status: string;
}): string {
  const assignment = agent.assignmentLabel?.trim();

  const fromLive = agent.liveTrace?.trim();
  if (fromLive) {
    const shortened = shortenLivePhrase(fromLive);
    if (shortened) return shortened;
    if (fromLive.length <= MAX_LABEL && fromLive.split(/\s+/).length <= MAX_WORDS) {
      return fromLive;
    }
  }

  if (assignment) return assignment;

  if (agent.status === "running") return LIVE_TRACE_PLANNING;
  if (agent.status === "failed") return "Could not complete";
  return "Finished";
}
