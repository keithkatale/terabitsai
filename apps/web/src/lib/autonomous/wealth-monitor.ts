import { randomUUID } from "crypto";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import { fetchAccountState } from "@/lib/chat/tools/account-state-tool";
import {
  getActiveConversationAdmin,
  loadConversationMessagesAdmin,
  type TradingMode,
} from "@/lib/chat/conversation-persistence";
import { evaluateBalanceGoal } from "@/lib/goals/goal-evaluator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAgentActivity } from "./activity-log";
import type { MonitorAnalysis, MonitorReview } from "./types";
import { toExtendedGoal } from "./decide-next-action";
import { runProactiveChatTurn } from "@/lib/chat/proactive-turn";
import { buildOrchestratorKnowledgeContext } from "@/lib/knowledge/knowledge-loader";
import {
  buildDefaultGoalProfile,
  getGoalProfileMd,
  saveGoalProfileMd,
  scheduleNextWake,
} from "./goal-profile";
import { AUTONOMOUS_CYCLE_INTERVAL_MS } from "./cycle-config";
import {
  executeAutonomousSkills,
  formatSkillResultsForDirective,
  shouldAllowNewTrades,
} from "@/lib/skills/monitor-integration";

function parseJsonBlock<T>(raw: string): T | null {
  const match = raw.trim().match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

function summarizeMessages(
  messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>,
) {
  return messages
    .slice(-8)
    .map((m) => {
      const text = m.parts
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join(" ")
        .slice(0, 500);
      return `${m.role}: ${text}`;
    })
    .join("\n");
}

async function runMonitorAnalysis(params: {
  goalRow: Record<string, unknown>;
  currentProfile: string;
  accountSnapshot: string;
  conversationSummary: string;
  knowledgeContext: string;
  skillAnalysis?: string;
  tradeAllowance?: { allowed: boolean; reason: string };
  goalProgress: {
    progressPct: number;
    status: string;
    currentBalance: number;
    targetBalance: number;
  };
}): Promise<MonitorAnalysis> {
  const goal = toExtendedGoal(params.goalRow);

  const systemInstruction = `You are the Wealth Monitor — the supervisory AI that manages the user's goal profile (goal.md) and directs the Command chat agent to help them reach their balance target.

Respond with ONLY valid JSON:
{
  "reasoning": "detailed chain-of-thought analysis (3-6 sentences) shown in monitor panel",
  "summary": "one-line status for UI",
  "goalProfileMd": "full updated goal.md markdown document",
  "chatDirective": "concrete instructions for Command AI — what to analyze, report, or execute",
  "nextWakeMs": 120000
}

Rules:
- goalProfileMd must be complete markdown — update progress, open positions, last actions, next planned steps.
- chatDirective must ALWAYS be actionable — Command AI executes without asking permission. Instruct it to use broker_action (get_quote then place_order) to trade, or close_position to exit.
- Use knowledge context to pick strategies, patterns, and risk rules aligned with the goal.
- nextWakeMs: 120000=2min default, 30000-300000 after trade placed, 1800000=30min when waiting on position.`;

  const userPrompt = `## goal.md (living goal profile — update this)
${params.currentProfile}

## Account snapshot
${params.accountSnapshot}

## Goal
- Current balance: $${params.goalProgress.currentBalance.toFixed(2)}
- Target: $${params.goalProgress.targetBalance.toFixed(2)}
- Progress: ${params.goalProgress.progressPct.toFixed(1)}%
- Status: ${params.goalProgress.status}
- Mode: ${goal.mode}
- Max risk/trade: ${goal.max_risk_per_trade}%

${params.skillAnalysis || ""}

${params.tradeAllowance ? `## Trade Allowance
${params.tradeAllowance.allowed ? "✓ New trades allowed — risk parameters within limits" : `⚠️ ${params.tradeAllowance.reason}`}` : ""}

## Recent Command chat
${params.conversationSummary || "(no conversation yet)"}

## Trading knowledge
${params.knowledgeContext || "N/A"}

Analyze the full state. Update goal.md. Write a directive for Command AI to take the next best action toward the target balance.`;

  try {
    const raw = await generateVertexTextCompletion({
      systemInstruction,
      userPrompt,
      temperature: 0.2,
      maxTokens: 4096,
    });
    const parsed = parseJsonBlock<MonitorAnalysis>(raw);
    if (parsed?.goalProfileMd && parsed.chatDirective) {
      return {
        reasoning: String(parsed.reasoning ?? parsed.summary ?? ""),
        summary: String(parsed.summary ?? ""),
        goalProfileMd: parsed.goalProfileMd,
        chatDirective: parsed.chatDirective,
        shouldDispatchChat: true,
        nextWakeMs: Number(parsed.nextWakeMs) || AUTONOMOUS_CYCLE_INTERVAL_MS,
      };
    }
  } catch {
    /* fallback below */
  }

  const fallbackDirective = `Report current account balance, open positions, and progress toward the $${params.goalProgress.targetBalance.toFixed(2)} target. Scan for one high-conviction opportunity aligned with the goal and execute or queue it if risk limits allow.`;

  return {
    reasoning: `Account at $${params.goalProgress.currentBalance.toFixed(2)} (${params.goalProgress.progressPct.toFixed(1)}% toward target). Reviewing positions and market context to determine next action.`,
    summary: `Monitoring — ${params.goalProgress.progressPct.toFixed(1)}% toward goal`,
    goalProfileMd: params.currentProfile,
    chatDirective: fallbackDirective,
    shouldDispatchChat: true,
    nextWakeMs: AUTONOMOUS_CYCLE_INTERVAL_MS,
  };
}

async function runMonitorReview(params: {
  currentProfile: string;
  chatOutput: string;
  chatDirective: string;
}): Promise<MonitorReview> {
  const systemInstruction = `You are the Wealth Monitor reviewing Command AI output after it executed your directive.

Respond with ONLY valid JSON:
{
  "reasoning": "analysis of whether the task is complete (shown in monitor panel)",
  "taskComplete": true,
  "followUpDirective": null,
  "nextWakeMs": 120000,
  "goalProfilePatch": null
}

Rules:
- taskComplete=false + followUpDirective when Command AI didn't finish (trade pending, needs follow-up).
- If a trade was placed, set nextWakeMs to 30000-300000 (30s-5min).
- If waiting on user confirmation, nextWakeMs=60000 and taskComplete=true.
- goalProfilePatch: optional markdown to append to goal.md if progress changed.`;

  const userPrompt = `## goal.md
${params.currentProfile}

## Your directive to Command
${params.chatDirective}

## Command AI output
${params.chatOutput}

Did Command complete the directive? Schedule next wake appropriately.`;

  try {
    const raw = await generateVertexTextCompletion({
      systemInstruction,
      userPrompt,
      temperature: 0.15,
      maxTokens: 2048,
    });
    const parsed = parseJsonBlock<MonitorReview>(raw);
    if (parsed) {
      return {
        reasoning: String(parsed.reasoning ?? ""),
        taskComplete: Boolean(parsed.taskComplete ?? true),
        followUpDirective: parsed.followUpDirective ?? null,
        nextWakeMs: Number(parsed.nextWakeMs) || AUTONOMOUS_CYCLE_INTERVAL_MS,
        goalProfilePatch: parsed.goalProfilePatch ?? null,
      };
    }
  } catch {
    /* fallback */
  }

  return {
    reasoning: "Command AI responded. Scheduling next monitor wake.",
    taskComplete: true,
    followUpDirective: null,
    nextWakeMs: AUTONOMOUS_CYCLE_INTERVAL_MS,
    goalProfilePatch: null,
  };
}

/**
 * Wealth Monitor cycle: timer fires → analyze goal.md + account + chat →
 * direct Command AI → review → schedule next wake.
 */
export async function runWealthMonitorCycle(params: {
  goalRow: Record<string, unknown>;
  cycleId?: string;
}) {
  const goal = toExtendedGoal(params.goalRow);
  const cycleId = params.cycleId ?? randomUUID();
  const mode = goal.mode as TradingMode;
  const admin = createSupabaseAdminClient();

  await logAgentActivity({
    userId: goal.user_id,
    goalId: goal.id,
    cycleId,
    phase: "monitor",
    action: "cycle_start",
    reasoning: "Wealth Monitor cycle started",
  });

  await logAgentActivity({
    userId: goal.user_id,
    goalId: goal.id,
    cycleId,
    phase: "monitor",
    action: "monitor_analyze",
    reasoning: "Analyzing goal.md, account snapshot, and Command conversation…",
    payload: { stage: "start" },
  });

  const [accountState, goalProgress, recentActivity, pendingTrades] = await Promise.all([
    fetchAccountState(goal.user_id, mode, {
      include_positions: true,
      include_performance: true,
    }),
    evaluateBalanceGoal(goal),
    admin
      .from("agent_activity")
      .select("action, phase, symbol, reasoning, created_at")
      .eq("user_id", goal.user_id)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("ai_trade_log")
      .select("id, symbol, direction, status, size")
      .eq("user_id", goal.user_id)
      .eq("mode", mode)
      .eq("status", "pending")
      .limit(5),
  ]);

  let existingProfile = await getGoalProfileMd(goal.id);
  if (!existingProfile) {
    existingProfile = buildDefaultGoalProfile({
      goal,
      currentBalance: goalProgress.currentBalance,
      progressPct: goalProgress.progressPct,
      status: goalProgress.status,
    });
  }

  let conversation = await getActiveConversationAdmin(goal.user_id, mode);
  if (!conversation) {
    const { data: latest } = await admin
      .from("conversations")
      .select("session_number")
      .eq("user_id", goal.user_id)
      .eq("mode", mode)
      .order("session_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sessionNumber = (latest?.session_number ?? 0) + 1;
    await admin
      .from("conversations")
      .update({ is_active: false })
      .eq("user_id", goal.user_id)
      .eq("mode", mode)
      .eq("is_active", true);
    const { data: created } = await admin
      .from("conversations")
      .insert({
        user_id: goal.user_id,
        mode,
        session_number: sessionNumber,
        is_active: true,
        title: `Session ${sessionNumber}`,
      })
      .select("id, session_number, mode, title, context_summary, is_active, created_at, updated_at")
      .single();
    conversation = created as typeof conversation;
  }

  const convMessages = conversation
    ? await loadConversationMessagesAdmin(conversation.id, goal.user_id)
    : [];

  let knowledgeContext = "";
  try {
    const hasPositions = (accountState.positions?.length ?? 0) > 0;
    knowledgeContext = await buildOrchestratorKnowledgeContext(
      hasPositions ? "trending" : "ranging",
    );
  } catch {
    knowledgeContext = "";
  }

  const targetBalance = goal.target_balance ?? Number(goal.goal_value?.target ?? 0);

  const accountSnapshot = JSON.stringify(
    {
      balance: accountState.balance,
      positions: accountState.positions,
      performance: accountState.performance,
      pendingTrades: pendingTrades.data,
      recentAgentActivity: recentActivity.data?.slice(0, 4),
    },
    null,
    2,
  );

  // Execute autonomous skills for this cycle
  await logAgentActivity({
    userId: goal.user_id,
    goalId: goal.id,
    cycleId,
    phase: "monitor",
    action: "skills_execute",
    reasoning: "Executing autonomous trading skills",
  });

  let skillResults: Record<string, any> = {};
  let skillAnalysis = "";
  let tradeAllowance = { allowed: true, reason: "No skills executed" };

  try {
    skillResults = await executeAutonomousSkills({
      userId: goal.user_id,
      goalId: goal.id,
      mode,
      cycleId,
      accountBalance: goalProgress.currentBalance,
    });

    skillAnalysis = formatSkillResultsForDirective(skillResults);
    tradeAllowance = shouldAllowNewTrades(skillResults);

    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId,
      phase: "monitor",
      action: "skills_complete",
      reasoning: `Skills executed. Trade allowance: ${tradeAllowance.allowed ? "allowed" : tradeAllowance.reason}`,
      payload: {
        skillResults: Object.keys(skillResults),
        tradeAllowed: tradeAllowance.allowed,
        tradeReason: tradeAllowance.reason,
      },
    });
  } catch (error) {
    console.error("[Monitor] Skill execution failed:", error);
    skillAnalysis = "## Skill Analysis\n\n⚠️ Skills execution failed. Proceeding with basic analysis.";
    
    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId,
      phase: "monitor",
      action: "skills_error",
      reasoning: `Skill execution error: ${error}`,
    });
  }

  const analysis = await runMonitorAnalysis({
    goalRow: params.goalRow,
    currentProfile: existingProfile,
    accountSnapshot,
    conversationSummary: summarizeMessages(convMessages ?? []),
    knowledgeContext,
    skillAnalysis,
    tradeAllowance,
    goalProgress: {
      progressPct: goalProgress.progressPct,
      status: goalProgress.status,
      currentBalance: goalProgress.currentBalance,
      targetBalance,
    },
  });

  await saveGoalProfileMd(goal.id, analysis.goalProfileMd);

  await logAgentActivity({
    userId: goal.user_id,
    goalId: goal.id,
    cycleId,
    phase: "monitor",
    action: "monitor_goal_update",
    reasoning: analysis.summary,
    payload: {
      reasoning: analysis.reasoning,
      summary: analysis.summary,
      goalProfileMd: analysis.goalProfileMd,
      nextWakeMs: analysis.nextWakeMs,
    },
  });

  let chatResult: { messageId: string; text: string } | undefined;
  let finalWakeMs = analysis.nextWakeMs;

  if (!conversation) {
    throw new Error("Failed to resolve Command conversation for monitor directive");
  }

  await logAgentActivity({
    userId: goal.user_id,
    goalId: goal.id,
    cycleId,
    phase: "monitor",
    action: "monitor_directive",
    reasoning: analysis.reasoning || analysis.summary,
    payload: {
      reasoning: analysis.reasoning,
      summary: analysis.summary,
      chatDirective: analysis.chatDirective,
    },
  });

  chatResult = await runProactiveChatTurn({
    userId: goal.user_id,
    mode,
    conversationId: conversation.id,
    directive: analysis.chatDirective,
    cycleId,
    narration: analysis.summary,
    persistToConversation: false,
  });

  const review = await runMonitorReview({
    currentProfile: analysis.goalProfileMd,
    chatOutput: chatResult.text,
    chatDirective: analysis.chatDirective,
  });

  await logAgentActivity({
    userId: goal.user_id,
    goalId: goal.id,
    cycleId,
    phase: "monitor",
    action: "monitor_review",
    reasoning: review.reasoning,
    payload: {
      reasoning: review.reasoning,
      taskComplete: review.taskComplete,
      chatMessageId: chatResult.messageId,
      chatOutput: chatResult.text.slice(0, 500),
      nextWakeMs: review.nextWakeMs,
      followUpDirective: review.followUpDirective,
    },
  });

  finalWakeMs = review.nextWakeMs;

  if (review.goalProfilePatch) {
    const merged = `${analysis.goalProfileMd}\n\n${review.goalProfilePatch}`;
    await saveGoalProfileMd(goal.id, merged);
  }

  if (!review.taskComplete && review.followUpDirective) {
    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId,
      phase: "monitor",
      action: "monitor_followup",
      reasoning: review.followUpDirective.slice(0, 200),
      payload: {
        reasoning: review.followUpDirective,
        followUpDirective: review.followUpDirective,
      },
    });

    const followUp = await runProactiveChatTurn({
      userId: goal.user_id,
      mode,
      conversationId: conversation.id,
      directive: review.followUpDirective,
      cycleId,
      narration: "Monitor follow-up — complete the prior directive.",
      persistToConversation: false,
    });

    chatResult = followUp;

    const followReview = await runMonitorReview({
      currentProfile: analysis.goalProfileMd,
      chatOutput: followUp.text,
      chatDirective: review.followUpDirective,
    });

    finalWakeMs = followReview.nextWakeMs;

    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId,
      phase: "monitor",
      action: "monitor_review",
      reasoning: followReview.reasoning,
      payload: {
        followUp: true,
        reasoning: followReview.reasoning,
        taskComplete: followReview.taskComplete,
        chatOutput: followUp.text.slice(0, 500),
      },
    });
  }

  const wakeAt = new Date(Date.now() + Math.max(15_000, finalWakeMs));
  await scheduleNextWake(goal.id, wakeAt);

  await logAgentActivity({
    userId: goal.user_id,
    goalId: goal.id,
    cycleId,
    phase: "monitor",
    action: "cycle_end",
    reasoning: `Cycle complete. Next wake in ${Math.round(finalWakeMs / 1000)}s`,
    payload: {
      nextWakeAt: wakeAt.toISOString(),
      nextWakeMs: finalWakeMs,
      spoke: true,
    },
  });

  return {
    cycleId,
    analysis,
    chatResult,
    nextWakeAt: wakeAt.toISOString(),
  };
}

/** @deprecated Use runWealthMonitorCycle */
export const runOrchestratorTurn = runWealthMonitorCycle;
