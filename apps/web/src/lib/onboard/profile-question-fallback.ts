import type { OnboardProfileDraft, ProfileFieldKey } from "@/lib/onboard/profile-types";
import { missingProfileFields } from "@/lib/onboard/profile-types";

export type ProfileQuestionPayload = {
  say: string;
  field: ProfileFieldKey | null;
  options: { id: string; label: string }[];
  values: Record<string, string | number | string[]>;
  done: boolean;
  multiSelect?: boolean;
};

export function buildFallbackQuestion(profile: OnboardProfileDraft): ProfileQuestionPayload {
  const missing = missingProfileFields(profile);
  const field = missing[0] ?? null;

  if (!field) {
    return {
      say: "You're all set — Terabits AI now understands how you trade and invest.",
      field: null,
      options: [{ id: "continue", label: "Enter Terabits" }],
      values: {},
      done: true,
    };
  }

  switch (field) {
    case "userPersona":
      return {
        say: "First, which best describes you on Terabits?",
        field: "userPersona",
        options: [
          { id: "forex_trader", label: "Forex trader — I trade currency pairs and FX sessions" },
          { id: "long_term_investor", label: "Long-term investor — I build wealth over months and years" },
          { id: "market_scout", label: "Market scout — I research, scan, and scope opportunities" },
          { id: "swing_trader", label: "Active / swing trader — I trade setups over days to weeks" },
          { id: "beginner", label: "Just getting started — I'm learning how markets work" },
        ],
        values: {
          forex_trader: "forex_trader",
          long_term_investor: "long_term_investor",
          market_scout: "market_scout",
          swing_trader: "swing_trader",
          beginner: "beginner",
        },
        done: false,
      };
    case "goal":
      return {
        say: "What do you want Terabits to help you accomplish first?",
        field: "goal",
        options: [
          { id: "signals", label: "Get AI signals and market intelligence" },
          { id: "grow", label: "Grow a demo or live account steadily" },
          { id: "automate", label: "Automate trades and portfolio management" },
          { id: "learn", label: "Learn strategies while risking small amounts" },
          { id: "research", label: "Deep research on assets before I commit capital" },
          { id: "income", label: "Generate consistent side income from trading" },
        ],
        values: {
          signals: "Get AI signals and actionable market intelligence",
          grow: "Grow account balance steadily with disciplined trades",
          automate: "Automate portfolio management and trade execution",
          learn: "Learn trading strategies with minimal risk",
          research: "Research assets deeply before committing capital",
          income: "Generate consistent side income from trading",
        },
        done: false,
      };
    case "tradingExperience":
      return {
        say: "How would you describe your trading experience?",
        field: "tradingExperience",
        options: [
          { id: "beginner", label: "Beginner — new to charts, orders, and risk" },
          { id: "intermediate", label: "Intermediate — I've placed trades and know basics" },
          { id: "advanced", label: "Advanced — I use technicals, sizing, and multi-asset strategies" },
          { id: "pro", label: "Professional — trading is a core part of my income" },
        ],
        values: {
          beginner: "Beginner",
          intermediate: "Intermediate",
          advanced: "Advanced",
          pro: "Professional",
        },
        done: false,
      };
    case "marketsOfInterest":
      return {
        say: "Which markets do you focus on? Pick your main ones.",
        field: "marketsOfInterest",
        multiSelect: true,
        options: [
          { id: "forex", label: "Forex / currencies" },
          { id: "crypto", label: "Crypto" },
          { id: "stocks", label: "Stocks & indices" },
          { id: "commodities", label: "Commodities (gold, oil, etc.)" },
          { id: "etfs", label: "ETFs & funds" },
        ],
        values: {
          forex: ["forex"],
          crypto: ["crypto"],
          stocks: ["stocks"],
          commodities: ["commodities"],
          etfs: ["etfs"],
        },
        done: false,
      };
    case "amountAvailable":
      return {
        say: "How much capital could you realistically deploy to start?",
        field: "amountAvailable",
        options: [
          { id: "0", label: "$0 — demo / paper only for now" },
          { id: "100", label: "Around $100" },
          { id: "500", label: "Around $500" },
          { id: "2000", label: "Around $2,000" },
          { id: "10000", label: "$10,000+" },
        ],
        values: { "0": 0, "100": 100, "500": 500, "2000": 2000, "10000": 10000 },
        done: false,
      };
    case "riskPreference":
      return {
        say: "How much volatility are you comfortable with?",
        field: "riskPreference",
        options: [
          { id: "low", label: "Conservative — protect capital first" },
          { id: "medium", label: "Balanced — moderate ups and downs" },
          { id: "high", label: "Aggressive — I accept swings for higher upside" },
        ],
        values: { low: "low", medium: "medium", high: "high" },
        done: false,
      };
    case "horizonDays":
      return {
        say: "What's your typical time horizon for a trade or investment plan?",
        field: "horizonDays",
        options: [
          { id: "7", label: "Days — intraday to weekly" },
          { id: "30", label: "~1 month" },
          { id: "90", label: "~3 months" },
          { id: "365", label: "1 year or longer" },
        ],
        values: { "7": 7, "30": 30, "90": 90, "365": 365 },
        done: false,
      };
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}
