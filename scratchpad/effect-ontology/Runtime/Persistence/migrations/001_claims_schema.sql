-- Migration: 001_claims_schema
-- Description: Initial schema for claims, articles, and corrections
-- Created: 2024-12-18
--
-- This schema supports the three-layer claims architecture:
-- 1. Named Graphs (Article-level) - stored in GCS as TriG files
-- 2. Reified Claims (Claim-level) - stored here as relational metadata
-- 3. Materialized State (Default Graph) - stored in GCS as Turtle
--
-- The relational tables provide fast querying for:
-- - Claim lookups by article, subject, predicate
-- - Correction chain traversal
-- - Conflict detection
-- - Timeline queries (what was believed at time T?)

-- =============================================================================
-- Articles Table
-- =============================================================================
-- Tracks source articles from which claims are extracted

CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source identification
    uri TEXT UNIQUE NOT NULL,                    -- Original article URL
    source_name TEXT,                            -- Publisher name (e.g., "Seattle Times")
    headline TEXT,                               -- Article headline

    -- Bitemporal timestamps
    published_at TIMESTAMPTZ NOT NULL,           -- When article was published
    ingested_at TIMESTAMPTZ DEFAULT NOW(),       -- When we ingested it

    -- RDF graph location
    graph_uri TEXT,                              -- GCS path to named graph (TriG)

    -- Metadata
    content_hash TEXT,                           -- Hash of original content
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_uri ON articles(uri);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_name);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);

-- =============================================================================
-- Claims Table
-- =============================================================================
-- Reified claims with Wikidata-style ranks
-- Note: deprecated_by FK added later after corrections table exists

CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source article
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,

    -- RDF triple components
    subject_iri TEXT NOT NULL,                   -- Entity IRI (e.g., :jane_doe)
    predicate_iri TEXT NOT NULL,                 -- Property IRI (e.g., :hasRole)
    object_value TEXT NOT NULL,                  -- Value (IRI or literal)
    object_type TEXT DEFAULT 'iri',              -- 'iri' | 'literal' | 'typed_literal'
    object_datatype TEXT,                        -- XSD datatype for typed literals
    object_language TEXT,                        -- Language tag for literals (e.g., 'en')

    -- Wikidata-style rank
    rank TEXT NOT NULL DEFAULT 'normal'
        CHECK (rank IN ('preferred', 'normal', 'deprecated')),

    -- Temporal validity (when the claim was true in the real world)
    valid_from TIMESTAMPTZ,                      -- Start of validity period
    valid_to TIMESTAMPTZ,                        -- End of validity period

    -- Lifecycle timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),        -- When claim was extracted
    deprecated_at TIMESTAMPTZ,                   -- When claim was deprecated
    deprecated_by UUID,                          -- FK added below after corrections table

    -- Confidence and provenance
    confidence_score NUMERIC(4,3),               -- 0.000 to 1.000
    evidence_text TEXT,                          -- Supporting text span
    evidence_start_offset INTEGER,               -- Character offset in source
    evidence_end_offset INTEGER
);

CREATE INDEX IF NOT EXISTS idx_claims_article ON claims(article_id);
CREATE INDEX IF NOT EXISTS idx_claims_subject ON claims(subject_iri);
CREATE INDEX IF NOT EXISTS idx_claims_predicate ON claims(predicate_iri);
CREATE INDEX IF NOT EXISTS idx_claims_rank ON claims(rank);
CREATE INDEX IF NOT EXISTS idx_claims_valid_period ON claims(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_claims_deprecated ON claims(deprecated_at) WHERE deprecated_at IS NOT NULL;

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_claims_subject_predicate ON claims(subject_iri, predicate_iri);

-- =============================================================================
-- Corrections Table
-- =============================================================================
-- Tracks corrections, retractions, and updates with PROV-O semantics

CREATE TABLE IF NOT EXISTS corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Correction type (PROV-O inspired)
    correction_type TEXT NOT NULL
        CHECK (correction_type IN ('retraction', 'clarification', 'update', 'amendment')),

    -- Source of correction
    source_article_id UUID REFERENCES articles(id),

    -- Correction metadata
    reason TEXT,                                 -- Human-readable explanation
    correction_date TIMESTAMPTZ NOT NULL,        -- When correction was issued

    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ                     -- When we processed the correction
);

CREATE INDEX IF NOT EXISTS idx_corrections_type ON corrections(correction_type);
CREATE INDEX IF NOT EXISTS idx_corrections_source ON corrections(source_article_id);
CREATE INDEX IF NOT EXISTS idx_corrections_date ON corrections(correction_date);

-- Add FK from claims.deprecated_by to corrections now that both tables exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'claims_deprecated_by_fkey'
    ) THEN
        ALTER TABLE claims ADD CONSTRAINT claims_deprecated_by_fkey
            FOREIGN KEY (deprecated_by) REFERENCES corrections(id);
    END IF;
END $$;

-- =============================================================================
-- Correction Claims Junction Table
-- =============================================================================
-- Links corrections to affected claims (original and replacement)

CREATE TABLE IF NOT EXISTS correction_claims (
    correction_id UUID NOT NULL REFERENCES corrections(id) ON DELETE CASCADE,
    original_claim_id UUID NOT NULL REFERENCES claims(id),
    new_claim_id UUID REFERENCES claims(id),     -- NULL for pure retractions

    PRIMARY KEY (correction_id, original_claim_id)
);

CREATE INDEX IF NOT EXISTS idx_correction_claims_original ON correction_claims(original_claim_id);
CREATE INDEX IF NOT EXISTS idx_correction_claims_new ON correction_claims(new_claim_id);

-- =============================================================================
-- Conflicts Table
-- =============================================================================
-- Detected conflicts between claims (for human review)

CREATE TABLE IF NOT EXISTS conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Conflict type
    conflict_type TEXT NOT NULL
        CHECK (conflict_type IN ('position', 'temporal', 'contradictory', 'duplicate')),

    -- Conflicting claims
    claim_a_id UUID NOT NULL REFERENCES claims(id),
    claim_b_id UUID NOT NULL REFERENCES claims(id),

    -- Status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'resolved', 'ignored')),

    -- Resolution (when resolved)
    resolution_strategy TEXT,                    -- 'temporal_precedence' | 'source_authority' | 'manual'
    accepted_claim_id UUID REFERENCES claims(id),
    resolved_by TEXT,                            -- User/system that resolved
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,

    -- Lifecycle
    detected_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT different_claims CHECK (claim_a_id != claim_b_id)
);

CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);
CREATE INDEX IF NOT EXISTS idx_conflicts_claims ON conflicts(claim_a_id, claim_b_id);

-- =============================================================================
-- Batch Runs Table
-- =============================================================================
-- Tracks extraction batch runs for auditing

CREATE TABLE IF NOT EXISTS batch_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT UNIQUE NOT NULL,               -- External batch ID

    -- Status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed')),

    -- Metrics
    documents_total INTEGER DEFAULT 0,
    documents_processed INTEGER DEFAULT 0,
    claims_extracted INTEGER DEFAULT 0,
    conflicts_detected INTEGER DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Error info (if failed)
    error_message TEXT,
    error_details JSONB,

    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_runs_batch_id ON batch_runs(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_runs_status ON batch_runs(status);

-- =============================================================================
-- Migration Metadata
-- =============================================================================
-- Tracks applied migrations

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Record this migration
INSERT INTO schema_migrations (version, name)
VALUES (1, '001_claims_schema')
ON CONFLICT (version) DO NOTHING;
