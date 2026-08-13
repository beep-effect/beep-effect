-- Migration: 007_llm_examples
-- Description: Add LLM examples table for few-shot learning
-- Created: 2024-12-20
--
-- This migration creates the llm_examples table for storing curated examples
-- that enable few-shot prompting. Examples are scoped per-ontology and support
-- hybrid retrieval (vector similarity + full-text search).

-- =============================================================================
-- Enable required extensions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For trigram-based FTS

-- =============================================================================
-- LLM Examples Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS llm_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Scoping
    ontology_id TEXT NOT NULL,
    example_type TEXT NOT NULL,  -- entity_extraction | relation_extraction | entity_linking | negative
    source TEXT NOT NULL DEFAULT 'manual',  -- manual | validated | auto_generated

    -- Structured content
    input_text TEXT NOT NULL,
    target_class TEXT,
    target_predicate TEXT,
    evidence_text TEXT,
    evidence_start_offset INTEGER,
    evidence_end_offset INTEGER,

    -- Output
    expected_output JSONB NOT NULL,
    prompt_messages JSONB,  -- Pre-formatted user/assistant pairs
    explanation TEXT,

    -- Embedding (768-dim Nomic with ontology prefix)
    embedding vector(768) NOT NULL,

    -- Negative example metadata
    is_negative BOOLEAN NOT NULL DEFAULT FALSE,
    negative_pattern TEXT,

    -- Quality metrics
    usage_count INTEGER DEFAULT 0,
    success_rate NUMERIC(4, 3),

    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- =============================================================================
-- Basic Indexes (via Drizzle-compatible names)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_llm_examples_ontology_type
    ON llm_examples(ontology_id, example_type);

CREATE INDEX IF NOT EXISTS idx_llm_examples_ontology_active
    ON llm_examples(ontology_id, is_active);

CREATE INDEX IF NOT EXISTS idx_llm_examples_is_negative
    ON llm_examples(is_negative);

CREATE INDEX IF NOT EXISTS idx_llm_examples_target_class
    ON llm_examples(ontology_id, target_class);

CREATE INDEX IF NOT EXISTS idx_llm_examples_target_predicate
    ON llm_examples(ontology_id, target_predicate);

-- =============================================================================
-- HNSW Index for Vector Similarity Search
-- =============================================================================
-- Uses cosine distance for semantic similarity matching

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_llm_examples_embedding_hnsw'
    ) THEN
        CREATE INDEX idx_llm_examples_embedding_hnsw
            ON llm_examples
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
    END IF;
END $$;

-- =============================================================================
-- GIN Index for Full-Text Search (for negative example retrieval)
-- =============================================================================
-- Uses trigram for fuzzy matching on input_text

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_llm_examples_input_text_trgm'
    ) THEN
        CREATE INDEX idx_llm_examples_input_text_trgm
            ON llm_examples
            USING gin (input_text gin_trgm_ops);
    END IF;
END $$;

-- =============================================================================
-- Record migration
-- =============================================================================

INSERT INTO schema_migrations (version, name, applied_at)
VALUES (7, '007_llm_examples', NOW())
ON CONFLICT (version) DO NOTHING;
