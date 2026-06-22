import type { GoalStatus, TradingMode } from "@/lib/goals/types";

export type AgentActivityPhase =
  | "observe"
  | "scan"
  | "analyze"
  | "judge"
  | "risk"
  | "act"
  | "report"
  | "manage"
  | "orchestrate";

export type AgentActivityAction =
  | "cycle_start"
  | "cycle_end"
  | "hold"
  | "trade_executed"
  | "trade_queued"
  | "position_closed"
  | "position_managed"
  | "skipped"
  | "circuit_breaker"
  | "kill_switch"
  | "goal_achieved"
  | "goal_failed"
  | "error"
  | "orchestrator_wake"
  | "orchestrator_skip";

export type OrchestratorDirective = {
  summary: string;
  chatDirective: string;
  shouldSpeak: boolean;
  subagentTasks: Array<{ role: string; asset: string; instruction: string }>;
  priority: "low" | "normal" | "high";
};

export type ExtendedUserGoal = {
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
  max_concurrent_positions: number;
  max_position_pct: number;
  daily_loss_limit_pct: number;
  allowed_assets: string[];
  min_confluence_score: number;
  kill_switch: boolean;
  confirmation_threshold_pct: number;
  peak_balance: number | null;
  trades_today: number;
  trades_today_reset_at: string | null;
  achieved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalContext = {
  goal: ExtendedUserGoal;
  currentBalance: number;
  progressPct: number;
  cycleId: string;
};

export type DecisionOutcome =
  | { type: "hold"; reasoning: string }
  | { type: "execute"; symbol: string; direction: "BUY" | "SELL"; size: number; stopLoss: number; takeProfit: number; reasoning: string; tradeId?: string }
  | { type: "queue_confirm"; symbol: string; direction: "BUY" | "SELL"; size: number; stopLoss: number; takeProfit: number; reasoning: string; tradeId: string }
  | { type: "close"; dealId: string; percent?: number; reasoning: string }
  | { type: "paused"; reasoning: string };

export type JudgmentResult = {
  approved: boolean;
  conviction: number;
  reasoning: string;
  narration: string;
};
