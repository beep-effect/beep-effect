-- Migration: 009_processing_status
-- Description: Add 'processing' status to ingested_links check constraint
-- Created: 2024-12-22
--
-- The ingested_links table was missing 'processing' status which is needed
-- when links are actively being processed by a batch workflow.

-- Drop the old constraint (auto-named by PostgreSQL)
ALTER TABLE ingested_links DROP CONSTRAINT IF EXISTS ingested_links_status_check;

-- Add the updated constraint with 'processing' status
ALTER TABLE ingested_links ADD CONSTRAINT ingested_links_status_check
  CHECK (status IN ('pending', 'enriched', 'processing', 'processed', 'failed', 'skipped'));

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES (9, '009_processing_status')
ON CONFLICT (version) DO NOTHING;
