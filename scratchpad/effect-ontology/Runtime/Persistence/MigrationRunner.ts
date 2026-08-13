/**
 * Database Migration Runner
 *
 * Applies SQL migrations in order, tracking which have been applied.
 * Uses the schema_migrations table to track applied versions.
 *
 * @since 2.0.0
 * @module Runtime/Persistence/MigrationRunner
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Layer } from "effect";

const $I = $ScratchpadId.create("effect-ontology/Runtime/Persistence/MigrationRunner");

import { Effect, Option } from "effect";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import { SqlClient } from "effect/unstable/sql";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export interface MigrationResult {
  readonly applied: ReadonlyArray<Migration>;
  readonly skipped: ReadonlyArray<number>;
  readonly errors: ReadonlyArray<{ version: number; error: string }>;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export interface MigrationRunnerService {
  readonly getCurrentVersion: Effect.Effect<number>;
  readonly applyMigration: (
    migration: Migration
  ) => Effect.Effect<void, { readonly version: number; readonly error: string }>;
  readonly runMigrations: (migrations: ReadonlyArray<Migration>) => Effect.Effect<MigrationResult>;
}

export class MigrationRunner extends Context.Service<MigrationRunner, MigrationRunnerService>()($I`MigrationRunner`, {
  make: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    /**
     * Get the current schema version
     */
    const getCurrentVersion = Effect.gen(function* () {
      const result = yield* sql`
        SELECT COALESCE(MAX(version), 0) as version
        FROM schema_migrations
      `.pipe(
        Effect.orElseSucceed(() =>
          // Table doesn't exist yet
          [{ version: 0 }]
        )
      );
      return (result[0]?.version as number) ?? 0;
    });

    /**
     * Apply a single migration within a transaction
     */
    const applyMigration = Effect.fn("MigrationRunner.applyMigration")(function* (
      migration: Migration
    ): Effect.fn.Return<void, { readonly version: number; readonly error: string }> {
      return yield* Effect.gen(function* () {
        yield* Effect.logInfo(`Applying migration ${migration.version}: ${migration.name}`);
        yield* sql.unsafe(migration.sql);
        yield* sql`
          INSERT INTO schema_migrations (version, name)
          VALUES (${migration.version},
                  ${migration.name}) ON CONFLICT (version) DO NOTHING
        `;
        yield* Effect.logInfo(`Migration ${migration.version} applied successfully`);
      }).pipe(
        Effect.mapError((error) => ({
          version: migration.version,
          error: error instanceof Error ? error.message : String(error),
        }))
      );
    });

    /**
     * Run all pending migrations
     */
    const runMigrations = Effect.fn("MigrationRunner.runMigrations")(function* (
      migrations: ReadonlyArray<Migration>
    ): Effect.fn.Return<MigrationResult> {
      const currentVersion = yield* getCurrentVersion;
      yield* Effect.logInfo(`Current schema version: ${currentVersion}`);

      const sorted = A.sort(
        migrations,
        Order.mapInput(Order.Number, (migration: Migration) => migration.version)
      );
      const pending = A.filter(sorted, (migration) => migration.version > currentVersion);

      if (pending.length === 0) {
        yield* Effect.logInfo("No pending migrations");
        return {
          applied: [] as Array<Migration>,
          skipped: A.map(
            A.filter(sorted, (migration) => migration.version <= currentVersion),
            (migration) => migration.version
          ),
          errors: [],
        } satisfies MigrationResult;
      }

      yield* Effect.logInfo(`Found ${pending.length} pending migrations`);

      const applied: Array<Migration> = [];
      const errors: Array<{ version: number; error: string }> = [];

      for (const migration of pending) {
        const result = yield* applyMigration(migration).pipe(
          Effect.map(() => Option.some(migration)),
          Effect.catch((err) => {
            errors.push(err);
            return Effect.succeed(Option.none<Migration>());
          })
        );

        if (Option.isSome(result)) {
          applied.push(result.value);
        } else {
          // Stop on first error
          break;
        }
      }

      return {
        applied,
        skipped: A.map(
          A.filter(sorted, (migration) => migration.version <= currentVersion),
          (migration) => migration.version
        ),
        errors,
      } satisfies MigrationResult;
    });

    return {
      getCurrentVersion,
      applyMigration,
      runMigrations,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}

// -----------------------------------------------------------------------------
// Convenience Layer
// -----------------------------------------------------------------------------

/**
 * Layer that provides MigrationRunner with SqlClient dependency
 */
export const MigrationRunnerLive = MigrationRunner.Default;

// -----------------------------------------------------------------------------
// Pre-defined Migrations (embedded SQL)
// -----------------------------------------------------------------------------

/**
 * All migrations to apply at startup.
 * SQL is embedded to avoid runtime file system dependencies.
 */
export const AllMigrations: ReadonlyArray<Migration> = [
  {
    version: 1,
    name: "001_claims_schema",
    sql: `-- Initial schema for claims, articles, and corrections
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uri TEXT UNIQUE NOT NULL,
    source_name TEXT,
    headline TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ DEFAULT NOW(),
    graph_uri TEXT,
    content_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_articles_uri ON articles(uri);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_name);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);

CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    subject_iri TEXT NOT NULL,
    predicate_iri TEXT NOT NULL,
    object_value TEXT NOT NULL,
    object_type TEXT DEFAULT 'iri',
    object_datatype TEXT,
    object_language TEXT,
    rank TEXT NOT NULL DEFAULT 'normal' CHECK (rank IN ('preferred', 'normal', 'deprecated')),
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deprecated_at TIMESTAMPTZ,
    deprecated_by UUID,
    confidence_score NUMERIC(4,3),
    evidence_text TEXT,
    evidence_start_offset INTEGER,
    evidence_end_offset INTEGER
);
CREATE INDEX IF NOT EXISTS idx_claims_article ON claims(article_id);
CREATE INDEX IF NOT EXISTS idx_claims_subject ON claims(subject_iri);
CREATE INDEX IF NOT EXISTS idx_claims_predicate ON claims(predicate_iri);
CREATE INDEX IF NOT EXISTS idx_claims_rank ON claims(rank);
CREATE INDEX IF NOT EXISTS idx_claims_valid_period ON claims(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_claims_deprecated ON claims(deprecated_at) WHERE deprecated_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_claims_subject_predicate ON claims(subject_iri, predicate_iri);

CREATE TABLE IF NOT EXISTS corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correction_type TEXT NOT NULL CHECK (correction_type IN ('retraction', 'clarification', 'update', 'amendment')),
    source_article_id UUID REFERENCES articles(id),
    reason TEXT,
    correction_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_corrections_type ON corrections(correction_type);
CREATE INDEX IF NOT EXISTS idx_corrections_source ON corrections(source_article_id);
CREATE INDEX IF NOT EXISTS idx_corrections_date ON corrections(correction_date);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'claims_deprecated_by_fkey') THEN
        ALTER TABLE claims ADD CONSTRAINT claims_deprecated_by_fkey FOREIGN KEY (deprecated_by) REFERENCES corrections(id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS correction_claims (
    correction_id UUID NOT NULL REFERENCES corrections(id) ON DELETE CASCADE,
    original_claim_id UUID NOT NULL REFERENCES claims(id),
    new_claim_id UUID REFERENCES claims(id),
    PRIMARY KEY (correction_id, original_claim_id)
);
CREATE INDEX IF NOT EXISTS idx_correction_claims_original ON correction_claims(original_claim_id);
CREATE INDEX IF NOT EXISTS idx_correction_claims_new ON correction_claims(new_claim_id);

CREATE TABLE IF NOT EXISTS conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_type TEXT NOT NULL CHECK (conflict_type IN ('position', 'temporal', 'contradictory', 'duplicate')),
    claim_a_id UUID NOT NULL REFERENCES claims(id),
    claim_b_id UUID NOT NULL REFERENCES claims(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
    resolution_strategy TEXT,
    accepted_claim_id UUID REFERENCES claims(id),
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT different_claims CHECK (claim_a_id != claim_b_id)
);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);
CREATE INDEX IF NOT EXISTS idx_conflicts_claims ON conflicts(claim_a_id, claim_b_id);

CREATE TABLE IF NOT EXISTS batch_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    documents_total INTEGER DEFAULT 0,
    documents_processed INTEGER DEFAULT 0,
    claims_extracted INTEGER DEFAULT 0,
    conflicts_detected INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_batch_runs_batch_id ON batch_runs(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_runs_status ON batch_runs(status);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    version: 2,
    name: "002_bitemporal_timestamps",
    sql: `-- Add bitemporal transaction time columns
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'claims' AND column_name = 'created_at')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'claims' AND column_name = 'asserted_at')
    THEN
        ALTER TABLE claims RENAME COLUMN created_at TO asserted_at;
    END IF;
END $$;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS derived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_claims_derived_at ON claims(derived_at) WHERE derived_at IS NOT NULL;`,
  },
  {
    version: 3,
    name: "003_claim_idempotency",
    sql: `-- Add unique constraint for claim idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_natural_key ON claims (article_id, subject_iri, predicate_iri, object_value);`,
  },
  {
    version: 4,
    name: "004_entity_registry_pgvector",
    sql: `-- Entity Registry with pgvector for cross-batch entity linking
-- Enables building up a persistent entity store across extraction batches

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Canonical Entity Registry: The "golden" entity records
-- Each unique real-world entity has one canonical entry
CREATE TABLE IF NOT EXISTS canonical_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    iri TEXT UNIQUE NOT NULL,              -- Full IRI: http://example.org/entities/arsenal_fc
    canonical_mention TEXT NOT NULL,        -- Best mention: "Arsenal Football Club"

    -- Types (denormalized for fast filtering)
    types TEXT[] NOT NULL DEFAULT '{}',     -- Ontology class URIs

    -- Embedding for ANN similarity search (Nomic 768-dim)
    embedding vector(768) NOT NULL,

    -- Resolution metadata
    merge_count INTEGER DEFAULT 1,          -- How many entity mentions merged into this
    confidence_avg NUMERIC(4,3),            -- Average resolution confidence

    -- Temporal tracking
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast ANN search (better than IVFFlat for incremental updates)
CREATE INDEX IF NOT EXISTS idx_canonical_entities_embedding
ON canonical_entities USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Type filtering (GIN for array containment queries)
CREATE INDEX IF NOT EXISTS idx_canonical_entities_types
ON canonical_entities USING GIN (types);

-- Trigram index for fuzzy mention search
CREATE INDEX IF NOT EXISTS idx_canonical_entities_mention
ON canonical_entities USING GIN (canonical_mention gin_trgm_ops);

-- IRI lookup
CREATE INDEX IF NOT EXISTS idx_canonical_entities_iri ON canonical_entities(iri);


-- Entity Aliases: Alternative mentions mapped to canonical entities
-- Preserves provenance of how each mention was resolved
CREATE TABLE IF NOT EXISTS entity_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_entity_id UUID NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,

    -- Alias data
    mention TEXT NOT NULL,                  -- Original mention: "The Gunners"
    mention_normalized TEXT NOT NULL,       -- Lowercased, trimmed for lookup
    embedding vector(768),                  -- Optional embedding for similarity search

    -- Resolution metadata
    resolution_method TEXT NOT NULL,        -- 'exact', 'similarity', 'containment', 'neighbor'
    resolution_confidence NUMERIC(4,3) NOT NULL,

    -- Source tracking
    first_batch_id TEXT,                    -- Which batch first saw this alias
    source_article_id UUID REFERENCES articles(id),

    -- Temporal
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast exact alias lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_aliases_mention_normalized
ON entity_aliases(mention_normalized);

-- Lookup aliases for a canonical entity
CREATE INDEX IF NOT EXISTS idx_entity_aliases_canonical
ON entity_aliases(canonical_entity_id);

-- HNSW index on alias embeddings (where present) for similarity search
CREATE INDEX IF NOT EXISTS idx_entity_aliases_embedding
ON entity_aliases USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE embedding IS NOT NULL;


-- Blocking Tokens: Inverted index for fast candidate retrieval
-- Avoids O(n) scan by pre-indexing tokens from entity mentions
CREATE TABLE IF NOT EXISTS entity_blocking_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_entity_id UUID NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
    token TEXT NOT NULL,                    -- Normalized token (lowercase, >2 chars)
    token_type TEXT DEFAULT 'mention'       -- 'mention', 'type', 'attribute'
);

-- Token lookup for blocking
CREATE INDEX IF NOT EXISTS idx_blocking_tokens_token
ON entity_blocking_tokens(token);

-- Cleanup when canonical is deleted
CREATE INDEX IF NOT EXISTS idx_blocking_tokens_entity
ON entity_blocking_tokens(canonical_entity_id);

-- Composite for efficient blocking queries
CREATE INDEX IF NOT EXISTS idx_blocking_tokens_composite
ON entity_blocking_tokens(token, canonical_entity_id);`,
  },
  {
    version: 5,
    name: "005_ontology_scoping",
    sql: `-- Add ontology_id to articles, claims for namespace scoping
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ontology_id TEXT;
UPDATE articles SET ontology_id = 'seattle' WHERE ontology_id IS NULL;
ALTER TABLE articles ALTER COLUMN ontology_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_ontology_id ON articles(ontology_id);
CREATE INDEX IF NOT EXISTS idx_articles_ontology_source ON articles(ontology_id, source_name);
CREATE INDEX IF NOT EXISTS idx_articles_ontology_published ON articles(ontology_id, published_at DESC);

ALTER TABLE claims ADD COLUMN IF NOT EXISTS ontology_id TEXT;
UPDATE claims SET ontology_id = 'seattle' WHERE ontology_id IS NULL;
ALTER TABLE claims ALTER COLUMN ontology_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_claims_ontology_id ON claims(ontology_id);
CREATE INDEX IF NOT EXISTS idx_claims_ontology_subject ON claims(ontology_id, subject_iri);
CREATE INDEX IF NOT EXISTS idx_claims_ontology_predicate ON claims(ontology_id, predicate_iri);
CREATE INDEX IF NOT EXISTS idx_claims_ontology_subject_predicate ON claims(ontology_id, subject_iri, predicate_iri);`,
  },
  {
    version: 6,
    name: "006_entity_registry_scoping",
    sql: `-- Add ontology_id scoping to entity registry tables
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'canonical_entities' AND column_name = 'ontology_id'
    ) THEN
        ALTER TABLE canonical_entities ADD COLUMN ontology_id TEXT NOT NULL DEFAULT 'default';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_canonical_entities_ontology_id ON canonical_entities(ontology_id);
CREATE INDEX IF NOT EXISTS idx_canonical_entities_ontology_iri ON canonical_entities(ontology_id, iri);

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'entity_aliases' AND column_name = 'ontology_id'
    ) THEN
        ALTER TABLE entity_aliases ADD COLUMN ontology_id TEXT NOT NULL DEFAULT 'default';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_entity_aliases_mention_normalized;
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_aliases_ontology_mention ON entity_aliases(ontology_id, mention_normalized);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_ontology ON entity_aliases(ontology_id);

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'entity_blocking_tokens' AND column_name = 'ontology_id'
    ) THEN
        ALTER TABLE entity_blocking_tokens ADD COLUMN ontology_id TEXT NOT NULL DEFAULT 'default';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_blocking_tokens_ontology_token ON entity_blocking_tokens(ontology_id, token);`,
  },
  {
    version: 7,
    name: "007_llm_examples",
    sql: `-- LLM examples table for few-shot learning
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS llm_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ontology_id TEXT NOT NULL,
    example_type TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    input_text TEXT NOT NULL,
    target_class TEXT,
    target_predicate TEXT,
    evidence_text TEXT,
    evidence_start_offset INTEGER,
    evidence_end_offset INTEGER,
    expected_output JSONB NOT NULL,
    prompt_messages JSONB,
    explanation TEXT,
    embedding vector(768) NOT NULL,
    is_negative BOOLEAN NOT NULL DEFAULT FALSE,
    negative_pattern TEXT,
    usage_count INTEGER DEFAULT 0,
    success_rate NUMERIC(4, 3),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_llm_examples_ontology_type ON llm_examples(ontology_id, example_type);
CREATE INDEX IF NOT EXISTS idx_llm_examples_ontology_active ON llm_examples(ontology_id, is_active);
CREATE INDEX IF NOT EXISTS idx_llm_examples_is_negative ON llm_examples(is_negative);
CREATE INDEX IF NOT EXISTS idx_llm_examples_target_class ON llm_examples(ontology_id, target_class);
CREATE INDEX IF NOT EXISTS idx_llm_examples_target_predicate ON llm_examples(ontology_id, target_predicate);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_llm_examples_embedding_hnsw') THEN
        CREATE INDEX idx_llm_examples_embedding_hnsw ON llm_examples USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_llm_examples_input_text_trgm') THEN
        CREATE INDEX idx_llm_examples_input_text_trgm ON llm_examples USING gin (input_text gin_trgm_ops);
    END IF;
END $$;`,
  },
  {
    version: 8,
    name: "008_content_hash_scoping",
    sql: `-- Ensure ingested_links exists before the ontology-scoped unique constraint.
-- The checked-in 004_ingested_links.sql was never part of AllMigrations, so a
-- fresh database would otherwise fail here on a missing table.
CREATE TABLE IF NOT EXISTS ingested_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_hash VARCHAR(64) NOT NULL UNIQUE,
    source_uri TEXT,
    source_type VARCHAR(32),
    headline TEXT,
    description TEXT,
    published_at TIMESTAMPTZ,
    author TEXT,
    organization TEXT,
    language VARCHAR(8) DEFAULT 'en',
    topics JSONB DEFAULT '[]'::jsonb,
    key_entities JSONB DEFAULT '[]'::jsonb,
    storage_uri TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'enriched', 'processed', 'failed', 'skipped')),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enriched_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    word_count INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ingested_links ADD COLUMN IF NOT EXISTS ontology_id TEXT;

-- Change content_hash unique constraint to be scoped by ontology_id
-- Previously content_hash was globally unique, preventing the same content
-- from being ingested into multiple ontologies.

-- Drop the old global unique constraint on content_hash
ALTER TABLE ingested_links DROP CONSTRAINT IF EXISTS ingested_links_content_hash_key;

-- Add composite unique constraint scoped by ontology_id
ALTER TABLE ingested_links ADD CONSTRAINT ingested_links_ontology_content_unique
    UNIQUE (ontology_id, content_hash);

-- Index for looking up by content hash within an ontology
CREATE INDEX IF NOT EXISTS idx_ingested_links_ontology_content_hash
    ON ingested_links(ontology_id, content_hash);`,
  },
  {
    version: 9,
    name: "009_processing_status",
    sql: `-- Add 'processing' status to ingested_links check constraint
-- The ingested_links table was missing 'processing' status which is needed
-- when links are actively being processed by a batch workflow.

-- Drop the old constraint (auto-named by PostgreSQL)
ALTER TABLE ingested_links DROP CONSTRAINT IF EXISTS ingested_links_status_check;

-- Add the updated constraint with 'processing' status
ALTER TABLE ingested_links ADD CONSTRAINT ingested_links_status_check
  CHECK (status IN ('pending', 'enriched', 'processing', 'processed', 'failed', 'skipped'));`,
  },
];
