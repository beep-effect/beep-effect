-- Migration: 003_claim_idempotency
-- Description: Add unique constraint for claim idempotency
-- Created: 2024-12-19
--
-- This constraint ensures that duplicate extractions don't create duplicate claims.
-- The natural key (article_id, subject_iri, predicate_iri, object_value) uniquely
-- identifies a claim - if we extract the same fact from the same article twice,
-- we should not insert a duplicate row.
--
-- This enables ON CONFLICT DO NOTHING for idempotent upserts.

-- =============================================================================
-- Unique Constraint for Claim Idempotency
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_natural_key
  ON claims (article_id, subject_iri, predicate_iri, object_value);

-- Record this migration
INSERT INTO schema_migrations (version, name)
VALUES (3, '003_claim_idempotency')
ON CONFLICT (version) DO NOTHING;
