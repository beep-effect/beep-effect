-- Migration: 005_ontology_scoping
-- Description: Add ontology_id to articles, claims, and ingested_links for namespace scoping
-- Created: 2024-12-20
--
-- Enables multi-ontology support by scoping all data to a specific ontology.
-- Backfills existing data with 'seattle' as the default ontology.

-- =============================================================================
-- Add ontology_id to articles
-- =============================================================================

ALTER TABLE articles ADD COLUMN IF NOT EXISTS ontology_id TEXT;

-- Backfill existing data
UPDATE articles SET ontology_id = 'seattle' WHERE ontology_id IS NULL;

-- Add NOT NULL constraint
ALTER TABLE articles ALTER COLUMN ontology_id SET NOT NULL;

-- Add index for scoped queries
CREATE INDEX IF NOT EXISTS idx_articles_ontology_id ON articles(ontology_id);

-- Composite index for common scoped queries
CREATE INDEX IF NOT EXISTS idx_articles_ontology_source ON articles(ontology_id, source_name);
CREATE INDEX IF NOT EXISTS idx_articles_ontology_published ON articles(ontology_id, published_at DESC);

-- =============================================================================
-- Add ontology_id to claims
-- =============================================================================

ALTER TABLE claims ADD COLUMN IF NOT EXISTS ontology_id TEXT;

-- Backfill existing data
UPDATE claims SET ontology_id = 'seattle' WHERE ontology_id IS NULL;

-- Add NOT NULL constraint
ALTER TABLE claims ALTER COLUMN ontology_id SET NOT NULL;

-- Add index for scoped queries
CREATE INDEX IF NOT EXISTS idx_claims_ontology_id ON claims(ontology_id);

-- Composite indexes for common scoped queries
CREATE INDEX IF NOT EXISTS idx_claims_ontology_subject ON claims(ontology_id, subject_iri);
CREATE INDEX IF NOT EXISTS idx_claims_ontology_predicate ON claims(ontology_id, predicate_iri);
CREATE INDEX IF NOT EXISTS idx_claims_ontology_subject_predicate ON claims(ontology_id, subject_iri, predicate_iri);

-- =============================================================================
-- Add ontology_id to ingested_links
-- =============================================================================

ALTER TABLE ingested_links ADD COLUMN IF NOT EXISTS ontology_id TEXT;

-- Backfill existing data
UPDATE ingested_links SET ontology_id = 'seattle' WHERE ontology_id IS NULL;

-- Add NOT NULL constraint
ALTER TABLE ingested_links ALTER COLUMN ontology_id SET NOT NULL;

-- Add index for scoped queries
CREATE INDEX IF NOT EXISTS idx_ingested_links_ontology_id ON ingested_links(ontology_id);

-- Composite index for common scoped queries
CREATE INDEX IF NOT EXISTS idx_ingested_links_ontology_status ON ingested_links(ontology_id, status);

-- =============================================================================
-- Record Migration
-- =============================================================================

INSERT INTO schema_migrations (version, name)
VALUES (5, '005_ontology_scoping')
ON CONFLICT (version) DO NOTHING;
