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

import { Model, VariantField } from "@beep/effect-drizzle";
import * as pg from "@beep/effect-drizzle/pg";
import { $ScratchpadId } from "@beep/identity";
import { Sha256Hex } from "@beep/schema/Sha256";
import { sql } from "drizzle-orm";
import { Number as Num, SchemaGetter } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ClaimRank } from "../Domain/Schema/KnowledgeModel.ts";
import { LinkStatus } from "../Domain/Schema/LinkIngestion.ts";
import { ConflictKind, ConflictStatus } from "../Domain/Schema/Timeline.ts";

const $I = $ScratchpadId.create("effect-ontology/Repository/schema");

const CorrectionType = S.Literals(["retraction", "clarification", "update", "amendment"]);
const ClaimObjectType = S.Literals(["iri", "literal"]);
const Sha256HexString = Sha256Hex.pipe(S.decodeTo(S.String));
const nullableColumn = <Schema extends S.Top>(schema: Schema) => {
  const nullable = S.NullOr(schema);
  const optional = S.optional(nullable);
  return VariantField({
    select: nullable,
    insert: optional,
    update: optional,
    json: nullable,
    jsonCreate: optional,
    jsonUpdate: optional,
  });
};

const generatedUuidPrimaryKey = S.String.pipe(
  pg.uuid(),
  pg.primaryKey(),
  pg.defaultExpr(sql<string>`gen_random_uuid()`)
);
const defaultOntologyId = S.String.pipe(pg.text(), pg.default("default"), pg.columnName("ontology_id"));
const uniqueBatchId = S.String.pipe(pg.text(), pg.unique(), pg.columnName("batch_id"));
const nullableCreatedAt = nullableColumn(S.Date).pipe(
  pg.timestamp({ mode: "date" }),
  pg.defaultNow(),
  pg.columnName("created_at")
);
const nullableUpdatedAt = nullableColumn(S.Date).pipe(
  pg.timestamp({ mode: "date" }),
  pg.defaultNow(),
  pg.columnName("updated_at")
);
const executionTimingFields = {
  startedAt: nullableColumn(S.Date).pipe(pg.timestamp({ mode: "date" }), pg.columnName("started_at")),
  completedAt: nullableColumn(S.Date).pipe(pg.timestamp({ mode: "date" }), pg.columnName("completed_at")),
  errorMessage: nullableColumn(S.String).pipe(pg.text(), pg.columnName("error_message")),
};

const EmbeddingVectorValues = S.Array(S.Finite).check(
  S.isLengthBetween(768, 768, {
    identifier: $I`EmbeddingVector768LengthCheck`,
    title: "Embedding Vector 768",
    description: "Exactly 768 finite numeric embedding coordinates.",
    message: "Expected exactly 768 finite embedding coordinates.",
  })
);

const EmbeddingVector768Codec = S.String.pipe(
  S.decodeTo(EmbeddingVectorValues, {
    decode: SchemaGetter.transform((value) => A.map(Str.split(",")(Str.replace(/^\[|\]$/g, "")(value)), Num.Number)),
    encode: SchemaGetter.transform(
      (value) =>
        `[${A.join(
          A.map(value, (entry) => `${entry}`),
          ","
        )}]`
    ),
  })
);

/**
 * Decodes PostgreSQL `vector(768)` text into a finite 768-coordinate embedding.
 *
 * **Example** (Decode a 768-d vector and reject a short one)
 *
 * ```ts
 * import { EmbeddingVector768 } from "@effect-ontology/Repository/schema"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const encoded = `[${Array.from({ length: 768 }, () => 0).join(",")}]`
 * console.log(O.isSome(S.decodeUnknownOption(EmbeddingVector768.schema)(encoded))) // true
 * console.log(O.isNone(S.decodeUnknownOption(EmbeddingVector768.schema)("[0,1]"))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EmbeddingVector768 = EmbeddingVector768Codec.pipe(pg.unsafeCustom("vector(768)"));

const NullableEmbeddingVector768Codec = EmbeddingVector768Codec.pipe(S.NullOr);
const OptionalNullableEmbeddingVector768Codec = NullableEmbeddingVector768Codec.pipe(S.optional);

const NullableEmbeddingVector768 = VariantField({
  select: NullableEmbeddingVector768Codec,
  insert: OptionalNullableEmbeddingVector768Codec,
  update: OptionalNullableEmbeddingVector768Codec,
  json: NullableEmbeddingVector768Codec,
  jsonCreate: OptionalNullableEmbeddingVector768Codec,
  jsonUpdate: OptionalNullableEmbeddingVector768Codec,
}).pipe(pg.unsafeCustom("vector(768)"));

// =============================================================================
// Articles Table
// =============================================================================

/**
 * Schema-first PostgreSQL table for ontology-scoped source articles.
 *
 * **Example** (Name the ontology-scoped unique key)
 *
 * ```ts
 * import { Articles } from "@effect-ontology/Repository/schema"
 *
 * console.log("uri" in Articles.fields) // true
 * console.log("ontologyId" in Articles.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class Articles extends Model<Articles>("Articles")(
  {
    id: generatedUuidPrimaryKey,
    uri: S.NonEmptyString.pipe(pg.text()),
    ontologyId: S.NonEmptyString.pipe(pg.text(), pg.columnName("ontology_id")),
    sourceName: nullableColumn(S.String).pipe(pg.text(), pg.columnName("source_name")),
    headline: nullableColumn(S.String).pipe(pg.text()),
    publishedAt: S.Date.pipe(pg.timestamp({ mode: "date" }), pg.columnName("published_at")),
    ingestedAt: S.Date.pipe(pg.timestamp({ mode: "date" }), pg.defaultNow(), pg.columnName("ingested_at")),
    graphUri: nullableColumn(S.String).pipe(pg.text(), pg.columnName("graph_uri")),
    contentHash: nullableColumn(S.String).pipe(pg.text(), pg.columnName("content_hash")),
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

/**
 * Drizzle table projected from the schema-first article model.
 *
 * **Example** (Inspect article columns)
 *
 * ```ts
 * import { articles } from "@effect-ontology/Repository/schema"
 *
 * console.log(articles.ontologyId.name) // "ontology_id"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const articles = pg.toPgTable(Articles);

// =============================================================================
// Corrections Table (defined before claims due to FK reference)
// =============================================================================

const ArticlesReference: { readonly tableName: "articles"; readonly entityType: "Articles" } = {
  tableName: "articles",
  entityType: "Articles",
};
const CorrectionsReference: { readonly tableName: "corrections"; readonly entityType: "Corrections" } = {
  tableName: "corrections",
  entityType: "Corrections",
};
const ClaimsReference: { readonly tableName: "claims"; readonly entityType: "Claims" } = {
  tableName: "claims",
  entityType: "Claims",
};

/**
 * Schema-first PostgreSQL table for claim corrections.
 *
 * **Example** (Name the correction-type column)
 *
 * ```ts
 * import { Corrections } from "@effect-ontology/Repository/schema"
 *
 * console.log("correctionType" in Corrections.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class Corrections extends Model<Corrections>("Corrections")(
  {
    id: generatedUuidPrimaryKey,
    correctionType: CorrectionType.pipe(pg.text(), pg.columnName("correction_type")),
    sourceArticleId: nullableColumn(S.String).pipe(
      pg.uuid(),
      pg.references(ArticlesReference),
      pg.columnName("source_article_id")
    ),
    reason: nullableColumn(S.String).pipe(pg.text()),
    correctionDate: S.Date.pipe(pg.timestamp({ mode: "date" }), pg.columnName("correction_date")),
    createdAt: nullableColumn(S.Date).pipe(
      pg.timestamp({ mode: "date" }),
      pg.defaultNow(),
      pg.columnName("created_at")
    ),
    processedAt: nullableColumn(S.Date).pipe(pg.timestamp({ mode: "date" }), pg.columnName("processed_at")),
  },
  (table) => [
    pg.Table.check(
      sql<boolean>`${table.correctionType} IN ('retraction', 'clarification', 'update', 'amendment')`,
      "corrections_correction_type_check"
    ),
    pg.Table.index("idx_corrections_type", [table.correctionType]),
    pg.Table.index("idx_corrections_source", [table.sourceArticleId]),
    pg.Table.index("idx_corrections_date", [table.correctionDate]),
  ]
) {}

// =============================================================================
// Claims Table
// =============================================================================

/**
 * Schema-first PostgreSQL table for persisted RDF claims.
 *
 * **Example** (Name the claim triple columns)
 *
 * ```ts
 * import { Claims } from "@effect-ontology/Repository/schema"
 *
 * console.log("subjectIri" in Claims.fields) // true
 * console.log("predicateIri" in Claims.fields) // true
 * console.log("objectValue" in Claims.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class Claims extends Model<Claims>("Claims")(
  {
    id: generatedUuidPrimaryKey,
    articleId: S.String.pipe(
      pg.uuid(),
      pg.references(ArticlesReference, { onDelete: "cascade" }),
      pg.columnName("article_id")
    ),
    ontologyId: S.String.pipe(pg.text(), pg.columnName("ontology_id")),
    subjectIri: S.String.pipe(pg.text(), pg.columnName("subject_iri")),
    predicateIri: S.String.pipe(pg.text(), pg.columnName("predicate_iri")),
    objectValue: S.String.pipe(pg.text(), pg.columnName("object_value")),
    objectType: nullableColumn(ClaimObjectType).pipe(pg.text(), pg.default("iri"), pg.columnName("object_type")),
    objectDatatype: nullableColumn(S.String).pipe(pg.text(), pg.columnName("object_datatype")),
    objectLanguage: nullableColumn(S.String).pipe(pg.text(), pg.columnName("object_language")),
    rank: ClaimRank.pipe(pg.text(), pg.default("normal")),
    validFrom: nullableColumn(S.Date).pipe(pg.timestamp({ mode: "date" }), pg.columnName("valid_from")),
    validTo: nullableColumn(S.Date).pipe(pg.timestamp({ mode: "date" }), pg.columnName("valid_to")),
    assertedAt: nullableColumn(S.Date).pipe(
      pg.timestamp({ mode: "date" }),
      pg.defaultNow(),
      pg.columnName("asserted_at")
    ),
    derivedAt: nullableColumn(S.Date).pipe(pg.timestamp({ mode: "date" }), pg.columnName("derived_at")),
    deprecatedAt: nullableColumn(S.Date).pipe(pg.timestamp({ mode: "date" }), pg.columnName("deprecated_at")),
    deprecatedBy: nullableColumn(S.String).pipe(
      pg.uuid(),
      pg.references(CorrectionsReference),
      pg.columnName("deprecated_by")
    ),
    confidenceScore: nullableColumn(S.String).pipe(pg.numeric(4, 3), pg.columnName("confidence_score")),
    evidenceText: nullableColumn(S.String).pipe(pg.text(), pg.columnName("evidence_text")),
    evidenceStartOffset: nullableColumn(S.Int).pipe(pg.integer(), pg.columnName("evidence_start_offset")),
    evidenceEndOffset: nullableColumn(S.Int).pipe(pg.integer(), pg.columnName("evidence_end_offset")),
  },
  (table) => [
    pg.Table.uniqueIndex("idx_claims_natural_key", [
      table.articleId,
      table.subjectIri,
      table.predicateIri,
      table.objectValue,
    ]),
    pg.Table.index("idx_claims_article", [table.articleId]),
    pg.Table.index("idx_claims_subject", [table.subjectIri]),
    pg.Table.index("idx_claims_predicate", [table.predicateIri]),
    pg.Table.index("idx_claims_rank", [table.rank]),
    pg.Table.index("idx_claims_valid_period", [table.validFrom, table.validTo]),
    pg.Table.index("idx_claims_deprecated", [table.deprecatedAt], {
      where: sql<boolean>`${table.deprecatedAt} IS NOT NULL`,
    }),
    pg.Table.index("idx_claims_derived_at", [table.derivedAt], {
      where: sql<boolean>`${table.derivedAt} IS NOT NULL`,
    }),
    pg.Table.index("idx_claims_subject_predicate", [table.subjectIri, table.predicateIri]),
    pg.Table.index("idx_claims_ontology_id", [table.ontologyId]),
    pg.Table.index("idx_claims_ontology_subject", [table.ontologyId, table.subjectIri]),
    pg.Table.index("idx_claims_ontology_predicate", [table.ontologyId, table.predicateIri]),
    pg.Table.index("idx_claims_ontology_subject_predicate", [table.ontologyId, table.subjectIri, table.predicateIri]),
    pg.Table.check(sql<boolean>`${table.rank} IN ('preferred', 'normal', 'deprecated')`, "claims_rank_check"),
  ]
) {}

// =============================================================================
// Correction Claims Junction Table
// =============================================================================

/**
 * Junction table linking a correction to the original and replacement claims.
 *
 * **Example** (Name the original-claim foreign key)
 *
 * ```ts
 * import { CorrectionClaims } from "@effect-ontology/Repository/schema"
 *
 * console.log("originalClaimId" in CorrectionClaims.fields) // true
 * console.log("newClaimId" in CorrectionClaims.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class CorrectionClaims extends Model<CorrectionClaims>("CorrectionClaims")(
  {
    correctionId: S.String.pipe(
      pg.uuid(),
      pg.references(CorrectionsReference, { onDelete: "cascade" }),
      pg.columnName("correction_id")
    ),
    originalClaimId: S.String.pipe(pg.uuid(), pg.references(ClaimsReference), pg.columnName("original_claim_id")),
    newClaimId: nullableColumn(S.String).pipe(pg.uuid(), pg.references(ClaimsReference), pg.columnName("new_claim_id")),
  },
  (table) => [
    pg.Table.compositePrimaryKey("correction_claims_pkey", [table.correctionId, table.originalClaimId]),
    pg.Table.index("idx_correction_claims_original", [table.originalClaimId]),
    pg.Table.index("idx_correction_claims_new", [table.newClaimId]),
  ]
) {}

// =============================================================================
// Conflicts Table
// =============================================================================

/**
 * Schema-first PostgreSQL table for ordered claim-conflict pairs.
 *
 * **Example** (Name the conflict-status column)
 *
 * ```ts
 * import { Conflicts } from "@effect-ontology/Repository/schema"
 *
 * console.log("status" in Conflicts.fields) // true
 * console.log("claimAId" in Conflicts.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class Conflicts extends Model<Conflicts>("Conflicts")(
  {
    id: generatedUuidPrimaryKey,
    ontologyId: S.NonEmptyString.pipe(pg.text(), pg.columnName("ontology_id")),
    conflictType: ConflictKind.pipe(pg.text(), pg.columnName("conflict_type")),
    claimAId: S.String.pipe(pg.uuid(), pg.references(ClaimsReference), pg.columnName("claim_a_id")),
    claimBId: S.String.pipe(pg.uuid(), pg.references(ClaimsReference), pg.columnName("claim_b_id")),
    status: ConflictStatus.pipe(pg.text(), pg.default("pending")),
    resolutionStrategy: nullableColumn(S.String).pipe(pg.text(), pg.columnName("resolution_strategy")),
    acceptedClaimId: nullableColumn(S.String).pipe(
      pg.uuid(),
      pg.references(ClaimsReference),
      pg.columnName("accepted_claim_id")
    ),
    resolvedBy: nullableColumn(S.String).pipe(pg.text(), pg.columnName("resolved_by")),
    resolvedByFingerprint: nullableColumn(Sha256HexString).pipe(pg.text(), pg.columnName("resolved_by_fingerprint")),
    resolvedAt: nullableColumn(S.Date).pipe(pg.timestamp({ mode: "date" }), pg.columnName("resolved_at")),
    resolutionNotes: nullableColumn(S.String).pipe(pg.text(), pg.columnName("resolution_notes")),
    detectedAt: S.Date.pipe(pg.timestamp({ mode: "date" }), pg.defaultNow(), pg.columnName("detected_at")),
  },
  (table) => [
    pg.Table.index("idx_conflicts_ontology_status", [table.ontologyId, table.status]),
    pg.Table.index("idx_conflicts_claims", [table.claimAId, table.claimBId]),
    pg.Table.uniqueIndex("conflicts_ontology_claim_pair_unique", [table.ontologyId, table.claimAId, table.claimBId]),
    pg.Table.check(sql<boolean>`${table.conflictType} IN ('position', 'temporal')`, "conflicts_conflict_type_check"),
    pg.Table.check(sql<boolean>`${table.status} IN ('pending', 'resolved', 'ignored')`, "conflicts_status_check"),
    pg.Table.check(sql<boolean>`${table.claimAId} < ${table.claimBId}`, "conflicts_canonical_claim_pair_check"),
    pg.Table.check(
      sql<boolean>`(
        (${table.status} = 'pending'
          AND ${table.resolutionStrategy} IS NULL
          AND ${table.acceptedClaimId} IS NULL
          AND ${table.resolvedBy} IS NULL
          AND ${table.resolvedByFingerprint} IS NULL
          AND ${table.resolvedAt} IS NULL
          AND ${table.resolutionNotes} IS NULL)
        OR (${table.status} = 'ignored'
          AND ${table.resolutionStrategy} IS NULL
          AND ${table.acceptedClaimId} IS NULL
          AND ${table.resolvedBy} IS NOT NULL
          AND ${table.resolvedAt} IS NOT NULL)
        OR (${table.status} = 'resolved'
          AND ${table.resolutionStrategy} IS NOT NULL
          AND ${table.acceptedClaimId} IS NOT NULL
          AND ${table.resolvedBy} IS NOT NULL
          AND ${table.resolvedAt} IS NOT NULL)
      )`,
      "conflicts_resolution_state_check"
    ),
  ]
) {}

const ClaimFamilySchema = pg.schema({
  articles: Articles,
  corrections: Corrections,
  claims: Claims,
  correction_claims: CorrectionClaims,
  conflicts: Conflicts,
});

/**
 * Drizzle table projected from {@link Corrections}.
 *
 * **Example** (Inspect correction columns)
 *
 * ```ts
 * import { corrections } from "@effect-ontology/Repository/schema"
 *
 * console.log(corrections.correctionType.name) // "correction_type"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const corrections = ClaimFamilySchema.tables.corrections;

/**
 * Drizzle table projected from {@link Claims}.
 *
 * **Example** (Inspect claim columns)
 *
 * ```ts
 * import { claims } from "@effect-ontology/Repository/schema"
 *
 * console.log(claims.ontologyId.name) // "ontology_id"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const claims = ClaimFamilySchema.tables.claims;

/**
 * Drizzle table projected from {@link CorrectionClaims}.
 *
 * **Example** (Inspect correction-claim columns)
 *
 * ```ts
 * import { correctionClaims } from "@effect-ontology/Repository/schema"
 *
 * console.log(correctionClaims.originalClaimId.name) // "original_claim_id"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const correctionClaims = ClaimFamilySchema.tables.correction_claims;

/**
 * Drizzle table projected from {@link Conflicts}.
 *
 * **Example** (Inspect conflict columns)
 *
 * ```ts
 * import { conflicts } from "@effect-ontology/Repository/schema"
 *
 * console.log(conflicts.status.name) // "status"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const conflicts = ClaimFamilySchema.tables.conflicts;

// =============================================================================
// Batch Runs Table
// =============================================================================

/**
 * Schema-first PostgreSQL table for extraction batch-run progress.
 *
 * **Example** (Name the batch identifier)
 *
 * ```ts
 * import { BatchRuns } from "@effect-ontology/Repository/schema"
 *
 * console.log("batchId" in BatchRuns.fields) // true
 * console.log("status" in BatchRuns.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class BatchRuns extends Model<BatchRuns>("BatchRuns")(
  {
    id: generatedUuidPrimaryKey,
    batchId: uniqueBatchId,
    status: S.String.pipe(pg.text(), pg.default("pending")),
    documentsTotal: nullableColumn(S.Int).pipe(pg.integer(), pg.default(0), pg.columnName("documents_total")),
    documentsProcessed: nullableColumn(S.Int).pipe(pg.integer(), pg.default(0), pg.columnName("documents_processed")),
    claimsExtracted: nullableColumn(S.Int).pipe(pg.integer(), pg.default(0), pg.columnName("claims_extracted")),
    conflictsDetected: nullableColumn(S.Int).pipe(pg.integer(), pg.default(0), pg.columnName("conflicts_detected")),
    ...executionTimingFields,
    errorDetails: nullableColumn(S.Unknown).pipe(pg.unsafeCustom("jsonb"), pg.columnName("error_details")),
    createdAt: nullableCreatedAt,
  },
  (table) => [
    pg.Table.index("idx_batch_runs_batch_id", [table.batchId]),
    pg.Table.index("idx_batch_runs_status", [table.status]),
    pg.Table.check(
      sql<boolean>`${table.status} IN ('pending', 'running', 'completed', 'failed')`,
      "batch_runs_status_check"
    ),
  ]
) {}

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
 * **Example** (Name the canonical IRI and embedding)
 *
 * ```ts
 * import { CanonicalEntities } from "@effect-ontology/Repository/schema"
 *
 * console.log("iri" in CanonicalEntities.fields) // true
 * console.log("embedding" in CanonicalEntities.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class CanonicalEntities extends Model<CanonicalEntities>("CanonicalEntities")(
  {
    id: generatedUuidPrimaryKey,

    // Ontology scoping (entities are scoped per ontology)
    ontologyId: defaultOntologyId,

    // Identity
    iri: S.String.pipe(pg.text()),
    canonicalMention: S.String.pipe(pg.text(), pg.columnName("canonical_mention")),

    // Types (denormalized for fast filtering)
    types: S.Array(S.String).pipe(pg.array(S.String.pipe(pg.text())), pg.default([])),

    // Embedding for ANN similarity search (Nomic 768-dim)
    embedding: EmbeddingVector768,

    // Resolution metadata
    mergeCount: nullableColumn(S.Int).pipe(pg.integer(), pg.default(1), pg.columnName("merge_count")),
    confidenceAvg: nullableColumn(S.String).pipe(pg.numeric(4, 3), pg.columnName("confidence_avg")),

    // Temporal tracking
    firstSeenAt: nullableColumn(S.Date).pipe(
      pg.timestamp({ mode: "date" }),
      pg.defaultNow(),
      pg.columnName("first_seen_at")
    ),
    lastSeenAt: nullableColumn(S.Date).pipe(
      pg.timestamp({ mode: "date" }),
      pg.defaultNow(),
      pg.columnName("last_seen_at")
    ),
    createdAt: nullableCreatedAt,
    updatedAt: nullableUpdatedAt,
  },
  (table) => [
    pg.Table.uniqueIndex("canonical_entities_ontology_iri_unique", [table.ontologyId, table.iri]),
    pg.Table.index("idx_canonical_entities_iri", [table.iri]),
    pg.Table.index("idx_canonical_entities_ontology_id", [table.ontologyId]),
    pg.Table.index("idx_canonical_entities_ontology_iri", [table.ontologyId, table.iri]),
    // Note: HNSW, GIN indexes are created in migration SQL as Drizzle doesn't support them natively
  ]
) {}

const CanonicalEntitiesReference: {
  readonly tableName: "canonical_entities";
  readonly entityType: "CanonicalEntities";
} = {
  tableName: "canonical_entities",
  entityType: "CanonicalEntities",
};
const canonicalEntityReferenceId = S.String.pipe(pg.uuid());

/**
 * Entity Aliases
 *
 * **Details**
 *
 * Alternative mentions mapped to canonical entities.
 * Preserves provenance of how each mention was resolved.
 *
 * **Example** (Name the alias mention and canonical entity)
 *
 * ```ts
 * import { EntityAliases } from "@effect-ontology/Repository/schema"
 *
 * console.log("mentionNormalized" in EntityAliases.fields) // true
 * console.log("canonicalEntityId" in EntityAliases.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class EntityAliases extends Model<EntityAliases>("EntityAliases")(
  {
    id: generatedUuidPrimaryKey,

    // Ontology scoping (aliases are scoped per ontology)
    ontologyId: defaultOntologyId,

    canonicalEntityId: canonicalEntityReferenceId.pipe(
      pg.references(CanonicalEntitiesReference, { onDelete: "cascade" }),
      pg.columnName("canonical_entity_id")
    ),

    // Alias data
    mention: S.String.pipe(pg.text()),
    mentionNormalized: S.String.pipe(pg.text(), pg.columnName("mention_normalized")),
    embedding: NullableEmbeddingVector768,

    // Resolution metadata
    resolutionMethod: S.String.pipe(pg.text(), pg.columnName("resolution_method")),
    resolutionConfidence: S.String.pipe(pg.numeric(4, 3), pg.columnName("resolution_confidence")),

    // Source tracking
    firstBatchId: nullableColumn(S.String).pipe(pg.text(), pg.columnName("first_batch_id")),
    sourceArticleId: nullableColumn(S.String).pipe(
      pg.uuid(),
      pg.references(ArticlesReference),
      pg.columnName("source_article_id")
    ),

    // Temporal
    createdAt: nullableCreatedAt,
  },
  (table) => [
    pg.Table.uniqueIndex("idx_entity_aliases_ontology_mention", [table.ontologyId, table.mentionNormalized]),
    pg.Table.index("idx_entity_aliases_canonical", [table.canonicalEntityId]),
    pg.Table.index("idx_entity_aliases_ontology", [table.ontologyId]),
  ]
) {}

/**
 * Entity Blocking Tokens
 *
 * **Details**
 *
 * Inverted index for fast candidate retrieval during entity resolution.
 * Avoids O(n) scan by pre-indexing tokens from entity mentions.
 *
 * **Example** (Name the blocking token)
 *
 * ```ts
 * import { EntityBlockingTokens } from "@effect-ontology/Repository/schema"
 *
 * console.log("token" in EntityBlockingTokens.fields) // true
 * console.log("canonicalEntityId" in EntityBlockingTokens.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class EntityBlockingTokens extends Model<EntityBlockingTokens>("EntityBlockingTokens")(
  {
    id: generatedUuidPrimaryKey,

    // Ontology scoping (tokens are scoped per ontology)
    ontologyId: defaultOntologyId,

    canonicalEntityId: canonicalEntityReferenceId.pipe(
      pg.references(CanonicalEntitiesReference, {
        name: "entity_blocking_tokens_Sx4xpmtdQjTC_fkey",
        onDelete: "cascade",
      }),
      pg.columnName("canonical_entity_id")
    ),
    token: S.String.pipe(pg.text()),
    tokenType: nullableColumn(S.String).pipe(pg.text(), pg.default("mention"), pg.columnName("token_type")),
  },
  (table) => [
    pg.Table.index("idx_blocking_tokens_token", [table.token]),
    pg.Table.index("idx_blocking_tokens_entity", [table.canonicalEntityId]),
    pg.Table.index("idx_blocking_tokens_ontology_token", [table.ontologyId, table.token]),
    pg.Table.index("idx_blocking_tokens_composite", [table.ontologyId, table.token, table.canonicalEntityId]),
  ]
) {}

const EntityRegistrySchema = pg.schema({
  articles: Articles,
  batch_runs: BatchRuns,
  canonical_entities: CanonicalEntities,
  entity_aliases: EntityAliases,
  entity_blocking_tokens: EntityBlockingTokens,
});

/**
 * Drizzle table projected from {@link BatchRuns}.
 *
 * **Example** (Inspect the batch identifier column)
 *
 * ```ts
 * import { batchRuns } from "@effect-ontology/Repository/schema"
 *
 * console.log(batchRuns.batchId.name) // "batch_id"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const batchRuns = EntityRegistrySchema.tables.batch_runs;

/**
 * Drizzle table projected from {@link CanonicalEntities}.
 *
 * **Example** (Inspect the ontology column)
 *
 * ```ts
 * import { canonicalEntities } from "@effect-ontology/Repository/schema"
 *
 * console.log(canonicalEntities.ontologyId.name) // "ontology_id"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const canonicalEntities = EntityRegistrySchema.tables.canonical_entities;

/**
 * Drizzle table projected from {@link EntityAliases}.
 *
 * **Example** (Inspect the canonical-entity reference column)
 *
 * ```ts
 * import { entityAliases } from "@effect-ontology/Repository/schema"
 *
 * console.log(entityAliases.canonicalEntityId.name) // "canonical_entity_id"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const entityAliases = EntityRegistrySchema.tables.entity_aliases;

/**
 * Drizzle table projected from {@link EntityBlockingTokens}.
 *
 * **Example** (Inspect the blocking-token column)
 *
 * ```ts
 * import { entityBlockingTokens } from "@effect-ontology/Repository/schema"
 *
 * console.log(entityBlockingTokens.token.name) // "token"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const entityBlockingTokens = EntityRegistrySchema.tables.entity_blocking_tokens;

// =============================================================================
// Type Exports for Drizzle
// =============================================================================

/**
 * Select row decoded from {@link Articles}.
 *
 * @see {@link Articles} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type ArticleRow = Articles;
/**
 * Insert payload accepted by {@link Articles}.
 *
 * @see {@link Articles} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type ArticleInsertRow = typeof Articles.insert.Type;

/**
 * Select row decoded from {@link Claims}.
 *
 * @see {@link Claims} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimRow = Claims;
/**
 * Insert payload accepted by {@link Claims}.
 *
 * @see {@link Claims} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimInsertRow = typeof Claims.insert.Type;

/**
 * Select row decoded from {@link Corrections}.
 *
 * @see {@link Corrections} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionRow = Corrections;
/**
 * Insert payload accepted by {@link Corrections}.
 *
 * @see {@link Corrections} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionInsertRow = typeof Corrections.insert.Type;

/**
 * Select row decoded from {@link CorrectionClaims}.
 *
 * @see {@link CorrectionClaims} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionClaimRow = CorrectionClaims;
/**
 * Insert payload accepted by {@link CorrectionClaims}.
 *
 * @see {@link CorrectionClaims} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionClaimInsertRow = typeof CorrectionClaims.insert.Type;

/**
 * Select row decoded from {@link Conflicts}.
 *
 * @see {@link Conflicts} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type ConflictRow = Conflicts;
/**
 * Insert payload accepted by {@link Conflicts}.
 *
 * @see {@link Conflicts} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type ConflictInsertRow = typeof Conflicts.insert.Type;

/**
 * Select row decoded from {@link BatchRuns}.
 *
 * @see {@link BatchRuns} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type BatchRunRow = BatchRuns;
/**
 * Insert payload accepted by {@link BatchRuns}.
 *
 * @see {@link BatchRuns} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type BatchRunInsertRow = typeof BatchRuns.insert.Type;

/**
 * Select row decoded from {@link CanonicalEntities}.
 *
 * @see {@link CanonicalEntities} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type CanonicalEntityRow = CanonicalEntities;
/**
 * Insert payload accepted by {@link CanonicalEntities}.
 *
 * @see {@link CanonicalEntities} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type CanonicalEntityInsertRow = typeof CanonicalEntities.insert.Type;

/**
 * Select row decoded from {@link EntityAliases}.
 *
 * @see {@link EntityAliases} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type EntityAliasRow = EntityAliases;
/**
 * Insert payload accepted by {@link EntityAliases}.
 *
 * @see {@link EntityAliases} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type EntityAliasInsertRow = typeof EntityAliases.insert.Type;

/**
 * Select row decoded from {@link EntityBlockingTokens}.
 *
 * @see {@link EntityBlockingTokens} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type EntityBlockingTokenRow = EntityBlockingTokens;
/**
 * Insert payload accepted by {@link EntityBlockingTokens}.
 *
 * @see {@link EntityBlockingTokens} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type EntityBlockingTokenInsertRow = typeof EntityBlockingTokens.insert.Type;

// =============================================================================
// Ingested Links Tables (Link Ingestion Pipeline)
// =============================================================================

const LinkBatchLifecycleStatus = S.Literals(["pending", "running", "completed", "failed"]);
const LinkBatchItemLifecycleStatus = S.Literals(["pending", "processing", "completed", "failed"]);
const StringArrayJson = S.Array(S.String);
const UnknownRecordJson = S.Record(S.String, S.Unknown);

/**
 * Ingested Links
 *
 * **Details**
 *
 * Tracks URLs fetched via Jina Reader API for extraction.
 * Content is stored in GCS/local; this table holds metadata.
 *
 * **Example** (Name the content-addressed hash)
 *
 * ```ts
 * import { IngestedLinks } from "@effect-ontology/Repository/schema"
 *
 * console.log("contentHash" in IngestedLinks.fields) // true
 * console.log("status" in IngestedLinks.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class IngestedLinks extends Model<IngestedLinks>("IngestedLinks")(
  {
    id: generatedUuidPrimaryKey,

    // Content identification (content-addressed, unique per ontology)
    contentHash: S.String.pipe(pg.varchar(64), pg.columnName("content_hash")),

    // Ontology scoping
    ontologyId: S.String.pipe(pg.text(), pg.columnName("ontology_id")),

    // Source information
    sourceUri: nullableColumn(S.String).pipe(pg.text(), pg.columnName("source_uri")),
    sourceType: nullableColumn(S.String).pipe(pg.varchar(32), pg.columnName("source_type")),

    // Enriched metadata
    headline: nullableColumn(S.String).pipe(pg.text()),
    description: nullableColumn(S.String).pipe(pg.text()),
    publishedAt: nullableColumn(S.Date).pipe(pg.timestamp({ mode: "date" }), pg.columnName("published_at")),
    author: nullableColumn(S.String).pipe(pg.text()),
    organization: nullableColumn(S.String).pipe(pg.text()),
    language: nullableColumn(S.String).pipe(pg.varchar(8), pg.default("en")),

    // Topics and entities (JSONB for flexibility)
    topics: nullableColumn(StringArrayJson).pipe(pg.jsonb(), pg.default([])),
    keyEntities: nullableColumn(StringArrayJson).pipe(pg.jsonb(), pg.default([]), pg.columnName("key_entities")),

    // Storage location
    storageUri: S.String.pipe(pg.text(), pg.columnName("storage_uri")),

    // Processing status
    status: LinkStatus.pipe(pg.varchar(16), pg.default("pending")),

    // Timestamps
    fetchedAt: S.Date.pipe(pg.timestamp({ mode: "date" }), pg.defaultNow(), pg.columnName("fetched_at")),
    enrichedAt: nullableColumn(S.Date).pipe(pg.timestamp({ mode: "date" }), pg.columnName("enriched_at")),
    processedAt: nullableColumn(S.Date).pipe(pg.timestamp({ mode: "date" }), pg.columnName("processed_at")),

    // Error tracking
    errorMessage: nullableColumn(S.String).pipe(pg.text(), pg.columnName("error_message")),

    // Content stats
    wordCount: nullableColumn(S.Int).pipe(pg.integer(), pg.columnName("word_count")),

    // Metadata
    metadata: nullableColumn(UnknownRecordJson).pipe(pg.jsonb(), pg.default({})),

    // Lifecycle
    createdAt: nullableCreatedAt,
    updatedAt: nullableUpdatedAt,
  },
  (table) => [
    pg.Table.index("idx_ingested_links_status", [table.status]),
    pg.Table.index("idx_ingested_links_source_uri", [table.sourceUri]),
    pg.Table.index("idx_ingested_links_fetched_at", [table.fetchedAt]),
    pg.Table.index("idx_ingested_links_source_type", [table.sourceType]),
    pg.Table.index("idx_ingested_links_organization", [table.organization]),
    pg.Table.index("idx_ingested_links_ontology_id", [table.ontologyId]),
    pg.Table.index("idx_ingested_links_ontology_status", [table.ontologyId, table.status]),
    // Composite unique: same content can exist in multiple ontologies
    pg.Table.uniqueIndex("idx_ingested_links_ontology_content_unique", [table.ontologyId, table.contentHash]),
    pg.Table.check(
      sql<boolean>`${table.status} IN ('pending', 'enriched', 'processing', 'processed', 'failed', 'skipped')`,
      "ingested_links_status_check"
    ),
  ]
) {}

/**
 * Link Batches
 *
 * **Details**
 *
 * Groups ingested links for batch extraction.
 *
 * **Example** (Name the link-batch status)
 *
 * ```ts
 * import { LinkBatches } from "@effect-ontology/Repository/schema"
 *
 * console.log("batchId" in LinkBatches.fields) // true
 * console.log("status" in LinkBatches.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class LinkBatches extends Model<LinkBatches>("LinkBatches")(
  {
    id: generatedUuidPrimaryKey,
    batchId: uniqueBatchId,

    // Status
    status: LinkBatchLifecycleStatus.pipe(pg.text(), pg.default("pending")),

    // Metrics
    linksTotal: nullableColumn(S.Int).pipe(pg.integer(), pg.default(0), pg.columnName("links_total")),
    linksProcessed: nullableColumn(S.Int).pipe(pg.integer(), pg.default(0), pg.columnName("links_processed")),
    linksFailed: nullableColumn(S.Int).pipe(pg.integer(), pg.default(0), pg.columnName("links_failed")),

    // Ontology
    ontologyUri: nullableColumn(S.String).pipe(pg.text(), pg.columnName("ontology_uri")),

    // Timing
    createdAt: nullableCreatedAt,
    ...executionTimingFields,
  },
  (table) => [
    pg.Table.index("idx_link_batches_status", [table.status]),
    pg.Table.check(
      sql<boolean>`${table.status} IN ('pending', 'running', 'completed', 'failed')`,
      "link_batches_status_check"
    ),
  ]
) {}

const LinkBatchesReference: { readonly tableName: "link_batches"; readonly entityType: "LinkBatches" } = {
  tableName: "link_batches",
  entityType: "LinkBatches",
};
const IngestedLinksReference: { readonly tableName: "ingested_links"; readonly entityType: "IngestedLinks" } = {
  tableName: "ingested_links",
  entityType: "IngestedLinks",
};

/**
 * Link Batch Items Junction
 *
 * **Details**
 *
 * Links ingested_links to batches.
 *
 * **Example** (Name the batch and link foreign keys)
 *
 * ```ts
 * import { LinkBatchItems } from "@effect-ontology/Repository/schema"
 *
 * console.log("batchId" in LinkBatchItems.fields) // true
 * console.log("linkId" in LinkBatchItems.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class LinkBatchItems extends Model<LinkBatchItems>("LinkBatchItems")(
  {
    batchId: S.String.pipe(
      pg.uuid(),
      pg.references(LinkBatchesReference, {
        name: "link_batch_items_batch_id_link_batches_id_fkey",
        onDelete: "cascade",
      }),
      pg.columnName("batch_id")
    ),
    linkId: S.String.pipe(
      pg.uuid(),
      pg.references(IngestedLinksReference, {
        name: "link_batch_items_link_id_ingested_links_id_fkey",
        onDelete: "cascade",
      }),
      pg.columnName("link_id")
    ),

    // Item status
    status: LinkBatchItemLifecycleStatus.pipe(pg.text(), pg.default("pending")),

    // Result reference
    extractionRunId: nullableColumn(S.String).pipe(pg.text(), pg.columnName("extraction_run_id")),
    articleId: nullableColumn(S.String).pipe(pg.uuid(), pg.columnName("article_id")),

    // Timing
    ...executionTimingFields,
  },
  (table) => [
    pg.Table.compositePrimaryKey("link_batch_items_pkey", [table.batchId, table.linkId]),
    pg.Table.index("idx_link_batch_items_link", [table.linkId]),
    pg.Table.index("idx_link_batch_items_status", [table.status]),
    pg.Table.check(
      sql<boolean>`${table.status} IN ('pending', 'processing', 'completed', 'failed')`,
      "link_batch_items_status_check"
    ),
  ]
) {}

const LinkPersistenceSchema = pg.schema({
  ingested_links: IngestedLinks,
  link_batches: LinkBatches,
  link_batch_items: LinkBatchItems,
});

/**
 * Drizzle table projected from {@link IngestedLinks}.
 *
 * **Example** (Inspect the content-hash column)
 *
 * ```ts
 * import { ingestedLinks } from "@effect-ontology/Repository/schema"
 *
 * console.log(ingestedLinks.contentHash.name) // "content_hash"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const ingestedLinks = LinkPersistenceSchema.tables.ingested_links;

/**
 * Drizzle table projected from {@link LinkBatches}.
 *
 * **Example** (Inspect the batch status column)
 *
 * ```ts
 * import { linkBatches } from "@effect-ontology/Repository/schema"
 *
 * console.log(linkBatches.status.name) // "status"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const linkBatches = LinkPersistenceSchema.tables.link_batches;

/**
 * Drizzle table projected from {@link LinkBatchItems}.
 *
 * **Example** (Inspect the link reference column)
 *
 * ```ts
 * import { linkBatchItems } from "@effect-ontology/Repository/schema"
 *
 * console.log(linkBatchItems.linkId.name) // "link_id"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const linkBatchItems = LinkPersistenceSchema.tables.link_batch_items;

/**
 * Select row decoded from {@link IngestedLinks}.
 *
 * @see {@link IngestedLinks} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type IngestedLinkRow = IngestedLinks;
/**
 * Insert payload accepted by {@link IngestedLinks}.
 *
 * @see {@link IngestedLinks} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type IngestedLinkInsertRow = typeof IngestedLinks.insert.Type;

/**
 * Select row decoded from {@link LinkBatches}.
 *
 * @see {@link LinkBatches} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type LinkBatchRow = LinkBatches;
/**
 * Insert payload accepted by {@link LinkBatches}.
 *
 * @see {@link LinkBatches} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type LinkBatchInsertRow = typeof LinkBatches.insert.Type;

/**
 * Select row decoded from {@link LinkBatchItems}.
 *
 * @see {@link LinkBatchItems} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type LinkBatchItemRow = LinkBatchItems;
/**
 * Insert payload accepted by {@link LinkBatchItems}.
 *
 * @see {@link LinkBatchItems} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type LinkBatchItemInsertRow = typeof LinkBatchItems.insert.Type;

// =============================================================================
// LLM Examples Table (Few-Shot Learning)
// =============================================================================

const LlmExampleType = S.Literals(["entity_extraction", "relation_extraction", "entity_linking", "negative"]);
const LlmExampleSource = S.Literals(["manual", "validated", "auto_generated"]);
const LlmPromptMessagesJson = S.Struct({ role: S.String, content: S.String }).pipe(S.Array);

/**
 * LLM Examples
 *
 * **Details**
 *
 * Stores curated examples for few-shot prompting. Examples are scoped per-ontology
 * and support hybrid retrieval (vector similarity + lexical search).
 *
 * **Example** (Name the few-shot task type)
 *
 * ```ts
 * import { LlmExamples } from "@effect-ontology/Repository/schema"
 *
 * console.log("exampleType" in LlmExamples.fields) // true
 * console.log("inputText" in LlmExamples.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class LlmExamples extends Model<LlmExamples>("LlmExamples")(
  {
    id: generatedUuidPrimaryKey,

    // Scoping
    ontologyId: S.String.pipe(pg.text(), pg.columnName("ontology_id")),
    exampleType: LlmExampleType.pipe(pg.text(), pg.columnName("example_type")),
    source: LlmExampleSource.pipe(pg.text(), pg.default("manual")),

    // Structured content
    inputText: S.String.pipe(pg.text(), pg.columnName("input_text")),
    targetClass: nullableColumn(S.String).pipe(pg.text(), pg.columnName("target_class")),
    targetPredicate: nullableColumn(S.String).pipe(pg.text(), pg.columnName("target_predicate")),
    evidenceText: nullableColumn(S.String).pipe(pg.text(), pg.columnName("evidence_text")),
    evidenceStartOffset: nullableColumn(S.Int).pipe(pg.integer(), pg.columnName("evidence_start_offset")),
    evidenceEndOffset: nullableColumn(S.Int).pipe(pg.integer(), pg.columnName("evidence_end_offset")),

    // Output
    expectedOutput: UnknownRecordJson.pipe(pg.jsonb(), pg.columnName("expected_output")),
    promptMessages: nullableColumn(LlmPromptMessagesJson).pipe(pg.jsonb(), pg.columnName("prompt_messages")),
    explanation: nullableColumn(S.String).pipe(pg.text()),

    // Embedding (768-dim Nomic with ontology prefix)
    embedding: EmbeddingVector768,

    // Negative example metadata
    isNegative: S.Boolean.pipe(pg.boolean(), pg.default(false), pg.columnName("is_negative")),
    negativePattern: nullableColumn(S.String).pipe(pg.text(), pg.columnName("negative_pattern")),

    // Quality metrics
    usageCount: nullableColumn(S.Int).pipe(pg.integer(), pg.default(0), pg.columnName("usage_count")),
    successRate: nullableColumn(S.String).pipe(pg.numeric(4, 3), pg.columnName("success_rate")),

    // Lifecycle
    createdAt: nullableColumn(S.Date).pipe(
      pg.timestamp({ mode: "date" }),
      pg.defaultNow(),
      pg.columnName("created_at")
    ),
    createdBy: nullableColumn(S.String).pipe(pg.text(), pg.columnName("created_by")),
    isActive: S.Boolean.pipe(pg.boolean(), pg.default(true), pg.columnName("is_active")),
  },
  (table) => [
    pg.Table.index("idx_llm_examples_ontology_type", [table.ontologyId, table.exampleType]),
    pg.Table.index("idx_llm_examples_ontology_active", [table.ontologyId, table.isActive]),
    pg.Table.index("idx_llm_examples_is_negative", [table.isNegative]),
    // Note: HNSW and GIN indexes are created in migration SQL
  ]
) {}

/**
 * Drizzle table projected from {@link LlmExamples}.
 *
 * **Example** (Inspect the example-type column)
 *
 * ```ts
 * import { llmExamples } from "@effect-ontology/Repository/schema"
 *
 * console.log(llmExamples.exampleType.name) // "example_type"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const llmExamples = pg.toPgTable(LlmExamples);

/**
 * Select row decoded from {@link LlmExamples}.
 *
 * @see {@link LlmExamples} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type LlmExampleRow = LlmExamples;
/**
 * Insert payload accepted by {@link LlmExamples}.
 *
 * @see {@link LlmExamples} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type LlmExampleInsertRow = typeof LlmExamples.insert.Type;

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
 * **Example** (Name the vector and owner columns)
 *
 * ```ts
 * import { Embeddings } from "@effect-ontology/Repository/schema"
 *
 * console.log("embedding" in Embeddings.fields) // true
 * console.log("entityType" in Embeddings.fields) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export class Embeddings extends Model<Embeddings>("Embeddings")(
  {
    id: generatedUuidPrimaryKey,
    entityType: S.Literals(["class", "entity", "claim", "example"]).pipe(pg.varchar(20), pg.columnName("entity_type")),
    entityId: S.NonEmptyString.pipe(pg.text(), pg.columnName("entity_id")),
    ontologyId: S.NonEmptyString.pipe(pg.text(), pg.defaultExpr(sql<string>`'default'`), pg.columnName("ontology_id")),
    embedding: EmbeddingVector768,
    contentText: S.NullOr(S.String).pipe(pg.text(), pg.columnName("content_text")),
    model: S.NonEmptyString.pipe(pg.text(), pg.defaultExpr(sql<string>`'nomic-embed-text-v1.5'`)),
    createdAt: S.NullOr(S.Date).pipe(pg.timestamp({ mode: "date" }), pg.defaultNow(), pg.columnName("created_at")),
    updatedAt: S.NullOr(S.Date).pipe(pg.timestamp({ mode: "date" }), pg.defaultNow(), pg.columnName("updated_at")),
  },
  (table) => [
    pg.Table.uniqueIndex("idx_embeddings_ontology_entity_unique", [table.ontologyId, table.entityType, table.entityId]),
    pg.Table.index("idx_embeddings_entity_type_idx", [table.entityType]),
    pg.Table.index("idx_embeddings_ontology_type_idx", [table.ontologyId, table.entityType]),
    pg.Table.check(
      sql<boolean>`${table.entityType} IN ('class', 'entity', 'claim', 'example')`,
      "embeddings_entity_type_check"
    ),
  ]
) {}

/**
 * Drizzle table projected from {@link Embeddings}.
 *
 * **Example** (Inspect embedding columns)
 *
 * ```ts
 * import { embeddings } from "@effect-ontology/Repository/schema"
 *
 * console.log(embeddings.embedding.name) // "embedding"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const embeddings = pg.toPgTable(Embeddings);

/**
 * Select row decoded from {@link Embeddings}.
 *
 * @see {@link Embeddings} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingRow = Embeddings;
/**
 * Insert payload accepted by {@link Embeddings}.
 *
 * @see {@link Embeddings} for the schema-first table model.
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingInsertRow = typeof Embeddings.insert.Type;
