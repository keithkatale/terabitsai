export type GoalStatus =
  | "active"
  | "in_progress"
  | "achieved"
  | "failed"
  | "cancelled"
  | "paused";

export type TradingMode = "demo" | "live";

export type UserGoal = {
  id: string;
  user_id: string;
  mode: TradingMode;
  goal_type: string;
  goal_value: Record<string, unknown>;
  description: string | null;
  status: GoalStatus;
  progress_pct: number | null;
  initial_balance: number | null;
  target_balance: number | null;
  deadline_at: string | null;
  last_evaluated_at: string | null;
  failure_reason: string | null;
  autonomous_trading: boolean;
  max_risk_per_trade: number;
  consecutive_losses: number;
  max_concurrent_positions?: number;
  max_position_pct?: number;
  daily_loss_limit_pct?: number;
  allowed_assets?: string[];
  min_confluence_score?: number;
  kill_switch?: boolean;
  confirmation_threshold_pct?: number;
  peak_balance?: number | null;
  trades_today?: number;
  trades_today_reset_at?: string | null;
  achieved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalEvaluationStatus = "on_track" | "achieved" | "failed" | "at_risk";

export type GoalEvaluation = {
  goalId: string;
  currentBalance: number;
  progressPct: number;
  status: GoalEvaluationStatus;
  failureReason?: string;
  suggestedAction?: "hold" | "trade" | "rebalance";
};

export type GoalAgentDecision = {
  action: "hold" | "trade" | "close";
  reasoning: string;
  trade?: {
    symbol: string;
    direction: "BUY" | "SELL";
    allocationUsd: number;
    leverage?: number;
  };
  close?: {
    deal_id: string;
    percent?: number;
  };
};

export type GoalEvaluationAction =
  | "none"
  | "trade_proposed"
  | "trade_executed"
  | "goal_achieved"
  | "goal_failed"
  | "autonomous_paused";
