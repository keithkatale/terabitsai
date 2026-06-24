-- Chart insights: persisted TradingView visual analysis for TA-only users and signal journaling

CREATE TABLE IF NOT EXISTS public.chart_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  spec_json JSONB NOT NULL DEFAULT '{}',
  analysis_json JSONB NOT NULL DEFAULT '{}',
  snapshot_hash TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'headless',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chart_insights_user_created_idx
  ON public.chart_insights (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chart_insights_symbol_idx
  ON public.chart_insights (symbol, created_at DESC);

ALTER TABLE public.chart_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY chart_insights_select_own
  ON public.chart_insights
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY chart_insights_insert_own
  ON public.chart_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Service role (workers, admin) can insert/read for autonomous cycles
CREATE POLICY chart_insights_service_all
  ON public.chart_insights
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.chart_insights IS 'Persisted TradingView chart visual analyses from analyze_chart tool and tradingview-chart-analyst skill';
