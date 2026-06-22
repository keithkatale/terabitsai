import { resolvePlatformAccount } from "@/lib/ledger/ledger-service";
import { getLiveTotalAccountBalance } from "@/lib/portfolio/portfolio-balance";
import { evaluateBalanceGoal, computeProgressPct } from "@/lib/goals/goal-evaluator";
import { evaluateGoalById, processGoalById } from "@/lib/goals/goal-monitor";
import { enqueueAutonomousEvent } from "@/lib/autonomous/activity-log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GoalStatus, UserGoal } from "@/lib/goals/types";

export type ManageGoalArgs = {
  operation:
    | "list"
    | "set"
    | "update"
    | "cancel"
    | "set_balance_target"
    | "check_progress"
    | "pause_goal"
    | "resume_goal"
    | "enable_autonomous"
    | "disable_autonomous";
  goal_type?: "balance_target" | "strategy_preference" | "risk_tolerance" | "milestone";
  goal_value?: Record<string, unknown>;
  description?: string;
  goal_id?: string;
  progress_pct?: number;
  status?: GoalStatus;
  target_balance?: number;
  deadline_days?: number;
  autonomous_trading?: boolean;
  max_risk_per_trade?: number;
};

function buildGoalProgressGenui(goal: UserGoal, currentBalance: number, progressPct: number) {
  return {
    type: "component",
    name: "GoalProgressWidget",
    props: {
      goalId: goal.id,
      mode: goal.mode,
      initialBalance: goal.initial_balance ?? Number(goal.goal_value?.initial ?? 0),
      targetBalance: goal.target_balance ?? Number(goal.goal_value?.target ?? 0),
      currentBalance,
      progressPct,
      status: goal.status,
      autonomousTrading: goal.autonomous_trading ?? false,
      deadlineAt: goal.deadline_at,
      description: goal.description,
      failureReason: goal.failure_reason,
    },
  };
}

async function getBalanceGoal(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, goalId: string) {
  const { data, error } = await supabase
    .from("user_goals")
    .select("*")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Goal not found" };
  return { goal: data as UserGoal };
}

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

    const balanceGoal = (data ?? []).find(
      (g) => g.goal_type === "balance_target" && ["active", "in_progress", "paused"].includes(g.status),
    ) as UserGoal | undefined;

    if (balanceGoal) {
      const evaluation = await evaluateBalanceGoal(balanceGoal);
      return {
        success: true,
        goals: data ?? [],
        active_balance_goal: balanceGoal,
        evaluation,
        genui: buildGoalProgressGenui(balanceGoal, evaluation.currentBalance, evaluation.progressPct),
      };
    }

    return { success: true, goals: data ?? [], needs_goal: (data ?? []).length === 0 };
  }

  if (operation === "set_balance_target") {
    const target = args.target_balance ?? Number(args.goal_value?.target ?? 0);
    if (!Number.isFinite(target) || target <= 0) {
      return { success: false, error: "target_balance must be a positive number" };
    }

    const account = await resolvePlatformAccount(userId, mode);
    const initialBalance = await getLiveTotalAccountBalance(account.id);

    if (target <= initialBalance) {
      return {
        success: false,
        error: `Target ($${target}) must be greater than current balance ($${initialBalance.toFixed(2)})`,
      };
    }

    await supabase
      .from("user_goals")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("mode", mode)
      .eq("goal_type", "balance_target")
      .in("status", ["active", "in_progress", "paused"]);

    const deadlineAt =
      args.deadline_days && args.deadline_days > 0
        ? new Date(Date.now() + args.deadline_days * 86400000).toISOString()
        : null;

    const goalValue = {
      initial: initialBalance,
      target,
      currency: "USD",
      ...(args.goal_value ?? {}),
    };

    const insertPayload = {
      user_id: userId,
      mode,
      goal_type: "balance_target",
      goal_value: {
        ...goalValue,
        autonomous_trading: args.autonomous_trading ?? false,
        max_risk_per_trade: args.max_risk_per_trade ?? 5,
        deadline_at: deadlineAt,
      },
      description:
        args.description ??
        `Grow account from $${initialBalance.toFixed(2)} to $${target.toFixed(2)}`,
      status: "active",
      progress_pct: 0,
      initial_balance: initialBalance,
      target_balance: target,
      deadline_at: deadlineAt,
      autonomous_trading: args.autonomous_trading ?? false,
      max_risk_per_trade: args.max_risk_per_trade ?? 5,
      consecutive_losses: 0,
    };

    let { data, error } = await supabase
      .from("user_goals")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error?.message?.includes("autonomous_trading")) {
      const legacy = await supabase
        .from("user_goals")
        .insert({
          user_id: userId,
          mode,
          goal_type: "balance_target",
          goal_value: insertPayload.goal_value,
          description: insertPayload.description,
          status: "active",
          progress_pct: 0,
        })
        .select("*")
        .single();
      data = legacy.data;
      error = legacy.error;
    }

    if (error) return { success: false, error: error.message };

    const goal = data as UserGoal;
    const progressPct = computeProgressPct(initialBalance, initialBalance, target);

    await enqueueAutonomousEvent({
      userId,
      goalId: goal.id,
      eventType: "goal_created",
      payload: { autonomous: args.autonomous_trading ?? false },
    });

    if (args.autonomous_trading) {
      processGoalById(goal.id).catch((err) =>
        console.warn("[goal-tool] immediate cycle failed:", err)
      );
    }

    return {
      success: true,
      goal,
      message: args.autonomous_trading
        ? `Balance goal set: $${initialBalance.toFixed(2)} → $${target.toFixed(2)}. I'm now managing your account toward this target.`
        : `Balance goal set: $${initialBalance.toFixed(2)} → $${target.toFixed(2)}. Enable autonomous trading when you're ready for me to trade on your behalf.`,
      genui: buildGoalProgressGenui(goal, initialBalance, progressPct),
    };
  }

  if (operation === "check_progress") {
    if (!args.goal_id) {
      const { data: active } = await supabase
        .from("user_goals")
        .select("*")
        .eq("user_id", userId)
        .eq("mode", mode)
        .eq("goal_type", "balance_target")
        .in("status", ["active", "in_progress", "paused"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) {
        return {
          success: false,
          error: "No active balance goal. Ask the user to set one with set_balance_target.",
          needs_goal: true,
        };
      }
      args.goal_id = active.id;
    }

    const goalId = args.goal_id;
    if (!goalId) {
      return { success: false, error: "goal_id is required" };
    }

    const evaluation = await evaluateGoalById(goalId, userId);
    if (!evaluation) return { success: false, error: "Goal not found" };

    const fetched = await getBalanceGoal(supabase, userId, goalId);
    if ("error" in fetched) return { success: false, error: fetched.error };

    return {
      success: true,
      evaluation,
      goal: fetched.goal,
      genui: buildGoalProgressGenui(
        fetched.goal,
        evaluation.currentBalance,
        evaluation.progressPct,
      ),
    };
  }

  if (operation === "pause_goal" || operation === "resume_goal") {
    if (!args.goal_id) return { success: false, error: "goal_id is required" };
    const status = operation === "pause_goal" ? "paused" : "in_progress";

    const { data, error } = await supabase
      .from("user_goals")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", args.goal_id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, goal: data };
  }

  if (operation === "enable_autonomous" || operation === "disable_autonomous") {
    if (!args.goal_id) return { success: false, error: "goal_id is required" };

    const { data, error } = await supabase
      .from("user_goals")
      .update({
        autonomous_trading: operation === "enable_autonomous",
        updated_at: new Date().toISOString(),
      })
      .eq("id", args.goal_id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) return { success: false, error: error.message };

    if (operation === "enable_autonomous") {
      await enqueueAutonomousEvent({
        userId,
        goalId: args.goal_id,
        eventType: "autonomous_enabled",
      });
      processGoalById(args.goal_id).catch((err) =>
        console.warn("[goal-tool] immediate cycle failed:", err)
      );
    }

    return {
      success: true,
      goal: data,
      message:
        operation === "enable_autonomous"
          ? "Autonomous trading enabled — I'm now actively managing your account toward your goal."
          : "Autonomous trading disabled — I'll propose trades for your confirmation.",
    };
  }

  if (operation === "set") {
    if (args.goal_type === "balance_target") {
      const target = Number(args.goal_value?.target ?? args.target_balance ?? 0);
      return manageUserGoals(userId, mode, {
        ...args,
        operation: "set_balance_target",
        target_balance: target,
      });
    }

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
    if (args.target_balance != null) updates.target_balance = args.target_balance;
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
