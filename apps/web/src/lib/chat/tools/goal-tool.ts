import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ManageGoalArgs = {
  operation: "list" | "set" | "update" | "cancel";
  goal_type?: "balance_target" | "strategy_preference" | "risk_tolerance" | "milestone";
  goal_value?: Record<string, unknown>;
  description?: string;
  goal_id?: string;
  progress_pct?: number;
  status?: "active" | "achieved" | "cancelled" | "paused";
};

export async function manageUserGoals(
  userId: string,
  mode: "demo" | "live",
  args: ManageGoalArgs,
) {
  const supabase = await createSupabaseServerClient();
  const operation = args.operation;

  if (operation === "list") {
    const { data, error } = await supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", userId)
      .eq("mode", mode)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, goals: data ?? [] };
  }

  if (operation === "set") {
    if (!args.goal_type || !args.goal_value) {
      return { success: false, error: "goal_type and goal_value are required" };
    }

    const { data, error } = await supabase
      .from("user_goals")
      .insert({
        user_id: userId,
        mode,
        goal_type: args.goal_type,
        goal_value: args.goal_value,
        description: args.description ?? null,
        status: "active",
      })
      .select("*")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, goal: data };
  }

  if (operation === "update") {
    if (!args.goal_id) return { success: false, error: "goal_id is required" };

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (args.goal_value) updates.goal_value = args.goal_value;
    if (args.description) updates.description = args.description;
    if (args.progress_pct != null) updates.progress_pct = args.progress_pct;
    if (args.status) {
      updates.status = args.status;
      if (args.status === "achieved") updates.achieved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("user_goals")
      .update(updates)
      .eq("id", args.goal_id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, goal: data };
  }

  if (operation === "cancel") {
    if (!args.goal_id) return { success: false, error: "goal_id is required" };

    const { data, error } = await supabase
      .from("user_goals")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", args.goal_id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, goal: data };
  }

  return { success: false, error: "Unknown operation" };
}
