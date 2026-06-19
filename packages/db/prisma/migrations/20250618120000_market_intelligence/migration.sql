-- CreateTable
CREATE TABLE "intel_scan_runs" (
    "id" TEXT NOT NULL,
    "scan_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "symbols_scanned" INTEGER NOT NULL DEFAULT 0,
    "signals_created" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "intel_scan_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_signals" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL DEFAULT '1H',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'deterministic',
    "payload" JSONB,
    "sector" TEXT,
    "asset_class" TEXT,
    "expires_at" TIMESTAMP(3),
    "scan_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_news_items" (
    "id" TEXT NOT NULL,
    "symbol" TEXT,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "source" TEXT NOT NULL,
    "url" TEXT,
    "category" TEXT,
    "published_at" TIMESTAMP(3),
    "scan_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_news_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invest_opportunities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "symbols" TEXT[],
    "horizon" TEXT NOT NULL DEFAULT 'swing',
    "conviction" INTEGER NOT NULL DEFAULT 3,
    "style" TEXT NOT NULL DEFAULT 'thematic',
    "sector" TEXT,
    "payload" JSONB,
    "expires_at" TIMESTAMP(3),
    "scan_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invest_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_pulse_snapshots" (
    "id" TEXT NOT NULL,
    "themes" JSONB NOT NULL,
    "scan_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_pulse_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intel_scan_runs_scan_type_started_at_idx" ON "intel_scan_runs"("scan_type", "started_at");

-- CreateIndex
CREATE INDEX "market_signals_symbol_created_at_idx" ON "market_signals"("symbol", "created_at");

-- CreateIndex
CREATE INDEX "market_signals_strategy_created_at_idx" ON "market_signals"("strategy", "created_at");

-- CreateIndex
CREATE INDEX "market_signals_sector_created_at_idx" ON "market_signals"("sector", "created_at");

-- CreateIndex
CREATE INDEX "market_news_items_symbol_created_at_idx" ON "market_news_items"("symbol", "created_at");

-- CreateIndex
CREATE INDEX "market_news_items_created_at_idx" ON "market_news_items"("created_at");

-- CreateIndex
CREATE INDEX "invest_opportunities_sector_created_at_idx" ON "invest_opportunities"("sector", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "market_pulse_snapshots_scan_run_id_key" ON "market_pulse_snapshots"("scan_run_id");

-- AddForeignKey
ALTER TABLE "market_signals" ADD CONSTRAINT "market_signals_scan_run_id_fkey" FOREIGN KEY ("scan_run_id") REFERENCES "intel_scan_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_news_items" ADD CONSTRAINT "market_news_items_scan_run_id_fkey" FOREIGN KEY ("scan_run_id") REFERENCES "intel_scan_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invest_opportunities" ADD CONSTRAINT "invest_opportunities_scan_run_id_fkey" FOREIGN KEY ("scan_run_id") REFERENCES "intel_scan_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_pulse_snapshots" ADD CONSTRAINT "market_pulse_snapshots_scan_run_id_fkey" FOREIGN KEY ("scan_run_id") REFERENCES "intel_scan_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AssetAnalysis (intel worker writes per-symbol technical snapshots)
CREATE TABLE "asset_analyses" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL DEFAULT '1h',
    "price" DOUBLE PRECISION,
    "change_pct" DOUBLE PRECISION,
    "rsi" DOUBLE PRECISION,
    "ema_20" DOUBLE PRECISION,
    "ema_50" DOUBLE PRECISION,
    "smc_structure" JSONB,
    "sentiment_rating" TEXT NOT NULL,
    "sentiment_score" DOUBLE PRECISION NOT NULL,
    "news_teasers" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_analyses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "asset_analyses_symbol_created_at_idx" ON "asset_analyses"("symbol", "created_at");
