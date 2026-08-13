-- Migration: 002_bitemporal_timestamps
-- Description: Add bitemporal transaction time columns for timeline queries
-- Created: 2024-12-18
--
-- This migration adds transaction time properties to support bitemporal queries:
-- - "What did the system know at time T?"
-- - "When did we assert/derive this claim?"
--
-- Valid time (validFrom, validUntil) was already present in 001_claims_schema.
-- Transaction time (assertedAt, derivedAt) is added here.

-- =============================================================================
-- Articles Table: Add ingestedAt if not exists
-- =============================================================================
-- Note: ingested_at already exists in 001_claims_schema as DEFAULT NOW()
-- No changes needed for articles table

-- =============================================================================
-- Claims Table: Rename created_at → asserted_at, add derived_at
-- =============================================================================

-- Rename created_at to asserted_at for semantic clarity
-- (created_at is when claim was asserted to KB)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'claims' AND column_name = 'created_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'claims' AND column_name = 'asserted_at'
    ) THEN
        ALTER TABLE claims RENAME COLUMN created_at TO asserted_at;
    END IF;
END $$;

-- Add derived_at column for DerivedAssertion claims
-- NULL for extracted claims, populated for inferred claims
ALTER TABLE claims ADD COLUMN IF NOT EXISTS derived_at TIMESTAMPTZ;

-- Add index for derived_at queries (e.g., "show facts inferred today")
CREATE INDEX IF NOT EXISTS idx_claims_derived_at ON claims(derived_at)
    WHERE derived_at IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN claims.asserted_at IS 'Transaction time: when this claim was asserted to the knowledge base';
COMMENT ON COLUMN claims.derived_at IS 'Transaction time: when this derived assertion was produced by inference (NULL for extracted claims)';

-- =============================================================================
-- Migration Metadata
-- =============================================================================

INSERT INTO schema_migrations (version, name)
VALUES (2, '002_bitemporal_timestamps')
ON CONFLICT (version) DO NOTHING;
