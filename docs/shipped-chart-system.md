# Shipped Systems Record (June 2026)

## TradingView AI Chart Analysis

The orchestrator exposes an `analyze_chart` tool that renders a TradingView chart, captures a screenshot, runs Gemini vision analysis, and streams an interactive chart widget into chat.

| Layer | Location |
|-------|----------|
| Tool declaration + handler | `apps/web/src/lib/chart/analyze-chart-tool.ts` |
| Chart spec / indicators | `apps/web/src/lib/chart/tradingview-spec.ts` |
| Remote screenshot client | `apps/web/src/lib/chart/render-tradingview.ts` |
| Vision → structured analysis | `apps/web/src/lib/chart/analyze-chart-vision.ts` |
| Insight persistence | `apps/web/src/lib/chart/chart-insights-persistence.ts` |
| Interactive GenUI widget | `apps/web/src/components/generative-ui/tradingview-chart.tsx` |
| Internal render page | `apps/web/src/app/chart-frame/page.tsx` |
| Snapshot API | `apps/web/src/app/api/chart/snapshot/route.ts` |
| Skill docs | `tradingview-charts/SKILL.md`, `skills/skills-index.yaml` |

**Flow:** orchestrator calls `analyze_chart` → web app POSTs to chart-renderer → PNG cached → Gemini vision → `ChartAnalysis` JSON + `TradingViewChart` genui payload streamed to client.

**Env:** `CHART_RENDER_SERVICE_URL`, `CHART_RENDER_API_KEY` (Bearer auth to renderer).

## chart-renderer Cloud Run Service

Self-hosted Playwright screenshot API — no chart-img.com dependency.

| Item | Detail |
|------|--------|
| App | `apps/chart-renderer/` |
| Entry | `apps/chart-renderer/src/index.ts` |
| Docker | `Dockerfile.chart-renderer` (Playwright `v1.52.0-jammy`) |
| Deploy | `cloudbuild-chart-renderer.yaml`, also in root `cloudbuild.yaml` |
| Service name | `ai-agent-platform-chart-renderer` |
| API | `GET /render?symbol=&interval=&studies=` with `Authorization: Bearer <key>` |
| Output | 1280×800 PNG |

Playwright is pinned to **1.52.0** to match the Docker base image.

## Wealth Monitor Disabled

Automated wealth-monitor cycles are off by default.

| Gate | Location |
|------|----------|
| Feature flag | `WEALTH_MONITOR_ENABLED` (default `false`) in `apps/web/src/lib/autonomous/cycle-config.ts` |
| Cycle route | `apps/web/src/app/api/autonomous/cycle/route.ts` |
| Goal monitor | `apps/web/src/lib/goals/goal-monitor.ts` |
| Wealth-manager service | `apps/wealth-manager/src/index.ts` |
| Vercel crons removed | `apps/web/vercel.json` |

Manual `/api/autonomous/trigger` still works for on-demand cycles.

## chart_insights Table

Supabase migration `supabase/migrations/20260622500000_chart_insights.sql` — journals TA signals from chart analysis for later reference.
