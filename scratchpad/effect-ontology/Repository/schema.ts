/**
 * Drizzle Schema Definition
 *
 * **Details**
 *
 * PostgreSQL schema for claims, articles, corrections, conflicts, and batch runs.
 * Drives the generated baseline under `Runtime/Persistence/migrations`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Model } from "@beep/effect-drizzle";
import * as pg from "@beep/effect-drizzle/pg";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { Number as Num } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// =============================================================================
// Custom Types
// =============================================================================

/**
 * Create a pgvector custom type for a specific dimension.
 *
 * **Example** (Inspect vector n)
 *
 * ```ts
 * import { vectorN } from "@effect-ontology/Repository/schema"
 *
 * console.log(vectorN)
 * ```
 *
 * @param dimension - Vector dimension (e.g., 512, 768, 1024)
 * @returns Drizzle custom type for pgvector
 * @category repositories
 * @since 0.0.0
 */
export const vectorN = (dimension: number) =>
  customType<{ data: ReadonlyArray<number>; driverData: string }>({
    dataType() {
      return `vector(${dimension})`;
    },
    toDriver(value: ReadonlyArray<number>): string {
      return `[${A.join(
        A.map(value, (entry) => `${entry}`),
        ","
      )}]`;
    },
    fromDriver(value: string): ReadonlyArray<number> {
      // Parse "[0.1,0.2,...]" format from PostgreSQL
      const cleaned = Str.replace(/^\[|\]$/g, "")(value);
      return A.map(Str.split(",")(cleaned), Num.Number);
    },
  });

/**
 * Custom type for pgvector embedding columns (768-dimensional).
 * Used by Nomic embed text v1.5 (default dimension).
 *
 * @since 0.0.0
 * @category tables
 */
const vector768 = vectorN(768);

/**
 * Custom type for pgvector embedding columns (512-dimensional).
 * Used by Voyage-3-lite.
 *
 * @since 0.0.0
 * @category tables
 */

/**
 * Custom type for pgvector embedding columns (1024-dimensional).
 * Used by Voyage-3, Voyage-code-3, Voyage-law-2.
 *
 * @since 0.0.0
 * @category tables
 */

// =============================================================================
// Articles Table
// =============================================================================

/**
 * Provides repository access for articles.
 *
 * **Example** (Inspect articles)
 *
 * ```ts
 * import { articles } from "@effect-ontology/Repository/schema"
 *
 * console.log(articles)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
class Articles extends Model<Articles>("Articles")(
  {
    id: S.String.pipe(pg.uuid(), pg.primaryKey(), pg.defaultExpr(sql<string>`gen_random_uuid()`)),
    uri: S.NonEmptyString.pipe(pg.text()),
    ontologyId: S.NonEmptyString.pipe(pg.text(), pg.columnName("ontology_id")),
    sourceName: S.NullOr(S.String).pipe(pg.text(), pg.columnName("source_name")),
    headline: S.NullOr(S.String).pipe(pg.text()),
    publishedAt: S.Date.pipe(pg.timestamp({ mode: "date" }), pg.columnName("published_at")),
    ingestedAt: S.Date.pipe(pg.timestamp({ mode: "date" }), pg.defaultNow(), pg.columnName("ingested_at")),
    graphUri: S.NullOr(S.String).pipe(pg.text(), pg.columnName("graph_uri")),
    contentHash: S.NullOr(S.String).pipe(pg.text(), pg.columnName("content_hash")),
    createdAt: S.Date.pipe(pg.timestamp({ mode: "date" }), pg.defaultNow(), pg.columnName("created_at")),
    updatedAt: S.Date.pipe(pg.timestamp({ mode: "date" }), pg.defaultNow(), pg.columnName("updated_at")),
  },
  (table) => [
    pg.Table.uniqueIndex("articles_ontology_uri_unique", [table.ontologyId, table.uri]),
    pg.Table.index("idx_articles_uri", [table.uri]),
    pg.Table.index("idx_articles_source", [table.sourceName]),
    pg.Table.index("idx_articles_published", [table.publishedAt]),
    pg.Table.index("idx_articles_ontology_id", [table.ontologyId]),
    pg.Table.index("idx_articles_ontology_source", [table.ontologyId, table.sourceName]),
    pg.Table.index("idx_articles_ontology_published", [table.ontologyId, table.publishedAt]),
  ]
) {}

export const articles = pg.toPgTable(Articles);

// =============================================================================
// Corrections Table (defined before claims due to FK reference)
// =============================================================================

/**
 * Provides repository access for corrections.
 *
 * **Example** (Inspect corrections)
 *
 * ```ts
 * import { corrections } from "@effect-ontology/Repository/schema"
 *
 * console.log(corrections)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const corrections = pgTable(
  "corrections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    correctionType: text("correction_type").notNull(),
    sourceArticleId: uuid("source_article_id").references(() => articles.id),
    reason: text("reason"),
    correctionDate: timestamp("correction_date", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "corrections_correction_type_check",
      sql`${table.correctionType} IN ('retraction', 'clarification', 'update', 'amendment')`
    ),
    index("idx_corrections_type").on(table.correctionType),
    index("idx_corrections_source").on(table.sourceArticleId),
    index("idx_corrections_date").on(table.correctionDate),
  ]
);

// =============================================================================
// Claims Table
// =============================================================================

/**
 * Provides repository access for claims.
 *
 * **Example** (Inspect claims)
 *
 * ```ts
 * import { claims } from "@effect-ontology/Repository/schema"
 *
 * console.log(claims)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    ontologyId: text("ontology_id").notNull(),
    subjectIri: text("subject_iri").notNull(),
    predicateIri: text("predicate_iri").notNull(),
    objectValue: text("object_value").notNull(),
    objectType: text("object_type").default("iri"),
    objectDatatype: text("object_datatype"),
    objectLanguage: text("object_language"),
    rank: text("rank").notNull().default("normal"),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    assertedAt: timestamp("asserted_at", { withTimezone: true }).defaultNow(),
    derivedAt: timestamp("derived_at", { withTimezone: true }),
    deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
    deprecatedBy: uuid("deprecated_by").references(() => corrections.id),
    confidenceScore: numeric("confidence_score", { precision: 4, scale: 3 }),
    evidenceText: text("evidence_text"),
    evidenceStartOffset: integer("evidence_start_offset"),
    evidenceEndOffset: integer("evidence_end_offset"),
  },
  (table) => [
    // Unique constraint for claim idempotency - enables ON CONFLICT DO NOTHING
    uniqueIndex("idx_claims_natural_key").on(table.articleId, table.subjectIri, table.predicateIri, table.objectValue),
    index("idx_claims_article").on(table.articleId),
    index("idx_claims_subject").on(table.subjectIri),
    index("idx_claims_predicate").on(table.predicateIri),
    index("idx_claims_rank").on(table.rank),
    index("idx_claims_valid_period").on(table.validFrom, table.validTo),
    index("idx_claims_deprecated").on(table.deprecatedAt).where(sql`${table.deprecatedAt} IS NOT NULL`),
    index("idx_claims_derived_at").on(table.derivedAt).where(sql`${table.derivedAt} IS NOT NULL`),
    index("idx_claims_subject_predicate").on(table.subjectIri, table.predicateIri),
    index("idx_claims_ontology_id").on(table.ontologyId),
    index("idx_claims_ontology_subject").on(table.ontologyId, table.subjectIri),
    index("idx_claims_ontology_predicate").on(table.ontologyId, table.predicateIri),
    index("idx_claims_ontology_subject_predicate").on(table.ontologyId, table.subjectIri, table.predicateIri),
    check("claims_rank_check", sql`${table.rank} IN ('preferred', 'normal', 'deprecated')`),
  ]
);

// =============================================================================
// Correction Claims Junction Table
// =============================================================================

/**
 * Provides repository access for correction claims.
 *
 * **Example** (Inspect correction claims)
 *
 * ```ts
 * import { correctionClaims } from "@effect-ontology/Repository/schema"
 *
 * console.log(correctionClaims)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const correctionClaims = pgTable(
  "correction_claims",
  {
    correctionId: uuid("correction_id")
      .notNull()
      .references(() => corrections.id, { onDelete: "cascade" }),
    originalClaimId: uuid("original_claim_id")
      .notNull()
      .references(() => claims.id),
    newClaimId: uuid("new_claim_id").references(() => claims.id),
  },
  (table) => [
    primaryKey({ columns: [table.correctionId, table.originalClaimId] }),
    index("idx_correction_claims_original").on(table.originalClaimId),
    index("idx_correction_claims_new").on(table.newClaimId),
  ]
);

// =============================================================================
// Conflicts Table
// =============================================================================

/**
 * Provides repository access for conflicts.
 *
 * **Example** (Inspect conflicts)
 *
 * ```ts
 * import { conflicts } from "@effect-ontology/Repository/schema"
 *
 * console.log(conflicts)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const conflicts = pgTable(
  "conflicts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conflictType: text("conflict_type").notNull(),
    claimAId: uuid("claim_a_id")
      .notNull()
      .references(() => claims.id),
    claimBId: uuid("claim_b_id")
      .notNull()
      .references(() => claims.id),
    status: text("status").notNull().default("pending"),
    resolutionStrategy: text("resolution_strategy"),
    acceptedClaimId: uuid("accepted_claim_id").references(() => claims.id),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNotes: text("resolution_notes"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_conflicts_status").on(table.status),
    index("idx_conflicts_claims").on(table.claimAId, table.claimBId),
    check(
      "conflicts_conflict_type_check",
      sql`${table.conflictType} IN ('position', 'temporal', 'contradictory', 'duplicate')`
    ),
    check("conflicts_status_check", sql`${table.status} IN ('pending', 'resolved', 'ignored')`),
    check("different_claims", sql`${table.claimAId} <> ${table.claimBId}`),
  ]
);

// =============================================================================
// Batch Runs Table
// =============================================================================

/**
 * Provides repository access for batch runs.
 *
 * **Example** (Inspect batch runs)
 *
 * ```ts
 * import { batchRuns } from "@effect-ontology/Repository/schema"
 *
 * console.log(batchRuns)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const batchRuns = pgTable(
  "batch_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: text("batch_id").unique().notNull(),
    status: text("status").notNull().default("pending"),
    documentsTotal: integer("documents_total").default(0),
    documentsProcessed: integer("documents_processed").default(0),
    claimsExtracted: integer("claims_extracted").default(0),
    conflictsDetected: integer("conflicts_detected").default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    errorDetails: jsonb("error_details"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_batch_runs_batch_id").on(table.batchId),
    index("idx_batch_runs_status").on(table.status),
    check("batch_runs_status_check", sql`${table.status} IN ('pending', 'running', 'completed', 'failed')`),
  ]
);

// =============================================================================
// Entity Registry Tables (Cross-Batch Entity Linking)
// =============================================================================

/**
 * Canonical Entity Registry
 *
 * **Details**
 *
 * The "golden" entity records. Each unique real-world entity has one canonical entry.
 * Enables cross-batch entity linking by persisting resolved entities with embeddings.
 *
 * **Example** (Inspect canonical entities)
 *
 * ```ts
 * import { canonicalEntities } from "@effect-ontology/Repository/schema"
 *
 * console.log(canonicalEntities)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const canonicalEntities = pgTable(
  "canonical_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Ontology scoping (entities are scoped per ontology)
    ontologyId: text("ontology_id").notNull().default("default"),

    // Identity
    iri: text("iri").notNull(),
    canonicalMention: text("canonical_mention").notNull(),

    // Types (denormalized for fast filtering)
    types: text("types").array().notNull().default([]),

    // Embedding for ANN similarity search (Nomic 768-dim)
    embedding: vector768("embedding").notNull(),

    // Resolution metadata
    mergeCount: integer("merge_count").default(1),
    confidenceAvg: numeric("confidence_avg", { precision: 4, scale: 3 }),

    // Temporal tracking
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("canonical_entities_ontology_iri_unique").on(table.ontologyId, table.iri),
    index("idx_canonical_entities_iri").on(table.iri),
    index("idx_canonical_entities_ontology_id").on(table.ontologyId),
    index("idx_canonical_entities_ontology_iri").on(table.ontologyId, table.iri),
    // Note: HNSW, GIN indexes are created in migration SQL as Drizzle doesn't support them natively
  ]
);

/**
 * Entity Aliases
 *
 * **Details**
 *
 * Alternative mentions mapped to canonical entities.
 * Preserves provenance of how each mention was resolved.
 *
 * **Example** (Inspect entity aliases)
 *
 * ```ts
 * import { entityAliases } from "@effect-ontology/Repository/schema"
 *
 * console.log(entityAliases)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const entityAliases = pgTable(
  "entity_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Ontology scoping (aliases are scoped per ontology)
    ontologyId: text("ontology_id").notNull().default("default"),

    canonicalEntityId: uuid("canonical_entity_id")
      .notNull()
      .references(() => canonicalEntities.id, {
        onDelete: "cascade",
      }),

    // Alias data
    mention: text("mention").notNull(),
    mentionNormalized: text("mention_normalized").notNull(),
    embedding: vector768("embedding"),

    // Resolution metadata
    resolutionMethod: text("resolution_method").notNull(), // 'exact', 'similarity', 'containment', 'neighbor', 'manual'
    resolutionConfidence: numeric("resolution_confidence", { precision: 4, scale: 3 }).notNull(),

    // Source tracking
    firstBatchId: text("first_batch_id"),
    sourceArticleId: uuid("source_article_id").references(() => articles.id),

    // Temporal
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_entity_aliases_ontology_mention").on(table.ontologyId, table.mentionNormalized),
    index("idx_entity_aliases_canonical").on(table.canonicalEntityId),
    index("idx_entity_aliases_ontology").on(table.ontologyId),
  ]
);

/**
 * Entity Blocking Tokens
 *
 * **Details**
 *
 * Inverted index for fast candidate retrieval during entity resolution.
 * Avoids O(n) scan by pre-indexing tokens from entity mentions.
 *
 * **Example** (Inspect entity blocking tokens)
 *
 * ```ts
 * import { entityBlockingTokens } from "@effect-ontology/Repository/schema"
 *
 * console.log(entityBlockingTokens)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const entityBlockingTokens = pgTable(
  "entity_blocking_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Ontology scoping (tokens are scoped per ontology)
    ontologyId: text("ontology_id").notNull().default("default"),

    canonicalEntityId: uuid("canonical_entity_id")
      .notNull()
      .references(() => canonicalEntities.id, {
        onDelete: "cascade",
      }),
    token: text("token").notNull(),
    tokenType: text("token_type").default("mention"), // 'mention', 'type', 'attribute'
  },
  (table) => [
    index("idx_blocking_tokens_token").on(table.token),
    index("idx_blocking_tokens_entity").on(table.canonicalEntityId),
    index("idx_blocking_tokens_ontology_token").on(table.ontologyId, table.token),
    index("idx_blocking_tokens_composite").on(table.ontologyId, table.token, table.canonicalEntityId),
  ]
);

// =============================================================================
// Type Exports for Drizzle
// =============================================================================

/**
 * Describes the article row data exposed by this module.
 *
 * **Example** (Reference ArticleRow columns)
 *
 * ```ts
 * import type { ArticleRow } from "@effect-ontology/Repository/schema"
 *
 * const articleRowFields: ReadonlyArray<keyof ArticleRow> = ["id", "uri", "ontologyId"]
 *
 * console.log(articleRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ArticleRow = typeof articles.$inferSelect;
/**
 * Describes the article insert row data exposed by this module.
 *
 * **Example** (Reference ArticleInsertRow columns)
 *
 * ```ts
 * import type { ArticleInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const articleInsertRowFields: ReadonlyArray<keyof ArticleInsertRow> = ["id", "uri", "ontologyId"]
 *
 * console.log(articleInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ArticleInsertRow = typeof articles.$inferInsert;

/**
 * Describes the claim row data exposed by this module.
 *
 * **Example** (Reference ClaimRow columns)
 *
 * ```ts
 * import type { ClaimRow } from "@effect-ontology/Repository/schema"
 *
 * const claimRowFields: ReadonlyArray<keyof ClaimRow> = ["id", "articleId", "ontologyId"]
 *
 * console.log(claimRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimRow = typeof claims.$inferSelect;
/**
 * Describes the claim insert row data exposed by this module.
 *
 * **Example** (Reference ClaimInsertRow columns)
 *
 * ```ts
 * import type { ClaimInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const claimInsertRowFields: ReadonlyArray<keyof ClaimInsertRow> = ["id", "articleId", "ontologyId"]
 *
 * console.log(claimInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimInsertRow = typeof claims.$inferInsert;

/**
 * Describes the correction row data exposed by this module.
 *
 * **Example** (Reference CorrectionRow columns)
 *
 * ```ts
 * import type { CorrectionRow } from "@effect-ontology/Repository/schema"
 *
 * const correctionRowFields: ReadonlyArray<keyof CorrectionRow> = ["id", "correctionType", "sourceArticleId"]
 *
 * console.log(correctionRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionRow = typeof corrections.$inferSelect;
/**
 * Describes the correction insert row data exposed by this module.
 *
 * **Example** (Reference CorrectionInsertRow columns)
 *
 * ```ts
 * import type { CorrectionInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const correctionInsertRowFields: ReadonlyArray<keyof CorrectionInsertRow> = ["id", "correctionType", "sourceArticleId"]
 *
 * console.log(correctionInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionInsertRow = typeof corrections.$inferInsert;

/**
 * Describes the correction claim row data exposed by this module.
 *
 * **Example** (Reference CorrectionClaimRow columns)
 *
 * ```ts
 * import type { CorrectionClaimRow } from "@effect-ontology/Repository/schema"
 *
 * const correctionClaimRowFields: ReadonlyArray<keyof CorrectionClaimRow> = ["correctionId", "originalClaimId", "newClaimId"]
 *
 * console.log(correctionClaimRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionClaimRow = typeof correctionClaims.$inferSelect;
/**
 * Describes the correction claim insert row data exposed by this module.
 *
 * **Example** (Reference CorrectionClaimInsertRow columns)
 *
 * ```ts
 * import type { CorrectionClaimInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const correctionClaimInsertRowFields: ReadonlyArray<keyof CorrectionClaimInsertRow> = ["correctionId", "originalClaimId", "newClaimId"]
 *
 * console.log(correctionClaimInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionClaimInsertRow = typeof correctionClaims.$inferInsert;

/**
 * Describes the conflict row data exposed by this module.
 *
 * **Example** (Reference ConflictRow columns)
 *
 * ```ts
 * import type { ConflictRow } from "@effect-ontology/Repository/schema"
 *
 * const conflictRowFields: ReadonlyArray<keyof ConflictRow> = ["id", "conflictType", "claimAId"]
 *
 * console.log(conflictRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConflictRow = typeof conflicts.$inferSelect;
/**
 * Describes the conflict insert row data exposed by this module.
 *
 * **Example** (Reference ConflictInsertRow columns)
 *
 * ```ts
 * import type { ConflictInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const conflictInsertRowFields: ReadonlyArray<keyof ConflictInsertRow> = ["id", "conflictType", "claimAId"]
 *
 * console.log(conflictInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConflictInsertRow = typeof conflicts.$inferInsert;

/**
 * Describes the batch run row data exposed by this module.
 *
 * **Example** (Reference BatchRunRow columns)
 *
 * ```ts
 * import type { BatchRunRow } from "@effect-ontology/Repository/schema"
 *
 * const batchRunRowFields: ReadonlyArray<keyof BatchRunRow> = ["id", "batchId", "status"]
 *
 * console.log(batchRunRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BatchRunRow = typeof batchRuns.$inferSelect;
/**
 * Describes the batch run insert row data exposed by this module.
 *
 * **Example** (Reference BatchRunInsertRow columns)
 *
 * ```ts
 * import type { BatchRunInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const batchRunInsertRowFields: ReadonlyArray<keyof BatchRunInsertRow> = ["id", "batchId", "status"]
 *
 * console.log(batchRunInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BatchRunInsertRow = typeof batchRuns.$inferInsert;

/**
 * Describes the canonical entity row data exposed by this module.
 *
 * **Example** (Reference CanonicalEntityRow columns)
 *
 * ```ts
 * import type { CanonicalEntityRow } from "@effect-ontology/Repository/schema"
 *
 * const canonicalEntityRowFields: ReadonlyArray<keyof CanonicalEntityRow> = ["id", "ontologyId", "iri"]
 *
 * console.log(canonicalEntityRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CanonicalEntityRow = typeof canonicalEntities.$inferSelect;
/**
 * Describes the canonical entity insert row data exposed by this module.
 *
 * **Example** (Reference CanonicalEntityInsertRow columns)
 *
 * ```ts
 * import type { CanonicalEntityInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const canonicalEntityInsertRowFields: ReadonlyArray<keyof CanonicalEntityInsertRow> = ["id", "ontologyId", "iri"]
 *
 * console.log(canonicalEntityInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CanonicalEntityInsertRow = typeof canonicalEntities.$inferInsert;

/**
 * Describes the entity alias row data exposed by this module.
 *
 * **Example** (Reference EntityAliasRow columns)
 *
 * ```ts
 * import type { EntityAliasRow } from "@effect-ontology/Repository/schema"
 *
 * const entityAliasRowFields: ReadonlyArray<keyof EntityAliasRow> = ["id", "ontologyId", "canonicalEntityId"]
 *
 * console.log(entityAliasRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EntityAliasRow = typeof entityAliases.$inferSelect;
/**
 * Describes the entity alias insert row data exposed by this module.
 *
 * **Example** (Reference EntityAliasInsertRow columns)
 *
 * ```ts
 * import type { EntityAliasInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const entityAliasInsertRowFields: ReadonlyArray<keyof EntityAliasInsertRow> = ["id", "ontologyId", "canonicalEntityId"]
 *
 * console.log(entityAliasInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EntityAliasInsertRow = typeof entityAliases.$inferInsert;

/**
 * Describes the entity blocking token row data exposed by this module.
 *
 * **Example** (Reference EntityBlockingTokenRow columns)
 *
 * ```ts
 * import type { EntityBlockingTokenRow } from "@effect-ontology/Repository/schema"
 *
 * const entityBlockingTokenRowFields: ReadonlyArray<keyof EntityBlockingTokenRow> = ["id", "ontologyId", "canonicalEntityId"]
 *
 * console.log(entityBlockingTokenRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EntityBlockingTokenRow = typeof entityBlockingTokens.$inferSelect;
/**
 * Describes the entity blocking token insert row data exposed by this module.
 *
 * **Example** (Reference EntityBlockingTokenInsertRow columns)
 *
 * ```ts
 * import type { EntityBlockingTokenInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const entityBlockingTokenInsertRowFields: ReadonlyArray<keyof EntityBlockingTokenInsertRow> = ["id", "ontologyId", "canonicalEntityId"]
 *
 * console.log(entityBlockingTokenInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EntityBlockingTokenInsertRow = typeof entityBlockingTokens.$inferInsert;

// =============================================================================
// Ingested Links Tables (Link Ingestion Pipeline)
// =============================================================================

/**
 * Ingested Links
 *
 * **Details**
 *
 * Tracks URLs fetched via Jina Reader API for extraction.
 * Content is stored in GCS/local; this table holds metadata.
 *
 * **Example** (Inspect ingested links)
 *
 * ```ts
 * import { ingestedLinks } from "@effect-ontology/Repository/schema"
 *
 * console.log(ingestedLinks)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const ingestedLinks = pgTable(
  "ingested_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Content identification (content-addressed, unique per ontology)
    contentHash: varchar("content_hash", { length: 64 }).notNull(),

    // Ontology scoping
    ontologyId: text("ontology_id").notNull(),

    // Source information
    sourceUri: text("source_uri"),
    sourceType: varchar("source_type", { length: 32 }),

    // Enriched metadata
    headline: text("headline"),
    description: text("description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    author: text("author"),
    organization: text("organization"),
    language: varchar("language", { length: 8 }).default("en"),

    // Topics and entities (JSONB for flexibility)
    topics: jsonb("topics").$type<Array<string>>().default([]),
    keyEntities: jsonb("key_entities").$type<Array<string>>().default([]),

    // Storage location
    storageUri: text("storage_uri").notNull(),

    // Processing status
    status: varchar("status", { length: 16 }).notNull().default("pending"),

    // Timestamps
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),

    // Error tracking
    errorMessage: text("error_message"),

    // Content stats
    wordCount: integer("word_count"),

    // Metadata
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

    // Lifecycle
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_ingested_links_status").on(table.status),
    index("idx_ingested_links_source_uri").on(table.sourceUri),
    index("idx_ingested_links_fetched_at").on(table.fetchedAt),
    index("idx_ingested_links_source_type").on(table.sourceType),
    index("idx_ingested_links_organization").on(table.organization),
    index("idx_ingested_links_ontology_id").on(table.ontologyId),
    index("idx_ingested_links_ontology_status").on(table.ontologyId, table.status),
    // Composite unique: same content can exist in multiple ontologies
    uniqueIndex("idx_ingested_links_ontology_content_unique").on(table.ontologyId, table.contentHash),
    check(
      "ingested_links_status_check",
      sql`${table.status} IN ('pending', 'enriched', 'processing', 'processed', 'failed', 'skipped')`
    ),
  ]
);

/**
 * Link Batches
 *
 * **Details**
 *
 * Groups ingested links for batch extraction.
 *
 * **Example** (Inspect link batches)
 *
 * ```ts
 * import { linkBatches } from "@effect-ontology/Repository/schema"
 *
 * console.log(linkBatches)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const linkBatches = pgTable(
  "link_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: text("batch_id").unique().notNull(),

    // Status
    status: text("status").notNull().default("pending"),

    // Metrics
    linksTotal: integer("links_total").default(0),
    linksProcessed: integer("links_processed").default(0),
    linksFailed: integer("links_failed").default(0),

    // Ontology
    ontologyUri: text("ontology_uri"),

    // Timing
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // Error
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_link_batches_status").on(table.status),
    check("link_batches_status_check", sql`${table.status} IN ('pending', 'running', 'completed', 'failed')`),
  ]
);

/**
 * Link Batch Items Junction
 *
 * **Details**
 *
 * Links ingested_links to batches.
 *
 * **Example** (Inspect link batch items)
 *
 * ```ts
 * import { linkBatchItems } from "@effect-ontology/Repository/schema"
 *
 * console.log(linkBatchItems)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const linkBatchItems = pgTable(
  "link_batch_items",
  {
    batchId: uuid("batch_id")
      .notNull()
      .references(() => linkBatches.id, { onDelete: "cascade" }),
    linkId: uuid("link_id")
      .notNull()
      .references(() => ingestedLinks.id, { onDelete: "cascade" }),

    // Item status
    status: text("status").notNull().default("pending"),

    // Result reference
    extractionRunId: text("extraction_run_id"),
    articleId: uuid("article_id"),

    // Timing
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // Error
    errorMessage: text("error_message"),
  },
  (table) => [
    primaryKey({ columns: [table.batchId, table.linkId] }),
    index("idx_link_batch_items_link").on(table.linkId),
    index("idx_link_batch_items_status").on(table.status),
    check(
      "link_batch_items_status_check",
      sql`${table.status} IN ('pending', 'processing', 'completed', 'failed')`
    ),
  ]
);

/**
 * Describes the ingested link row data exposed by this module.
 *
 * **Example** (Reference IngestedLinkRow columns)
 *
 * ```ts
 * import type { IngestedLinkRow } from "@effect-ontology/Repository/schema"
 *
 * const ingestedLinkRowFields: ReadonlyArray<keyof IngestedLinkRow> = ["id", "contentHash", "ontologyId"]
 *
 * console.log(ingestedLinkRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type IngestedLinkRow = typeof ingestedLinks.$inferSelect;
/**
 * Describes the ingested link insert row data exposed by this module.
 *
 * **Example** (Reference IngestedLinkInsertRow columns)
 *
 * ```ts
 * import type { IngestedLinkInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const ingestedLinkInsertRowFields: ReadonlyArray<keyof IngestedLinkInsertRow> = ["id", "contentHash", "ontologyId"]
 *
 * console.log(ingestedLinkInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type IngestedLinkInsertRow = typeof ingestedLinks.$inferInsert;

/**
 * Describes the link batch row data exposed by this module.
 *
 * **Example** (Reference LinkBatchRow columns)
 *
 * ```ts
 * import type { LinkBatchRow } from "@effect-ontology/Repository/schema"
 *
 * const linkBatchRowFields: ReadonlyArray<keyof LinkBatchRow> = ["id", "batchId", "status"]
 *
 * console.log(linkBatchRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LinkBatchRow = typeof linkBatches.$inferSelect;
/**
 * Describes the link batch insert row data exposed by this module.
 *
 * **Example** (Reference LinkBatchInsertRow columns)
 *
 * ```ts
 * import type { LinkBatchInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const linkBatchInsertRowFields: ReadonlyArray<keyof LinkBatchInsertRow> = ["id", "batchId", "status"]
 *
 * console.log(linkBatchInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LinkBatchInsertRow = typeof linkBatches.$inferInsert;

/**
 * Describes the link batch item row data exposed by this module.
 *
 * **Example** (Reference LinkBatchItemRow columns)
 *
 * ```ts
 * import type { LinkBatchItemRow } from "@effect-ontology/Repository/schema"
 *
 * const linkBatchItemRowFields: ReadonlyArray<keyof LinkBatchItemRow> = ["batchId", "linkId", "status"]
 *
 * console.log(linkBatchItemRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LinkBatchItemRow = typeof linkBatchItems.$inferSelect;
/**
 * Describes the link batch item insert row data exposed by this module.
 *
 * **Example** (Reference LinkBatchItemInsertRow columns)
 *
 * ```ts
 * import type { LinkBatchItemInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const linkBatchItemInsertRowFields: ReadonlyArray<keyof LinkBatchItemInsertRow> = ["batchId", "linkId", "status"]
 *
 * console.log(linkBatchItemInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LinkBatchItemInsertRow = typeof linkBatchItems.$inferInsert;

// =============================================================================
// LLM Examples Table (Few-Shot Learning)
// =============================================================================

/**
 * LLM Examples
 *
 * **Details**
 *
 * Stores curated examples for few-shot prompting. Examples are scoped per-ontology
 * and support hybrid retrieval (vector similarity + lexical search).
 *
 * **Example** (Inspect llm examples)
 *
 * ```ts
 * import { llmExamples } from "@effect-ontology/Repository/schema"
 *
 * console.log(llmExamples)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const llmExamples = pgTable(
  "llm_examples",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Scoping
    ontologyId: text("ontology_id").notNull(),
    exampleType: text("example_type").notNull(), // entity_extraction | relation_extraction | entity_linking | negative
    source: text("source").notNull().default("manual"), // manual | validated | auto_generated

    // Structured content
    inputText: text("input_text").notNull(),
    targetClass: text("target_class"),
    targetPredicate: text("target_predicate"),
    evidenceText: text("evidence_text"),
    evidenceStartOffset: integer("evidence_start_offset"),
    evidenceEndOffset: integer("evidence_end_offset"),

    // Output
    expectedOutput: jsonb("expected_output").notNull().$type<Record<string, unknown>>(),
    promptMessages: jsonb("prompt_messages").$type<Array<{ role: string; content: string }>>(), // Pre-formatted for direct inclusion
    explanation: text("explanation"),

    // Embedding (768-dim Nomic with ontology prefix)
    embedding: vector768("embedding").notNull(),

    // Negative example metadata
    isNegative: boolean("is_negative").notNull().default(false),
    negativePattern: text("negative_pattern"),

    // Quality metrics
    usageCount: integer("usage_count").default(0),
    successRate: numeric("success_rate", { precision: 4, scale: 3 }),

    // Lifecycle
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    createdBy: text("created_by"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    index("idx_llm_examples_ontology_type").on(table.ontologyId, table.exampleType),
    index("idx_llm_examples_ontology_active").on(table.ontologyId, table.isActive),
    index("idx_llm_examples_is_negative").on(table.isNegative),
    // Note: HNSW and GIN indexes are created in migration SQL
  ]
);

/**
 * Describes the llm example row data exposed by this module.
 *
 * **Example** (Reference LlmExampleRow columns)
 *
 * ```ts
 * import type { LlmExampleRow } from "@effect-ontology/Repository/schema"
 *
 * const llmExampleRowFields: ReadonlyArray<keyof LlmExampleRow> = ["id", "ontologyId", "exampleType"]
 *
 * console.log(llmExampleRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LlmExampleRow = typeof llmExamples.$inferSelect;
/**
 * Describes the llm example insert row data exposed by this module.
 *
 * **Example** (Reference LlmExampleInsertRow columns)
 *
 * ```ts
 * import type { LlmExampleInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const llmExampleInsertRowFields: ReadonlyArray<keyof LlmExampleInsertRow> = ["id", "ontologyId", "exampleType"]
 *
 * console.log(llmExampleInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LlmExampleInsertRow = typeof llmExamples.$inferInsert;

// =============================================================================
// Embeddings Table (Persistent Vector Storage)
// =============================================================================

/**
 * Embeddings Table
 *
 * **Details**
 *
 * Persistent storage for embedding vectors supporting hybrid search.
 * Stores embeddings for ontology classes, extracted entities, claims,
 * and few-shot examples.
 *
 * Features:
 * - IVFFlat index for fast ANN search
 * - tsvector for BM25-like full-text search
 * - RRF fusion via hybrid_search() function
 *
 * **Example** (Inspect embeddings)
 *
 * ```ts
 * import { embeddings } from "@effect-ontology/Repository/schema"
 *
 * console.log(embeddings)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // What this embedding represents
    entityType: varchar("entity_type", { length: 20 }).notNull(), // class | entity | claim | example
    entityId: text("entity_id").notNull(),

    // Ontology scoping
    ontologyId: text("ontology_id").notNull().default("default"),

    // The embedding vector (768-dim for Nomic)
    embedding: vector768("embedding").notNull(),

    // Text content for hybrid search
    contentText: text("content_text"),
    // Note: content_tsv is GENERATED ALWAYS in SQL, not exposed to Drizzle

    // Model provenance
    model: text("model").notNull().default("nomic-embed-text-v1.5"),

    // Temporal tracking
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // Unique per (ontology, type, id) - enables upsert
    uniqueIndex("idx_embeddings_ontology_entity_unique").on(table.ontologyId, table.entityType, table.entityId),
    index("idx_embeddings_entity_type_idx").on(table.entityType),
    index("idx_embeddings_ontology_type_idx").on(table.ontologyId, table.entityType),
    check("embeddings_entity_type_check", sql`${table.entityType} IN ('class', 'entity', 'claim', 'example')`),
    // Note: IVFFlat and GIN indexes are created in migration SQL
  ]
);

/**
 * Describes the embedding row data exposed by this module.
 *
 * **Example** (Reference EmbeddingRow columns)
 *
 * ```ts
 * import type { EmbeddingRow } from "@effect-ontology/Repository/schema"
 *
 * const embeddingRowFields: ReadonlyArray<keyof EmbeddingRow> = ["id", "entityType", "entityId"]
 *
 * console.log(embeddingRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingRow = typeof embeddings.$inferSelect;
/**
 * Describes the embedding insert row data exposed by this module.
 *
 * **Example** (Reference EmbeddingInsertRow columns)
 *
 * ```ts
 * import type { EmbeddingInsertRow } from "@effect-ontology/Repository/schema"
 *
 * const embeddingInsertRowFields: ReadonlyArray<keyof EmbeddingInsertRow> = ["id", "entityType", "entityId"]
 *
 * console.log(embeddingInsertRowFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingInsertRow = typeof embeddings.$inferInsert;
