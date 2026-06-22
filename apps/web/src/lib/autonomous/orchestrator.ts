import { randomUUID } from "crypto";
import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";
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
import type { DecisionOutcome, OrchestratorDirective } from "./types";
import { toExtendedGoal } from "./decide-next-action";
import { runProactiveChatTurn } from "@/lib/chat/proactive-turn";
import { buildOrchestratorKnowledgeContext } from "@/lib/knowledge/knowledge-loader";

function parseDirective(raw: string): OrchestratorDirective | null {
  const match = raw.trim().match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as OrchestratorDirective;
    if (typeof parsed.chatDirective !== "string") return null;
    return {
      summary: String(parsed.summary ?? ""),
      chatDirective: parsed.chatDirective,
      shouldSpeak: Boolean(parsed.shouldSpeak),
      subagentTasks: Array.isArray(parsed.subagentTasks) ? parsed.subagentTasks : [],
      priority: parsed.priority === "high" || parsed.priority === "low" ? parsed.priority : "normal",
    };
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
        .slice(0, 300);
      return `${m.role}: ${text}`;
    })
    .join("\n");
}

async function runSubagentTasks(
  tasks: Array<{ role: string; asset: string; instruction: string }>,
) {
  const catalog = getCapitalAssetCatalog();
  return Promise.all(
    tasks.slice(0, 3).map(async (task) => {
      const asset = catalog.find(
        (a) => a.symbol?.toLowerCase() === task.asset?.toLowerCase(),
      );
      const assetContext = asset
        ? `Asset: ${asset.display_name}, sector ${asset.sector}.`
        : `Asset: ${task.asset}.`;
      try {
        const report = await generateVertexTextCompletion({
          userPrompt: task.instruction,
          systemInstruction: `You are a ${task.role}. ${assetContext} Be concise.`,
          temperature: 0.2,
          maxTokens: 800,
        });
        return { role: task.role, asset: task.asset, status: "success" as const, report };
      } catch (err) {
        return {
          role: task.role,
          asset: task.asset,
          status: "failed" as const,
          error: err instanceof Error ? err.message : "failed",
        };
      }
    }),
  );
}

function shouldForceSpeak(outcome: DecisionOutcome): boolean {
  return (
    outcome.type === "execute" ||
    outcome.type === "queue_confirm" ||
    outcome.type === "close" ||
    outcome.type === "paused"
  );
}

export async function runOrchestratorTurn(params: {
  goalRow: Record<string, unknown>;
  cycleId: string;
  outcome: DecisionOutcome;
  narration: string;
}) {
  const goal = toExtendedGoal(params.goalRow);
  const mode = goal.mode as TradingMode;

  const admin = createSupabaseAdminClient();

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
      .limit(6),
    admin
      .from("ai_trade_log")
      .select("id, symbol, direction, status, size")
      .eq("user_id", goal.user_id)
      .eq("mode", mode)
      .eq("status", "pending")
      .limit(5),
  ]);

  let conversation = await getActiveConversationAdmin(goal.user_id, mode);
  if (!conversation) {
    const supabase = createSupabaseAdminClient();
    const { data: latest } = await supabase
      .from("conversations")
      .select("session_number")
      .eq("user_id", goal.user_id)
      .eq("mode", mode)
      .order("session_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sessionNumber = (latest?.session_number ?? 0) + 1;
    await supabase
      .from("conversations")
      .update({ is_active: false })
      .eq("user_id", goal.user_id)
      .eq("mode", mode)
      .eq("is_active", true);
    const { data: created } = await supabase
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

  const conversationSummary = summarizeMessages(convMessages ?? []);

  let knowledgeContext = "";
  try {
    knowledgeContext = await buildOrchestratorKnowledgeContext(
      params.outcome.type === "hold" ? "ranging" : "trending",
    );
  } catch {
    knowledgeContext = "";
  }

  const systemInstruction = `You are the orchestrator for an autonomous wealth manager. Synthesize app state and decide if Command chat should speak proactively.

Respond with ONLY valid JSON:
{
  "summary": "one-line state read",
  "chatDirective": "concrete instructions for the Command AI — what to analyze, report, or do next",
  "shouldSpeak": true,
  "subagentTasks": [{ "role": "technical", "asset": "BTCUSD", "instruction": "..." }],
  "priority": "low" | "normal" | "high"
}

Rules:
- shouldSpeak=true when: trade executed/queued, goal milestone, risk event, pending confirmation, or meaningful portfolio change.
- shouldSpeak=false when: hold with no change for 2+ cycles (routine monitoring only).
- chatDirective must be actionable — tell Command AI exactly what to do (call tools, report progress, spawn subagents).
- subagentTasks only when multi-faceted research is needed (max 3).
- Use TRADING KNOWLEDGE context to recommend regime-appropriate strategies and discipline reminders in chatDirective.`;

  const userPrompt = `Goal: $${goal.initial_balance ?? 0} → $${goal.target_balance ?? 0} (${goalProgress.progressPct.toFixed(1)}% progress, status ${goalProgress.status})
Autonomous: ${goal.autonomous_trading} | Kill switch: ${goal.kill_switch}
Cycle outcome: ${params.outcome.type} — ${params.narration}
Wallet: $${accountState.balance?.wallet_available?.toFixed(2) ?? "?"} | Positions: ${accountState.positions?.length ?? 0}
Open positions: ${JSON.stringify(accountState.positions?.slice(0, 5) ?? [])}
Pending confirmations: ${JSON.stringify(pendingTrades.data ?? [])}
Recent activity: ${JSON.stringify(recentActivity.data ?? [])}
Trading knowledge: ${knowledgeContext || "N/A"}
Recent conversation:
${conversationSummary || "(no messages yet)"}`;

  let directive: OrchestratorDirective;
  try {
    const raw = await generateVertexTextCompletion({
      systemInstruction,
      userPrompt,
      temperature: 0.2,
      maxTokens: 1024,
    });
    const parsed = parseDirective(raw);
    if (!parsed) {
      directive = {
        summary: params.narration,
        chatDirective: params.narration,
        shouldSpeak: shouldForceSpeak(params.outcome),
        subagentTasks: [],
        priority: shouldForceSpeak(params.outcome) ? "high" : "low",
      };
    } else {
      directive = parsed;
      if (shouldForceSpeak(params.outcome)) {
        directive.shouldSpeak = true;
        directive.priority = "high";
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Orchestrator LLM failed";
    await logAgentActivity({
      userId: goal.user_id,
      goalId: goal.id,
      cycleId: params.cycleId,
      phase: "orchestrate",
      action: "error",
      reasoning: msg,
    });
    return { spoke: false, error: msg };
  }

  let subagentResults: Awaited<ReturnType<typeof runSubagentTasks>> = [];
  if (directive.subagentTasks.length > 0) {
    subagentResults = await runSubagentTasks(directive.subagentTasks);
  }

  await logAgentActivity({
    userId: goal.user_id,
    goalId: goal.id,
    cycleId: params.cycleId,
    phase: "orchestrate",
    action: directive.shouldSpeak ? "orchestrator_wake" : "orchestrator_skip",
    reasoning: directive.summary,
    payload: {
      directive,
      outcome: params.outcome,
      subagentResults,
    },
  });

  if (!directive.shouldSpeak || !conversation) {
    return { spoke: false, directive };
  }

  const enrichedDirective =
    subagentResults.length > 0
      ? `${directive.chatDirective}\n\nSubagent research:\n${JSON.stringify(subagentResults, null, 2)}`
      : directive.chatDirective;

  const chatResult = await runProactiveChatTurn({
    userId: goal.user_id,
    mode,
    conversationId: conversation.id,
    directive: enrichedDirective,
    cycleId: params.cycleId,
    narration: params.narration,
  });

  return { spoke: true, directive, chatResult };
}
