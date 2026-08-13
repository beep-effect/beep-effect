-- Migration: 006_entity_registry_scoping
-- Description: Add ontology_id scoping to entity registry tables
-- Created: 2024-12-20
--
-- This migration adds ontology_id to canonical_entities, entity_aliases, and
-- entity_blocking_tokens tables. Entities are now scoped per ontology to prevent
-- cross-ontology contamination (e.g., Seattle entities don't pollute other ontologies).
--
-- For cross-ontology linking, use externalIds (e.g., Wikidata QIDs) rather than
-- sharing entities across ontologies.

-- =============================================================================
-- Enable pgvector if not already enabled
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- Canonical Entities Table
-- =============================================================================
-- The "golden" entity records. Each unique real-world entity has one canonical
-- entry per ontology.

CREATE TABLE IF NOT EXISTS canonical_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ontology scoping (entities are scoped per ontology)
    ontology_id TEXT NOT NULL DEFAULT 'default',

    -- Identity
    iri TEXT UNIQUE NOT NULL,                    -- Entity IRI (unique globally)
    canonical_mention TEXT NOT NULL,             -- Preferred surface form

    -- Types (denormalized for fast filtering)
    types TEXT[] NOT NULL DEFAULT '{}',

    -- Embedding for ANN similarity search (Nomic 768-dim)
    embedding vector(768) NOT NULL,

    -- Resolution metadata
    merge_count INTEGER DEFAULT 1,               -- How many entities merged into this
    confidence_avg NUMERIC(4,3),                 -- Average confidence of resolution

    -- Temporal tracking
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add ontology_id if the table already exists but column doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'canonical_entities' AND column_name = 'ontology_id'
    ) THEN
        ALTER TABLE canonical_entities ADD COLUMN ontology_id TEXT NOT NULL DEFAULT 'default';
    END IF;
END $$;

-- Indexes for canonical entities
CREATE INDEX IF NOT EXISTS idx_canonical_entities_iri ON canonical_entities(iri);
CREATE INDEX IF NOT EXISTS idx_canonical_entities_ontology_id ON canonical_entities(ontology_id);
CREATE INDEX IF NOT EXISTS idx_canonical_entities_ontology_iri ON canonical_entities(ontology_id, iri);
CREATE INDEX IF NOT EXISTS idx_canonical_entities_types ON canonical_entities USING gin(types);

-- HNSW index for ANN similarity search (create if not exists by checking)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_canonical_entities_embedding_hnsw'
    ) THEN
        CREATE INDEX idx_canonical_entities_embedding_hnsw
            ON canonical_entities
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
    END IF;
END $$;

-- =============================================================================
-- Entity Aliases Table
-- =============================================================================
-- Alternative mentions mapped to canonical entities.

CREATE TABLE IF NOT EXISTS entity_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ontology scoping
    ontology_id TEXT NOT NULL DEFAULT 'default',

    canonical_entity_id UUID NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,

    -- Alias data
    mention TEXT NOT NULL,                       -- Raw surface form
    mention_normalized TEXT NOT NULL,            -- Lowercased, trimmed
    embedding vector(768),                       -- Optional embedding for similarity

    -- Resolution metadata
    resolution_method TEXT NOT NULL,             -- 'exact', 'similarity', 'containment', 'neighbor', 'manual'
    resolution_confidence NUMERIC(4,3) NOT NULL,

    -- Source tracking
    first_batch_id TEXT,
    source_article_id UUID REFERENCES articles(id),

    -- Temporal
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add ontology_id if the table already exists but column doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'entity_aliases' AND column_name = 'ontology_id'
    ) THEN
        ALTER TABLE entity_aliases ADD COLUMN ontology_id TEXT NOT NULL DEFAULT 'default';
    END IF;
END $$;

-- Drop old unique index if it exists (was on mention_normalized alone)
DROP INDEX IF EXISTS idx_entity_aliases_mention_normalized;

-- Create new ontology-scoped unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_aliases_ontology_mention
    ON entity_aliases(ontology_id, mention_normalized);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_canonical ON entity_aliases(canonical_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_ontology ON entity_aliases(ontology_id);

-- =============================================================================
-- Entity Blocking Tokens Table
-- =============================================================================
-- Inverted index for fast candidate retrieval during entity resolution.

CREATE TABLE IF NOT EXISTS entity_blocking_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ontology scoping
    ontology_id TEXT NOT NULL DEFAULT 'default',

    canonical_entity_id UUID NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
    token TEXT NOT NULL,                         -- Blocking token (lowercased word)
    token_type TEXT DEFAULT 'mention'            -- 'mention', 'type', 'attribute'
);

-- Add ontology_id if the table already exists but column doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'entity_blocking_tokens' AND column_name = 'ontology_id'
    ) THEN
        ALTER TABLE entity_blocking_tokens ADD COLUMN ontology_id TEXT NOT NULL DEFAULT 'default';
    END IF;
END $$;

-- Indexes for blocking tokens (ontology-scoped)
CREATE INDEX IF NOT EXISTS idx_blocking_tokens_token ON entity_blocking_tokens(token);
CREATE INDEX IF NOT EXISTS idx_blocking_tokens_entity ON entity_blocking_tokens(canonical_entity_id);
CREATE INDEX IF NOT EXISTS idx_blocking_tokens_ontology_token ON entity_blocking_tokens(ontology_id, token);
CREATE INDEX IF NOT EXISTS idx_blocking_tokens_composite ON entity_blocking_tokens(ontology_id, token, canonical_entity_id);

-- =============================================================================
-- Record migration
-- =============================================================================

INSERT INTO schema_migrations (version, name, applied_at)
VALUES (6, '006_entity_registry_scoping', NOW())
ON CONFLICT (version) DO NOTHING;
