import type { UserPlan } from "@/lib/subscription/access";

export function buildPlanContextPrompt(plan: UserPlan): string {
  const lines: string[] = ["\n\nUSER SUBSCRIPTION PLAN:"];

  switch (plan) {
    case "free":
      lines.push("- Plan: **Chat (Free)** — $0/month");
      lines.push("- CAN: Use AI chat for market education, analysis, and Q&A.");
      lines.push("- CANNOT: Access managed wallet, managed portfolio, or automated trade execution.");
      lines.push("- CANNOT: Use managed accounts or let the platform trade on their behalf.");
      lines.push("- CANNOT: Access the Wallet tab features (requires Managed $50/mo plan).");
      lines.push("- If they ask to execute trades, manage a portfolio, or use autonomous trading, explain these require upgrading to Managed ($50/mo) at /pricing.");
      lines.push("- For signals and live market data, suggest Terminal ($30/mo).");
      break;
    case "pro":
      lines.push("- Plan: **Terminal (Pro)** — $30/month");
      lines.push("- CAN: Full terminal workspace, live signals, catalyst radar, intel feed, multi-asset scanner, charts, and AI analytics.");
      lines.push("- CAN: Get AI-generated signals, market intelligence, and data-driven trade ideas.");
      lines.push("- CANNOT: Use managed accounts, managed assets, or automated portfolio management.");
      lines.push("- CANNOT: Access Wallet tab managed portfolio features (requires Managed $50/mo).");
      lines.push("- CANNOT: Execute autonomous trades on their behalf — they analyze and decide.");
      lines.push("- If they ask for managed/automated trading, explain Managed ($50/mo) is required.");
      break;
    case "premium":
      lines.push("- Plan: **Managed (Premium)** — $50/month");
      lines.push("- CAN: Everything in Terminal plus managed portfolio, automated trade execution, and Wallet tab.");
      lines.push("- CAN: Use managed accounts, autonomous trading, and goal-driven wealth management.");
      lines.push("- Prioritize actionable trade proposals and autonomous execution when goals are set.");
      break;
    default:
      lines.push("- Plan: Free tier");
      break;
  }

  return lines.join("\n");
}

export function filterToolsForPlan<T extends { name: string }>(
  tools: T[],
  plan: UserPlan,
): T[] {
  if (plan === "premium") return tools;

  const managedOnly = new Set([
    "execute_trade",
    "broker_action",
    "manage_goals",
    "schedule_task",
  ]);

  return tools.filter((t) => !managedOnly.has(t.name));
}
