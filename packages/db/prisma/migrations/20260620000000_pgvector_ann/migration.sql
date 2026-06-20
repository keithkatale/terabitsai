-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add native vector column to document_embeddings (768-dim for Gemini text-embedding-004)
ALTER TABLE "document_embeddings"
  ADD COLUMN IF NOT EXISTS "embedding_vec" vector(768);

-- Populate embedding_vec from existing JSONB embeddings (best-effort)
UPDATE "document_embeddings"
SET "embedding_vec" = (
  SELECT ('[' || array_to_string(
    ARRAY(
      SELECT jsonb_array_elements_text("embedding")::float
    ),
    ','
  ) || ']')::vector
)
WHERE "embedding_vec" IS NULL
  AND jsonb_array_length("embedding") = 768;

-- Create HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS "document_embeddings_vec_hnsw_idx"
  ON "document_embeddings"
  USING hnsw ("embedding_vec" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Add vector column to historical_analogs for analog matching
ALTER TABLE "historical_analogs"
  ADD COLUMN IF NOT EXISTS "context_embedding_vec" vector(768);

CREATE INDEX IF NOT EXISTS "historical_analogs_vec_hnsw_idx"
  ON "historical_analogs"
  USING hnsw ("context_embedding_vec" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
