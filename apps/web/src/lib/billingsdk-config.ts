export type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
};

export const plans: Plan[] = [
  {
    id: "free",
    name: "Chat",
    price: "$0",
    period: "forever",
    description: "AI market analysis in a focused chat experience.",
    features: [
      "Unlimited AI chat on /",
      "Market reasoning & education",
      "No live terminal or market panels",
    ],
    cta: "Current plan",
  },
  {
    id: "pro",
    name: "Terminal",
    price: "$30",
    period: "per month",
    description: "Side-by-side AI chat and live market intelligence.",
    highlighted: true,
    features: [
      "Everything in Chat",
      "Full /app terminal workspace",
      "Live signals, catalyst radar & intel feed",
      "Multi-asset scanner & charts",
    ],
    cta: "Upgrade to Terminal",
  },
  {
    id: "premium",
    name: "Managed",
    price: "$50",
    period: "per month",
    description: "Let the platform trade and invest on your behalf.",
    features: [
      "Everything in Terminal",
      "Managed portfolio allocation",
      "Automated trade execution",
      "Priority usage & support",
    ],
    cta: "Upgrade to Managed",
  },
];

export const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, premium: 2 };
