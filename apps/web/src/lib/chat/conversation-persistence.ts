import { resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  created_at: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toPersistedMessageId(id: string): string {
  return UUID_RE.test(id) ? id : randomUUID();
}

export async function createConversation(userId: string, mode: TradingMode) {
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
      title: `Session ${sessionNumber}`,
    })
    .select("id, session_number, mode, title, context_summary, is_active, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data as ConversationRow;
}

export async function listConversations(userId: string, mode: TradingMode, limit = 20) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, session_number, mode, title, context_summary, is_active, created_at, updated_at")
    .eq("user_id", userId)
    .eq("mode", mode)
    .order("created_at", { ascending: false })
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
    .select("id, role, parts, tool_pods, sequence, created_at")
    .eq("conversation_id", conversationId)
    .order("sequence", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    role: row.role as PersistedChatMessage["role"],
    parts: (row.parts ?? []) as PersistedMessagePart[],
    toolPods: row.tool_pods ?? undefined,
  }));
}

export async function appendConversationMessages(
  conversationId: string,
  userId: string,
  messages: PersistedChatMessage[],
) {
  if (messages.length === 0) return;

  const supabase = await createSupabaseServerClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
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

  const rows = messages.map((msg) => ({
    id: toPersistedMessageId(msg.id),
    conversation_id: conversationId,
    role: msg.role,
    parts: msg.parts,
    tool_pods: msg.toolPods ?? null,
    sequence: sequence++,
  }));

  const { error } = await supabase.from("chat_messages").insert(rows);
  if (error) throw new Error(error.message);

  const firstUserText = messages
    .find((m) => m.role === "user")
    ?.parts.find((p) => p.type === "text" && p.text?.trim())?.text?.trim();

  const updates: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };
  if (firstUserText) {
    updates.title = firstUserText.slice(0, 80);
  }

  await supabase.from("conversations").update(updates).eq("id", conversationId);
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

export async function getActiveGoals(userId: string, mode: TradingMode) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_goals")
    .select("id, goal_type, goal_value, description, status, progress_pct, created_at")
    .eq("user_id", userId)
    .eq("mode", mode)
    .eq("status", "active")
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

  if (context.goals.length > 0) {
    lines.push("ACTIVE USER GOALS:");
    for (const goal of context.goals) {
      const desc = goal.description ?? goal.goal_type;
      lines.push(`- ${desc}: ${JSON.stringify(goal.goal_value)}`);
    }
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
