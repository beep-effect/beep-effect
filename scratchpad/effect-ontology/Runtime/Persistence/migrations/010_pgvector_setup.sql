-- Migration: 010_pgvector_setup
-- Description: Add embeddings table for persistent vector storage with hybrid search
-- Created: 2024-12-24
--
-- Stores embeddings for ontology classes, entities, and claims to enable:
-- - Persistent vector search (survives restarts)
-- - Hybrid search via RRF (vector + full-text)
-- - Provider-agnostic embedding storage

-- Enable pgvector extension (should already exist but idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- Embeddings Table
-- =============================================================================
-- Separate from domain tables for clean separation and flexible indexing.
-- Supports multiple embedding dimensions via flexible vector column.

CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What this embedding represents
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('class', 'entity', 'claim', 'example')),
  entity_id TEXT NOT NULL,

  -- Ontology scoping (embeddings are per-ontology)
  ontology_id TEXT NOT NULL DEFAULT 'default',

  -- The embedding vector (768-dim for Nomic, primary model)
  embedding vector(768) NOT NULL,

  -- Text content for hybrid search (tsvector for BM25-like ranking)
  content_text TEXT,
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', COALESCE(content_text, ''))) STORED,

  -- Model provenance
  model TEXT NOT NULL DEFAULT 'nomic-embed-text-v1.5',

  -- Temporal tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique per (ontology, type, id) - enables upsert
  UNIQUE(ontology_id, entity_type, entity_id)
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- IVFFlat for ANN search (good for 1K-100K vectors, fast builds)
-- Using cosine distance operator for normalized embeddings
CREATE INDEX IF NOT EXISTS idx_embeddings_ivfflat
  ON embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_embeddings_tsv
  ON embeddings USING gin(content_tsv);

-- Entity lookup indexes
CREATE INDEX IF NOT EXISTS idx_embeddings_entity_type
  ON embeddings(entity_type);

CREATE INDEX IF NOT EXISTS idx_embeddings_ontology_type
  ON embeddings(ontology_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_embeddings_ontology_entity
  ON embeddings(ontology_id, entity_type, entity_id);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Hybrid search with RRF fusion
-- Combines vector similarity and text search using Reciprocal Rank Fusion
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(768),
  query_text TEXT,
  search_ontology_id TEXT,
  search_entity_type VARCHAR(20),
  result_limit INTEGER DEFAULT 20,
  vector_weight FLOAT DEFAULT 0.6,
  text_weight FLOAT DEFAULT 0.4
)
RETURNS TABLE (
  entity_id TEXT,
  entity_type VARCHAR(20),
  rrf_score FLOAT,
  vector_rank INTEGER,
  text_rank INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
  rrf_k INTEGER := 60;  -- RRF constant (standard value)
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      e.entity_id,
      e.entity_type,
      ROW_NUMBER() OVER (ORDER BY e.embedding <=> query_embedding) as vrank
    FROM embeddings e
    WHERE e.ontology_id = search_ontology_id
      AND e.entity_type = search_entity_type
    ORDER BY e.embedding <=> query_embedding
    LIMIT result_limit * 2
  ),
  text_results AS (
    SELECT
      e.entity_id,
      e.entity_type,
      ROW_NUMBER() OVER (ORDER BY ts_rank(e.content_tsv, plainto_tsquery('english', query_text)) DESC) as trank
    FROM embeddings e
    WHERE e.ontology_id = search_ontology_id
      AND e.entity_type = search_entity_type
      AND e.content_tsv @@ plainto_tsquery('english', query_text)
    ORDER BY ts_rank(e.content_tsv, plainto_tsquery('english', query_text)) DESC
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(v.entity_id, t.entity_id) as entity_id,
      COALESCE(v.entity_type, t.entity_type) as entity_type,
      v.vrank,
      t.trank,
      -- RRF score: 1/(k + rank) only for result sets where item appears
      -- Items not in a result set get 0 contribution from that set (not penalty)
      (CASE WHEN v.vrank IS NOT NULL THEN vector_weight / (rrf_k + v.vrank) ELSE 0 END) +
      (CASE WHEN t.trank IS NOT NULL THEN text_weight / (rrf_k + t.trank) ELSE 0 END) as rrf_score
    FROM vector_results v
    FULL OUTER JOIN text_results t
      ON v.entity_id = t.entity_id AND v.entity_type = t.entity_type
  )
  SELECT
    c.entity_id,
    c.entity_type,
    c.rrf_score::FLOAT,
    COALESCE(c.vrank, 0)::INTEGER as vector_rank,
    COALESCE(c.trank, 0)::INTEGER as text_rank
  FROM combined c
  ORDER BY c.rrf_score DESC
  LIMIT result_limit;
END;
$$;

-- =============================================================================
-- Record Migration
-- =============================================================================

INSERT INTO schema_migrations (version, name)
VALUES (10, '010_pgvector_setup')
ON CONFLICT (version) DO NOTHING;
