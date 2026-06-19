-- Market synthesis platform tables + pgvector extension

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "intel_documents" (
    "id" TEXT NOT NULL,
    "diet" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT,
    "symbol" TEXT,
    "symbols" TEXT[],
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "sentiment" DOUBLE PRECISION,
    "event_type" TEXT,
    "published_at" TIMESTAMP(3),
    "payload" JSONB,
    "scan_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "intel_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "intel_documents_source_external_id_key" ON "intel_documents"("source", "external_id");
CREATE INDEX IF NOT EXISTS "intel_documents_symbol_published_at_idx" ON "intel_documents"("symbol", "published_at");
CREATE INDEX IF NOT EXISTS "intel_documents_diet_created_at_idx" ON "intel_documents"("diet", "created_at");

CREATE TABLE IF NOT EXISTS "document_embeddings" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL DEFAULT 0,
    "embedding" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_embeddings_document_id_key" ON "document_embeddings"("document_id");

CREATE TABLE IF NOT EXISTS "synthesis_briefs" (
    "id" TEXT NOT NULL,
    "brief_type" TEXT NOT NULL,
    "symbols" TEXT[],
    "headline" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "bullets" JSONB NOT NULL,
    "impact_score" INTEGER NOT NULL DEFAULT 5,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "provenance" JSONB NOT NULL,
    "analogs" JSONB,
    "regime" TEXT,
    "expires_at" TIMESTAMP(3),
    "scan_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "synthesis_briefs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "synthesis_briefs_brief_type_created_at_idx" ON "synthesis_briefs"("brief_type", "created_at");
CREATE INDEX IF NOT EXISTS "synthesis_briefs_symbols_idx" ON "synthesis_briefs" USING GIN ("symbols");

CREATE TABLE IF NOT EXISTS "entity_nodes" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "symbol" TEXT,
    "metadata" JSONB,
    CONSTRAINT "entity_nodes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "entity_nodes_symbol_idx" ON "entity_nodes"("symbol");
CREATE INDEX IF NOT EXISTS "entity_nodes_type_label_idx" ON "entity_nodes"("type", "label");

CREATE TABLE IF NOT EXISTS "entity_edges" (
    "id" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "source_doc_id" TEXT,
    CONSTRAINT "entity_edges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "entity_edges_from_id_idx" ON "entity_edges"("from_id");
CREATE INDEX IF NOT EXISTS "entity_edges_to_id_idx" ON "entity_edges"("to_id");

ALTER TABLE "entity_edges" DROP CONSTRAINT IF EXISTS "entity_edges_from_id_fkey";
ALTER TABLE "entity_edges" ADD CONSTRAINT "entity_edges_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "entity_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entity_edges" DROP CONSTRAINT IF EXISTS "entity_edges_to_id_fkey";
ALTER TABLE "entity_edges" ADD CONSTRAINT "entity_edges_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "entity_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_embeddings" DROP CONSTRAINT IF EXISTS "document_embeddings_document_id_fkey";
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "intel_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "macro_regime_snapshots" (
    "id" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "themes" JSONB NOT NULL,
    "fred_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "macro_regime_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "historical_analogs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT,
    "synthesis_id" TEXT,
    "symbol" TEXT,
    "event_summary" TEXT NOT NULL,
    "context_embedding" JSONB,
    "return_1h" DOUBLE PRECISION,
    "return_1d" DOUBLE PRECISION,
    "return_1w" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historical_analogs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "historical_analogs_symbol_created_at_idx" ON "historical_analogs"("symbol", "created_at");

CREATE TABLE IF NOT EXISTS "contradiction_alerts" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "news_bias" TEXT NOT NULL,
    "flow_bias" TEXT,
    "technical_bias" TEXT,
    "summary" TEXT NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 5,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contradiction_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contradiction_alerts_symbol_created_at_idx" ON "contradiction_alerts"("symbol", "created_at");

-- Optional pgvector column for future native vector search
DO $$ BEGIN
  ALTER TABLE "document_embeddings" ADD COLUMN IF NOT EXISTS "embedding_vec" vector(768);
EXCEPTION WHEN others THEN NULL;
END $$;
