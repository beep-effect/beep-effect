-- Migration: 008_content_hash_scoping
-- Description: Change content_hash unique constraint to be scoped by ontology_id
-- Created: 2024-12-21
--
-- Previously content_hash was globally unique, preventing the same content
-- from being ingested into multiple ontologies. This migration changes the
-- uniqueness to be per-ontology: (ontology_id, content_hash).

-- =============================================================================
-- Update Unique Constraint
-- =============================================================================

-- Drop the old global unique constraint on content_hash
ALTER TABLE ingested_links DROP CONSTRAINT IF EXISTS ingested_links_content_hash_key;

-- Add composite unique constraint scoped by ontology_id
-- This allows the same content (same hash) to exist in multiple ontologies
ALTER TABLE ingested_links ADD CONSTRAINT ingested_links_ontology_content_unique
    UNIQUE (ontology_id, content_hash);

-- =============================================================================
-- Add Index for Content Hash Lookups
-- =============================================================================

-- Index for looking up by content hash within an ontology
-- This is used by the duplicate detection in LinkIngestionService
CREATE INDEX IF NOT EXISTS idx_ingested_links_ontology_content_hash
    ON ingested_links(ontology_id, content_hash);

-- =============================================================================
-- Record Migration
-- =============================================================================

INSERT INTO schema_migrations (version, name)
VALUES (8, '008_content_hash_scoping')
ON CONFLICT (version) DO NOTHING;
