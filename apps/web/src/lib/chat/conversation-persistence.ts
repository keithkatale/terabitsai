import { resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isPlaceholderConversationTitle,
  resolveConversationTitleAfterFirstUserMessage,
} from "@/lib/chat/conversation-title";
import { randomUUID } from "crypto";

export type TradingMode = "demo" | "live";

export type PersistedMessagePart = {
  type: string;
  text?: string;
  payload?: unknown;
};

export type PersistedChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: PersistedMessagePart[];
  toolPods?: unknown;
  subAgents?: unknown;
};

export type ConversationRow = {
  id: string;
  session_number: number;
  mode: TradingMode;
  title: string | null;
  context_summary: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserGoalRow = {
  id: string;
  goal_type: string;
  goal_value: Record<string, unknown>;
  description: string | null;
  status: string;
  progress_pct: number | null;
  initial_balance?: number | null;
  target_balance?: number | null;
  deadline_at?: string | null;
  autonomous_trading?: boolean;
  failure_reason?: string | null;
  created_at: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toPersistedMessageId(id: string): string {
  return UUID_RE.test(id) ? id : randomUUID();
}

export async function updateConversationTitle(
  conversationId: string,
  userId: string,
  title: string,
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("conversations")
    .update({ title: title.slice(0, 120), updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function createConversation(
  userId: string,
  mode: TradingMode,
  title = "New conversation",
) {
  const supabase = await createSupabaseServerClient();

  let accountId: string | null = null;
  try {
    const account = await resolvePlatformAccount(userId, mode);
    accountId = account.id;
  } catch {
    // Account may not exist yet for new users.
  }

  const { data: latest } = await supabase
    .from("conversations")
    .select("session_number")
    .eq("user_id", userId)
    .eq("mode", mode)
    .order("session_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sessionNumber = (latest?.session_number ?? 0) + 1;

  await supabase
    .from("conversations")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("mode", mode)
    .eq("is_active", true);

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      account_id: accountId,
      mode,
      session_number: sessionNumber,
      is_active: true,
      title: title.slice(0, 120),
    })
    .select("id, session_number, mode, title, context_summary, is_active, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data as ConversationRow;
}

export async function activateConversation(
  userId: string,
  conversationId: string,
  mode: TradingMode,
) {
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) throw new Error("Conversation not found");

  await supabase
    .from("conversations")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("mode", mode)
    .eq("is_active", true);

  const { data, error } = await supabase
    .from("conversations")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId)
    .select("id, session_number, mode, title, context_summary, is_active, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data as ConversationRow;
}

export async function deleteConversation(userId: string, conversationId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function getActiveConversation(userId: string, mode: TradingMode) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, session_number, mode, title, context_summary, is_active, created_at, updated_at")
    .eq("user_id", userId)
    .eq("mode", mode)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ConversationRow | null;
}

export async function getOrCreateActiveConversation(userId: string, mode: TradingMode) {
  const existing = await getActiveConversation(userId, mode);
  if (existing) return existing;
  return createConversation(userId, mode);
}

export async function listConversations(userId: string, mode: TradingMode, limit = 30) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, session_number, mode, title, context_summary, is_active, created_at, updated_at")
    .eq("user_id", userId)
    .eq("mode", mode)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as ConversationRow[];
}

export async function loadConversationMessages(conversationId: string, userId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conv) return null;

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, parts, tool_pods, sub_agents, sequence, created_at")
    .eq("conversation_id", conversationId)
    .order("sequence", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    role: row.role as PersistedChatMessage["role"],
    parts: (row.parts ?? []) as PersistedMessagePart[],
    toolPods: row.tool_pods ?? undefined,
    subAgents: row.sub_agents ?? undefined,
    createdAt: row.created_at as string | undefined,
  }));
}

export async function appendConversationMessages(
  conversationId: string,
  userId: string,
  messages: PersistedChatMessage[],
): Promise<{ title: string | null }> {
  if (messages.length === 0) return { title: null };

  const supabase = await createSupabaseServerClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, title")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conv) throw new Error("Conversation not found");

  const { data: lastRow } = await supabase
    .from("chat_messages")
    .select("sequence")
    .eq("conversation_id", conversationId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sequence = (lastRow?.sequence ?? 0) + 1;

  const candidateIds = messages.map((msg) => toPersistedMessageId(msg.id));
  const { data: existingRows } = candidateIds.length
    ? await supabase
        .from("chat_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .in("id", candidateIds)
    : { data: [] as { id: string }[] };

  const existingIds = new Set((existingRows ?? []).map((row) => String(row.id)));

  const rows = messages
    .filter((msg) => !existingIds.has(toPersistedMessageId(msg.id)))
    .map((msg) => ({
      id: toPersistedMessageId(msg.id),
      conversation_id: conversationId,
      role: msg.role,
      parts: msg.parts,
      tool_pods: msg.toolPods ?? null,
      sub_agents: msg.subAgents ?? null,
      sequence: sequence++,
    }));

  if (rows.length === 0) {
    return { title: null };
  }

  const { error } = await supabase.from("chat_messages").insert(rows);
  if (error) throw new Error(error.message);

  let firstUserText =
    messages
      .find((m) => m.role === "user")
      ?.parts.find((p) => p.type === "text" && p.text?.trim())?.text?.trim() ?? "";

  if (!firstUserText && isPlaceholderConversationTitle(String(conv.title ?? ""))) {
    const { data: firstUserRow } = await supabase
      .from("chat_messages")
      .select("parts")
      .eq("conversation_id", conversationId)
      .eq("role", "user")
      .order("sequence", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstUserRow?.parts) {
      const parts = firstUserRow.parts as PersistedMessagePart[];
      firstUserText =
        parts.find((p) => p.type === "text" && p.text?.trim())?.text?.trim() ?? "";
    }
  }

  const updates: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };

  let nextTitle: string | null = null;
  if (firstUserText) {
    nextTitle = resolveConversationTitleAfterFirstUserMessage(
      firstUserText,
      String(conv.title ?? "New conversation"),
    );
    if (nextTitle !== conv.title) {
      updates.title = nextTitle;
    }
  }

  await supabase.from("conversations").update(updates).eq("id", conversationId);

  return { title: nextTitle ?? (updates.title ? updates.title : null) };
}

/** Background jobs (orchestrator) — bypass RLS via service role. */
export async function appendConversationMessagesAdmin(
  conversationId: string,
  userId: string,
  messages: PersistedChatMessage[],
) {
  if (messages.length === 0) return;

  const admin = createSupabaseAdminClient();

  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conv) throw new Error("Conversation not found");

  const { data: lastRow } = await admin
    .from("chat_messages")
    .select("sequence")
    .eq("conversation_id", conversationId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sequence = (lastRow?.sequence ?? 0) + 1;

  const rows = messages.map((msg) => ({
    id: toPersistedMessageId(msg.id),
    conversation_id: conversationId,
    role: msg.role,
    parts: msg.parts,
    tool_pods: msg.toolPods ?? null,
    sub_agents: msg.subAgents ?? null,
    sequence: sequence++,
  }));

  const { error } = await admin.from("chat_messages").insert(rows);
  if (error) throw new Error(error.message);

  await admin
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function getActiveConversationAdmin(userId: string, mode: TradingMode) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("conversations")
    .select("id, session_number, mode, title, context_summary, is_active, created_at, updated_at")
    .eq("user_id", userId)
    .eq("mode", mode)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ConversationRow | null;
}

export async function loadConversationMessagesAdmin(conversationId: string, userId: string) {
  const admin = createSupabaseAdminClient();

  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conv) return null;

  const { data, error } = await admin
    .from("chat_messages")
    .select("id, role, parts, tool_pods, sub_agents, sequence, created_at")
    .eq("conversation_id", conversationId)
    .order("sequence", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    role: row.role as PersistedChatMessage["role"],
    parts: (row.parts ?? []) as PersistedMessagePart[],
    toolPods: row.tool_pods ?? undefined,
    subAgents: row.sub_agents ?? undefined,
    created_at: row.created_at as string,
  }));
}

export async function updateConversationSummary(
  conversationId: string,
  userId: string,
  summary: string,
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("conversations")
    .update({ context_summary: summary.slice(0, 4000), updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

/** Append a new summary section to context_summary (accumulates across session saves). */
export async function appendConversationSummarySection(
  conversationId: string,
  userId: string,
  sectionTitle: string,
  sectionBody: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("context_summary, session_number")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conv) throw new Error("Conversation not found");

  const existing = (conv.context_summary as string | null)?.trim() ?? "";
  const block = `## ${sectionTitle}\n${sectionBody.trim()}`;
  const merged = existing ? `${existing}\n\n${block}` : block;
  const nextSession = (conv.session_number ?? 1) + 1;

  const { error } = await supabase
    .from("conversations")
    .update({
      context_summary: merged.slice(0, 12_000),
      session_number: nextSession,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return { contextSummary: merged.slice(0, 12_000), sessionNumber: nextSession };
}

/** Summarize current session segment, save to context_summary, insert visible divider — same conversation. */
export async function archiveSessionInPlace(
  conversationId: string,
  userId: string,
  summaryText: string,
) {
  const dividerId = randomUUID();
  const now = new Date().toLocaleString();
  const { sessionNumber } = await appendConversationSummarySection(
    conversationId,
    userId,
    `Session saved ${now}`,
    summaryText,
  );

  await appendConversationMessages(conversationId, userId, [
    {
      id: dividerId,
      role: "system",
      parts: [
        {
          type: "session_divider",
          text: summaryText,
          payload: { sessionNumber, savedAt: new Date().toISOString() },
        },
      ],
    },
  ]);

  return { dividerId, sessionNumber, summary: summaryText };
}

export async function getActiveGoals(userId: string, mode: TradingMode) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_goals")
    .select(
      "id, goal_type, goal_value, description, status, progress_pct, initial_balance, target_balance, deadline_at, autonomous_trading, failure_reason, created_at",
    )
    .eq("user_id", userId)
    .eq("mode", mode)
    .in("status", ["active", "in_progress", "paused"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as UserGoalRow[];
}

export async function getSessionContext(userId: string, mode: TradingMode) {
  const supabase = await createSupabaseServerClient();

  const [conversations, goals] = await Promise.all([
    listConversations(userId, mode, 6),
    getActiveGoals(userId, mode),
  ]);

  const previousSessions = conversations.filter((c) => !c.is_active).slice(0, 5);

  return {
    goals,
    previousSessions,
    sessionNumber: (conversations.find((c) => c.is_active)?.session_number ?? 0) + 1,
  };
}

export function buildSessionContextPrompt(context: Awaited<ReturnType<typeof getSessionContext>>): string {
  const lines: string[] = [];

  const balanceGoal = context.goals.find((g) => g.goal_type === "balance_target");

  if (balanceGoal) {
    const initial =
      balanceGoal.initial_balance ?? Number(balanceGoal.goal_value?.initial ?? 0);
    const target =
      balanceGoal.target_balance ?? Number(balanceGoal.goal_value?.target ?? 0);
    lines.push("ACTIVE BALANCE GOAL (monitored every 2 minutes by background agent):");
    lines.push(`- Grow $${initial} → $${target} (${balanceGoal.progress_pct ?? 0}% progress)`);
    lines.push(`- Status: ${balanceGoal.status}`);
    if (balanceGoal.deadline_at) {
      lines.push(`- Deadline: ${balanceGoal.deadline_at}`);
    }
    lines.push(
      `- Autonomous trading: ${balanceGoal.autonomous_trading ? "ENABLED — Command AI executes trades automatically" : "disabled (confirmation required)"}`,
    );
    lines.push(
      "Keep working toward this goal. User may ask side questions — answer them, but stay goal-aware.",
    );
  } else if (context.goals.length > 0) {
    lines.push("ACTIVE USER GOALS:");
    for (const goal of context.goals) {
      const desc = goal.description ?? goal.goal_type;
      lines.push(`- ${desc}: ${JSON.stringify(goal.goal_value)}`);
    }
  } else {
    lines.push("NO ACTIVE GOAL SET.");
    lines.push(
      "The user has not set a balance target yet. Early in the conversation, ask them to set one (e.g. grow $20 to $50). Use manage_goals with operation set_balance_target once they agree.",
    );
  }

  if (context.previousSessions.length > 0) {
    lines.push("\nRECENT SESSION HISTORY:");
    for (const session of context.previousSessions) {
      const summary =
        session.context_summary?.trim() ||
        session.title?.trim() ||
        `Session ${session.session_number}`;
      lines.push(`- Session ${session.session_number}: ${summary}`);
    }
  }

  if (lines.length === 0) return "";

  return `\n\nPERSISTENT MEMORY (across prior sessions — treat as factual user context):\n${lines.join("\n")}`;
}

export function hasActiveBalanceGoal(
  context: Awaited<ReturnType<typeof getSessionContext>>,
): boolean {
  return context.goals.some(
    (g) =>
      g.goal_type === "balance_target" &&
      ["active", "in_progress", "paused"].includes(g.status),
  );
}

export function buildGoalMissionPrompt(
  context: Awaited<ReturnType<typeof getSessionContext>>,
): string {
  const balanceGoal = context.goals.find((g) => g.goal_type === "balance_target");

  if (balanceGoal) {
    const initial =
      balanceGoal.initial_balance ?? Number(balanceGoal.goal_value?.initial ?? 0);
    const target =
      balanceGoal.target_balance ?? Number(balanceGoal.goal_value?.target ?? 0);

    return `PRIMARY MISSION — GOAL-DRIVEN WEALTH MANAGER (FULL AUTONOMY)
Your #1 job is helping the user reach their balance target: $${initial.toFixed(2)} → $${target.toFixed(2)}.
- Status: ${balanceGoal.status} | Progress: ${balanceGoal.progress_pct ?? 0}%
- Autonomous trading: ${balanceGoal.autonomous_trading ? "ENABLED — you EXECUTE trades via execute_trade or broker_action on Capital.com without asking permission" : "disabled — propose trades only"}
- When autonomous is ON: call execute_trade or broker_action place_order. Orders go straight to Capital.com — never show swipe-to-confirm tickets.
- NEVER say you cannot execute trades, cannot access the brokerage, or need manual placement when autonomous is enabled.
- Call get_account_state and manage_goals(check_progress) when discussing portfolio health.
- Report what you DID (opened, closed, sized) — act first, explain after.
- User may ask side questions — answer them, but stay goal-aware.
- When achieved, celebrate and prompt for a new balance target. Autonomous growth runs on the Investing tab — not in this chat.

## AVAILABLE TRADING SKILLS

You have specialized analysis skills via execute_skill:

1. **market-regime-detector** — Classify market (uptrend/downtrend/ranging)
   Inputs: { symbols: ["SPY", "QQQ"], timeframes: ["1D"] }
   Returns: { regime, confidence, reasoning, recommended_strategy }

2. **position-sizer** — Calculate risk-based position size
   Inputs: { symbol, entry_price, stop_loss, account_balance, max_risk_pct }
   Returns: { units, margin_required, risk_dollars, risk_pct }

3. **portfolio-heat-calculator** — Sum total portfolio risk
   Inputs: {} (auto-fetches positions)
   Returns: { total_risk_pct, num_positions, risk_by_symbol }

4. **pattern-lookup** — Query chart patterns from knowledge base
   Inputs: { pattern_type: "head_and_shoulders" }
   Returns: Pattern definition, reliability, trading playbook

5. **strategy-recommender** — Get regime-based strategies
   Inputs: { regime: "uptrend", confidence: 85 }
   Returns: { recommended_strategies, primary_strategy }

Use skills to enhance analysis: call market-regime-detector at start, position-sizer before trades, portfolio-heat-calculator before new positions.`;
  }

  return `PRIMARY MISSION — GOAL-DRIVEN WEALTH MANAGER
The user has NO balance goal. Setting one is your #1 priority — do NOT wait for them to ask.

MANDATORY BEHAVIOR (every session, especially the first reply):
1. Call get_account_state to read wallet balance and positions.
2. Call manage_goals(operation=list) to confirm goal status.
3. Open your reply by inviting them to set a balance target using their real balance.
   Example: "You have $20 in your account — what balance would you like to reach? Many users start with $20 → $50."
4. When they agree, call manage_goals(operation=set_balance_target, target_balance=<amount>) immediately.
5. Show the GoalProgressWidget after setting the goal.

Do not dive into generic market chat or trade ideas until a goal exists or the user explicitly declines.
Side questions are fine, but always steer back to defining a balance target.`;
}
