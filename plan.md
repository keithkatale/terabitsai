Plan: AI Trading & Investing Engine ("Quant-in-a-Box")
Context
Goal. Build a world-class, dual-purpose AI trading engine: (a) a premium "Quant-in-a-Box" for individuals ($25–$5,000/mo by tier), and (b) an accessible wealth-generation platform for emerging markets — eventually operating as a pooled/managed-funds business. Execution runs through a broker API (Capital.com CFDs first).

Why this shape. A single LLM "bot" hallucinates and dilutes signals. The industry pattern is a multi-agent coordinator + a deterministic risk gatekeeper, where the AI only drafts intents and a key-holding backend validates and executes. This plan turns that into a concrete, buildable system.

Decisions locked in (user's choices):

Stack: all Node.js / TypeScript.
Business model targeted first: pooled / managed funds (investment-bank model).
Reasoning LLM: Google Gemini.
Two consequences I'm designing around (not re-litigating):

Pooled real money is legally gated. You cannot custody and trade pooled client capital without licensing (asset-management / brokerage / e-money depending on jurisdiction), segregated custody, and AML/KYC. → The build is staged: paper/demo engine + pilot now; real pooled capital only after the compliance gate. The software is built in parallel with licensing so neither blocks the other.
Gemini grounding is less exact than Claude's here. → A thin ModelRouter interface wraps the LLM so the engine keeps strict structured-output discipline and you can swap/AB providers later without touching the agents.
Architecture (Multi-Agent Coordinator + Deterministic Gatekeeper)
Three isolated layers. The AI layer never holds broker keys.

┌───────────────────────────────────────────────────────────────┐
│ 1. REASONING LAYER  (no secrets, no execution)                 │
│    Orchestrator → [Macro Agent] [Technical Agent] [Regime]     │
│                 → Aggregator → TradeProposal (strict JSON)     │
└───────────────────────────────┬───────────────────────────────┘
                                 │  proposal (intent) via queue
                                 ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. RISK GATEKEEPER  (pure deterministic TypeScript — NO LLM)   │
│    margin · exposure caps · max size · stop-loss · daily-loss  │
│    limit · correlation/regime guard  → APPROVE / REJECT+reason │
└───────────────────────────────┬───────────────────────────────┘
                                 │  approved order only
                                 ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. EXECUTION LAYER  (holds broker keys, in a vault)            │
│    Capital.com adapter · idempotent orders · reconciliation ·  │
│    kill switch · circuit breakers · fills → positions          │
└───────────────────────────────────────────────────────────────┘
        every step writes to the AUDIT + EXPLAINABILITY log
Reasoning layer (each agent = one structured-output LLM call behind ModelRouter):

Orchestrator — deterministic code (not an LLM) that gathers data and sequences the agents.
Macro/Fundamental Agent — news sentiment, economic shifts, market health.
Technical Agent — price action, momentum, indicators (computed in code, interpreted by the LLM).
Regime/Risk-sentiment Agent (optional v1.1) — volatility regime, "risk-on/off".
Aggregator — merges agent outputs into one TradeProposal with per-agent votes and confidence.
The contract between AI and the rest of the system — a strict schema enforced via the provider's structured-output / JSON mode (the single most important interface in the system):

type TradeProposal = {
  symbol: string;            // e.g. "US100"
  side: "BUY" | "SELL" | "FLAT";
  confidence: number;        // 0..1
  timeHorizon: "scalp" | "swing" | "long_term";
  rationale: string;         // human-readable, powers the Explainability Log
  agentVotes: { agent: string; side: string; confidence: number; note: string }[];
  suggestedStopPct: number;  // advisory only — gatekeeper decides real risk
  suggestedSizeHint: number;
};
Risk Gatekeeper (pure TS, deterministic — never let an LLM do the final math): consumes TradeProposal + live account/portfolio state, computes margin and exposure, enforces hard caps (max position size, per-symbol and total exposure, daily loss limit, mandatory stop-loss, leverage ceiling, correlation guard), and emits RiskDecision { approved, sizedOrder?, reasons[] }. A trade reaches the broker only if it passes here. Downside is mathematically capped before any order is sent.

Execution layer: the only component with broker credentials (stored in a secrets vault / KMS, encrypted at rest). Idempotent order placement (client order IDs), position reconciliation against the broker on every loop, a global kill switch, and circuit breakers (halt on N consecutive losses / drawdown breach / data staleness).

Tech Stack (all TypeScript)
Runtime: Node.js 20+, TypeScript, pnpm monorepo (Turborepo).
Web app: Next.js (App Router) + React — serves both surfaces (premium dashboard + consumer app).
Engine worker: a separate Node service (not the Next.js process) running the scheduled agent loop.
Jobs/queue: BullMQ + Redis (scheduled loop triggers, proposal → gatekeeper → execution pipeline as discrete jobs).
DB: PostgreSQL via Prisma; TimescaleDB extension for OHLCV time-series.
Market data + execution: Capital.com REST (demo first), WebSocket for live prices.
AI: Google Gemini via @google/genai, behind a ModelRouter interface. Use fast model (Gemini Flash) for scalping, frontier model (Gemini Pro) for end-of-day reasoning/rebalancing. Force the TradeProposal schema via structured output.
Indicators / data: technicalindicators + danfojs-node (dataframes).
Secrets: broker keys in a vault (Cloud KMS / HashiCorp Vault / Doppler) — injected only into the execution service.
TS tradeoff to accept: the TS quant/backtesting ecosystem is thinner than Python's. We'll build a small event-driven backtester in TS (walk-forward, slippage + fee modelling). If backtesting depth becomes a bottleneck, the cleanest escape hatch is a small Python research sidecar that shares the same TradeProposal/data schemas — but v1 stays all-TS as chosen.

Proposed monorepo layout:

apps/web                 # Next.js — premium dashboard + consumer app (Vault / Arena)
apps/engine              # scheduled agent loop worker
packages/agents          # orchestrator + macro/technical/aggregator (LLM calls)
packages/model-router    # provider abstraction (Gemini now; swappable)
packages/risk            # deterministic gatekeeper (pure functions, heavily unit-tested)
packages/broker          # Capital.com adapter (demo + live), reconciliation, kill switch
packages/backtest        # event-driven backtester + paper-trading engine
packages/db              # Prisma schema + migrations
packages/contracts       # shared zod schemas (TradeProposal, RiskDecision, Order, ...)
Core data model (Prisma): users, portfolios, brokerConnections (encrypted creds), marketSnapshots (Timescale), agentRuns, proposals, riskEvaluations, orders, fills, positions, auditEvents, explainabilityLogs. The audit/explainability tables are also the premium product feature — log every agent input/output and every risk decision.

MVP — The Simplest Robust Build (daily loop, paper/demo only)
Do not start with HFT scalping. Prove the architecture with a daily/hourly loop on a demo account.

Loop trigger — BullMQ scheduled job at market open / hourly.
Ingest — pull OHLCV + recent news for the watchlist from Capital.com demo.
Reason — orchestrator runs Macro + Technical agents (Gemini, structured output) → Aggregator → TradeProposal.
Gate — deterministic Risk Gatekeeper sizes/approves/rejects with reasons.
Execute — approved orders sent to the Capital.com demo account; idempotent; reconcile positions.
Log + show — write the full chain to the audit/explainability store; render it in the Next.js dashboard.
Everything is paper/demo until the strategy shows a positive, risk-adjusted track record in backtest and forward paper-trading — and until the compliance gate (below) clears for real capital.

Positioning & UX
Premium "Quant-in-a-Box" ($25–$5k/mo): transparency-first. Explainability Log (why the AI acted, which agents agreed, the exact risk params). Tier by features / latency / number of strategies / AUM.
Emerging-markets app: abstract away candlesticks/order books. Two zones — Vault (long-term AI-managed accumulation) and Arena (live scalping signals to track/interact with). Goal-based, mobile-first.
Best Practices / Non-Negotiables
Deterministic risk, always. LLMs draft; code decides sizing, margin, and stops.
Separation of keys. Reasoning layer has zero broker access; only the execution service holds credentials.
Latency vs logic. Fast model (Flash) for scalping; frontier model (Pro) for EOD rebalancing.
Backtest + paper gate before any live capital. Walk-forward, realistic fees/slippage; no real money until metrics pass.
Safety rails. Idempotent orders, position reconciliation, kill switch, circuit breakers (drawdown, consecutive losses, stale data).
Observability = product. Version-pin prompts; log every agent I/O and risk decision; run evals on historical data. This doubles as the premium Explainability feature.
Regulatory (critical for the pooled model): CFDs are leveraged and high-risk — cap downside mathematically before sending any order, and show risk disclosures. Real pooled capital is gated on: licensing for the jurisdictions you serve, AML/KYC, segregated/audited custody, and a full audit trail. Run the licensing workstream in parallel with engineering; the engine ships on demo/paper meanwhile.
Verification
Risk gatekeeper: exhaustive unit tests (packages/risk) — exposure caps, margin math, forced stops, daily-loss halt, rejection reasons. This is the safety core; treat failures as release blockers.
Backtester: validate against a known historical window; confirm fees/slippage are applied and walk-forward produces out-of-sample results.
End-to-end (demo): run the full loop against the Capital.com demo account; confirm a TradeProposal flows → gatekeeper decision → demo order → reconciled position → complete entry in the explainability log.
Kill switch / circuit breakers: simulate stale data and a drawdown breach; confirm the engine halts and places no orders.
No-live-money assertion: an environment flag makes live execution impossible until explicitly enabled post-compliance.
Build order (suggested first PRs)
packages/contracts (zod schemas) + packages/db (Prisma).
packages/broker Capital.com demo adapter (auth, OHLCV, place/close, reconcile).
packages/risk gatekeeper + tests.
packages/model-router + packages/agents (macro + technical + aggregator).
apps/engine daily loop wiring it together.
apps/web explainability dashboard.
packages/backtest for the paper-trade gate.